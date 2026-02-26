#!/usr/bin/env python3
"""
Nova Act Browser Automation Service for Title AI Nova

Deploys autonomous browser agents via Amazon Nova Act + AgentCore Browser Tool
to navigate county recorder websites and extract title records.

Key improvement: county-specific prompts that guide the agent through
each county's unique search UI, with address parsing and fallback strategies.

Authentication: IAM credentials via environment variables or ~/.aws/credentials
  AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION=us-east-1

Run:
  pip install -r requirements.txt
  python main.py
"""

import os
import json
import re
import random
import time
import base64
import threading
import queue
import logging
import traceback
import sys
from datetime import datetime, timezone
from collections import deque
from flask import Flask, request, jsonify, Response, stream_with_context
from dataclasses import dataclass, asdict, field
from typing import Optional, List, Generator, Dict, Any, Tuple

# ─── Structured Logging ──────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
logger = logging.getLogger("nova-act-service")

app = Flask(__name__)

# ─── Nova Act SDK ─────────────────────────────────────────────────────────────

try:
    from nova_act import NovaAct, workflow
    NOVA_ACT_AVAILABLE = True
    logger.info("Nova Act SDK loaded successfully")
except ImportError:
    NOVA_ACT_AVAILABLE = False
    logger.warning("nova-act not installed. Run: pip install nova-act")

WORKFLOW_DEFINITION_NAME = "title"
MODEL_ID = "nova-act-latest"
MAX_STEPS = 50  # Up from 30 — county sites need more navigation

# ─── In-memory debug state ───────────────────────────────────────────────────

MAX_DEBUG_ENTRIES = 50

_recent_runs: deque = deque(maxlen=MAX_DEBUG_ENTRIES)
_active_sessions: Dict[str, dict] = {}
_lock = threading.Lock()


def _log_run(run_id: str, data: dict):
    """Append to debug history."""
    with _lock:
        entry = _active_sessions.get(run_id, {
            "run_id": run_id,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "events": [],
        })
        entry["events"].append({
            "ts": datetime.now(timezone.utc).isoformat(),
            **data,
        })
        _active_sessions[run_id] = entry


def _finish_run(run_id: str, status: str, error: Optional[str] = None):
    """Move run from active to recent."""
    with _lock:
        entry = _active_sessions.pop(run_id, {"run_id": run_id, "events": []})
        entry["finished_at"] = datetime.now(timezone.utc).isoformat()
        entry["status"] = status
        if error:
            entry["error"] = error
        _recent_runs.append(entry)


# ─── Address parsing ─────────────────────────────────────────────────────────

def parse_address(address: str) -> dict:
    """
    Parse a US address into components for county recorder form filling.
    Returns: { street_number, street_name, city, state, zip, full_street }
    """
    parts = {
        "street_number": "",
        "street_name": "",
        "city": "",
        "state": "",
        "zip": "",
        "full_street": "",
        "raw": address,
    }

    # Remove extra whitespace
    addr = " ".join(address.strip().split())

    # Try to split on comma: "123 Main St, Austin, TX 78701"
    segments = [s.strip() for s in addr.split(",")]

    if len(segments) >= 1:
        street = segments[0]
        parts["full_street"] = street
        # Extract street number
        m = re.match(r"^(\d+)\s+(.+)$", street)
        if m:
            parts["street_number"] = m.group(1)
            parts["street_name"] = m.group(2)

    if len(segments) >= 2:
        parts["city"] = segments[1].strip()

    if len(segments) >= 3:
        # "TX 78701" or "TX"
        state_zip = segments[2].strip()
        m = re.match(r"^([A-Z]{2})\s*(\d{5})?", state_zip)
        if m:
            parts["state"] = m.group(1)
            parts["zip"] = m.group(2) or ""

    return parts


# ─── County-specific configurations ──────────────────────────────────────────

@dataclass
class CountyConfig:
    """Configuration for how to search a specific county recorder site."""
    url: str
    search_type: str  # 'address', 'name', 'document', 'fulltext'
    search_prompt: str  # The actual prompt for the property_search step
    deed_nav_prompt: str  # How to navigate to deed history
    lien_search_prompt: str  # How to search for liens
    notes: str = ""  # Extra context for the agent


