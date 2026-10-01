from fastapi import APIRouter, HTTPException, Request

router = APIRouter(prefix="/api/attack", tags=["ATT&CK"])


@router.get("/matrix")
def matrix(request: Request):
    return {"version": request.app.state.attack.version, "columns": request.app.state.attack.matrix()}


@router.get("/techniques/{technique_id}")
def technique(technique_id: str, request: Request):
    result = request.app.state.attack.get_technique(technique_id)
    if not result:
        raise HTTPException(404, "Technique not found")
    return result

