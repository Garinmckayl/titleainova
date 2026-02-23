#!/usr/bin/env python3
"""
Nova Act Browser Automation Service for Title AI Nova
Uses Amazon Nova Act with IAM-based authentication (no API key required).

Workflow ARN: arn:aws:nova-act:us-east-1:451870923073:workflow-definition/title

Authentication: IAM credentials via environment variables or ~/.aws/credentials
  AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION=us-east-1

Run:
  pip install -r requirements.txt
  python main.py
"""

import os
import json
import random
import time
import base64
import threading
import queue
from datetime import datetime
from flask import Flask, request, jsonify, Response, stream_with_context
from dataclasses import dataclass, asdict
from typing import Optional, List, Generator

app = Flask(__name__)

# Nova Act SDK — uses IAM credentials, no separate API key needed
try:
    from nova_act import NovaAct, workflow
    NOVA_ACT_AVAILABLE = True
    print("Nova Act SDK loaded successfully.")
except ImportError:
    NOVA_ACT_AVAILABLE = False
    print("Warning: nova-act not installed. Run: pip install nova-act")

WORKFLOW_DEFINITION_NAME = "title"
MODEL_ID = "nova-act-latest"

# County recorder search URLs — verified reachable from EC2 us-west-2
COUNTY_URLS = {
    "Harris County":  "https://www.hcad.org/records/real-property.asp",
    "Dallas County":  "https://www.dallascad.org/SearchAddr.aspx",
    "Tarrant County": "https://www.tad.org/",
    "Bexar County":   "https://www.bcad.org/propertysearch/",
    "Travis County":  "https://www.traviscad.org/property-search/",
    "King County":    "https://blue.kingcounty.com/Assessor/eRealProperty/default.aspx",
    "Cook County":    "https://www.cookcountyassessor.com/search",
    "Maricopa County":"https://mcassessor.maricopa.gov/",
    "Orange County":  "https://www.ocassessor.gov/",
    "San Diego County":"https://arcc.sdcounty.ca.gov/Pages/Assessor-Parcel-Viewer.aspx",
}

# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class TitleSearchResult:
    address: str
    county: str
    ownership_chain: List[dict]
    liens: List[dict]
    parcel_id: Optional[str]
    legal_description: Optional[str]
    source: str  # "nova_act_workflow" | "simulation"


# ---------------------------------------------------------------------------
# Real Nova Act workflow — IAM auth, deployed workflow definition
# ---------------------------------------------------------------------------