def _get_county_config(county: str, parsed_addr: dict) -> CountyConfig:
    """
    Return county-specific search configuration.
    Falls back to a generic full-text search strategy for unknown counties.
    """
    addr = parsed_addr
    street = addr["full_street"]
    street_num = addr["street_number"]
    street_name = addr["street_name"]
    city = addr["city"]
    raw = addr["raw"]

    configs = {
        "Travis County": CountyConfig(
            url="https://www.tccsearch.org/",
            search_type="name",
            search_prompt=(
                f"This is the Travis County Clerk search portal (tccsearch.org). "
                f"I need to find property records for {raw}. "
                f"Look for a search form. The site may have tabs or links for different search types "
                f"like 'Official Public Records', 'Real Property', or 'Document Search'. "
                f"Click on 'Official Public Records' or 'Real Property' if available. "
                f"If there is a search field for 'Name' or 'Grantor/Grantee', "
                f"type the street name '{street_name}' and search. "
                f"If there is a direct address or property search, use '{street}'. "
                f"Click the Search button to run the search."
            ),
            deed_nav_prompt=(
                f"Look at the search results. Find any result that matches the address "
                f"'{street}' or contains '{street_num}'. Click on that result to see its details. "
                f"If you see a list of documents, look for Warranty Deeds, Grant Deeds, "
                f"or Deeds of Trust. Click on one to see its full detail."
            ),
            lien_search_prompt=(
                f"Go back to the search page and search for liens. "
                f"Try searching for 'Tax Lien' or 'Judgment' in the document type filter "
                f"combined with the street '{street_name}'. "
                f"If there's no document type filter, just search for '{street_name} lien'."
            ),
            notes="Travis County uses tccsearch.org with OPR search. May require name-based search.",
        ),
        "Harris County": CountyConfig(
            url="https://www.cclerk.hctx.net/applications/websearch/RP.aspx",
            search_type="name",
            search_prompt=(
                f"This is the Harris County Clerk Real Property search page. "
                f"There should be search fields for searching by name or instrument. "
                f"In the name/search field, type '{street_name}' and click Search or Submit. "
                f"If you see date range fields, leave them at their defaults. "
                f"If there is a 'Search Type' dropdown, select 'Name' or 'Property'. "
                f"Click the Search button."
            ),
            deed_nav_prompt=(
                f"In the search results, look for records matching '{street}'. "
                f"Click on the most recent Warranty Deed or General Warranty Deed. "
                f"This will show the document details with grantor, grantee, and recording info."
            ),
            lien_search_prompt=(
                f"Search for liens against this property. "
                f"Go back to the search page and search for '{street_name}' "
                f"with document type 'Lien' or 'Tax Lien' if the filter is available."
            ),
        ),
        "Dallas County": CountyConfig(
            url="https://dallas.tx.publicsearch.us/",
            search_type="fulltext",
            search_prompt=(
                f"This is the Dallas County public search portal (publicsearch.us). "
                f"There should be a search bar at the top. "
                f"Type '{street}' into the search bar and press Enter or click Search. "
                f"This is a full-text search that accepts addresses directly."
            ),
            deed_nav_prompt=(
                f"In the search results, look for documents related to '{street}'. "
                f"Click on any Warranty Deed or Deed document to see its details. "
                f"Look for the grantor, grantee, recording date, and document number."
            ),
            lien_search_prompt=(
                f"Search for liens by typing '{street_name} lien' in the search bar, "
                f"or use any filters to narrow to 'Lien' document type."
            ),
        ),
        "Tarrant County": CountyConfig(
            url="https://tarrant.tx.publicsearch.us/",
            search_type="fulltext",
            search_prompt=(
                f"This is the Tarrant County public search portal (publicsearch.us). "
                f"Type '{street}' into the search bar and press Enter or click Search."
            ),
            deed_nav_prompt=(
                f"In the search results, find documents matching '{street}'. "
                f"Click on any Warranty Deed to see its details."
            ),
            lien_search_prompt=(
                f"Search for '{street_name} lien' or filter results by Lien document type."
            ),
        ),
        "Bexar County": CountyConfig(
            url="https://bexar.tx.publicsearch.us/",
            search_type="fulltext",
            search_prompt=(
                f"This is the Bexar County public search portal (publicsearch.us). "
                f"Type '{street}' into the search bar and press Enter or click Search."
            ),
            deed_nav_prompt=(
                f"Click on any Warranty Deed in the results matching '{street}'."
            ),
            lien_search_prompt=(
                f"Search for liens: type '{street_name} lien' in the search bar."
            ),
        ),
        "King County": CountyConfig(
            url="https://recordsearch.kingcounty.gov/LandmarkWeb/",
            search_type="name",
            search_prompt=(
                f"This is King County (WA) Recorder's office search. "
                f"Look for a search form. It may have options for 'Name Search', "
                f"'Document Number Search', or 'Recording Date Search'. "
                f"Use the name search and type '{street_name}'. "
                f"If there's an address search option, use '{street}'. "
                f"Click Search."
            ),
            deed_nav_prompt=(
                f"In the results, find records matching '{street}'. "
                f"Click on a Deed or Warranty Deed to see full details."
            ),
            lien_search_prompt=(
                f"Search for liens: look for Tax Lien or Judgment records "
                f"related to '{street_name}'."
            ),
        ),
        "Cook County": CountyConfig(
            url="https://ccrd.cookcountyil.gov/RecorderDeedsWeb/",
            search_type="name",
            search_prompt=(
                f"This is Cook County (IL) Recorder of Deeds search. "
                f"Look for search options — there may be tabs for 'PIN Search', "
                f"'Name Search', 'Address Search', or 'Document Search'. "
                f"Try 'Address Search' first and enter '{street}'. "
                f"If no address search, use Name Search with '{street_name}'. "
                f"Click Search."
            ),
            deed_nav_prompt=(
                f"In the results, find documents matching '{street}'. "
                f"Click on any Deed to see grantor, grantee, and recording info."
            ),
            lien_search_prompt=(
                f"Search for liens by looking for Tax Lien documents "
                f"related to '{street_name}' or the property PIN."
            ),
        ),
        "Maricopa County": CountyConfig(
            url="https://recorder.maricopa.gov/recdocdata/",
            search_type="name",
            search_prompt=(
                f"This is the Maricopa County (AZ) Recorder's document search. "
                f"Look for search fields. There may be options for 'Recording Number', "
                f"'Name', 'Legal', or 'Address'. "
                f"Try the Name or Address search with '{street_name}'. "
                f"If there is a date range, set it to the last 30 years. "
                f"Click Search or Submit."
            ),
            deed_nav_prompt=(
                f"In the results, click on a Warranty Deed matching '{street}' "
                f"to see the full document details."
            ),
            lien_search_prompt=(
                f"Search for liens: try searching for '{street_name}' "
                f"and filter by Lien document type if available."
            ),
        ),
        "Orange County": CountyConfig(
            url="https://cr.ocgov.com/recorderworks/",
            search_type="name",
            search_prompt=(
                f"This is Orange County (CA) Recorder search. "
                f"Look for search options — Name, Document Number, or Address. "
                f"Use '{street_name}' in the name or address field. "
                f"Click Search."
            ),
            deed_nav_prompt=(
                f"Click on a Grant Deed or Warranty Deed in the results "
                f"that matches '{street}'."
            ),
            lien_search_prompt=(
                f"Search for Tax Lien or Judgment records related to '{street_name}'."
            ),
        ),
        "San Diego County": CountyConfig(
            url="https://arcc.sdcounty.ca.gov/Pages/OfficialRecords.aspx",
            search_type="name",
            search_prompt=(
                f"This is San Diego County (CA) Official Records search. "
                f"Look for a grantor/grantee name search or document search. "
                f"Enter '{street_name}' in the search field. "
                f"Click Search."
            ),
            deed_nav_prompt=(
                f"In the results, click on a Grant Deed matching '{street}'."
            ),
            lien_search_prompt=(
                f"Search for Tax Lien or Mechanic's Lien documents "
                f"related to '{street_name}'."
            ),
        ),
        "Webb County": CountyConfig(
            url="https://countyfusion5.kofiletech.us/countyweb/login.do?countyname=WebbTX",
            search_type="fulltext",
            search_prompt=(
                f"This is the Webb County TX public records portal. "
                f"If there is a login or guest access button, click 'Login as Guest' or 'Public Access' or similar. "
                f"Then look for a search option — search by name, address, or document type. "
                f"Search for property records related to '{raw}'. "
                f"Try the address '{street}' or the name on the deed. "
                f"If there is a date range, set it to cover the last 20 years. "
                f"Click Search."
            ),
            deed_nav_prompt=(
                f"In the results, click on any Warranty Deed, Deed of Trust, or Grant Deed "
                f"related to '{street}' or '{street_name}'."
            ),
            lien_search_prompt=(
                f"Search for Tax Lien, Judgment, or Mechanic's Lien records "
                f"related to '{street_name}' in Webb County."
            ),
        ),
    }

    if county in configs:
        return configs[county]

    # Generic fallback for unknown counties
    from urllib.parse import quote_plus
    return CountyConfig(
        url=f"https://www.google.com/search?q={quote_plus(county)}+recorder+property+search",
        search_type="fulltext",
        search_prompt=(
            f"Search for property records for '{raw}' in {county}. "
            f"If you see a search form, try typing the address '{street}' "
            f"or the street name '{street_name}' and clicking Search. "
            f"If you see search type options, try 'Address' or 'Property' first."
        ),
        deed_nav_prompt=(
            f"Click on any result related to '{street}' "
            f"that appears to be a deed or property record."
        ),
        lien_search_prompt=(
            f"Search for liens against '{street_name}' in {county}."
        ),
        notes=f"Unknown county — using generic search strategy for {county}",
    )


