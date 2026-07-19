# ECED Meta-Model

**System:** OuterSpace AI (OSA)  
**Version:** 1.0  
**Status:** Ratified — Evidence, Causality, Event, Decision Meta-Model  
**Authority:** OSA Constitution Article 5  
**Reference:** OSA-Constitution-v1.0.md, OSA-CECD-v1.0.md

---

## Purpose

Defines the formal meta-model for all constitutional evidence in OSA. This meta-model governs the structure, relationships, and semantics of Evidence (E), Causality (C), Events (E), and Decisions (D) — collectively ECED. All evidence in OSA MUST conform to this meta-model.

---

## 1. Meta-Model Overview

### 1.1 Core Concepts

| Concept | Symbol | Description |
|---------|--------|-------------|
| **Evidence** | E | Immutable record of observation, transform, decision, audit, or constitutional act |
| **Causality** | C | Directed relationship: cause → effect between evidence |
| **Event** | EV | Occurrence that triggers evidence production |
| **Decision** | D | Governed choice producing E₂ evidence under authority |

### 1.2 Evidence Hierarchy (Levels)

```
E₄ Constitutional Evidence (supreme)
  ↑ derives-from
E₃ Audit Evidence
  ↑ audits
E₂ Governed Decision Evidence (authority minimum)
  ↑ decides-on
E₁ Processed Observation Evidence
  ↑ processes
E₀ Raw Observation Evidence (sensor)
```

**Rule:** Every evidence (except E₀) MUST reference at least one lower-level evidence via `input_evidence_refs` or `subject_evidence_refs`.

---

## 2. Formal Schema (Normative)

### 2.1 Base Evidence Record (All Levels)

```typescript
interface EvidenceRecord {
  // Identity
  evidence_id: EvidenceId;           // Format: "E{level}-OSA-{domain}-{YYYYMMDD}-{seq}"
  level: EvidenceLevel;              // "E0" | "E1" | "E2" | "E3" | "E4"
  
  // Temporal
  timestamp: ISO8601Timestamp;       // Production timestamp
  
  // Provenance
  source: EvidenceSource;            // Producer identifier
  
  // Cryptographic Integrity
  payload_hash: Hash;                // sha3-256(payload)
  previous_evidence_hash: Hash | null;  // Previous same-level same-source
  chain_hash: Hash;                  // sha3-256(payload_hash + previous_evidence_hash)
  signature: Signature;              // Producer signature over chain_hash
  
  // Level-Specific Payload (discriminated union)
  payload: E0Payload | E1Payload | E2Payload | E3Payload | E4Payload;
}
```

### 2.2 EvidenceId Format

```
E{level}-OSA-{domain}-{YYYYMMDD}-{sequence}

Examples:
  E0-OSA-TEL-20260719-0001
  E1-OSA-ORB-20260719-0042
  E2-OSA-GOV-20260719-0007
  E3-OSA-AUDIT-20260719-0001
  E4-OSA-CONST-20260719-001
```

**Rules:**
- `level`: 0-4
- `domain`: 3-letter subsystem code (TEL, ORB, OBS, NAV, SCI, KG, GK, PE, DE, MO, AR, SR, RE, VE, EL, AE, GOV, CONST, etc.)
- `sequence`: 4-digit zero-padded, per domain per day

### 2.3 EvidenceSource Format

```
{type}:{identifier}:{version?}

Examples:
  sensor:sat-123:gps
  processor:orbital-determinator:v2.1
  agent:orbital-awareness-tracker
  governance-kernel
  audit-engine:constitutional-audit:v1.0
  ratification-assembly
  constitutional-review-council
  evidence-stewardship-board
  promotion-authority
```

---

## 3. Level-Specific Payloads (Normative)

### 3.1 E₀ — Raw Observation Payload

```typescript
interface E0Payload {
  sensor_type: SensorType;           // GPS, IMU, STAR_TRACKER, RADAR, OPTICAL, RF, etc.
  payload: RawSensorData;            // Domain-specific raw data
  sensor_metadata: SensorMetadata;   // Satellite ID, instrument, mode, configuration
}
```

**RawSensorData** is domain-specific but MUST be serializable to deterministic JSON.

### 3.2 E₁ — Processed Observation Payload

```typescript
interface E1Payload {
  transform: TransformSpec;          // What processing occurred
  input_evidence_refs: EvidenceId[]; // MUST reference E₀ evidence
  payload: ProcessedData;            // Domain-specific processed output
  quality_metrics?: QualityMetrics;  // Uncertainty, confidence, residuals
}
```

**TransformSpec:**
```typescript
interface TransformSpec {
  type: TransformType;               // CALIBRATION, FUSION, ORBIT_DETERMINATION, FEATURE_EXTRACTION, CATALOGING, etc.
  algorithm: string;                 // Algorithm name
  version: string;                   // Algorithm version
  parameters: Record<string, any>;   // All parameters for reproducibility
  software_hash: Hash;               // sha3-256 of processing software
}
```

