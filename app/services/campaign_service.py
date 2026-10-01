from __future__ import annotations

import json
import os
import re
import tempfile
from pathlib import Path

from pydantic import ValidationError

from app.models.campaign import Campaign, CampaignRecord
from app.services.attack_service import AttackService

PALETTE = ["#ff5c5c", "#35a7ff", "#2dd4bf", "#f59e0b", "#a78bfa", "#f472b6", "#84cc16", "#fb923c"]


class CampaignService:
    def __init__(self, directory: Path, attack_service: AttackService) -> None:
        self.directory = directory
        self.attack = attack_service
        self.directory.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def slugify(name: str) -> str:
        slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        return (slug or "campaign") + ".json"

    def _path(self, filename: str, *, must_exist: bool = False) -> Path:
        invalid = (
            not isinstance(filename, str)
            or len(filename) > 255
            or "/" in filename
            or "\\" in filename
            or any(ord(char) < 32 for char in filename)
            or not filename.endswith(".json")
            or not filename[:-5].strip(" .")
        )
        if invalid:
            raise ValueError("invalid campaign filename")
        path = (self.directory / filename).resolve()
        if path.parent != self.directory.resolve():
            raise ValueError("campaign path escapes the campaign directory")
        if must_exist and not path.is_file():
            raise FileNotFoundError(filename)
        return path

    def _record(self, path: Path, color_index: int = 0) -> CampaignRecord:
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            return CampaignRecord(filename=path.name, status="invalid", errors=[f"JSON line {exc.lineno}, column {exc.colno}: {exc.msg}"])
        except OSError as exc:
            return CampaignRecord(filename=path.name, status="invalid", errors=[str(exc)])
        try:
            campaign = Campaign.model_validate(raw)
        except ValidationError as exc:
            errors = [f"{'.'.join(str(x) for x in item['loc'])}: {item['msg']}" for item in exc.errors()]
            return CampaignRecord(filename=path.name, status="invalid", errors=errors)

        unknown = sorted({tid for layer in campaign.layers for tid in layer.techniques if not self.attack.has_technique(tid)})
        warnings = [f"Unknown technique {tid}" for tid in unknown]
        return CampaignRecord(
            filename=path.name, status="warning" if warnings else "valid", campaign=campaign,
            warnings=warnings, assigned_color=campaign.color or PALETTE[color_index % len(PALETTE)],
        )

    def discover(self) -> list[CampaignRecord]:
        records = [self._record(path, i) for i, path in enumerate(sorted(self.directory.glob("*.json")))]
        return sorted(records, key=lambda record: record.filename.casefold())

    def valid_records(self) -> list[CampaignRecord]:
        return [r for r in self.discover() if r.status == "valid"]

    def usage_for_technique(self, technique_id: str) -> list[dict]:
        """Return valid campaigns that explicitly list a technique and its layers."""
        return self.usage_for_techniques({technique_id})[technique_id]

    def usage_for_techniques(self, technique_ids: set[str]) -> dict[str, list[dict]]:
        """Build explicit campaign usage for many techniques in one discovery pass."""
        usage: dict[str, list[dict]] = {technique_id: [] for technique_id in technique_ids}
        for record in self.valid_records():
            matches: dict[str, list] = {}
            for layer in record.campaign.layers:
                for technique_id in set(layer.techniques) & technique_ids:
                    matches.setdefault(technique_id, []).append(layer)
            for technique_id, layers in matches.items():
                usage[technique_id].append({"record": record, "layers": layers})
        return usage

    def get(self, filename: str) -> CampaignRecord:
        path = self._path(filename, must_exist=True)
        index = [p.name for p in sorted(self.directory.glob("*.json"))].index(path.name)
        return self._record(path, index)

    def save(self, campaign: Campaign, filename: str | None = None, *, overwrite: bool = False) -> str:
        filename = filename or self.slugify(campaign.name)
        path = self._path(filename)
        if path.exists() and not overwrite:
            raise FileExistsError(filename)
        unknown = sorted({tid for layer in campaign.layers for tid in layer.techniques if not self.attack.has_technique(tid)})
        if unknown:
            raise ValueError(f"Unknown ATT&CK technique IDs: {', '.join(unknown)}")
        payload = json.dumps(campaign.model_dump(exclude_none=True), ensure_ascii=False, indent=2) + "\n"
        fd, temp_name = tempfile.mkstemp(prefix=f".{filename}.", suffix=".tmp", dir=self.directory)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                handle.write(payload)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temp_name, path)
        except Exception:
            try:
                os.unlink(temp_name)
            except FileNotFoundError:
                pass
            raise
        return filename

    def update(self, filename: str, campaign: Campaign, new_filename: str | None = None) -> str:
        """Update a campaign and optionally rename its source JSON file."""
        current_path = self._path(filename, must_exist=True)
        target_filename = new_filename or filename
        target_path = self._path(target_filename)
        if target_path != current_path and target_path.exists():
            raise FileExistsError(target_filename)

        # Validate and atomically replace the current file before using the
        # filesystem's atomic rename operation within the campaign directory.
        self.save(campaign, filename, overwrite=True)
        if target_path != current_path:
            os.replace(current_path, target_path)
        return target_filename

    def duplicate(self, filename: str) -> str:
        record = self.get(filename)
        if not record.campaign:
            raise ValueError("invalid campaigns cannot be duplicated")
        copy = record.campaign.model_copy(deep=True)
        copy.name = f"{copy.name} Copy"
        if copy.nickname:
            copy.nickname = f"{copy.nickname[:35]} Copy"
        base = self.slugify(copy.name).removesuffix(".json")
        candidate = f"{base}.json"
        number = 2
        while (self.directory / candidate).exists():
            candidate = f"{base}-{number}.json"
            number += 1
        return self.save(copy, candidate)

    def delete(self, filename: str) -> None:
        self._path(filename, must_exist=True).unlink()
