# CESF v1.2 Traceability — EarthOS Pilot B

## Scope

Pilot B extends Pilot A into multi-cluster federated governance, implementing CESF v1.2 L4–L5 conformance.

## Traceability Matrix

| CESF v1.2 Section | Requirement | Pilot B Artifact | Status |
|--------------------|-------------|------------------|--------|
| §2.1 CAL Token Format | Supports federated CAL tokens | `federation/core/src/types.ts` (FederatedCALToken) | ✅ |
| §2.2 Authorization | Cross-cluster authorization | `federation/core/src/engine.ts` | ✅ |
| §2.3 Append-Only Registry | Federated registry hash chains | `federation/core/src/registry.ts` | ✅ |
| §2.4 Replay Equivalence | Federated replay determinism | `federation/core/src/verifier.ts`, replay vectors | ✅ |
| §5 CCT Conformance | L4–L5 federated conformance | `cct-suite/L4/`, `cct-suite/L5/` | ✅ |
| §8.1 Federation Treaty | Treaty-based cross-cluster links | `federation/core/src/engine.ts` (signTreaty, peer linking) | ✅ |
| §8.2 Federated Revocation | Revocation propagation across clusters | `federation/core/src/engine.ts` (applyRemoteRevocation) | ✅ |
| §8.3 Cross-Cluster Delegation | Delegated authority chain preservation | `cct-suite/L4/L4-004` defines test | ✅ (structural) |
| §8.4 Evidence Lineage | Federated evidence chain | `cct-suite/L5/` defines tests; evidence/packets/ empty | ⚠️ Structural only |
| §3.1 CPBA Barriers | Federated barrier evaluation | Inherited from Pilot A via schema | ⚠️ No standalone implementation |
| §3.2 CPRM Readiness | Federated readiness model | Inherited from Pilot A via schema | ⚠️ No standalone implementation |

## Coverage Summary

- **11 applicable sections:** 7 fully implemented, 2 structural only, 2 inherited
- **Implementation conformance:** L4–L5 (7 tests, 100% pass)
- **Skill conformance:** 4 skills at 100%

## Gaps

- Evidence packets not yet generated (evidence/packets/ empty)
- Federated CPBA/CPRM rely on Pilot A schemas; no federation-specific barrier analysis
- Cluster stubs empty — only in-memory federation tests exist
- L5-003/004 (conflict resolution, cross-architecture) require multi-node deployment