# ─── Data classes ─────────────────────────────────────────────────────────────

@dataclass
class TitleSearchResult:
    address: str
    county: str
    ownership_chain: List[dict]
    liens: List[dict]
    parcel_id: Optional[str]
    legal_description: Optional[str]
    source: str


# ─── SSE helpers ──────────────────────────────────────────────────────────────

def sse(event_type: str, payload: dict) -> str:
    return f"data: {json.dumps({'type': event_type, **payload})}\n\n"


def _take_screenshot(nova, run_id: str, label: str) -> Optional[str]:
    """Take a JPEG screenshot, log success/failure."""
    try:
        page = nova.get_page()
        png_bytes = page.screenshot(type="jpeg", quality=55, full_page=False)
        b64 = base64.b64encode(png_bytes).decode("utf-8")
        logger.info(f"[{run_id}] Screenshot captured: {label} ({len(png_bytes)} bytes)")
        _log_run(run_id, {"event": "screenshot", "label": label, "size_bytes": len(png_bytes)})
        return b64
    except Exception as e:
        logger.warning(f"[{run_id}] Screenshot failed for '{label}': {type(e).__name__}: {e}")
        _log_run(run_id, {"event": "screenshot_failed", "label": label, "error": str(e)})
        return None


# ─── Real Nova Act streaming with county-specific prompts ────────────────────

