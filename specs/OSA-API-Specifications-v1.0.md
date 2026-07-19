# OSA API Specifications — Layer 4 Intelligence Services

**System:** OuterSpace AI (OSA)  
**Version:** 1.0  
**Status:** Normative Specification  
**Authority:** OSA-CSD-v1.0.md Section 1.4  
**Conformance:** CSD-T-008, ACC-CONFORMANCE-2

---

## Overview

All Layer 4 APIs follow constitutional requirements:
- REST + GraphQL + Streaming (WebSocket)
- Authentication: CAL tokens (ACC-compliant)
- All responses include evidence reference headers
- All mutations produce E₂+ evidence and audit events
- Rate limiting via constitutional quota enforcement

---

## Common Headers

| Header | Description | Required |
|--------|-------------|----------|
| `X-OSA-CAL-Token` | CAL token for authentication | Yes (mutations) |
| `X-OSA-Evidence-Ref` | Evidence ID produced by this request | Response (mutations) |
| `X-OSA-Authority-Ref` | Authority ID exercised | Response (mutations) |
| `X-OSA-Policy-Ref` | Policy ID evaluated | Response (mutations) |
| `X-OSA-Chain-Hash` | Evidence chain hash | Response (all) |
| `X-OSA-Request-ID` | Request correlation ID | Both |
| `X-OSA-Timestamp` | RFC3339 timestamp | Both |

---

## 1. Observation API — `OSA-OBS-API-v1.0.md`

**Base Path:** `/api/v1/observation`

### REST Endpoints

#### `POST /tasks/imaging`
Request Earth/planetary imaging task.

**Request:**
```json
{
  "target": { "type": "EARTH" | "PLANETARY_BODY", "body_id": "EARTH" | "MARS" | "...", "coordinates": { "lat": 0, "lon": 0, "alt": 0 } },
  "parameters": { "resolution_m": 10, "spectral_bands": ["VIS", "NIR"], "priority": "NOMINAL" | "URGENT" },
  "authority_ref": "auth:osa:observation:imaging",
  "evidence_requirement": "E1"
}
```

**Response (202 Accepted):**
```json
{
  "task_id": "task:osa:imaging:20260719-001",
  "status": "QUEUED",
  "estimated_completion": "2026-07-19T14:30:00Z",
  "evidence_ref": "E1-OSA-OBS-20260719-001"
}
```
Headers: `X-OSA-Evidence-Ref: E1-OSA-OBS-20260719-001`

#### `GET /catalog/imagery`
Query imagery catalog.

**Query:** `?region=bbox&start=ISO8601&end=ISO8601&bands=VIS,NIR&resolution_max=10`

**Response (200):**
```json
{
  "results": [
    { "image_id": "img:osa:20260719-001", "timestamp": "2026-07-19T12:00:00Z", "bounds": {...}, "bands": ["VIS"], "resolution_m": 5, "evidence_ref": "E1-OSA-OBS-20260719-002" }
  ],
  "evidence_refs": ["E1-OSA-OBS-20260719-002", "..."]
}
```

#### `GET /data/remote-sensing/{product_id}`
Retrieve remote sensing data product.

#### `GET /data/environmental`
Query environmental sensing data.

**Query:** `?parameters=temperature,humidity,pressure&region=geojson&start=ISO8601&end=ISO8601`

### GraphQL Schema

```graphql
type ObservationTask {
  taskId: ID!
  status: TaskStatus!
  target: Target!
  parameters: ImagingParameters!
  evidenceRef: EvidenceRef!
  createdAt: DateTime!
  completedAt: DateTime
}

type ImageryRecord {
  imageId: ID!
  timestamp: DateTime!
  bounds: GeoBounds!
  bands: [SpectralBand!]!
  resolutionM: Float!
  evidenceRef: EvidenceRef!
}

type Query {
  imageryCatalog(filter: ImageryFilter): [ImageryRecord!]!
  remoteSensingProduct(id: ID!): RemoteSensingProduct
  environmentalData(filter: EnvironmentalFilter): [EnvironmentalRecord!]!
}

type Mutation {
  requestImaging(input: ImagingTaskInput!): ObservationTask!
}
```

### Streaming (WebSocket)

**Endpoint:** `wss://api.osa.space/v1/observation/stream`

**Subscribe:** `{ "type": "SUBSCRIBE", "channel": "imagery.completed", "filter": { "region": "..." } }`

**Event:** `{ "type": "IMAGERY_COMPLETED", "task_id": "...", "image_id": "...", "evidence_ref": "E1-...", "timestamp": "..." }`

---

## 2. Navigation API — `OSA-NAV-API-v1.0.md`

**Base Path:** `/api/v1/navigation`

### REST Endpoints

#### `POST /routes/compute`
Compute orbital route.

**Request:**
```json
{
  "mission_profile": { "vehicle_id": "SAT-123", "initial_state": {...}, "target_orbit": {...}, "constraints": {...} },
  "authority_ref": "auth:osa:navigation:routing",
  "evidence_requirement": "E2"
}
```

