# OSA Production Deployment Guide

## Prerequisites

- Docker Swarm cluster (3+ manager nodes)
- 3+ worker nodes with:
  - 4+ CPU cores, 8GB RAM minimum per node
  - 50GB+ SSD storage per node
- TLS certificates for inter-service communication
- External load balancer (HAProxy/NGINX) for API Gateway
- Container registry access (GHCR)

## Quick Start

```bash
# 1. Join swarm workers
docker swarm join --token <WORKER_TOKEN> <MANAGER_IP>:2377

# 2. Deploy secrets
./scripts/setup-secrets.sh

# 3. Deploy stack
docker stack deploy -c docker-compose.prod.yml osa

# 4. Verify deployment
docker stack services osa
docker stack ps osa

# 5. Run conformance suite
docker service create --name conformance-runner \
  --network osa-constitutional \
  ghcr.io/warheart1984-ctrl/osa/conformance-runner:osa-v1.0.0 \
  --level L4 --target http://api-gateway:8080
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
                        Load Balancer (443)
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
                      API Gateway (8080)
              REST + GraphQL + WebSocket + SSE
└─────────────────────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          ▼                         ▼                         ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  Agent Runtime   │    │ Mission Orch.    │    │ Sim Runtime      │
│  (8085)          │    │ (8086)           │    │ (8087)           │
└────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
                      Decision Engine (8084)
                    Kernel Authz → Policy Eval → E₂
└─────────────────────────────────────────────────────────────────┘
                    │                    │
                    ▼                    ▼
         ┌──────────────────┐  ┌──────────────────┐
         │ Policy Engine    │  │ Governance       │
         │ (8083)           │  │ Kernel (8081)    │
         └────────┬─────────┘  └────────┬─────────┘
                  │                     │
                  └─────────────────────┼──────────────┐
                                        ▼              ▼
                          ┌──────────────────┐  ┌──────────────────┐
                          │ Evidence Ledger  │  │ Audit Engine     │
                          │ (8082)           │  │ (8084)           │
                          └──────────────────┘  └──────────────────┘
```

## Service Endpoints

| Service | Internal Port | External Port | Protocol |
|---------|---------------|---------------|----------|
| API Gateway | 8080 | 443 (LB) | HTTPS/WS |
| Governance Kernel | 8081 | - | gRPC/HTTP |
| Evidence Ledger | 8082 | - | HTTP |
| Policy Engine | 8083 | - | HTTP |
| Decision Engine | 8084 | - | HTTP |
| Agent Runtime | 8085 | - | HTTP |
| Mission Orchestrator | 8086 | - | HTTP |
| Simulation Runtime | 8087 | - | HTTP |
| Federation Gateway | 8088 | - | HTTP |

## Health Checks

```bash
# All services
for port in 8080 8081 8082 8083 8084 8085 8086 8087 8088; do
  curl -f http://localhost:$port/health || echo "FAIL: $port"
done

# L4 Conformance
curl -X POST http://localhost:8080/api/v1/decision/decide \
  -H "Authorization: Bearer $OSA_API_KEY" \
  -d @test/fixtures/l4-decision.json
```

## Evidence Freeze v1.0

All deployments pinned to immutable artifacts:

| Component | Image Tag | Evidence Ref |
|-----------|-----------|--------------|
| Governance Kernel | `osa-v1.0.0` | E4-OSA-GK-20260719-001 |
| Evidence Ledger | `osa-v1.0.0` | E4-OSA-EL-20260719-001 |
| Policy Engine | `osa-v1.0.0` | E4-OSA-PE-20260719-001 |
| Decision Engine | `osa-v1.0.0` | E4-OSA-DE-20260719-001 |
| API Gateway | `osa-v1.0.0` | E4-OSA-API-20260719-001 |
| CGL SDK | `osa-v1.0.0` | E4-OSA-CGL-20260719-001 |
| Conformance Suite | `osa-v1.0.0` | E4-OSA-CERT-20260719-001 |

**No modifications without constitutional amendment (Article 9).**

## L4 Certification Verification

```bash
# Run full conformance suite
docker run --rm --network osa-constitutional \
  ghcr.io/warheart1984-ctrl/osa/conformance-runner:osa-v1.0.0 \
  --level L4 --target http://api-gateway:8080 \
  --output /results/L4-certification-report.md

# Verify output
cat /results/L4-certification-report.md
# Should show: "L4 Certification: GRANTED"
```

## Federation (EarthOS Pilot B)

```bash
# Create treaty
curl -X POST https://api.osa.space/api/v1/federation/treaty \
  -H "Authorization: Bearer $OSA_API_KEY" \
  -d '{"type": "FEDERATION", "parties": ["OSA", "EarthOS-Pilot-B"], ...}'

# Import federated token
curl -X POST https://api.osa.space/api/v1/federation/authority/import \
  -H "Authorization: Bearer $OSA_API_KEY" \
  -d '{"treaty_id": "treaty:osa:earthos-pilot-b:20260719", "token": {...}}'
```

## Rollback Procedure

```bash
# Immediate rollback (all services)
docker service update --image ghcr.io/warheart1984-ctrl/osa/governance-kernel:osa-v1.0.0 \
  osa_governance-kernel
# Repeat for all services...

# Verify rollback
docker stack services osa
docker stack ps osa --no-trunc
```

## Monitoring

- **Prometheus**: `http://prometheus:9090` (metrics endpoint on each service)
- **Grafana**: `http://grafana:3000` (dashboards for evidence chain, replay, authz)
- **Loki**: `http://loki:3100` (audit logs, evidence chain)
- **AlertManager**: PagerDuty/Slack integration for chain breaks, replay divergences

## Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Authz latency (p99) | < 50ms | > 100ms |
| Evidence write latency (p99) | < 20ms | > 50ms |
| Replay match rate | 100% | < 100% |
| Chain verification | 100% | < 100% |
| Evidence chain integrity | 100% | < 100% |

## Backup Strategy

```bash
# Daily Evidence Ledger backup
docker run --rm -v evidence-ledger-data:/data \
  alpine tar czf - /data | gzip > backup/evidence-ledger-$(date +%Y%m%d).tar.gz

# Weekly Constitutional State backup
docker exec osa_governance-kernel \
  cat /data/constitutional-state.json | gzip > backup/state-$(date +%Y%m%d).json.gz
```

## Constitutional Amendment Process

For any production change:

1. **Propose** amendment with E₄ evidence
2. **30-day** public review
3. **Constitutional Review Council** majority
4. **Ratification Assembly** ≥2/3 supermajority
5. **Full replay verification** of affected components
6. **New Evidence Freeze** v1.x with updated hashes
7. **Deploy** new immutable tag `osa-v1.x.0`

---

**Constitutional Engineering Methodology Applied** — OSA v1.0 Reference Implementation