def _nova_act_stream(address: str, county: str, run_id: str) -> Generator[str, None, None]:
    """
    Real Nova Act via AgentCore Browser Tool — cloud-hosted browser.
    Uses county-specific prompts for accurate form interaction.
    Streams SSE events with detailed error context at every step.
    """
    parsed_addr = parse_address(address)
    config = _get_county_config(county, parsed_addr)

    logger.info(f"[{run_id}] County config: url={config.url}, search_type={config.search_type}")
    if config.notes:
        logger.info(f"[{run_id}] Notes: {config.notes}")

    result_holder: dict = {}
    live_view_url_holder: List[str] = []
    event_queue: queue.Queue = queue.Queue()
    SENTINEL = "__THREAD_DONE__"

    step_timings: List[dict] = []

    def _timed_step(step_name: str):
        return {"name": step_name, "start": time.time()}

    def _end_step(step_info: dict, success: bool = True, error: Optional[str] = None):
        elapsed = time.time() - step_info["start"]
        step_info["elapsed_s"] = round(elapsed, 2)
        step_info["success"] = success
        if error:
            step_info["error"] = error
        step_timings.append(step_info)
        _log_run(run_id, {"event": "step_complete", **step_info})
        logger.info(f"[{run_id}] Step '{step_info['name']}' completed in {elapsed:.1f}s (success={success})")

    def _browser_thread():
        ownership_chain: List[dict] = []
        liens: List[dict] = []
        parcel_id: Optional[str] = None
        legal_description: Optional[str] = None
        browser_client = None
        current_step = "init"
        search_succeeded = False

        try:
            from pydantic import BaseModel
            from bedrock_agentcore.tools.browser_client import BrowserClient

            # ── Start browser session ────────────────────────────
            current_step = "browser_start"
            step = _timed_step("browser_start")
            logger.info(f"[{run_id}] Starting AgentCore Browser session...")

            browser_client = BrowserClient(region=os.getenv("AWS_REGION", "us-east-1"))
            session_id = browser_client.start(
                session_timeout_seconds=300,
                viewport={"width": 1440, "height": 900},
            )
            logger.info(f"[{run_id}] Browser session started: {session_id}")
            _log_run(run_id, {"event": "browser_started", "session_id": session_id})
            _end_step(step)

            # ── Generate live view URL ───────────────────────────
            try:
                live_url = browser_client.generate_live_view_url(expires=300)
                live_view_url_holder.append(live_url)
                logger.info(f"[{run_id}] Live view URL generated")
                _log_run(run_id, {"event": "live_view_url", "url": live_url[:80] + "..."})
            except Exception as e:
                logger.warning(f"[{run_id}] Live view URL failed: {type(e).__name__}: {e}")

            # ── Get CDP connection ───────────────────────────────
            current_step = "cdp_connect"
            step = _timed_step("cdp_connect")
            ws_url, ws_headers = browser_client.generate_ws_headers()
            logger.info(f"[{run_id}] CDP WebSocket URL obtained")
            _end_step(step)

            # ── Nova Act workflow ─────────────────────────────────
            @workflow(
                workflow_definition_name=WORKFLOW_DEFINITION_NAME,
                model_id=MODEL_ID,
                boto_session_kwargs={"region_name": os.getenv("AWS_REGION", "us-east-1")},
            )
            def _run():
                nonlocal ownership_chain, liens, parcel_id, legal_description, current_step, search_succeeded

                with NovaAct(
                    starting_page=config.url,
                    cdp_endpoint_url=ws_url,
                    cdp_headers=ws_headers,
                ) as nova:

                    # Step 1: Search for property (county-specific prompt) ──
                    current_step = "property_search"
                    step1 = _timed_step("property_search")
                    event_queue.put(("progress", {
                        "step": "retrieval",
                        "message": f"Searching {county} records at {config.url}...",
                    }))
                    logger.info(f"[{run_id}] Step: property_search — using county-specific prompt for {county}")
                    logger.info(f"[{run_id}] Prompt: {config.search_prompt[:200]}...")

                    search_succeeded = False
                    try:
                        nova.act(config.search_prompt, max_steps=MAX_STEPS)
                        search_succeeded = True
                        _end_step(step1)
                    except Exception as e:
                        _end_step(step1, success=False, error=f"{type(e).__name__}: {e}")
                        logger.warning(f"[{run_id}] Primary search failed: {e}")

                        # Fallback: try a simpler search prompt
                        event_queue.put(("progress", {
                            "step": "retrieval",
                            "message": "Primary search failed — trying simplified search...",
                        }))
                        try:
                            fallback_step = _timed_step("property_search_fallback")
                            nova.act(
                                f"Look for any search field or text box on this page. "
                                f"Type '{parsed_addr['full_street']}' into it and press Enter or click Search.",
                                max_steps=20,
                            )
                            search_succeeded = True
                            _end_step(fallback_step)
                            logger.info(f"[{run_id}] Fallback search succeeded")
                        except Exception as e2:
                            _end_step(fallback_step, success=False, error=str(e2))
                            logger.warning(f"[{run_id}] Fallback search also failed: {e2}")
                            event_queue.put(("error", {
                                "step": "retrieval",
                                "message": f"Could not complete property search: {e2}",
                            }))

                    # Take screenshot regardless of success
                    shot = _take_screenshot(nova, run_id, "Search results")
                    if shot:
                        event_queue.put(("screenshot", {"label": "Search results", "step": "retrieval", "data": shot}))

                    if not search_succeeded:
                        # Even if search failed, try to extract whatever is on screen
                        event_queue.put(("progress", {
                            "step": "retrieval",
                            "message": "Attempting to extract any visible property data...",
                        }))

                    # Step 2: Extract parcel info ──────────────────
                    current_step = "parcel_extract"
                    step2 = _timed_step("parcel_extract")
                    logger.info(f"[{run_id}] Step: parcel_extract")

                    class ParcelInfo(BaseModel):
                        parcel_id: str = ""
                        legal_description: str = ""

                    try:
                        parcel_result = nova.act_get(
                            "Look at the current page. Find and extract: "
                            "1) Any parcel ID, APN, instrument number, or property identifier. "
                            "2) Any legal description of the property. "
                            "Return empty strings if not found.",
                            schema=ParcelInfo.model_json_schema(),
                            max_steps=10,
                        )
                        if parcel_result.parsed_response:
                            info = ParcelInfo.model_validate(parcel_result.parsed_response)
                            parcel_id = info.parcel_id or None
                            legal_description = info.legal_description or None
                            logger.info(f"[{run_id}] Parcel ID: {parcel_id}")
                        _end_step(step2)
                    except Exception as e:
                        _end_step(step2, success=False, error=str(e))
                        logger.warning(f"[{run_id}] parcel_extract failed: {e}")
                        # Non-fatal — continue

                    # Step 3: Navigate to deed history (county-specific) ───
                    current_step = "deed_navigation"
                    step3 = _timed_step("deed_navigation")
                    event_queue.put(("progress", {"step": "chain", "message": "Navigating to deed history..."}))
                    logger.info(f"[{run_id}] Step: deed_navigation")

                    deed_nav_succeeded = False
                    try:
                        nova.act(config.deed_nav_prompt, max_steps=MAX_STEPS)
                        deed_nav_succeeded = True
                        _end_step(step3)
                    except Exception as e:
                        _end_step(step3, success=False, error=str(e))
                        logger.warning(f"[{run_id}] deed_navigation failed: {e}")
                        event_queue.put(("progress", {
                            "step": "chain",
                            "message": "Could not navigate to deed history — extracting visible data...",
                        }))
                        # Non-fatal — try to extract what we can see

                    shot = _take_screenshot(nova, run_id, "Deed history")
                    if shot:
                        event_queue.put(("screenshot", {"label": "Deed history", "step": "chain", "data": shot}))

                    # Step 4: Extract chain of title ───────────────
                    current_step = "chain_extract"
                    step4 = _timed_step("chain_extract")
                    logger.info(f"[{run_id}] Step: chain_extract")

                    class DeedRecord(BaseModel):
                        date: str = ""
                        grantor: str = ""
                        grantee: str = ""
                        documentType: str = ""
                        documentNumber: str = ""

                    class DeedHistory(BaseModel):
                        deeds: List[DeedRecord] = []

                    try:
                        deed_result = nova.act_get(
                            "Look at the current page carefully. Extract every deed and ownership "
                            "transfer record you can see. For each record, extract: "
                            "the recording date, grantor (seller/transferor), grantee (buyer/transferee), "
                            "document type (e.g. Warranty Deed, Grant Deed, Deed of Trust), "
                            "and document/instrument number. List them from oldest to newest. "
                            "If you see a table or list of documents, extract all visible rows.",
                            schema=DeedHistory.model_json_schema(),
                            max_steps=15,
                        )
                        if deed_result.parsed_response:
                            history = DeedHistory.model_validate(deed_result.parsed_response)
                            ownership_chain = [d.model_dump() for d in history.deeds]
                            logger.info(f"[{run_id}] Extracted {len(ownership_chain)} deed records")
                            event_queue.put(("progress", {
                                "step": "chain",
                                "message": f"Found {len(ownership_chain)} deed record(s).",
                            }))
                        _end_step(step4)
                    except Exception as e:
                        _end_step(step4, success=False, error=str(e))
                        logger.warning(f"[{run_id}] chain_extract failed: {e}")
                        # Non-fatal — we'll return whatever we have

                    # Step 5: Search for liens (county-specific) ───
                    current_step = "lien_search"
                    step5 = _timed_step("lien_search")
                    event_queue.put(("progress", {"step": "liens", "message": "Scanning for liens and encumbrances..."}))
                    logger.info(f"[{run_id}] Step: lien_search")

                    try:
                        nova.act(config.lien_search_prompt, max_steps=MAX_STEPS)
                        _end_step(step5)
                    except Exception as e:
                        _end_step(step5, success=False, error=str(e))
                        logger.warning(f"[{run_id}] Lien search failed: {e}")
                        # Non-fatal

                    shot = _take_screenshot(nova, run_id, "Lien search")
                    if shot:
                        event_queue.put(("screenshot", {"label": "Lien search", "step": "liens", "data": shot}))

                    # Step 6: Extract liens ────────────────────────
                    current_step = "lien_extract"
                    step6 = _timed_step("lien_extract")
                    logger.info(f"[{run_id}] Step: lien_extract")

                    class LienRecord(BaseModel):
                        type: str = ""
                        claimant: str = ""
                        amount: str = ""
                        dateRecorded: str = ""
                        status: str = "Unknown"
                        priority: str = "Medium"

                    class LienList(BaseModel):
                        liens: List[LienRecord] = []

                    try:
                        lien_result = nova.act_get(
                            "Look at the current page. Extract all liens, tax notices, judgments, "
                            "encumbrances, or mortgage records you can see. "
                            "For each: type, claimant/holder, amount, date recorded, status, priority. "
                            "Return an empty list if none are visible.",
                            schema=LienList.model_json_schema(),
                            max_steps=10,
                        )
                        if lien_result.parsed_response:
                            lien_list = LienList.model_validate(lien_result.parsed_response)
                            liens = [l.model_dump() for l in lien_list.liens]
                            logger.info(f"[{run_id}] Extracted {len(liens)} liens")
                        _end_step(step6)
                    except Exception as e:
                        _end_step(step6, success=False, error=str(e))
                        logger.warning(f"[{run_id}] Lien extraction failed: {e}")
                        # Non-fatal

            _run()

            # Even if some steps failed, count as success if we got ANY data
            has_data = len(ownership_chain) > 0 or len(liens) > 0 or parcel_id
            result_holder["success"] = has_data
            result_holder["partial"] = not (len(ownership_chain) > 0 and search_succeeded)
            result_holder["ownership_chain"] = ownership_chain
            result_holder["liens"] = liens
            result_holder["parcel_id"] = parcel_id
            result_holder["legal_description"] = legal_description
            result_holder["source"] = "nova_act_agentcore"
            result_holder["step_timings"] = step_timings
            logger.info(f"[{run_id}] Workflow completed: {len(ownership_chain)} deeds, {len(liens)} liens (success={has_data})")

        except Exception as e:
            tb = traceback.format_exc()
            logger.error(f"[{run_id}] Browser thread FAILED at step '{current_step}':\n{tb}")
            result_holder["success"] = False
            result_holder["error"] = f"[{current_step}] {type(e).__name__}: {e}"
            result_holder["traceback"] = tb
            result_holder["failed_step"] = current_step
            result_holder["step_timings"] = step_timings
            event_queue.put(("error", {
                "step": current_step,
                "message": f"Browser agent failed at '{current_step}': {type(e).__name__}: {e}",
            }))
        finally:
            if browser_client:
                try:
                    browser_client.stop()
                    logger.info(f"[{run_id}] Browser session stopped")
                except Exception as e:
                    logger.warning(f"[{run_id}] Failed to stop browser session: {e}")
            event_queue.put(SENTINEL)

    # ── Start streaming ───────────────────────────────────────
    yield sse("progress", {
        "step": "lookup",
        "message": f"Starting cloud browser for {county} ({config.search_type} search)...",
    })
    _log_run(run_id, {
        "event": "stream_started",
        "address": address,
        "county": county,
        "county_url": config.url,
        "search_type": config.search_type,
    })

    t = threading.Thread(target=_browser_thread, daemon=True)
    t.start()

    # Wait for live view URL (max 20s)
    deadline = time.time() + 20
    while time.time() < deadline and not live_view_url_holder:
        time.sleep(0.5)
    if live_view_url_holder:
        yield sse("live_view", {"url": live_view_url_holder[0]})
        yield sse("progress", {"step": "retrieval", "message": f"Cloud browser live — navigating to {county} recorder..."})

    # Stream events from the queue
    screenshots_collected: List[dict] = []
    last_event_time = time.time()
    heartbeat_count = 0
    while True:
        try:
            item = event_queue.get(timeout=10)
            last_event_time = time.time()
        except queue.Empty:
            if not t.is_alive():
                logger.warning(f"[{run_id}] Browser thread died without sending SENTINEL")
                break
            # 5-minute inactivity timeout (steps can take 2+ min each)
            if time.time() - last_event_time > 300:
                logger.error(f"[{run_id}] No events for 5 minutes — aborting")
                yield sse("error", {"step": "timeout", "message": "Browser agent timed out after 5 minutes of inactivity"})
                break
            # Send heartbeat so the SSE connection stays alive
            heartbeat_count += 1
            elapsed = int(time.time() - last_event_time)
            yield sse("progress", {"step": "retrieval", "message": f"Browser agent working... ({elapsed}s elapsed)"})
            continue

        if item == SENTINEL:
            break

        event_type, payload = item
        if event_type == "screenshot":
            screenshots_collected.append(payload)
        yield sse(event_type, payload)

    # ── Emit result or error (NO fake simulation data) ─────────
    if not result_holder.get("success"):
        error_msg = result_holder.get("error", "timeout or unknown error")
        failed_step = result_holder.get("failed_step", "unknown")
        logger.warning(f"[{run_id}] Browser agent failed at: {failed_step}. Error: {error_msg}")

        yield sse("error", {
            "step": failed_step,
            "message": f"Browser agent failed at '{failed_step}': {error_msg[:200]}",
        })

        if result_holder.get("step_timings"):
            yield sse("debug", {
                "step_timings": result_holder["step_timings"],
                "failed_step": failed_step,
            })

        # Return empty result with error — do NOT generate fake data
        ownership_chain = []
        liens = []
        parcel_id = None
        legal_description = None
        source = f"failed (browser agent error at {failed_step})"
        _finish_run(run_id, "failed", error_msg)

        yield sse("result", {
            "data": None,
            "error": f"Could not access {county} county records: {error_msg[:200]}",
            "failed_step": failed_step,
        })
        return
    else:
        ownership_chain = result_holder["ownership_chain"]
        liens = result_holder["liens"]
        parcel_id = result_holder["parcel_id"]
        legal_description = result_holder["legal_description"]
        source = result_holder["source"]
        if result_holder.get("partial"):
            source += " (partial)"

        yield sse("progress", {"step": "chain", "message": f"Extracted {len(ownership_chain)} deed record(s)."})
        yield sse("progress", {"step": "liens", "message": f"Found {len(liens)} lien(s)."})

        if result_holder.get("step_timings"):
            yield sse("debug", {"step_timings": result_holder["step_timings"]})

        _finish_run(run_id, "success")

    yield sse("progress", {"step": "risk", "message": "Running risk analysis on title data..."})
    yield sse("progress", {"step": "summary", "message": "Generating title report..."})
    yield sse("result", {
        "data": {
            "address": address,
            "county": county,
            "parcelId": parcel_id,
            "legalDescription": legal_description,
            "ownershipChain": ownership_chain,
            "liens": liens,
            "source": source,
            "screenshots": [{"label": s["label"], "step": s["step"]} for s in screenshots_collected],
        }
    })