### 3.3 E₂ — Governed Decision Payload

```typescript
interface E2Payload {
  // Constitutional Binding (MANDATORY)
  authority_ref: AuthorityId;        // ACC authority grant
  policy_ref: PolicyId;              // Compiled policy reference
  policy_version_hash: Hash;         // Policy WASM hash
  kernel_authorization_ref: AuthorizationId; // GK authz record
  
  // Causality
  input_evidence_refs: EvidenceId[]; // MUST reference E₁ or E₂ evidence
  
  // Decision
  decision: DecisionRecord;          // The governed decision
  
  // Replay & Verification
  replay_context?: ReplayContext;    // For deterministic replay
  verification_context?: VerificationContext; // For independent verification
}
```

**DecisionRecord:**
```typescript
interface DecisionRecord {
  type: DecisionType;                // CONJUNCTION_ASSESSMENT, MISSION_ACTION, POLICY_EVALUATION, AUTHORITY_GRANT, REVOCATION, etc.
  timestamp: ISO8601Timestamp;       // Decision timestamp
  actor: EvidenceSource;             // Decision maker (agent, kernel, orchestrator)
  context: DecisionContext;          // Input state, parameters
  outcome: DecisionOutcome;          // Result, action, classification
  rationale: string;                 // Human-readable reasoning
}
```

**ReplayContext:**
```typescript
interface ReplayContext {
  policy_wasm_hash: Hash;            // Exact policy version
  input_evidence_hashes: Hash[];     // Exact input evidence
  runtime_version: string;           // Decision Engine version
  deterministic_seed?: string;       // If stochastic elements
}
```

### 3.4 E₃ — Audit Payload

```typescript
interface E3Payload {
  auditor: EvidenceSource;           // Audit authority
  audit_type: AuditType;             // ROUTINE_COMPLIANCE, INVESTIGATION, REMEDIATION_VERIFICATION, etc.
  subject_evidence_refs: EvidenceId[]; // Evidence under audit (E₂ or E₃)
  findings: AuditFinding[];          // Structured findings
  remediation_refs: EvidenceId[];    // Remediation evidence if applicable
  risk_assessment: RiskLevel;        // CRITICAL, HIGH, MEDIUM, LOW, NONE
}
```

**AuditFinding:**
```typescript
interface AuditFinding {
  rule: ConformanceRuleId;           // e.g., "ACC-CONFORMANCE-2", "CSD-T-004"
  status: "COMPLIANT" | "NON_COMPLIANT" | "PARTIAL" | "NOT_APPLICABLE";
  details: string;
  evidence_refs?: EvidenceId[];      // Supporting evidence
}
```

### 3.5 E₄ — Constitutional Payload

```typescript
interface E4Payload {
  constitutional_act: ConstitutionalActType; // AMENDMENT, TREATY_RATIFICATION, PROMOTION, STEWARDSHIP_ACTION, etc.
  act_ref: string;                   // Reference to act document (treaty_id, amendment_id, etc.)
  authority_basis: string;           // Constitutional article authorizing act
  participants: EvidenceSource[];    // Participating bodies
  process: ConstitutionalProcess;    // Vote, review, deliberation record
  outcome: ConstitutionalOutcome;    // RATIFIED, REJECTED, PROMOTED, etc.
  artifacts_hash: Hash;              // Hash of all act artifacts
}
```

**ConstitutionalProcess:**
```typescript
interface ConstitutionalProcess {
  type: "VOTE" | "REVIEW" | "DELIBERATION" | "UNANIMOUS_CONSENT";
  threshold?: string;                // e.g., "2/3", "UNANIMOUS", "MAJORITY"
  votes?: Record<string, "YES" | "NO" | "ABSTAIN">;
  review_period_days?: number;
  deliberation_record_ref?: EvidenceId;
}
```

---

## 4. Causality Model (Normative)

### 4.1 Causality Relations

```
E₀ ──(processes)──► E₁
E₁ ──(inputs-to)──► E₂
E₂ ──(decides-on)──► E₂ (chained decisions)
E₂ ──(audits)──► E₃
E₃ ──(remediates)──► E₂/E₃
E₄ ──(governs)──► E₀–E₃ (all levels)
```

### 4.2 Causality Record (Explicit)

```typescript
interface CausalityRecord {
  causality_id: CausalityId;         // "C-OSA-{YYYYMMDD}-{seq}"
  cause: EvidenceId;                 // Cause evidence
  effect: EvidenceId;                // Effect evidence
  relation: CausalityRelation;       // PROCESSES | INPUTS_TO | DECIDES_ON | AUDITS | REMEDIATES | GOVERNS
  strength: "DEFINITIVE" | "PROBABILISTIC" | "CONTRIBUTORY";
  timestamp: ISO8601Timestamp;       // When causality established
  established_by: EvidenceSource;    // Usually Governance Kernel or processor
  signature: Signature;
}
```

