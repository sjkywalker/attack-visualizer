from fastapi import APIRouter, HTTPException, Request, Response, status

from app.models.campaign import Campaign, TechniqueStatusUpdate

router = APIRouter(prefix="/api/campaigns", tags=["Campaigns"])


def serialize(record):
    data = record.model_dump()
    if data.get("campaign"):
        data["technique_count"] = len({t["id"] for layer in data["campaign"]["layers"] for t in layer["techniques"]})
    return data


@router.get("")
def list_campaigns(request: Request):
    return [serialize(r) for r in request.app.state.campaigns.discover()]


@router.get("/{filename}")
def get_campaign(filename: str, request: Request):
    try:
        return serialize(request.app.state.campaigns.get(filename))
    except (ValueError, FileNotFoundError) as exc:
        raise HTTPException(404, str(exc)) from exc


@router.post("", status_code=status.HTTP_201_CREATED)
def create_campaign(campaign: Campaign, request: Request, filename: str | None = None):
    try:
        saved_filename = request.app.state.campaigns.save(campaign, filename)
        return {"filename": saved_filename}
    except FileExistsError as exc:
        raise HTTPException(409, f"Campaign file already exists: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@router.put("/{filename}")
def update_campaign(filename: str, campaign: Campaign, request: Request, new_filename: str | None = None):
    try:
        saved_filename = request.app.state.campaigns.update(filename, campaign, new_filename)
        return {"filename": saved_filename}
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc
    except FileExistsError as exc:
        raise HTTPException(409, f"Campaign file already exists: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@router.patch("/{filename}/techniques/{technique_id}")
def update_technique_status(
    filename: str, technique_id: str, update: TechniqueStatusUpdate, request: Request
):
    try:
        record = request.app.state.campaigns.set_technique_status(
            filename, technique_id, update.status, update.layer_indexes
        )
        return serialize(record)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@router.post("/{filename}/duplicate", status_code=status.HTTP_201_CREATED)
def duplicate_campaign(filename: str, request: Request):
    try:
        return {"filename": request.app.state.campaigns.duplicate(filename)}
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@router.delete("/{filename}", status_code=status.HTTP_204_NO_CONTENT)
def delete_campaign(filename: str, request: Request):
    try:
        request.app.state.campaigns.delete(filename)
        return Response(status_code=204)
    except (ValueError, FileNotFoundError) as exc:
        raise HTTPException(404, str(exc)) from exc