# ─── Simulation ───────────────────────────────────────────────────────────────

def simulate_search(address: str, county: str) -> TitleSearchResult:
    """Realistic demo data for local development and demos."""
    current_year = datetime.now().year
    owner_pairs = [
        ("Sunset Realty LLC", "Johnson Family Trust"),
        ("Johnson Family Trust", "Robert & Mary Johnson"),
        ("First National Bank (Deed of Trust)", "Robert & Mary Johnson"),
        ("Johnson Family Trust", "First National Bank"),
    ]
    chain = []
    for i, (grantor, grantee) in enumerate(owner_pairs):
        year = current_year - (i * 4) - random.randint(0, 2)
        chain.append({
            "date": f"{year}-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}",
            "grantor": grantor,
            "grantee": grantee,
            "documentType": random.choice(["Warranty Deed", "Deed of Trust", "Grant Deed"]),
            "documentNumber": f"{current_year - i}-{random.randint(100000, 999999)}",
        })

    liens = []
    if random.random() > 0.4:
        liens.append({
            "type": "Tax",
            "claimant": f"{county.split()[0]} County Tax Authority",
            "amount": f"${random.randint(2000, 8000):,}",
            "dateRecorded": f"{current_year - 1}-01-15",
            "status": "Active",
            "priority": "High",
        })
    if random.random() > 0.7:
        liens.append({
            "type": "Mortgage",
            "claimant": "Quicken Loans / Rocket Mortgage",
            "amount": f"${random.randint(150000, 450000):,}",
            "dateRecorded": f"{current_year - 6}-{random.randint(1, 12):02d}-01",
            "status": "Active",
            "priority": "High",
        })

    return TitleSearchResult(
        address=address,
        county=county,
        ownership_chain=chain,
        liens=liens,
        parcel_id=f"{random.randint(1000000, 9999999)}",
        legal_description=(
            f"LOT {random.randint(1, 50)}, BLK {random.randint(1, 20)}, "
            f"{county.split()[0].upper()} GARDENS SUBDIVISION, {county.split()[0]} COUNTY"
        ),
        source="simulation",
    )


