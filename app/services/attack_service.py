from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

from app.models.attack import MatrixColumn, Tactic, Technique

DOMAIN_ORDER = ("enterprise", "mobile", "ics")
DOMAIN_LABELS = {"enterprise": "Enterprise", "mobile": "Mobile", "ics": "ICS"}
MATRIX_NAMES = {
    "enterprise": "Enterprise ATT&CK",
    "mobile": "Mobile ATT&CK",
    "ics": "ATT&CK for ICS",
}
REFERENCE_SOURCES = {"mitre-attack", "mitre-mobile-attack", "mitre-ics-attack"}


class AttackDataError(RuntimeError):
    pass


@dataclass
class DomainIndex:
    key: str
    label: str
    data_path: Path
    technique_by_id: dict[str, Technique]
    techniques_by_tactic: dict[str, list[Technique]]
    parent_by_subtechnique: dict[str, str]
    tactics: list[Tactic]


class AttackService:
    """Loads fixed local ATT&CK domain bundles once and exposes normalized indexes."""

    def __init__(self, data_paths: Path | dict[str, Path], version: str = "19.2") -> None:
        if isinstance(data_paths, Path):
            data_paths = {"enterprise": data_paths}
        self.version = version
        self.domains: dict[str, DomainIndex] = {}
        for domain in DOMAIN_ORDER:
            if domain in data_paths:
                self.domains[domain] = self._load_domain(domain, Path(data_paths[domain]))
        if not self.domains:
            raise AttackDataError("No ATT&CK domain data was configured")

        # Compatibility indexes expose a union while domain-specific indexes remain authoritative.
        self.technique_by_id: dict[str, Technique] = {}
        self.parent_by_subtechnique: dict[str, str] = {}
        for domain in self.available_domains:
            index = self.domains[domain]
            for technique_id, technique in index.technique_by_id.items():
                self.technique_by_id.setdefault(technique_id, technique)
            self.parent_by_subtechnique.update(index.parent_by_subtechnique)
        merged = self.matrix(self.available_domains)
        self.tactics = [column.tactic for column in merged]
        self.techniques_by_tactic = {column.tactic.short_name: column.techniques for column in merged}

    @property
    def available_domains(self) -> list[str]:
        return [domain for domain in DOMAIN_ORDER if domain in self.domains]

    @staticmethod
    def _reference(obj: dict) -> dict:
        return next((ref for ref in obj.get("external_references", [])
                     if ref.get("source_name") in REFERENCE_SOURCES and ref.get("external_id")), {})

    @classmethod
    def _external_id(cls, obj: dict) -> str | None:
        return cls._reference(obj).get("external_id")

    @staticmethod
    def technique_url(technique_id: str) -> str:
        tid = technique_id.upper()
        if not re.fullmatch(r"T\d{4}(?:\.\d{3})?", tid):
            raise ValueError("invalid ATT&CK technique ID")
        return "https://attack.mitre.org/techniques/" + tid.replace(".", "/") + "/"

    def _load_domain(self, domain: str, data_path: Path) -> DomainIndex:
        if not data_path.is_file():
            raise AttackDataError(f"ATT&CK {domain} data not found at {data_path}. See data/attack/README.md.")
        try:
            objects = json.loads(data_path.read_text(encoding="utf-8"))["objects"]
        except (OSError, json.JSONDecodeError, KeyError) as exc:
            raise AttackDataError(f"Unable to read ATT&CK {domain} STIX bundle: {exc}") from exc

        active = [obj for obj in objects if not obj.get("revoked") and not obj.get("x_mitre_deprecated")]
        tactic_objects = [obj for obj in active if obj.get("type") == "x-mitre-tactic"]
        tactic_by_stix = {obj["id"]: obj.get("x_mitre_shortname", "") for obj in tactic_objects}
        matrix = next((obj for obj in active if obj.get("type") == "x-mitre-matrix"
                       and obj.get("name") == MATRIX_NAMES[domain]), None)
        if not matrix:
            raise AttackDataError(f"{MATRIX_NAMES[domain]} matrix not found in {data_path}")
        ordered_shortnames = [tactic_by_stix[ref] for ref in matrix.get("tactic_refs", []) if ref in tactic_by_stix]
        tactic_by_shortname = {obj.get("x_mitre_shortname"): obj for obj in tactic_objects}
        tactics: list[Tactic] = []
        for order, short_name in enumerate(ordered_shortnames):
            obj = tactic_by_shortname.get(short_name, {})
            reference = self._reference(obj)
            tactics.append(Tactic(
                id=short_name, short_name=short_name, external_id=reference.get("external_id"),
                name=obj.get("name", short_name.replace("-", " ").title()),
                description=obj.get("description", ""), url=reference.get("url"), order=order,
                domains=[domain],
            ))

        parent_stix = {
            obj.get("source_ref", ""): obj.get("target_ref", "")
            for obj in active
            if obj.get("type") == "relationship" and obj.get("relationship_type") == "subtechnique-of"
        }
        patterns = [obj for obj in active if obj.get("type") == "attack-pattern" and self._external_id(obj)]
        id_by_stix = {obj["id"]: self._external_id(obj) for obj in patterns}
        name_by_external = {self._external_id(obj): obj.get("name", "") for obj in patterns}
        technique_by_id: dict[str, Technique] = {}
        parent_by_subtechnique: dict[str, str] = {}
        for obj in patterns:
            external_id = self._external_id(obj)
            phases = [phase.get("phase_name") for phase in obj.get("kill_chain_phases", [])
                      if phase.get("kill_chain_name") in REFERENCE_SOURCES]
            parent_id = id_by_stix.get(parent_stix.get(obj["id"], ""))
            reference = self._reference(obj)
            technique = Technique(
                id=external_id, name=obj.get("name", external_id), description=obj.get("description", ""),
                tactics=list(dict.fromkeys(phases)), parent_id=parent_id,
                parent_name=name_by_external.get(parent_id), platforms=obj.get("x_mitre_platforms", []),
                url=reference.get("url") or self.technique_url(external_id), domains=[domain],
            )
            technique_by_id[external_id] = technique
            if parent_id:
                parent_by_subtechnique[external_id] = parent_id

        techniques_by_tactic = {
            tactic.short_name: sorted(
                [item for item in technique_by_id.values() if tactic.short_name in item.tactics],
                key=lambda item: (item.parent_id or item.id, bool(item.parent_id), item.id),
            )
            for tactic in tactics
        }
        return DomainIndex(domain, DOMAIN_LABELS[domain], data_path, technique_by_id,
                           techniques_by_tactic, parent_by_subtechnique, tactics)

    def normalize_domains(self, domains: list[str] | tuple[str, ...] | None) -> list[str]:
        if not domains:
            return self.available_domains
        return [domain for domain in DOMAIN_ORDER if domain in domains and domain in self.domains]

    def domain_metadata(self) -> list[dict[str, str]]:
        return [{"id": key, "name": self.domains[key].label} for key in self.available_domains]

    def has_technique(self, technique_id: str) -> bool:
        tid = technique_id.upper()
        return any(tid in index.technique_by_id for index in self.domains.values())

    def domains_for_technique(self, technique_id: str) -> list[str]:
        tid = technique_id.upper()
        return [domain for domain in self.available_domains if tid in self.domains[domain].technique_by_id]

    def domains_for_tactic(self, short_name: str) -> list[str]:
        return [domain for domain in self.available_domains
                if any(tactic.short_name == short_name for tactic in self.domains[domain].tactics)]

    def get_technique(self, technique_id: str, domain: str | None = None) -> Technique | None:
        tid = technique_id.upper()
        candidates = [domain] if domain else self.available_domains
        return next((self.domains[key].technique_by_id[tid] for key in candidates
                     if key in self.domains and tid in self.domains[key].technique_by_id), None)

    def get_tactic(self, short_name: str, domain: str | None = None) -> Tactic | None:
        candidates = [domain] if domain else self.available_domains
        return next((tactic for key in candidates if key in self.domains
                     for tactic in self.domains[key].tactics if tactic.short_name == short_name), None)

    def techniques_for_tactic(self, short_name: str, domain: str) -> list[Technique]:
        return self.domains[domain].techniques_by_tactic.get(short_name, []) if domain in self.domains else []

    def children_for_technique(self, technique_id: str, domain: str) -> list[Technique]:
        if domain not in self.domains:
            return []
        return sorted([item for item in self.domains[domain].technique_by_id.values()
                       if item.parent_id == technique_id.upper()], key=lambda item: item.id)

    def matrix(self, domains: list[str] | tuple[str, ...] | None = None) -> list[MatrixColumn]:
        selected = self.normalize_domains(domains)
        tactic_order: list[str] = []
        tactic_values: dict[str, Tactic] = {}
        techniques: dict[str, dict[str, Technique]] = {}
        for domain in selected:
            index = self.domains[domain]
            for tactic in index.tactics:
                key = tactic.short_name
                if key not in tactic_values:
                    tactic_order.append(key)
                    tactic_values[key] = tactic.model_copy(deep=True)
                    techniques[key] = {}
                elif domain not in tactic_values[key].domains:
                    tactic_values[key].domains.append(domain)
                for item in index.techniques_by_tactic.get(key, []):
                    if item.id not in techniques[key]:
                        techniques[key][item.id] = item.model_copy(deep=True)
                    elif domain not in techniques[key][item.id].domains:
                        techniques[key][item.id].domains.append(domain)
        return [MatrixColumn(
            tactic=tactic_values[key],
            techniques=sorted(techniques[key].values(), key=lambda item: (item.parent_id or item.id, bool(item.parent_id), item.id)),
        ) for key in tactic_order]
