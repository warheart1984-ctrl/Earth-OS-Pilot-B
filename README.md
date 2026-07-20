# EarthOS Pilot B — Federated Constitutional Network

> **Repository note:** This folder is the OSA constitutional runtime. **Canonical GitHub repo:** [warheart1984-ctrl/OSA](https://github.com/warheart1984-ctrl/OSA) (`main`). [Earth-OS-Pilot-B](https://github.com/warheart1984-ctrl/Earth-OS-Pilot-B) is an automated mirror (`master`). See [REPOSITORY-STRATEGY.md](./REPOSITORY-STRATEGY.md) for CI/CD, releases, and local remote setup. **Release lineage & certification baseline:** [RELEASE-LINEAGE.md](./RELEASE-LINEAGE.md) (current record: [releases/osa-v1.0.0/RELEASE-RECORD.yaml](./releases/osa-v1.0.0/RELEASE-RECORD.yaml)).

**Version:** Pilot B  
**Status:** Multi-Cluster Federated Governance  
**Purpose:** Extends Pilot A into a multi-cluster, federated constitutional network enabling cross-domain authority propagation, federated revocation, and federated evidence lineage

---

## Overview

EarthOS Pilot B extends Pilot A from a single-node sandbox into a multi-cluster, federated constitutional network. This pilot enables cross-domain authority propagation, federated revocation, and federated evidence lineage across multiple constitutional governance clusters.

---

## Repository Structure

```
EarthOS-Pilot-B/
├── cct-suite/              # CCT Ω∞ Conformance Suite (L4–L5)
├── clusters/               # Multi-cluster configurations
├── docs/                   # Documentation
│   ├── architecture.md     # Federated architecture
│   └── ciems-alignment.md  # CIEMS constitutional alignment
├── evidence/               # Federated evidence repository
├── federation/             # Federation core components
├── governance/             # Federated governance components
└── schemas/                # Schema definitions
```

---

## Architecture

```
┌─────────────────────┐     Federation      ┌─────────────────────┐
│  Cluster A          │◄──── Treaty ────────►│  Cluster B          │
│  ┌───────────────┐  │                     │  ┌───────────────┐  │
│  │ Registry A     │  │                     │  │ Registry B     │  │
│  │ CAL Tokens A   │  │                     │  │ CAL Tokens B   │  │
│  │ Replay Engine A│  │                     │  │ Replay Engine B│  │
│  └───────────────┘  │                     │  └───────────────┘  │
└──────────┬──────────┘                     └──────────┬──────────┘
           │                                           │
           └───────────────Federation Core─────────────┘
                           │
                    ┌──────┴──────┐
                    │ Federated   │
                    │ Governance  │
                    └─────────────┘
```

---

## Key Features

**Federated Authority Propagation:**
- Cross-domain authority propagation
- Treaty-based federation agreements
- Federated token validation
- Cross-cluster authorization

**Federated Revocation:**
- Global revocation propagation
- Cross-cluster invalidation
- Treaty-based revocation rules
- Evidence-based revocation

**Federated Evidence Lineage:**
- Cross-cluster evidence tracking
- Federated audit trails
- Treaty-based evidence sharing
- Cross-domain lineage verification

---

## CIEMS Constitutional Alignment

EarthOS Pilot B maps to CIEMS (Constitutional Intent, Evidence & Mandate System) sovereignty layers:

| CIEMS Layer | EarthOS Artifact |
|-------------|-----------------|
| Constitution | CESF v1.2 Core Principles |
| Specification | CESF v1.2 Normative Standards |
| Schema | CAL, CRC, CPBA, CPRM JSON Schemas |
| Conformance | CCT Ω∞ L4–L5 test suites |
| Implementation | Federated CGE |
| Deployment | Pilot B federated network |
| Stewardship | Evidence Stewardship Board, Promotion Authority |

### Substrate → Substration → Promotion Model

| Substration | Arena | Promotion Path |
|-------------|-------|---------------|
| Pilot B | Multi-cluster federated governance | L5 conformance + Pilot A ratification → Federation overview → Federated ratification |

### Graduation Rules

A pilot graduates from **experimental** to **ratified arena** when:

1. All applicable CCT levels pass (100%)
2. CPBA: PROMOTION_ALLOWED (all barriers satisfied)
3. CPRM: R5 readiness (all 10 contracts pass)
4. Governance Review: majority approval
5. Ratification Assembly: supermajority vote (≥2/3)

---

## CIEMS-Enhanced Governance

| Governance Body | CIEMS Role |
|----------------|------------|
| Evidence Stewardship Board | Validates substrat evidence before promotion |
| Promotion Authority | Evaluates promotion readiness across all 6 CIEMS layers |
| Constitutional Review Council | Ensures constitutional consistency across substrations |
| Ratification Assembly | Ratifies substrations as sovereign arenas |

---

## Documentation

- **Architecture:** Federated architecture and cluster configurations
- **CIEMS Alignment:** Constitutional alignment with CIEMS sovereignty layers

---

## Contributing

This is a federated constitutional governance sandbox. Contributions must:

1. Follow CAS conformance requirements
2. Pass CCT Ω∞ L4–L5 conformance suite
3. Maintain federated governance capabilities
4. Preserve cross-cluster evidence lineage
5. Support federated revocation mechanisms

---

## License

See individual component documentation for specific licensing information.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| Pilot B | 2026-07-17 | Initial EarthOS Pilot B repository |

---

## Contact

For questions about EarthOS Pilot B participation, refer to the architecture documentation and CIEMS alignment guidelines.

*CIEMS canonical definition: `.codex/cse/specs/ftg/docs/CIEMS-CANONICAL-STANDARD.md`*

---

*Repository Version: Pilot B*  
*Last Updated: 2026-07-17*  
*CESF alignment: v1.1 → v1.2 (2026-07-17 drift correction)*  
*Maintainer: warheart1984-ctrl*