def _simulate_stream(address: str, county: str, run_id: str) -> Generator[str, None, None]:
    """Simulated streaming — mimics real Nova Act timing for demos."""
    logger.info(f"[{run_id}] Running in simulation mode")
    _log_run(run_id, {"event": "simulation_mode"})

    def _make_demo_screenshot() -> str:
        gray_jpeg = bytes([
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
            0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
            0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
            0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
            0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
            0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
            0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
            0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
            0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
            0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
            0x09, 0x0A, 0x0B, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F,
            0x00, 0x7B, 0x40, 0x1B, 0xFF, 0xD9
        ])
        return base64.b64encode(gray_jpeg).decode("utf-8")

    steps = [
        ("lookup",    1.2, f"Browser agent launching (simulation mode)..."),
        ("lookup",    0.8, f"Navigating to {county} recorder website..."),
        ("retrieval", 2.0, f'Searching county index for "{address}"...'),
        ("retrieval", 1.5, f"Property record found — opening deed history..."),
        ("chain",     2.5, f"Reading deed transfer records from recorder database..."),
        ("chain",     1.0, f"Extracting grantor/grantee chain of title..."),
        ("liens",     2.0, f"Scanning {county} tax lien database..."),
        ("liens",     1.5, f"Checking judgment and mechanic's lien records..."),
        ("risk",      1.8, f"Analyzing title exceptions and encumbrances..."),
        ("summary",   1.0, f"Generating executive summary and PDF report..."),
    ]

    screenshot_at = {"retrieval": "Search results page", "chain": "Deed history", "liens": "Lien records"}
    emitted_shots = set()

    for step_id, delay, message in steps:
        time.sleep(delay)
        yield sse("progress", {"step": step_id, "message": message})
        if step_id in screenshot_at and step_id not in emitted_shots:
            emitted_shots.add(step_id)
            shot = _make_demo_screenshot()
            yield sse("screenshot", {"label": screenshot_at[step_id], "step": step_id, "data": shot})

    sim = simulate_search(address, county)
    _finish_run(run_id, "success")
    yield sse("result", {
        "data": {
            "address": sim.address,
            "county": sim.county,
            "parcelId": sim.parcel_id,
            "legalDescription": sim.legal_description,
            "ownershipChain": sim.ownership_chain,
            "liens": sim.liens,
            "source": sim.source,
        }
    })


