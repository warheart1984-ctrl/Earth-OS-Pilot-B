# OSA Deployment & Demonstration Guide

## Quick Start

```bash
# 1. Clone and build
git clone https://github.com/warheart1984-ctrl/OSA.git
cd OSA

# 2. Generate signing keys
mkdir -p keys
openssl genpkey -algorithm ed25519 -out keys/signing.key
openssl pkey -in keys/signing.key -pubout -out keys/signing.key.pub

# 3. Deploy stack
docker-compose up -d

# 4. Run conformance suite
docker-compose --profile conformance up conformance-runner

# 5. Verify L4 certification
cat conformance-results/L4-certification-report.md
```

## Evidence Freeze v1.0

All constitutional documents and API contracts are frozen at:
```
evidence-freeze/v1.0/
├── constitution/
│   ├── OSA-Constitution-v1.0.md
│   ├── OSA-ACC-v1.0.md
│   ├── OSA-CSD-v1.0.md
│   ├── OSA-CECD-v1.0.md
│   └── OSA-ECED-v1.0.md
├── specs/
│   ├── OSA-Reference-Architecture-v1.0.md
│   ├── OSA-API-Specifications-v1.0.md
│   ├── OSA-Runtime-Specifications-v1.0.md
│   ├── OSA-Evidence-Specification-v1.0.md
│   ├── OSA-Conformance-Specification-v1.0.md
│   └── OSA-CGL-v1.0.md
├── conformance/
│   ├── index.ts
│   ├── types.ts
│   ├── conformance-runner.ts
│   ├── evidence-validator.ts
│   ├── replay-verifier.ts
│   ├── causality-checker.ts
│   └── federation-simulator.ts
└── api/
    ├── graphql-schema.ts
    └── rest-routes.ts
```

Hash verification:
```bash
sha3-256sum evidence-freeze/v1.0/**/*
```

## L4 Certification Process

```bash
# Run full conformance suite
docker-compose --profile conformance up conformance-runner

# Expected output: L4 certification granted
# All L1-L4 tests pass (100%)
# 1000 decisions: 100% replay match
# Evidence chain: 100% verified
```

## Deterministic Replay Demo

```bash
# 1. Create test decisions
curl -X POST http://localhost:8080/api/v1/decision/decide \
  -H "Authorization: Bearer $OSA_API_KEY" \
  -d '{
    "authority_id": "auth:osa:orbital-awareness:satellite-tracking",
    "policy_id": "pol:osa:orbital-tracking:v1.2",
    "kernel_authz_id": "authz:gk:20260719-0001",
    "input_evidence": ["E1-OSA-ORB-20260719-0001"],
    "context": {...},
    "decision_type": "CONJUNCTION_ASSESSMENT"
  }'

# 2. Replay the decision
curl -X POST http://localhost:8080/api/v1/decision/replay \
  -H "Authorization: Bearer $OSA_API_KEY" \
  -d '{
    "decision_id": "D-OSA-20260719-0001",
    "policy_wasm_hash": "sha3-256:...",
    "input_evidence_hashes": ["sha3-256:..."],
    "runtime_version": "decision-engine-1.0.0"
  }'

# 3. Verify match
# {"match": true, "original_hash": "...", "replay_hash": "..."}
```

## Evidence Chain Verification

```bash
# Verify single source chain
curl -X POST http://localhost:8082/api/v1/evidence/verify \
  -H "Authorization: Bearer $OSA_API_KEY" \
  -d '{
    "source": "governance-kernel",
    "level": "E2"
  }'

# {"ok": true, "entries_verified": 1247}
```

## CGL SDK External Client Demo

```typescript
// external-client.ts
import { createOSAClient, governedOperation, createEvidenceSource } from '@osa/cgl';

const client = await createOSAClient({
  kernelEndpoint: 'http://localhost:8081',
  ledgerEndpoint: 'http://localhost:8082',
  decisionEndpoint: 'http://localhost:8084',
  apiKey: process.env.OSA_API_KEY
});

const result = await governedOperation({
  authorityId: 'auth:osa:orbital-awareness:satellite-tracking',
  policyId: 'pol:osa:orbital-tracking:v1.2',
  holder: createEvidenceSource('agent', 'my-satellite-tracker'),
  action: { resource: 'satellite:catalog', action: 'read' },
  context: {
    actor: createEvidenceSource('agent', 'my-satellite-tracker'),
    request: { satelliteId: 'SAT-123' },
    environment: { classification: 'UNCLASSIFIED' },
    constraints: { timeWindow: { start: now(), end: addDays(now(), 1) } }
  },
  inputEvidence: ['E1-OSA-ORB-20260719-0001'],
  decisionType: 'CONJUNCTION_ASSESSMENT',
  operation: async () => {
    const tracking = await client.observation.trackSatellite('SAT-123');
    return tracking;
  },
  kernelClient: client.kernel,
  decisionEngineClient: client.decision,
  evidenceLedgerClient: client.ledger,
  auditEngineClient: client.audit
});

console.log(`Decision: ${result.decisionId}, Evidence: ${result.evidenceRef}`);
```

## EarthOS Pilot B Federation

```bash
# 1. Create federation treaty
curl -X POST http://localhost:8088/api/v1/federation/treaty \
  -H "Authorization: Bearer $OSA_API_KEY" \
  -d '{
    "type": "FEDERATION",
    "parties": ["OSA", "EarthOS-Pilot-B"],
    "constitutional_basis": "OSA-Constitution-v1.0 Article 8",
    "terms": {
      "recognize_tokens": true,
      "propagate_revocation": true,
      "share_evidence": true,
      "sync_interval_ms": 300000,
      "authority_domains": ["orbital-awareness", "climate-observation", "navigation"]
    }
  }'

# 2. Import federated token
curl -X POST http://localhost:8088/api/v1/federation/authority/import \
  -H "Authorization: Bearer $OSA_API_KEY" \
  -d '{
    "treaty_id": "treaty:osa:earthos-pilot-b:20260719",
    "token": {...},
    "local_policy_id": "pol:osa:orbital-tracking:v1.2"
  }'

# 3. Verify cross-domain evidence lineage
curl http://localhost:8082/api/v1/evidence/E2-OSA-ORB-20260719-001/lineage
```

## Independent Reproduction Checklist

```bash
# Another team can reproduce:
□ Clone repo at git tag v1.0
□ Run docker-compose up -d
□ Run conformance suite: L4 PASS
□ Deploy CGL SDK client
□ Execute governed operation
□ Verify evidence chain
□ Replay decision
□ Federation handshake with EarthOS Pilot B
```

## Results Archive

All demonstration outputs are archived in `conformance-results/` with cryptographic evidence:
- `L4-certification-report.md` - Full test results
- `replay-demo-E4-OSA-REPLAY-20260719-001.json` - Replay evidence
- `chain-verification-E3-OSA-CV-20260719-001.json` - Chain integrity
- `federation-handshake-E4-OSA-FED-20260719-001.json` - Federation evidence

---
**Constitutional Engineering Methodology Applied** — OSA v1.0 Reference Implementation