from __future__ import annotations

from pydantic import BaseModel


class Tactic(BaseModel):
    id: str
    name: str
    short_name: str
    external_id: str | None = None
    description: str = ""
    url: str | None = None
    order: int = 0


class Technique(BaseModel):
    id: str
    name: str
    description: str = ""
    tactics: list[str] = []
    parent_id: str | None = None
    parent_name: str | None = None
    platforms: list[str] = []
    url: str


class MatrixColumn(BaseModel):
    tactic: Tactic
    techniques: list[Technique]