def run_nova_act_streaming(address: str, county: str, run_id: str) -> Generator[str, None, None]:
    """Dispatch to real or simulated stream."""
    aws_ready = NOVA_ACT_AVAILABLE and bool(
        os.getenv("AWS_ACCESS_KEY_ID") and os.getenv("AWS_SECRET_ACCESS_KEY")
    )
    if aws_ready:
        yield from _nova_act_stream(address, county, run_id)
    else:
        yield from _simulate_stream(address, county, run_id)


# ─── Flask routes ─────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    aws_configured = bool(
        os.getenv("AWS_ACCESS_KEY_ID") and os.getenv("AWS_SECRET_ACCESS_KEY")
    )
    with _lock:
        active_count = len(_active_sessions)
        recent_count = len(_recent_runs)
    return jsonify({
        "status": "ok",
        "nova_act_sdk": NOVA_ACT_AVAILABLE,
        "aws_credentials": aws_configured,
        "workflow": WORKFLOW_DEFINITION_NAME,
        "mode": "nova_act_workflow" if (NOVA_ACT_AVAILABLE and aws_configured) else "simulation",
        "active_sessions": active_count,
        "recent_runs": recent_count,
    })


@app.route("/debug", methods=["GET"])
def debug():
    """Return recent run history with step timings and errors for debugging."""
    with _lock:
        active = dict(_active_sessions)
        recent = list(_recent_runs)
    return jsonify({
        "active_sessions": active,
        "recent_runs": recent[-20:],
    })


