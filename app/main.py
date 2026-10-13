from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.templating import Jinja2Templates

from app.api import attack, campaigns
from app.services.attack_service import AttackService
from app.services.campaign_service import CampaignService

ROOT = Path(__file__).resolve().parents[1]
ATTACK_VERSION = os.getenv("ATTVIZ_ATTACK_VERSION", "19.2")
ATTACK_PATHS = {
    "enterprise": Path(os.getenv("ATTVIZ_ATTACK_DATA", ROOT / "data/attack/enterprise-attack.json")),
    "mobile": Path(os.getenv("ATTVIZ_MOBILE_ATTACK_DATA", ROOT / "data/attack/mobile-attack.json")),
    "ics": Path(os.getenv("ATTVIZ_ICS_ATTACK_DATA", ROOT / "data/attack/ics-attack.json")),
}
CAMPAIGN_PATH = Path(os.getenv("ATTVIZ_CAMPAIGN_DIR", ROOT / "data/campaigns"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.attack = AttackService(ATTACK_PATHS, ATTACK_VERSION)
    app.state.campaigns = CampaignService(CAMPAIGN_PATH, app.state.attack)
    yield


app = FastAPI(title="ATT&CK Visualizer", version="1.0.0", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=ROOT / "app/static"), name="static")
app.include_router(attack.router)
app.include_router(campaigns.router)
templates = Jinja2Templates(directory=ROOT / "app/templates")


@app.get("/brand/ATTVIZ.png", include_in_schema=False)
def brand_logo():
    return FileResponse(ROOT / "ATTVIZ.png", media_type="image/png")


def legal_document_response(request: Request, title: str, path: Path, download_path: str):
    response = templates.TemplateResponse(request, "legal_document.html", {
        "active": "terms",
        "attack_version": ATTACK_VERSION,
        "document_title": title,
        "document_text": path.read_text(encoding="utf-8"),
        "download_path": download_path,
    })
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/legal/license", include_in_schema=False)
@app.get("/legal/documents/license", include_in_schema=False)
def project_license(request: Request):
    return legal_document_response(request, "PolyForm Noncommercial License 1.0.0", ROOT / "LICENSE", "/legal/license/download")


@app.get("/legal/license/download", include_in_schema=False)
def download_project_license():
    return FileResponse(ROOT / "LICENSE", media_type="text/plain", filename="LICENSE")


@app.get("/legal/notice", include_in_schema=False)
@app.get("/legal/documents/notice", include_in_schema=False)
def project_notice(request: Request):
    return legal_document_response(request, "ATT&CK Visualizer Notices", ROOT / "NOTICE.md", "/legal/notice/download")


@app.get("/legal/notice/download", include_in_schema=False)
def download_project_notice():
    return FileResponse(ROOT / "NOTICE.md", media_type="text/markdown", filename="NOTICE.md")


@app.get("/legal/mitre-attack-license", include_in_schema=False)
@app.get("/legal/documents/mitre-attack-license", include_in_schema=False)
def mitre_attack_license(request: Request):
    return legal_document_response(request, "MITRE ATT&CK Data License", ROOT / "data/attack/LICENSE.txt", "/legal/mitre-attack-license/download")


@app.get("/legal/mitre-attack-license/download", include_in_schema=False)
def download_mitre_attack_license():
    return FileResponse(ROOT / "data/attack/LICENSE.txt", media_type="text/plain", filename="MITRE-ATTACK-LICENSE.txt")


@app.get("/", include_in_schema=False)
def index(request: Request):
    return templates.TemplateResponse(request, "index.html", {"active": "main", "attack_version": ATTACK_VERSION})


@app.get("/campaigns", include_in_schema=False)
def campaign_manager(request: Request):
    return templates.TemplateResponse(request, "campaigns.html", {"active": "campaigns", "attack_version": ATTACK_VERSION})


@app.get("/help", include_in_schema=False)
def help_page(request: Request):
    return templates.TemplateResponse(request, "help.html", {"active": "help", "attack_version": ATTACK_VERSION})


@app.get("/disclaimer", include_in_schema=False)
def disclaimer_page(request: Request):
    return templates.TemplateResponse(request, "disclaimer.html", {"active": "disclaimer", "attack_version": ATTACK_VERSION})


@app.get("/terms", include_in_schema=False)
def terms_page(request: Request):
    response = templates.TemplateResponse(request, "terms.html", {"active": "terms", "attack_version": ATTACK_VERSION})
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/techniques/{technique_id}", include_in_schema=False)
def technique_detail(technique_id: str, request: Request, domain: str | None = None):
    attack = request.app.state.attack
    domains = attack.domains_for_technique(technique_id)
    selected_domain = domain if domain in domains else (domains[0] if domains else None)
    technique = attack.get_technique(technique_id, selected_domain)
    if not technique:
        raise HTTPException(404, "Technique not found")
    parent = attack.get_technique(technique.parent_id, selected_domain) if technique.parent_id else None
    children = attack.children_for_technique(technique.id, selected_domain)
    return templates.TemplateResponse(request, "technique_detail.html", {
        "active": "main", "attack_version": ATTACK_VERSION, "technique": technique,
        "parent": parent, "children": children, "domains": domains,
        "selected_domain": selected_domain, "domain_labels": {item["id"]: item["name"] for item in attack.domain_metadata()},
        "usage": request.app.state.campaigns.usage_for_technique(technique.id),
    })


@app.get("/tactics/{short_name}", include_in_schema=False)
def tactic_detail(short_name: str, request: Request, domain: str | None = None):
    attack = request.app.state.attack
    domains = attack.domains_for_tactic(short_name)
    selected_domain = domain if domain in domains else (domains[0] if domains else None)
    tactic = attack.get_tactic(short_name, selected_domain)
    if not tactic:
        raise HTTPException(404, "Tactic not found")
    techniques = attack.techniques_for_tactic(short_name, selected_domain)
    usage = request.app.state.campaigns.usage_for_techniques({item.id for item in techniques})
    technique_ids = {item.id for item in techniques}
    roots = [item for item in techniques if not item.parent_id]
    families = [{
        "parent": parent,
        "children": sorted([item for item in techniques if item.parent_id == parent.id], key=lambda item: item.id),
    } for parent in roots]
    orphan_subtechniques = [item for item in techniques if item.parent_id and item.parent_id not in technique_ids]
    for child in orphan_subtechniques:
        parent = attack.get_technique(child.parent_id, selected_domain)
        existing = next((family for family in families if family["parent"].id == child.parent_id), None)
        if existing:
            existing["children"].append(child)
        elif parent:
            families.append({"parent": parent, "children": [child]})
    families.sort(key=lambda family: family["parent"].id)
    return templates.TemplateResponse(request, "tactic_detail.html", {
        "active": "main", "attack_version": ATTACK_VERSION, "tactic": tactic,
        "techniques": techniques, "families": families, "usage": usage,
        "technique_count": len([item for item in techniques if not item.parent_id]),
        "subtechnique_count": len([item for item in techniques if item.parent_id]),
        "domains": domains, "selected_domain": selected_domain,
        "domain_labels": {item["id"]: item["name"] for item in attack.domain_metadata()},
    })


@app.get("/healthz", include_in_schema=False)
def health(request: Request):
    """Lightweight container/orchestrator health probe."""
    return {
        "status": "ok",
        "attack_version": request.app.state.attack.version,
        "technique_count": len(request.app.state.attack.technique_by_id),
        "domains": {
            domain: len(request.app.state.attack.domains[domain].technique_by_id)
            for domain in request.app.state.attack.available_domains
        },
    }