**Rule:** All `input_evidence_refs`, `subject_evidence_refs`, `remediation_refs` in evidence payloads MUST have corresponding CausalityRecord in Causality Ledger.

---

## 5. Event Model (Normative)

### 5.1 Constitutional Event

```typescript
interface ConstitutionalEvent {
  event_id: EventId;                 // "EV-OSA-{YYYYMMDD}-{seq}"
  type: EventType;                   // See Event Taxonomy
  timestamp: ISO8601Timestamp;
  source: EvidenceSource;
  payload: EventPayload;             // Type-specific
  evidence_produced: EvidenceId[];   // Evidence generated by this event
  causality_refs: CausalityId[];     // Causality records established
}
```

### 5.2 Event Taxonomy

| Category | Event Types |
|----------|-------------|
| **Sensor** | SENSOR_READING, SENSOR_CALIBRATION, SENSOR_FAILURE |
| **Processing** | TRANSFORM_STARTED, TRANSFORM_COMPLETED, TRANSFORM_FAILED |
| **Governance** | AUTHORITY_REQUESTED, AUTHORITY_GRANTED, AUTHORITY_EXERCISED, AUTHORITY_DELEGATED, AUTHORITY_REVOKED, POLICY_COMPILED, POLICY_DEPLOYED, KERNEL_AUTHZ_GRANTED, KERNEL_AUTHZ_DENIED |
| **Decision** | DECISION_MADE, DECISION_REPLAYED, DECISION_VERIFIED |
| **Mission** | MISSION_STARTED, MISSION_ACTION, MISSION_COMPLETED, MISSION_FAILED |
| **Agent** | AGENT_SPAWNED, AGENT_ACTION, AGENT_TERMINATED |
| **Simulation** | SIMULATION_STARTED, SIMULATION_STEP, SIMULATION_COMPLETED |
| **Replay** | REPLAY_REQUESTED, REPLAY_COMPLETED, REPLAY_DIVERGED |
| **Verification** | VERIFICATION_REQUESTED, VERIFICATION_PASSED, VERIFICATION_FAILED |
| **Evidence** | EVIDENCE_WRITTEN, EVIDENCE_VERIFIED, CHAIN_VERIFIED, CHAIN_BROKEN |
| **Audit** | AUDIT_STARTED, AUDIT_COMPLETED, FINDING_ISSUED, REMEDIATION_MANDATED |
| **Constitutional** | AMENDMENT_PROPOSED, AMENDMENT_RATIFIED, TREATY_SIGNED, TREATY_RATIFIED, PROMOTION_REQUESTED, PROMOTION_GRANTED, STEWARDSHIP_ACTION |
| **Federation** | TREATY_NEGOTIATED, TOKEN_IMPORTED, TOKEN_EXPORTED, REVOCATION_PROPAGATED, EVIDENCE_EXCHANGED |

---

## 6. Decision Model (Normative)

### 6.1 Governed Decision Lifecycle

```
REQUEST → KERNEL_AUTHZ → POLICY_EVAL → DECISION → EVIDENCE(E₂) → AUDIT(E₃) → REPLAY → VERIFY
```

### 6.2 Decision Record (Canonical)

```typescript
interface GovernedDecision {
  decision_id: DecisionId;           // "D-OSA-{YYYYMMDD}-{seq}"
  authority_ref: AuthorityId;
  policy_ref: PolicyId;
  kernel_authz_ref: AuthorizationId;
  input_evidence: EvidenceId[];
  context: DecisionContext;
  evaluation: PolicyEvaluation;      // Policy engine output
  outcome: DecisionOutcome;
  evidence_ref: EvidenceId;          // E₂ produced
  replay_ref?: EvidenceId;           // E₂ from replay
  verification_ref?: EvidenceId;     // E₃ from verification
  timestamp: ISO8601Timestamp;
  duration_ms: number;               // End-to-end latency
}
```

### 6.3 Policy Evaluation (Deterministic)

```typescript
interface PolicyEvaluation {
  policy_wasm_hash: Hash;
  input_hash: Hash;                  // Hash of serialized inputs
  result: "ALLOW" | "DENY" | "CONDITIONAL";
  obligations: Obligation[];         // Evidence production, audit, etc.
  explanation: string;               // Deterministic explanation
  evaluation_timestamp: ISO8601Timestamp;
  evaluator_version: string;
}
```

---

## 7. Integrity Constraints (Normative)

### 7.1 Evidence Chain Integrity

**For each source + level combination:**
```
chain_hash[n] = sha3-256(payload_hash[n] + chain_hash[n-1])
chain_hash[0] = sha3-256(payload_hash[0] + "GENESIS")
```

