from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

TECHNIQUE_RE = re.compile(r"^T\d{4}(?:\.\d{3})?$")
COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


class CampaignLayer(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    techniques: list[str]

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("layer name cannot be blank")
        return value

    @field_validator("techniques")
    @classmethod
    def validate_technique_syntax(cls, values: list[str]) -> list[str]:
        cleaned = [value.strip().upper() for value in values]
        bad = [value for value in cleaned if not TECHNIQUE_RE.fullmatch(value)]
        if bad:
            raise ValueError(f"invalid ATT&CK ID format: {', '.join(bad)}")
        return cleaned


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