**Response (200):**
```json
{
  "route_id": "route:osa:20260719-001",
  "maneuvers": [{ "time": "...", "delta_v": [...], "duration_s": 120 }],
  "total_delta_v": 150.5,
  "evidence_ref": "E2-OSA-NAV-20260719-001"
}
```

#### `POST /routes/optimize`
Optimize existing route.

#### `POST /missions/plan`
Plan mission.

#### `POST /missions/validate`
Validate mission plan.

#### `POST /navigation/execute`
Execute autonomous navigation (vehicle must be authorized).

### GraphQL Schema

```graphql
type OrbitalRoute {
  routeId: ID!
  maneuvers: [Maneuver!]!
  totalDeltaV: Float!
  evidenceRef: EvidenceRef!
}

type MissionPlan {
  planId: ID!
  profile: MissionProfile!
  route: OrbitalRoute!
  validation: MissionValidation!
  evidenceRef: EvidenceRef!
}

type Mutation {
  computeRoute(input: RouteComputeInput!): OrbitalRoute!
  optimizeRoute(input: RouteOptimizeInput!): OrbitalRoute!
  planMission(input: MissionPlanInput!): MissionPlan!
  validateMission(planId: ID!): MissionValidation!
}
```

### Streaming

**Endpoint:** `wss://api.osa.space/v1/navigation/stream`

**Channels:** `route.computed`, `mission.planned`, `navigation.telemetry`

---

## 3. Mission API — `OSA-MIS-API-v1.0.md`

**Base Path:** `/api/v1/mission`

### REST Endpoints

#### `POST /missions`
Create mission.

#### `GET /missions/{mission_id}`
Get mission status.

#### `POST /missions/{mission_id}/actions`
Execute mission action.

#### `GET /missions/{mission_id}/telemetry`
Get mission telemetry stream (REST + Streaming).

#### `POST /missions/{mission_id}/abort`
Abort mission (requires authority).

### GraphQL

```graphql
type Mission {
  missionId: ID!
  status: MissionStatus!
  plan: MissionPlan!
  telemetry: TelemetryStream!
  evidenceRefs: [EvidenceRef!]!
}

type Mutation {
  createMission(input: MissionCreateInput!): Mission!
  executeAction(missionId: ID!, input: MissionActionInput!): MissionActionResult!
  abortMission(missionId: ID!): MissionAbortResult!
}
```

---

## 4. Knowledge API — `OSA-KNW-API-v1.0.md`

**Base Path:** `/api/v1/knowledge`

### REST Endpoints

#### `POST /entities`
Upsert space entity.

#### `GET /entities/{entity_ref}`
Get entity with evidence lineage.

#### `POST /entities/query`
Query entities with evidence.

#### `POST /relationships`
Upsert relationship.

#### `POST /graph/traverse`
Traverse knowledge graph.

### GraphQL

```graphql
type SpaceEntity {
  entityRef: ID!
  type: EntityType!
  properties: JSON!
  evidenceRefs: [EvidenceRef!]!
  relationships: [SpaceRelationship!]!
}

type Query {
  entity(ref: ID!): SpaceEntity
  queryEntities(filter: EntityFilter): [SpaceEntity!]!
  traverse(input: TraversalInput!): TraversalResult!
}
```

---

## 5. Simulation API — `OSA-SIM-API-v1.0.md`

**Base Path:** `/api/v1/simulation`

### REST Endpoints

#### `POST /simulations`
Create simulation run.

#### `GET /simulations/{sim_id}`
Get simulation status/results.

#### `POST /simulations/{sim_id}/step`
Step simulation (for interactive).

#### `GET /simulations/{sim_id}/replay`
Replay simulation (deterministic).

### GraphQL

```graphql
type Simulation {
  simulationId: ID!
  scenario: Scenario!
  status: SimulationStatus!
  results: SimulationResults!
  replayId: ID
  evidenceRef: EvidenceRef!
}
```

---

## 6. Evidence API — `OSA-EVD-API-v1.0.md`

**Base Path:** `/api/v1/evidence`

### REST Endpoints

#### `POST /evidence`
Submit evidence (E₀–E₄).

#### `GET /evidence/{evidence_id}`
Retrieve evidence by ID.

#### `GET /evidence/query`
Query evidence by criteria.

#### `GET /evidence/{evidence_id}/lineage`
Get full lineage graph.

#### `GET /evidence/{evidence_id}/verify`
Verify evidence integrity.

#### `POST /evidence/batch/verify`
Batch verify evidence chain.

### GraphQL

```graphql
type EvidenceRecord {
  evidenceId: ID!
  level: EvidenceLevel!
  timestamp: DateTime!
  source: String!
  payload: JSON!
  payloadHash: String!
  chainHash: String!
  signature: String!
  inputEvidenceRefs: [ID!]
}

type Query {
  evidence(id: ID!): EvidenceRecord
  queryEvidence(filter: EvidenceFilter): [EvidenceRecord!]!
  lineage(evidenceId: ID!): LineageGraph!
  verify(evidenceId: ID!): VerificationResult!
}
```