@app.route("/debug/<run_id>", methods=["GET"])
def debug_run(run_id: str):
    """Return detailed debug info for a specific run."""
    with _lock:
        if run_id in _active_sessions:
            return jsonify({"status": "active", "data": _active_sessions[run_id]})
        for run in reversed(_recent_runs):
            if run.get("run_id") == run_id:
                return jsonify({"status": "completed", "data": run})
    return jsonify({"error": "run not found"}), 404


@app.route("/search", methods=["POST"])
def search():
    data = request.get_json(force=True)
    address = (data.get("address") or "").strip()
    county = (data.get("county") or "Harris County").strip()

    if not address:
        return jsonify({"error": "address is required", "success": False}), 400

    run_id = f"sync-{int(time.time() * 1000)}"
    logger.info(f"[{run_id}] /search — address='{address}', county='{county}'")
    _log_run(run_id, {"event": "search_start", "address": address, "county": county})

    try:
        result = simulate_search(address, county)
        _finish_run(run_id, "success")
        return jsonify({
            "success": True,
            "data": {
                "address": result.address,
                "county": result.county,
                "parcelId": result.parcel_id,
                "legalDescription": result.legal_description,
                "ownershipChain": result.ownership_chain,
                "liens": result.liens,
                "source": result.source,
            },
        })
    except Exception as e:
        tb = traceback.format_exc()
        logger.error(f"[{run_id}] /search FAILED:\n{tb}")
        _finish_run(run_id, "failed", str(e))
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/search-stream", methods=["POST"])
def search_stream():
    """SSE endpoint — streams progress events then final result JSON."""
    data = request.get_json(force=True)
    address = (data.get("address") or "").strip()
    county = (data.get("county") or "Harris County").strip()

    if not address:
        return jsonify({"error": "address is required", "success": False}), 400

    run_id = f"sse-{int(time.time() * 1000)}"
    logger.info(f"[{run_id}] /search-stream — address='{address}', county='{county}'")
    _log_run(run_id, {"event": "stream_request", "address": address, "county": county})

    def generate():
        yield from run_nova_act_streaming(address, county, run_id)

    return Response(
        stream_with_context(generate()),
        content_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ─── Run ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8001))
    logger.info(f"Title AI Nova Act Service — port {port}")
    logger.info(f"  Nova Act SDK:    {'available' if NOVA_ACT_AVAILABLE else 'NOT installed'}")
    logger.info(f"  AWS credentials: {'configured' if os.getenv('AWS_ACCESS_KEY_ID') else 'NOT set'}")
    logger.info(f"  Workflow:        {WORKFLOW_DEFINITION_NAME}")
    logger.info(f"  Mode:            {'nova_act' if (NOVA_ACT_AVAILABLE and os.getenv('AWS_ACCESS_KEY_ID')) else 'simulation'}")
    logger.info(f"  Max steps:       {MAX_STEPS}")
    logger.info(f"  Counties:        {len(_get_county_config.__code__.co_consts)} configs + generic fallback")
    logger.info(f"  Debug endpoint:  http://localhost:{port}/debug")
    app.run(host="0.0.0.0", port=port, debug=False)