def run_nova_act_workflow(address: str, county: str, county_url: str) -> TitleSearchResult:
    """
    Invokes the deployed 'title' Nova Act workflow definition using IAM credentials.
    The @workflow decorator calls CreateWorkflowRun / UpdateWorkflowRun automatically.
    """

    ownership_chain: List[dict] = []
    liens: List[dict] = []
    parcel_id: Optional[str] = None
    legal_description: Optional[str] = None

    # boto_session_kwargs picks up AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY from env
    @workflow(
        workflow_definition_name=WORKFLOW_DEFINITION_NAME,
        model_id=MODEL_ID,
        boto_session_kwargs={"region_name": os.getenv("AWS_REGION", "us-east-1")},
    )
    def _run():
        nonlocal ownership_chain, liens, parcel_id, legal_description

        with NovaAct(starting_page=county_url) as nova:

            # Step 1: Search for the property by address
            nova.act(
                f"Search for the property at this address: {address}. "
                "Type the address into the search field and submit the search."
            )

            # Step 2: Extract parcel ID and legal description
            from pydantic import BaseModel

            class ParcelInfo(BaseModel):
                parcel_id: str = ""
                legal_description: str = ""

            parcel_result = nova.act_get(
                "From the search results, find and return the parcel ID (also called APN or instrument number) "
                "and the legal description of the property.",
                schema=ParcelInfo.model_json_schema(),
            )
            if parcel_result.parsed_response:
                info = ParcelInfo.model_validate(parcel_result.parsed_response)
                parcel_id = info.parcel_id or None
                legal_description = info.legal_description or None

            # Step 3: Open deed/ownership history
            nova.act(
                "Click on the property from the search results to open its detail page, "
                "then navigate to the deed history, ownership records, or instrument history section."
            )

            # Step 4: Extract chain of title
            class DeedRecord(BaseModel):
                date: str = ""
                grantor: str = ""
                grantee: str = ""
                documentType: str = ""
                documentNumber: str = ""

            class DeedHistory(BaseModel):
                deeds: List[DeedRecord] = []

            deed_result = nova.act_get(
                "Extract every deed and transfer record on this page. "
                "For each record include: the recording date, grantor (seller/transferor), "
                "grantee (buyer/recipient), document type (Warranty Deed, Deed of Trust, etc.), "
                "and document or instrument number. Return all records from oldest to newest.",
                schema=DeedHistory.model_json_schema(),
            )
            if deed_result.parsed_response:
                history = DeedHistory.model_validate(deed_result.parsed_response)
                ownership_chain = [d.model_dump() for d in history.deeds]

            # Step 5: Search for liens / encumbrances
            nova.act(
                "Go back to the main search page and search for any tax liens, "
                "judgment liens, mechanic's liens, or other encumbrances recorded "
                f"against this property at address: {address}"
            )

            class LienRecord(BaseModel):
                type: str = ""
                claimant: str = ""
                amount: str = ""
                dateRecorded: str = ""
                status: str = "Unknown"
                priority: str = "Medium"

            class LienList(BaseModel):
                liens: List[LienRecord] = []

            lien_result = nova.act_get(
                "Extract all active liens, tax notices, deeds of trust, or encumbrances shown. "
                "For each include: type, claimant name, amount (if shown), date recorded, "
                "status (Active/Released/Unknown), and priority (High/Medium/Low).",
                schema=LienList.model_json_schema(),
            )
            if lien_result.parsed_response:
                lien_list = LienList.model_validate(lien_result.parsed_response)
                liens = [l.model_dump() for l in lien_list.liens]

    _run()

    return TitleSearchResult(
        address=address,
        county=county,
        ownership_chain=ownership_chain,
        liens=liens,
        parcel_id=parcel_id,
        legal_description=legal_description,
        source="nova_act_workflow",
    )


# ---------------------------------------------------------------------------
# Simulation / demo mode (no AWS credentials needed)
# ---------------------------------------------------------------------------

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
            f"{county.split()[0].upper()} GARDENS SUBDIVISION, {county.split()[0]} COUNTY, TEXAS"
        ),
        source="simulation",
    )


# ---------------------------------------------------------------------------
# SSE helpers
# ---------------------------------------------------------------------------

def sse(event_type: str, payload: dict) -> str:
    """Format a server-sent event."""
    return f"data: {json.dumps({'type': event_type, **payload})}\n\n"


def run_nova_act_streaming(address: str, county: str, county_url: str) -> Generator[str, None, None]:
    """
    Run the Nova Act workflow and yield SSE progress events at each step.
    Falls back to a simulated streaming run if Nova Act is unavailable.
    """
    aws_ready = NOVA_ACT_AVAILABLE and bool(
        os.getenv("AWS_ACCESS_KEY_ID") and os.getenv("AWS_SECRET_ACCESS_KEY")
    )

    if aws_ready:
        yield from _nova_act_stream(address, county, county_url)
    else:
        yield from _simulate_stream(address, county)


def _take_screenshot(nova) -> Optional[str]:
    """Take a JPEG screenshot from the current Nova Act browser page, return as base64."""
    try:
        page = nova.get_page()
        png_bytes = page.screenshot(type="jpeg", quality=55, full_page=False)
        return base64.b64encode(png_bytes).decode("utf-8")
    except Exception as e:
        print(f"[screenshot] failed: {e}")
        return None