---

## 7. Verification API — `OSA-VER-API-v1.0.md`

**Base Path:** `/api/v1/verification`

### REST Endpoints

#### `POST /verify/decision`
Verify governed decision (replay + independent).

#### `POST /verify/evidence`
Verify evidence integrity (all levels).

#### `POST /verify/policy`
Verify policy compilation + deployment.

#### `GET /verify/status/{verification_id}`
Get verification status.

---

## 8. Governance API — `OSA-GOV-API-v1.0.md`

**Base Path:** `/api/v1/governance`

### REST Endpoints

#### `POST /authority/grant`
Grant authority (ACC).

#### `GET /authority/{authority_id}`
Get authority status.

#### `POST /authority/{authority_id}/revoke`
Revoke authority.

#### `POST /authority/delegate`
Delegate authority.

#### `POST /policy/compile`
Compile policy (source → WASM + proof).

#### `GET /policy/{policy_id}`
Get compiled policy.

#### `POST /policy/{policy_id}/deploy`
Deploy policy to Kernel.

#### `GET /audit/query`
Query audit records.

#### `GET /audit/{audit_id}`
Get audit details.

---

## 9. Agent API — `OSA-AGT-API-v1.0.md`

**Base Path:** `/api/v1/agent`

### REST Endpoints

#### `POST /agents`
Spawn agent (with authority grant).

#### `GET /agents/{agent_id}`
Get agent status.

#### `POST /agents/{agent_id}/action`
Execute agent action.

#### `POST /agents/{agent_id}/terminate`
Terminate agent.

---

## 10. Digital Twin API — `OSA-DT-API-v1.0.md`

**Base Path:** `/api/v1/digital-twin`

### REST Endpoints

#### `POST /twins`
Create digital twin.

#### `GET /twins/{twin_id}`
Get twin state.

#### `POST /twins/{twin_id}/sync`
Synchronize twin with reality.

#### `POST /twins/{twin_id}/simulate`
Run simulation on twin.

#### `GET /twins/{twin_id}/replay`
Replay twin history.

---

## Authentication & Authorization

### CAL Token Validation

All mutating endpoints require valid CAL token:
1. Extract `X-OSA-CAL-Token` header
2. Verify signature (Governance Kernel public key)
3. Check expiry
4. Check revocation (Evidence Ledger)
5. Evaluate constraints (time, classification, scope)
6. Verify evidence requirement met
7. Authorize via Governance Kernel

### Rate Limiting

Constitutional quota per authority:
- Defined in authority grant `scope.quota`
- Enforced at API Gateway
- Exhaustion → 429 with `X-OSA-Quota-Exhausted` header

---

## Error Responses

```json
{
  "error": {
    "code": "AUTHORIZATION_DENIED" | "EVIDENCE_REQUIREMENT_NOT_MET" | "AUTHORITY_REVOKED" | "POLICY_VIOLATION" | "QUOTA_EXHAUSTED" | "INVALID_REQUEST" | "INTERNAL_ERROR",
    "message": "Human-readable description",
    "details": {},
    "evidence_ref": "E3-OSA-AUDIT-...",
    "request_id": "req-..."
  }
}
```

**HTTP Status Mapping:**
- 400: INVALID_REQUEST
- 401: AUTHENTICATION_REQUIRED
- 403: AUTHORIZATION_DENIED, AUTHORITY_REVOKED, POLICY_VIOLATION
- 422: EVIDENCE_REQUIREMENT_NOT_MET
- 429: QUOTA_EXHAUSTED
- 500: INTERNAL_ERROR

---

## Conformance Requirements

**API-CONFORMANCE-1:** All endpoints implement specified headers  
**API-CONFORMANCE-2:** All mutations produce E₂+ evidence with `X-OSA-Evidence-Ref`  
**API-CONFORMANCE-3:** CAL token validation on all mutating endpoints  
**API-CONFORMANCE-4:** GraphQL schema matches REST capabilities  
**API-CONFORMANCE-5:** Streaming endpoints emit evidence-annotated events  
**API-CONFORMANCE-6:** Error responses include audit evidence reference  
**API-CONFORMANCE-7:** Rate limiting enforced per constitutional quota  

---

## Versioning

**URL Versioning:** `/api/v1/...`  
**Header:** `Accept: application/vnd.osa.v1+json`  
**Deprecation:** 6-month notice via `Deprecation` header + `Link: rel="successor-version"`

---

## References

| Spec | Document |
|------|----------|
| Constitution | OSA-Constitution-v1.0.md |
| ACC | OSA-ACC-v1.0.md |
| CSD | OSA-CSD-v1.0.md |
| CECD | OSA-CECD-v1.0.md |
| ECED | OSA-ECED-v1.0.md |

---

*Normative API specification. All Layer 4 implementations MUST conform.*