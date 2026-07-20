# Repository Strategy — OSA vs Earth-OS-Pilot-B

This document defines which GitHub repository is canonical, how the two repos relate, and where CI/CD and releases run.

## Summary

| Role | Repository | Default branch | Purpose |
|------|------------|----------------|---------|
| **Canonical** | [warheart1984-ctrl/OSA](https://github.com/warheart1984-ctrl/OSA) | `main` | Source of truth, PRs, tags, CI/CD, container images, production deploys |
| **Mirror** | [warheart1984-ctrl/Earth-OS-Pilot-B](https://github.com/warheart1984-ctrl/Earth-OS-Pilot-B) | `master` | Read-only sync of OSA for EarthOS Pilot B naming / historical links |

**Rule:** Commit and push to **OSA** only. Earth-OS-Pilot-B is updated automatically by the mirror workflow (or manually in an emergency).

## Why two repos?

- **OSA** — Product name for the certified constitutional runtime (Evidence Freeze `osa-v1.0.0`, L4 governance, GHCR `ghcr.io/warheart1984-ctrl/osa/*`).
- **Earth-OS-Pilot-B** — EarthOS program pilot identifier; kept in sync so existing bookmarks and docs still resolve.

Same codebase, one canonical remote.

## Local clone setup

```bash
git clone https://github.com/warheart1984-ctrl/OSA.git
cd OSA
git checkout main
```

Optional second remote if you need to inspect the mirror:

```bash
git remote add pilot-b https://github.com/warheart1984-ctrl/Earth-OS-Pilot-B.git
```

### Legacy working copy (`G:\EarthOS-Pilot-B`)

Recommended remotes:

| Remote | URL | Use |
|--------|-----|-----|
| `origin` | `https://github.com/warheart1984-ctrl/OSA.git` | **Push here** |
| `pilot-b` | `https://github.com/warheart1984-ctrl/Earth-OS-Pilot-B.git` | Mirror (do not push unless mirror is broken) |

```powershell
cd G:\EarthOS-Pilot-B
git remote rename origin pilot-b
git remote rename osa origin
git branch -M main
git branch --set-upstream-to=origin/main main
```

## CI/CD and releases (OSA only)

All production automation runs on **OSA**:

| Workflow | File | Triggers on OSA |
|----------|------|-----------------|
| Constitutional CI/CD (L1–L5, images, production gate) | `.github/workflows/ci-cd.yml` | Push to `main`, tags `osa-v*` |
| Mirror to Earth-OS-Pilot-B | `.github/workflows/mirror-to-earth-os-pilot-b.yml` | Push to `main`, tags `osa-v*` |
| Pilot federation smoke CI | `.github/workflows/ci.yml` | Push to `main` / `master` (both repos) |

### Production deployment gate

Production deploys require **exactly** tag `osa-v1.0.0` (Evidence Freeze v1.0). Enforced in `ci-cd.yml`:

- Only `osa-v1.0.0` passes the immutable-tag check
- Other tags (e.g. `osa-v1.0.1`) are blocked until a constitutional amendment (Article 9) and a new freeze

### Container registry

Images are published from OSA tag pushes:

```
ghcr.io/warheart1984-ctrl/osa/<service>:osa-v1.0.0
```

## Mirror workflow setup (one-time)

The mirror pushes `main` → `master` and all tags to Earth-OS-Pilot-B.

1. Create a fine-grained PAT (or classic PAT) with **Contents: Read and write** on `Earth-OS-Pilot-B`.
2. In **OSA** repo: **Settings → Secrets and variables → Actions** → New secret:
   - Name: `PILOT_B_MIRROR_TOKEN`
   - Value: the PAT
3. Push to `main` on OSA; workflow `.github/workflows/mirror-to-earth-os-pilot-b.yml` runs automatically.

Manual mirror (if Actions secret is not configured yet):

```bash
git push pilot-b main:master --tags
```

## Contributor workflow

1. Branch from `main` on a clone of **OSA**
2. Open PR against `warheart1984-ctrl/OSA` → `main`
3. Merge on OSA
4. Mirror updates Earth-OS-Pilot-B; do **not** open parallel PRs on Earth-OS-Pilot-B

## Release lineage (stewardship)

Repository strategy is part of the OSA **stewardship model**, not only Git hygiene. Governed releases form an auditable chain from product → constitutional freeze → certified reference runtime → future versions.

See **[RELEASE-LINEAGE.md](./RELEASE-LINEAGE.md)** for the full lineage model, required release-record fields, and Article 9 amendment path. Machine-readable records live under `releases/<tag>/RELEASE-RECORD.yaml` (schema: `releases/RELEASE-RECORD-SCHEMA.yaml`).

| Release | Tag | Record |
|---------|-----|--------|
| Constitutional Freeze v1.0 | `osa-v1.0.0` | [releases/osa-v1.0.0/RELEASE-RECORD.yaml](./releases/osa-v1.0.0/RELEASE-RECORD.yaml) |

Tags are cut on **OSA** only; the mirror receives them via the mirror workflow.

## Constitutional baseline

Immutable production baseline:

```bash
git checkout osa-v1.0.0
```

Tag `osa-v1.0.0` points to commit `c7166875596f9347622abed6271f72eb15ce39fb` (Evidence Freeze v1.0). Any production change requires Article 9 amendment, a new evidence freeze, a new release record, and an updated CI/CD production tag gate.

## Quick reference

| Action | Where |
|--------|--------|
| Clone | `git clone https://github.com/warheart1984-ctrl/OSA.git` |
| Daily development | Push to `origin` (OSA) `main` |
| Release / production tag | Tag on OSA only (`osa-v*`) |
| CI/CD & GHCR publish | OSA GitHub Actions |
| EarthOS Pilot B mirror | Automatic (or `git push pilot-b main:master --tags`) |
