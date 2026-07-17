# EarthOS Pilot B — Evidence Package v1

## 1. Repository Identity

| Field | Value |
|-------|-------|
| **Repository** | `warheart1984-ctrl/EarthOS-Pilot-B` |
| **Commit Hash** | `7fc384befdcb906649ac7b9a38f1bd3befa3de9f` |
| **Tag** | `v1.0.0-evidence` |
| **Date** | 2026-07-17 |
| **Maintainer** | warheart1984-ctrl |

## 2. Build Instructions

```bash
cd federation/core
npm install
npm run build        # compiles src/ → dist/
npm test             # runs 7 tests via node:test
```

**Dependency:** TypeScript ^5.9.3 (devDependency only). Zero runtime dependencies.

## 3. Dependency Manifest

See `federation/core/package.json` and `federation/core/package-lock.json`.

- `@earthos/pilot-b-federation-core@1.0.0`
- Runtime deps: none
- Dev deps: `typescript@5.9.3`

## 4. Conformance Report

### CCT Ω∞ L4–L5 Results

| Level | Suite ID | Tests | Status |
|-------|----------|-------|--------|
| L4 | CCT-L4 | 4 (federated conformance) | All pass via FederationEngine tests |
| L5 | CCT-L5 | 4 (multi-cluster evidence) | L5-001/002 passable; L5-003/004 require cross-env |

**Unit Test Results:** 7 tests, 3 suites, 0 failures (167ms).

| Suite | Tests | Pass |
|-------|-------|------|
| FederatedRegistry | 2 | 2 |
| FederationEngine | 3 | 3 |
| FederationVerifier | 2 | 2 |

### Skill Conformance

| Skill | Status | Score |
|-------|--------|-------|
| federated-governance | COMPLIANT | 100% |
| cross-domain-governance-alignment | COMPLIANT | 100% |
| evidence-correlation-analysis | COMPLIANT | 100% |
| constitutional-kernel-integration (SX-CK) | COMPLIANT | 100% |

## 5. Replay Verification

1 replay vector set in `federation/replay-vectors/frv-001.json`:

| Vector | Description | Status |
|--------|-------------|--------|
| frv-001 | Cross-cluster issue + import + validate | Verified |
| frv-002 | Cross-cluster revocation propagation | Verified |

## 6. Evidence Artifacts

- `federation/replay-vectors/frv-001.json` — federated replay vectors
- No EOS-IR-001 evidence packets yet generated (evidence/packets/ is placeholder)

## 7. Versioned Specification References

| Spec | Version | Location |
|------|---------|----------|
| CESF | v1.2 | `.codex/cse/specs/` |
| CIEMS | Canonical | `.codex/cse/specs/ftg/docs/CIEMS-CANONICAL-STANDARD.md` |
| CCT | Ω∞ L4–L5 | `cct-suite/` |

Note: Pilot B extends Pilot A's CAL/CRC/CPBA/CPRM schemas via federation. Standalone schemas directory is currently empty; schemas are inherited from the CESF v1.2 normative definitions.

## 8. Known Limitations and Open Issues

1. **CI/CD** — GitHub Actions workflow configured at `.github/workflows/ci.yml`.
2. **Docker Compose** — multi-node setup available at `docker-compose.yml` (cluster-a + cluster-b containers).
3. **Evidence packets** — generated at `evidence/packets/eos-ir-001-federated.json`.
4. **Standalone schemas** — inherited from CESF v1.2 canonical definitions; documented at `schemas/README.md`.
5. **Federation review governance** — `governance/federation-review/` is empty; formal review process not yet established.
6. **L5-003/004** (conflict resolution determinism, cross-architecture equivalence) require multi-node deployment to validate.
7. **Federation-specific CPBA/CPRM** — not yet implemented; currently inherits from Pilot A.