**Verification:** `verify_chain(source, level) → boolean`

### 7.2 Causality Completeness

**Every evidence reference MUST have causality record:**
```
∀ e ∈ Evidence, ∀ ref ∈ e.payload.*_evidence_refs:
  ∃ c ∈ Causality: c.cause = ref ∧ c.effect = e.evidence_id
```

### 7.3 Constitutional Binding

**Every E₂ MUST satisfy:**
```
∃ auth ∈ AuthorityGrants: auth.authority_id = e.payload.authority_ref ∧ auth.valid
∃ pol ∈ CompiledPolicies: pol.policy_id = e.payload.policy_ref ∧ pol.verified
∃ authz ∈ KernelAuthorizations: authz.authorization_id = e.payload.kernel_authorization_ref ∧ authz.granted
```

### 7.4 Replay Determinism

**For every E₂ with replay_context:**
```
replay(decision_id) → decision_outcome
decision_outcome ≡ original_outcome  (bitwise equality)
```

---

## 8. Serialization & Canonicalization (Normative)

### 8.1 Canonical JSON

All evidence, causality, events, decisions serialized as **canonical JSON**:
- Keys sorted lexicographically
- No whitespace
- Numbers: no trailing zeros, no leading zeros (except 0)
- Strings: UTF-8, escaped per RFC 8259
- Hashes: lowercase hex with `sha3-256:` prefix

### 8.2 Hash Computation

```python
def compute_hash(obj: Any) -> str:
    canonical = json_dumps(obj, sort_keys=True, separators=(',', ':'))
    return f"sha3-256:{sha3_256(canonical.encode('utf-8')).hexdigest()}"
```

### 8.3 Signature

```
signature = ed25519_sign(private_key, chain_hash_bytes)
```

**Verification:** `ed25519_verify(public_key, chain_hash_bytes, signature)`

---

## 9. Query & Traversal Patterns (Normative)

### 9.1 Evidence Lineage Traversal

```typescript
// Upstream (causes)
get_causes(evidence_id: EvidenceId): EvidenceId[]  // Via causality: INPUTS_TO, PROCESSES

// Downstream (effects)
get_effects(evidence_id: EvidenceId): EvidenceId[] // Via causality: DECIDES_ON, AUDITS

// Full lineage
get_lineage(evidence_id: EvidenceId): LineageGraph
```

### 9.2 Constitutional Compliance Query

```typescript
// All E₂ for authority
get_decisions_by_authority(authority_id: AuthorityId): E2Evidence[]

// All E₃ for subject
get_audits_for_evidence(evidence_id: EvidenceId): E3Evidence[]

// Constitutional acts governing evidence
get_constitutional_governance(evidence_id: EvidenceId): E4Evidence[]
```

### 9.3 Time-Range Queries

```typescript
get_evidence_by_timerange(level: EvidenceLevel, start: Timestamp, end: Timestamp): EvidenceId[]
get_events_by_timerange(type: EventType, start: Timestamp, end: Timestamp): Event[]
```

---

## 10. Conformance Requirements

**ECED-CONFORMANCE-1:** All evidence conforms to Level-Specific Payload schema  
**ECED-CONFORMANCE-2:** All evidence IDs follow format specification  
**ECED-CONFORMANCE-3:** All chain hashes compute correctly  
**ECED-CONFORMANCE-4:** All signatures verify against producer public key  
**ECED-CONFORMANCE-5:** All evidence references have causality records  
**ECED-CONFORMANCE-6:** All E₂ satisfy constitutional binding constraints  
**ECED-CONFORMANCE-7:** All replay contexts produce bitwise-identical outcomes  
**ECED-CONFORMANCE-8:** Canonical JSON serialization produces deterministic bytes  

---

## 11. Normative References

| Ref | Document |
|-----|----------|
| [CONST] | OSA-Constitution-v1.0.md |
| [ACC] | OSA-ACC-v1.0.md |
| [CSD] | OSA-CSD-v1.0.md |
| [CECD] | OSA-CECD-v1.0.md |
| [EL] | OSA-EL-v1.0.md (Evidence Ledger spec) |
| [CL] | OSA-CL-v1.0.md (Causality Ledger spec) |
| [EVL] | OSA-EVL-v1.0.md (Event Log spec) |

---

## Ratification

**Ratified by:** Constitutional Engineering Constitution Authority  
**Date:** 2026-07-19  
**Evidence ID:** E4-OSA-ECED-20260719-001  
**Hash:** `sha3-256:pending-ratification-evidence`  
**Constitutional Basis:** OSA-Constitution-v1.0 Article 5

---

*This meta-model is the formal specification for all constitutional evidence in OSA. All implementations MUST conform. Non-conformant evidence is invalid under Constitution Article 12.*