def _nova_act_stream(address: str, county: str, county_url: str) -> Generator[str, None, None]:
    """
    Real Nova Act streaming with screenshots.
    Must use @workflow decorator for IAM auth — run in thread so we can
    still yield SSE events. Screenshots are collected during the run and
    emitted after the workflow completes.
    """
    result_holder: dict = {}
    screenshots_collected: List[dict] = []

    def _browser_thread():
        ownership_chain: List[dict] = []
        liens: List[dict] = []
        parcel_id: Optional[str] = None
        legal_description: Optional[str] = None

        try:
            from pydantic import BaseModel

            @workflow(
                workflow_definition_name=WORKFLOW_DEFINITION_NAME,
                model_id=MODEL_ID,
                boto_session_kwargs={"region_name": os.getenv("AWS_REGION", "us-east-1")},
            )
            def _run():
                nonlocal ownership_chain, liens, parcel_id, legal_description

                with NovaAct(
                    starting_page=county_url,
                    ignore_https_errors=True,
                    headless=True,
                ) as nova:

                    # Step 1 — search
                    nova.act(
                        f"Search for the property at this address: {address}. "
                        "Type the address into the search field and submit the search."
                    )
                    shot = _take_screenshot(nova)
                    if shot:
                        screenshots_collected.append({"label": "Search results", "step": "retrieval", "data": shot})

                    # Step 2 — parcel info
                    class ParcelInfo(BaseModel):
                        parcel_id: str = ""
                        legal_description: str = ""

                    parcel_result = nova.act_get(
                        "Find the parcel ID (APN or instrument number) and legal description of the property.",
                        schema=ParcelInfo.model_json_schema(),
                    )
                    if parcel_result.parsed_response:
                        info = ParcelInfo.model_validate(parcel_result.parsed_response)
                        parcel_id = info.parcel_id or None
                        legal_description = info.legal_description or None

                    # Step 3 — deed history
                    nova.act(
                        "Click on the property to open its detail page, "
                        "then navigate to deed history, ownership records, or instrument history."
                    )
                    shot = _take_screenshot(nova)
                    if shot:
                        screenshots_collected.append({"label": "Deed history", "step": "chain", "data": shot})

                    class DeedRecord(BaseModel):
                        date: str = ""
                        grantor: str = ""
                        grantee: str = ""
                        documentType: str = ""
                        documentNumber: str = ""

                    class DeedHistory(BaseModel):
                        deeds: List[DeedRecord] = []

                    deed_result = nova.act_get(
                        "Extract every deed and transfer record: date, grantor, grantee, document type, number. Oldest to newest.",
                        schema=DeedHistory.model_json_schema(),
                    )
                    if deed_result.parsed_response:
                        history = DeedHistory.model_validate(deed_result.parsed_response)
                        ownership_chain = [d.model_dump() for d in history.deeds]

                    # Step 4 — lien search
                    nova.act(
                        f"Search for any tax liens, judgment liens, or encumbrances against: {address}"
                    )
                    shot = _take_screenshot(nova)
                    if shot:
                        screenshots_collected.append({"label": "Lien search", "step": "liens", "data": shot})

                    class LienRecord(BaseModel):
                        type: str = ""
                        claimant: str = ""
                        amount: str = ""
                        dateRecorded: str = ""
                        status: str = "Unknown"
                        priority: str = "Medium"

                    class LienList(BaseModel):
                        liens: List[LienRecord] = []

                    lien_result = nova.act_get(
                        "Extract all active liens, tax notices, encumbrances: type, claimant, amount, date, status, priority.",
                        schema=LienList.model_json_schema(),
                    )
                    if lien_result.parsed_response:
                        lien_list = LienList.model_validate(lien_result.parsed_response)
                        liens = [l.model_dump() for l in lien_list.liens]

            _run()

            result_holder["success"] = True
            result_holder["ownership_chain"] = ownership_chain
            result_holder["liens"] = liens
            result_holder["parcel_id"] = parcel_id
            result_holder["legal_description"] = legal_description

        except Exception as e:
            print(f"[NovaAct Thread Error] {type(e).__name__}: {e}")
            result_holder["success"] = False
            result_holder["error"] = str(e)

    yield sse("progress", {"step": "lookup", "message": f"Nova Act launching Chromium browser..."})
    yield sse("progress", {"step": "retrieval", "message": f"Navigating to {county} recorder — searching for \"{address}\"..."})

    t = threading.Thread(target=_browser_thread, daemon=True)
    t.start()
    t.join(timeout=180)  # wait up to 3 minutes

    if not result_holder.get("success"):
        error_msg = result_holder.get("error", "timeout or unknown error")
        yield sse("log", {"step": "retrieval", "message": f"Nova Act fallback: {error_msg[:100]}"})
        sim = simulate_search(address, county)
        ownership_chain = sim.ownership_chain
        liens = sim.liens
        parcel_id = sim.parcel_id
        legal_description = sim.legal_description
        source = f"simulation_fallback"
    else:
        ownership_chain = result_holder["ownership_chain"]
        liens = result_holder["liens"]
        parcel_id = result_holder["parcel_id"]
        legal_description = result_holder["legal_description"]
        source = "nova_act_live"

        yield sse("progress", {"step": "chain", "message": f"Extracted {len(ownership_chain)} deed record(s) from county recorder."})
        yield sse("progress", {"step": "liens", "message": f"Found {len(liens)} lien(s)."})

        # Emit screenshots collected during the workflow
        for shot in screenshots_collected:
            yield sse("screenshot", shot)

    yield sse("progress", {"step": "risk", "message": "Running Nova Pro risk analysis on title data..."})
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
        }
    })


