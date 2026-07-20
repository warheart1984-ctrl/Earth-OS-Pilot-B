# Release Lineage — OSA Constitutional Runtime

This document defines the formal release lineage model for the OSA constitutional runtime. Release lineage is part of the **stewardship model** (Constitution Article 10): it binds repository strategy, evidence freezes, certification, and production deployment to a single auditable chain.

Any implementation must be able to answer:

> **What exact constitutional baseline and evidence package was this system validated against?**

---

## Lineage Chain

```
OSA (product / program)
  ↓
osa-v1.0.0 — Constitutional Freeze (Evidence Freeze v1.0)
  ↓
Certified Reference Runtime (L4 Constitutional Governance)
  ↓
Future governed versions (Article 9 amendment → new freeze → new certification)
```

| Stage | Meaning | Canonical artifact |
|-------|---------|-------------------|
| **OSA** | The constitutional runtime product and stewardship program | Repository [warheart1984-ctrl/OSA](https://github.com/warheart1984-ctrl/OSA) |
| **Constitutional freeze** | Immutable tag pinning constitution, specs, runtime, conformance, and evidence | Git tag `osa-v*`, directory `evidence-freeze/vX.Y/` |
| **Certified reference runtime** | Runtime + images + compliance package validated at a conformance level | `releases/<tag>/RELEASE-RECORD.yaml` + `compliance-package/` |
| **Future governed versions** | Successor baselines created only through Article 9 | New tag, new freeze manifest, new release record |

The mirror repository [Earth-OS-Pilot-B](https://github.com/warheart1984-ctrl/Earth-OS-Pilot-B) carries the same lineage artifacts but does **not** originate releases. See [REPOSITORY-STRATEGY.md](./REPOSITORY-STRATEGY.md).

---

## Release Record (Required Fields)

Every governed release **must** publish a machine-readable record at:

```
releases/<release-tag>/RELEASE-RECORD.yaml
```

Each record carries **six mandatory fields**:

| Field | Description | Example (v1.0.0) |
|-------|-------------|-------------------|
| `constitutional_version` | Ratified Layer-1 constitutional documents | `1.0.0` (`constitution/OSA-Constitution-v1.0.md`, ACC, CSD, CECD, ECED) |
| `normative_specification_version` | Layer 2–9 normative specs frozen with the release | `1.0.0` (`specs/OSA-*-v1.0.md`, six specifications) |
| `runtime_version` | Certified runtime modules and container image tag | `1.0.0` / image tag `osa-v1.0.0` |
| `conformance_suite_version` | Conformance suite used for certification | `1.0.0` (`@osa/conformance-suite`) |
| `evidence_package_hash` | Cryptographic binding to the frozen evidence package | Git tree or `sha3-256:` hash of `evidence-freeze/vX.Y/` |
| `certification_record` | L4 (or higher) certification identity and report references | Certificate ID, evidence ID, issuing authority, report paths |

Schema and validation rules: [releases/RELEASE-RECORD-SCHEMA.yaml](./releases/RELEASE-RECORD-SCHEMA.yaml).

---

## Current Baseline

| Property | Value |
|----------|-------|
| Release tag | `osa-v1.0.0` |
| Git commit | `c7166875596f9347622abed6271f72eb15ce39fb` |
| Evidence freeze | `evidence-freeze/v1.0/` |
| Release record | [releases/osa-v1.0.0/RELEASE-RECORD.yaml](./releases/osa-v1.0.0/RELEASE-RECORD.yaml) |
| Certification | L4 Constitutional Governance — `OSA-L4-CERT-20260719-001` |
| Production gate | CI/CD requires exact tag `osa-v1.0.0` (`.github/workflows/ci-cd.yml`) |

Verify baseline:

```bash
git fetch --tags
git checkout osa-v1.0.0
git rev-parse HEAD   # must match release record commit
```

---

## Creating Future Governed Versions

No release may bypass the constitutional amendment path (Article 9, Section 9.1):

1. **Proposal** — Constitutional Steward submits amendment with E₄ evidence.
2. **Review** — 30-day public review; Constitutional Review Council majority.
3. **Ratification** — Ratification Assembly supermajority (≥2/3); entrenched articles require unanimity (Section 9.2).
4. **Replay verification** — Full replay of affected components (Section 9.3).
5. **Evidence freeze** — New directory `evidence-freeze/vX.Y/` with updated `EVIDENCE-FREEZE-MANIFEST.md` and per-artifact hashes.
6. **Tag** — New immutable tag `osa-vX.Y.Z` on the canonical **OSA** repository only.
7. **Certification** — Conformance suite at target level (L4+); updated `compliance-package/`.
8. **Release record** — `releases/osa-vX.Y.Z/RELEASE-RECORD.yaml` populated from steps 5–7.
9. **CI/CD gate** — Update production tag gate in `ci-cd.yml` only after steps 1–8 complete.
10. **Mirror** — Mirror workflow propagates tag to Earth-OS-Pilot-B (see [REPOSITORY-STRATEGY.md](./REPOSITORY-STRATEGY.md)).

Until step 9 completes, production remains pinned to the prior certified tag.

---

## Repository Strategy Integration

Release lineage is not separate from repository hygiene—it **is** stewardship:

| Stewardship concern | Document / mechanism |
|--------------------|----------------------|
| Canonical source & mirror | [REPOSITORY-STRATEGY.md](./REPOSITORY-STRATEGY.md) |
| Immutable artifact set | `evidence-freeze/vX.Y/EVIDENCE-FREEZE-MANIFEST.md` |
| Certification artifacts | `compliance-package/` |
| Machine-readable release identity | `releases/<tag>/RELEASE-RECORD.yaml` |
| Production deployment | [PRODUCTION-DEPLOYMENT.md](./PRODUCTION-DEPLOYMENT.md) |
| Amendment authority | `constitution/OSA-Constitution-v1.0.md` Article 9 |

Contributors merge to **OSA** `main`; tags and release records are cut on OSA only. The mirror receives tags automatically and must not fork lineage.

---

## Answering the Baseline Question

Implementations, operators, and auditors should resolve baseline in this order:

1. Read `releases/<deployed-tag>/RELEASE-RECORD.yaml` (or query runtime metadata if exposed).
2. Confirm git tag: `git describe --tags --exact-match` equals the record's `release_tag`.
3. Confirm commit: `git rev-parse HEAD` equals `git_commit`.
4. Verify evidence package hash against `evidence-freeze/vX.Y/` at that commit.
5. Cross-check `certification_record` against `compliance-package/report/`.

Container deployments additionally pin images to `ghcr.io/warheart1984-ctrl/osa/<service>:<release_tag>` as documented in the release record.

---

## Related Documents

- [REPOSITORY-STRATEGY.md](./REPOSITORY-STRATEGY.md) — canonical repo, mirror, CI/CD
- [PRODUCTION-DEPLOYMENT.md](./PRODUCTION-DEPLOYMENT.md) — deployment and rollback
- [evidence-freeze/v1.0/EVIDENCE-FREEZE-MANIFEST.md](./evidence-freeze/v1.0/EVIDENCE-FREEZE-MANIFEST.md) — frozen artifact inventory
- [compliance-package/COMPLIANCE-PACKAGE-README.md](./compliance-package/COMPLIANCE-PACKAGE-README.md) — certification package index
- [constitution/OSA-Constitution-v1.0.md](./constitution/OSA-Constitution-v1.0.md) — Articles 9–11 (amendment, stewardship, conformance)

---

*Constitutional Engineering Methodology — OSA Release Lineage v1.0*
