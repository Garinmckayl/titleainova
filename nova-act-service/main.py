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
from datetime import datetime
from flask import Flask, request, jsonify
from dataclasses import dataclass, asdict
from typing import Optional, List

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

# County recorder search URLs
COUNTY_URLS = {
    "Harris County":  "https://media.cclerk.hctx.net/RealEstate/Search",
    "Dallas County":  "https://dallas.tx.publicsearch.us/",
    "Tarrant County": "https://tarrant.tx.publicsearch.us/",
    "Bexar County":   "https://bexar.tx.publicsearch.us/",
    "Travis County":  "https://www.tccsearch.org/RealEstate/SearchEntry.aspx",
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


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8001))
    print(f"Title AI Nova Act Service — port {port}")
    print(f"  Nova Act SDK:    {'available' if NOVA_ACT_AVAILABLE else 'NOT installed (pip install nova-act)'}")
    print(f"  AWS credentials: {'set' if os.getenv('AWS_ACCESS_KEY_ID') else 'NOT set'}")
    print(f"  Workflow:        {WORKFLOW_DEFINITION_NAME}")
    print(f"  Mode:            {'nova_act_workflow' if (NOVA_ACT_AVAILABLE and os.getenv('AWS_ACCESS_KEY_ID')) else 'simulation'}")
    app.run(host="0.0.0.0", port=port, debug=False)