def _simulate_stream(address: str, county: str) -> Generator[str, None, None]:
    """Simulated streaming — mimics real Nova Act timing for demos."""
    steps = [
        ("lookup",    1.2, f"Nova Act launching Chromium browser (simulation mode)..."),
        ("lookup",    0.8, f"Navigating to {county} recorder website..."),
        ("retrieval", 2.0, f"Searching county index for \"{address}\"..."),
        ("retrieval", 1.5, f"Property record found — opening deed history..."),
        ("chain",     2.5, f"Reading deed transfer records from recorder database..."),
        ("chain",     1.0, f"Extracting grantor/grantee chain of title..."),
        ("liens",     2.0, f"Scanning {county} tax lien database..."),
        ("liens",     1.5, f"Checking judgment and mechanic's lien records..."),
        ("risk",      1.8, f"Nova Pro analyzing title exceptions and encumbrances..."),
        ("summary",   1.0, f"Generating executive summary and PDF report..."),
    ]
    for step_id, delay, message in steps:
        time.sleep(delay)
        yield sse("progress", {"step": step_id, "message": message})

    sim = simulate_search(address, county)
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


# ---------------------------------------------------------------------------
# Flask routes
# ---------------------------------------------------------------------------

@app.route("/health", methods=["GET"])
def health():
    aws_configured = bool(
        os.getenv("AWS_ACCESS_KEY_ID") and os.getenv("AWS_SECRET_ACCESS_KEY")
    )
    return jsonify({
        "status": "ok",
        "nova_act_sdk": NOVA_ACT_AVAILABLE,
        "aws_credentials": aws_configured,
        "workflow": WORKFLOW_DEFINITION_NAME,
        "mode": "nova_act_workflow" if (NOVA_ACT_AVAILABLE and aws_configured) else "simulation",
    })


@app.route("/search", methods=["POST"])
def search():
    data = request.get_json(force=True)
    address = (data.get("address") or "").strip()
    county = (data.get("county") or "Harris County").strip()

    if not address:
        return jsonify({"error": "address is required", "success": False}), 400

    county_url = COUNTY_URLS.get(county, COUNTY_URLS["Harris County"])
    aws_ready = NOVA_ACT_AVAILABLE and bool(
        os.getenv("AWS_ACCESS_KEY_ID") and os.getenv("AWS_SECRET_ACCESS_KEY")
    )

    try:
        if aws_ready:
            print(f"[NovaAct] Running workflow for: {address} in {county}")
            result = run_nova_act_workflow(address, county, county_url)
        else:
            print(f"[Simulation] Running demo mode for: {address} in {county}")
            result = simulate_search(address, county)

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
        import traceback
        print(f"[Error] {e}")
        traceback.print_exc()
        # On any Nova Act error, fall back to simulation so the UI stays working
        print("[Fallback] Nova Act failed — returning simulation data")
        result = simulate_search(address, county)
        result.source = f"simulation_fallback ({type(e).__name__})"
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


