from fastapi import APIRouter, HTTPException, Query, Request

router = APIRouter(prefix="/api/attack", tags=["ATT&CK"])


@router.get("/matrix")
def matrix(request: Request, domains: list[str] | None = Query(default=None)):
    attack = request.app.state.attack
    selected = attack.normalize_domains(domains)
    return {
        "version": attack.version,
        "domains": attack.domain_metadata(),
        "selected_domains": selected,
        "columns": attack.matrix(selected),
    }


@router.get("/techniques/{technique_id}")
def technique(technique_id: str, request: Request, domain: str | None = None):
    result = request.app.state.attack.get_technique(technique_id, domain)
    if not result:
        raise HTTPException(404, "Technique not found")
    return result
