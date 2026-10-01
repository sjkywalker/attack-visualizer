from __future__ import annotations

import json
import re
from pathlib import Path

from app.models.attack import MatrixColumn, Tactic, Technique

TACTIC_ORDER = [
    "reconnaissance", "resource-development", "initial-access", "execution",
    "persistence", "privilege-escalation", "defense-evasion", "credential-access",
    "discovery", "lateral-movement", "collection", "command-and-control",
    "exfiltration", "impact",
]


class AttackDataError(RuntimeError):
    pass


class AttackService:
    """Loads ATT&CK STIX once and exposes normalized application models."""

    def __init__(self, data_path: Path, version: str = "19.2") -> None:
        self.data_path = data_path
        self.version = version
        self.technique_by_id: dict[str, Technique] = {}
        self.techniques_by_tactic: dict[str, list[Technique]] = {}
        self.parent_by_subtechnique: dict[str, str] = {}
        self.tactics: list[Tactic] = []
        self._load()

    @staticmethod
    def _external_id(obj: dict) -> str | None:
        for ref in obj.get("external_references", []):
            if ref.get("source_name") == "mitre-attack" and ref.get("external_id"):
                return ref["external_id"]
        return None

    @staticmethod
    def technique_url(technique_id: str) -> str:
        tid = technique_id.upper()
        if not re.fullmatch(r"T\d{4}(?:\.\d{3})?", tid):
            raise ValueError("invalid ATT&CK technique ID")
        return "https://attack.mitre.org/techniques/" + tid.replace(".", "/") + "/"

    def _load(self) -> None:
        if not self.data_path.is_file():
            raise AttackDataError(
                f"ATT&CK data not found at {self.data_path}. See data/attack/README.md."
            )
        try:
            objects = json.loads(self.data_path.read_text(encoding="utf-8"))["objects"]
        except (OSError, json.JSONDecodeError, KeyError) as exc:
            raise AttackDataError(f"Unable to read ATT&CK STIX bundle: {exc}") from exc

        active = [o for o in objects if not o.get("revoked") and not o.get("x_mitre_deprecated")]
        stix_by_id = {o.get("id"): o for o in active}
        tactic_objects = [o for o in active if o.get("type") == "x-mitre-tactic"]
        tactic_by_stix = {o["id"]: o.get("x_mitre_shortname", "") for o in tactic_objects}

        matrix = next((o for o in active if o.get("type") == "x-mitre-matrix" and o.get("name") == "Enterprise ATT&CK"), None)
        matrix_refs = matrix.get("tactic_refs", []) if matrix else []
        ordered_shortnames = [tactic_by_stix[x] for x in matrix_refs if x in tactic_by_stix]
        if not ordered_shortnames:
            ordered_shortnames = TACTIC_ORDER
        tactic_by_shortname = {o.get("x_mitre_shortname"): o for o in tactic_objects}
        self.tactics = []
        for i, short_name in enumerate(ordered_shortnames):
            tactic_object = tactic_by_shortname.get(short_name, {})
            external_id = self._external_id(tactic_object)
            reference = next((ref for ref in tactic_object.get("external_references", []) if ref.get("source_name") == "mitre-attack"), {})
            self.tactics.append(Tactic(
                id=short_name, short_name=short_name, external_id=external_id,
                name=tactic_object.get("name", short_name.replace("-", " ").title()),
                description=tactic_object.get("description", ""), url=reference.get("url"), order=i,
            ))

        parent_stix: dict[str, str] = {}
        for obj in active:
            if obj.get("type") == "relationship" and obj.get("relationship_type") == "subtechnique-of":
                parent_stix[obj.get("source_ref", "")] = obj.get("target_ref", "")

        attack_patterns = [o for o in active if o.get("type") == "attack-pattern" and self._external_id(o)]
        id_by_stix = {o["id"]: self._external_id(o) for o in attack_patterns}
        name_by_external = {self._external_id(o): o.get("name", "") for o in attack_patterns}
        for obj in attack_patterns:
            external_id = self._external_id(obj)
            phases = [p.get("phase_name") for p in obj.get("kill_chain_phases", []) if p.get("kill_chain_name") == "mitre-attack"]
            parent_id = id_by_stix.get(parent_stix.get(obj["id"], ""))
            technique = Technique(
                id=external_id, name=obj.get("name", external_id),
                description=obj.get("description", ""), tactics=list(dict.fromkeys(phases)),
                parent_id=parent_id, parent_name=name_by_external.get(parent_id),
                platforms=obj.get("x_mitre_platforms", []), url=self.technique_url(external_id),
            )
            self.technique_by_id[external_id] = technique
            if parent_id:
                self.parent_by_subtechnique[external_id] = parent_id

        for tactic in self.tactics:
            self.techniques_by_tactic[tactic.short_name] = sorted(
                [t for t in self.technique_by_id.values() if tactic.short_name in t.tactics],
                key=lambda t: (t.parent_id or t.id, bool(t.parent_id), t.id),
            )

    def has_technique(self, technique_id: str) -> bool:
        return technique_id.upper() in self.technique_by_id

    def get_technique(self, technique_id: str) -> Technique | None:
        return self.technique_by_id.get(technique_id.upper())

    def matrix(self) -> list[MatrixColumn]:
        return [MatrixColumn(tactic=t, techniques=self.techniques_by_tactic.get(t.short_name, [])) for t in self.tactics]

    def get_tactic(self, short_name: str) -> Tactic | None:
        return next((tactic for tactic in self.tactics if tactic.short_name == short_name), None)
