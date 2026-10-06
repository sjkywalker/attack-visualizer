from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

TECHNIQUE_RE = re.compile(r"^T\d{4}(?:\.\d{3})?$")
COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


class CampaignTechnique(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    status: Literal["seen", "unseen"]
    comment: str | None = Field(default=None, max_length=2000)

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        cleaned = value.strip().upper()
        if not TECHNIQUE_RE.fullmatch(cleaned):
            raise ValueError(f"invalid ATT&CK ID format: {cleaned}")
        return cleaned

    @field_validator("comment")
    @classmethod
    def clean_comment(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class CampaignLayer(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    techniques: list[CampaignTechnique]

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("layer name cannot be blank")
        return value

    @field_validator("techniques", mode="before")
    @classmethod
    def normalize_legacy_techniques(cls, values: list[object]) -> list[object]:
        if not isinstance(values, list):
            return values
        return [{"id": value, "status": "seen"} if isinstance(value, str) else value for value in values]


class Campaign(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: Literal["1.0"]
    name: str = Field(min_length=1, max_length=160)
    nickname: str | None = Field(default=None, min_length=1, max_length=40)
    attribution_candidates: list[str] = Field(default_factory=list)
    description: str | None = Field(default=None, max_length=4000)
    color: str | None = None
    layers: list[CampaignLayer] = Field(min_length=1)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("campaign name cannot be blank")
        return value

    @field_validator("nickname")
    @classmethod
    def clean_nickname(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("campaign nickname cannot be blank")
        return value

    @field_validator("attribution_candidates")
    @classmethod
    def clean_attribution_candidates(cls, values: list[str]) -> list[str]:
        cleaned = []
        for value in values:
            candidate = value.strip()
            if not candidate:
                raise ValueError("attribution candidates cannot be blank")
            if candidate not in cleaned:
                cleaned.append(candidate)
        return cleaned

    @field_validator("color")
    @classmethod
    def validate_color(cls, value: str | None) -> str | None:
        if value is not None and not COLOR_RE.fullmatch(value):
            raise ValueError("color must be a six-digit hex value, for example #2dd4bf")
        return value.lower() if value else value


class CampaignRecord(BaseModel):
    filename: str
    status: Literal["valid", "warning", "invalid"]
    campaign: Campaign | None = None
    errors: list[str] = []
    warnings: list[str] = []
    assigned_color: str | None = None


class TechniqueStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["seen", "unseen"]
    layer_indexes: list[int] = Field(min_length=1)

    @field_validator("layer_indexes")
    @classmethod
    def clean_layer_indexes(cls, values: list[int]) -> list[int]:
        cleaned: list[int] = []
        for value in values:
            if value < 0:
                raise ValueError("layer indexes cannot be negative")
            if value not in cleaned:
                cleaned.append(value)
        return cleaned