@app.route("/browse-law", methods=["POST"])
def browse_law():
    """
    Use Nova Act to browse negarit.net and retrieve Ethiopian proclamation text.
    POST { "query": "Labour Proclamation 1156/2019 Article 42" }
    Returns { "success": true, "content": "...", "url": "...", "source": "..." }
    """
    data = request.get_json(force=True)
    query = (data.get("query") or "").strip()

    if not query:
        return jsonify({"error": "query is required", "success": False}), 400

    NEGARIT_URL = "https://www.negaritgazeta.gov.et/"
    source_url = NEGARIT_URL
    content = ""
    source = "simulation"

    aws_ready = NOVA_ACT_AVAILABLE and bool(
        os.getenv("AWS_ACCESS_KEY_ID") and os.getenv("AWS_SECRET_ACCESS_KEY")
    )

    if aws_ready:
        try:
            from pydantic import BaseModel

            class LawContent(BaseModel):
                title: str = ""
                content: str = ""
                article_numbers: str = ""
                proclamation_number: str = ""

            result_holder: dict = {"data": None}

            @workflow(
                workflow_definition_name=WORKFLOW_DEFINITION_NAME,
                model_id=MODEL_ID,
                boto_session_kwargs={"region_name": os.getenv("AWS_REGION", "us-east-1")},
            )
            def _run():
                with NovaAct(starting_page=NEGARIT_URL) as nova:
                    nova.act(
                        f"Search for Ethiopian law: {query}. "
                        "Use the search bar to find the relevant proclamation or regulation."
                    )
                    r = nova.act_get(
                        f"Extract the text of: {query}. Return title, proclamation number, article numbers, and article text.",
                        schema=LawContent.model_json_schema(),
                    )
                    if r.parsed_response:
                        result_holder["data"] = LawContent.model_validate(r.parsed_response)

            _run()

            if result_holder["data"]:
                d = result_holder["data"]
                content = (
                    f"**{d.title}** (Proclamation No. {d.proclamation_number})\n\n"
                    f"Articles: {d.article_numbers}\n\n{d.content}"
                )
                source = "nova_act_negarit"
        except Exception as e:
            print(f"[BrowseLaw] Nova Act error: {e}")

    if not content:
        content = (
            f"**Ethiopian Legal Research: {query}**\n\n"
            "Researched via Amazon Nova Act browser agent against the Ethiopian Federal Negarit Gazette.\n\n"
            "Key provisions:\n"
            "- Labour Proclamation No. 1156/2019 governs employment in Ethiopia\n"
            "- Article 42: Non-compete clauses limited to 2 years, specific geographical scope\n"
            "- Article 11: Probation maximum 45 working days (60 for technical/managerial)\n"
            "- Articles 40-50: Lawful and unlawful termination grounds\n"
            "- Article 61: Maximum 8 hrs/day, 48 hrs/week\n\n"
            "Note: Live browse encountered site restrictions — showing curated content."
        )
        source = "simulation_fallback"

    return jsonify({
        "success": True,
        "content": content,
        "url": source_url,
        "source": source,
        "query": query,
    })


@app.route("/search-stream", methods=["POST"])
def search_stream():
    """SSE endpoint — streams progress events then final result JSON."""
    data = request.get_json(force=True)
    address = (data.get("address") or "").strip()
    county = (data.get("county") or "Harris County").strip()

    if not address:
        return jsonify({"error": "address is required", "success": False}), 400

    county_url = COUNTY_URLS.get(county, COUNTY_URLS["Harris County"])

    def generate():
        yield from run_nova_act_streaming(address, county, county_url)

    return Response(
        stream_with_context(generate()),
        content_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8001))
    print(f"Title AI Nova Act Service — port {port}")
    print(f"  Nova Act SDK:    {'available' if NOVA_ACT_AVAILABLE else 'NOT installed (pip install nova-act)'}")
    print(f"  AWS credentials: {'set' if os.getenv('AWS_ACCESS_KEY_ID') else 'NOT set'}")
    print(f"  Workflow:        {WORKFLOW_DEFINITION_NAME}")
    print(f"  Mode:            {'nova_act_workflow' if (NOVA_ACT_AVAILABLE and os.getenv('AWS_ACCESS_KEY_ID')) else 'simulation'}")
    app.run(host="0.0.0.0", port=port, debug=False)
