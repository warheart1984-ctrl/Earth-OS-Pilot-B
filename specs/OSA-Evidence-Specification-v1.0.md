# OSA Evidence Specification

**System:** OuterSpace AI (OSA)  
**Version:** 1.0  
**Status:** Normative Specification  
**Authority:** OSA-CSD-v1.0.md Section 2.1, OSA-CECD-v1.0.md  
**Conformance:** CECD-CONFORMANCE-1 through CECD-CONFORMANCE-8

---

## Purpose

Complete technical specification for evidence production, storage, verification, and exchange in OSA. This is the implementation contract for the Evidence Ledger (Layer 3), Causality Ledger, Event Log, and Federation Evidence Exchange Protocol (FEEP).

---

## 1. Evidence Data Model (Normative)

### 1.1 Canonical Evidence Record

```typescript
interface CanonicalEvidenceRecord {
  // Identity (REQUIRED)
  evidence_id: EvidenceId;                    // E{level}-OSA-{domain}-{YYYYMMDD}-{seq}
  level: "E0" | "E1" | "E2" | "E3" | "E4";
  
  // Temporal (REQUIRED)
  timestamp: string;                          // RFC3339Nano
  
  // Provenance (REQUIRED)
  source: EvidenceSource;                     // {type}:{identifier}:{version?}
  
  // Cryptographic Integrity (REQUIRED)
  payload_hash: Hash;                         // sha3-256:hex(payload_canonical)
  previous_evidence_hash: Hash | null;        // Previous same-level same-source
  chain_hash: Hash;                           // sha3-256:hex(payload_hash + previous_evidence_hash)
  signature: Signature;                       // ed25519:hex(sign(private_key, chain_hash))
  
  // Level-Specific Payload (REQUIRED, discriminated union)
  payload: E0Payload | E1Payload | E2Payload | E3Payload | E4Payload;
}
```

### 1.2 EvidenceId Grammar

```
EvidenceId ::= "E" Level "-OSA-" Domain "-" Date "-" Sequence
Level      ::= "0" | "1" | "2" | "3" | "4"
Domain     ::= [A-Z]{3}                       // TEL, ORB, OBS, NAV, SCI, KG, GK, PE, DE, MO, AR, SR, RE, VE, EL, AE, GOV, CONST
Date       ::= [0-9]{8}                       // YYYYMMDD
Sequence   ::= [0-9]{4}                       // 0001-9999 per domain per day
```

**Examples:**
- `E0-OSA-TEL-20260719-0001`
- `E1-OSA-ORB-20260719-0042`
- `E2-OSA-GK-20260719-0007`
- `E3-OSA-AE-20260719-0001`
- `E4-OSA-CONST-20260719-001`

### 1.3 EvidenceSource Grammar

```
EvidenceSource ::= SourceType ":" Identifier [ ":" Version ]
SourceType     ::= "sensor" | "processor" | "agent" | "governance-kernel" 
                |  "audit-engine" | "ratification-assembly"
                |  "constitutional-review-council" | "evidence-stewardship-board"
                |  "promotion-authority" | "federation-gateway"
Identifier     ::= [a-z0-9-]+
Version        ::= [a-z0-9.+-]+
```

---

## 2. Level-Specific Payloads (Normative)

### 2.1 E₀ — Raw Observation

```typescript
interface E0Payload {
  sensor_type: SensorType;                    // Enum: GPS, IMU, STAR_TRACKER, RADAR, OPTICAL, RF, etc.
  payload: RawSensorData;                     // Domain-specific, deterministic JSON
  sensor_metadata: SensorMetadata;
}

interface RawSensorData {
  // Deterministic serialization required
  [key: string]: string | number | boolean | RawSensorData | RawSensorData[];
}

interface SensorMetadata {
  satellite_id?: string;
  instrument: string;
  mode: string;
  configuration_hash: Hash;                   // sha3-256 of full config
  calibration_version: string;
}
```

**Conformance:** E0-CONF-1: `payload` serializes to deterministic canonical JSON  
**Conformance:** E0-CONF-2: `configuration_hash` matches deployed sensor config

### 2.2 E₁ — Processed Observation

```typescript
interface E1Payload {
  transform: TransformSpec;
  input_evidence_refs: EvidenceId[];          // MUST be E₀, length >= 1
  payload: ProcessedData;                     // Domain-specific, deterministic JSON
  quality_metrics?: QualityMetrics;
}

interface TransformSpec {
  type: TransformType;                        // CALIBRATION, FUSION, ORBIT_DETERMINATION, FEATURE_EXTRACTION, CATALOGING, etc.
  algorithm: string;                          // e.g., "batch_least_squares"
  version: string;                            // Semantic version
  parameters: Record<string, unknown>;        // ALL parameters for reproducibility
  software_hash: Hash;                        // sha3-256 of processing software artifact
  software_version: string;
}

interface QualityMetrics {
  uncertainty?: Record<string, number>;
  confidence?: number;                        // 0.0 - 1.0
  residuals?: number[];
  dof?: number;                               // Degrees of freedom
}
```

**Conformance:** E1-CONF-1: All `input_evidence_refs` exist and are E₀  
**Conformance:** E1-CONF-2: `software_hash` matches deployed processor artifact  
**Conformance:** E1-CONF-3: Transform is deterministic given inputs + parameters

### 2.3 E₂ — Governed Decision

```typescript
interface E2Payload {
  // Constitutional Binding (REQUIRED)
  authority_ref: AuthorityId;                 // ACC authority grant ID
  policy_ref: PolicyId;                       // Compiled policy ID
  policy_version_hash: Hash;                  // sha3-256 of policy WASM
  kernel_authorization_ref: AuthorizationId;  // GK authorization record
  
  // Causality (REQUIRED)
  input_evidence_refs: EvidenceId[];          // MUST be E₁ or E₂, length >= 1
  
  // Decision (REQUIRED)
  decision: DecisionRecord;
  
  // Replay & Verification (OPTIONAL but REQUIRED for production)
  replay_context?: ReplayContext;
  verification_context?: VerificationContext;
}

interface DecisionRecord {
  type: DecisionType;                         // CONJUNCTION_ASSESSMENT, MISSION_ACTION, POLICY_EVALUATION, AUTHORITY_GRANT, REVOCATION, etc.
  timestamp: string;                          // RFC3339Nano
  actor: EvidenceSource;
  context: DecisionContext;
  outcome: DecisionOutcome;
  rationale: string;                          // Human-readable, deterministic
}

interface DecisionContext {
  // Full input state for replay
  policy_inputs: Record<string, unknown>;
  authority_constraints: AuthorityConstraints;
  environmental_state?: Record<string, unknown>;
}

interface DecisionOutcome {
  result: "ALLOW" | "DENY" | "CONDITIONAL";
  action?: string;
  classification?: string;
  parameters?: Record<string, unknown>;
  obligations?: Obligation[];                 // Evidence production, audit, notification, etc.
}

interface ReplayContext {
  policy_wasm_hash: Hash;
  input_evidence_hashes: Hash[];              // sha3-256 of each input evidence canonical form
  runtime_version: string;
  deterministic_seed?: string;
}

interface VerificationContext {
  verifier: EvidenceSource;
  verification_method: "REPLAY" | "INDEPENDENT_EVALUATION" | "FORMAL_PROOF";
  verification_policy_hash?: Hash;
}
```

**Conformance:** E2-CONF-1: `authority_ref` resolves to valid ACC grant  
**Conformance:** E2-CONF-2: `policy_ref` resolves to compiled, verified policy  
**Conformance:** E2-CONF-3: `kernel_authorization_ref` exists in GK authz log  
**Conformance:** E2-CONF-4: All `input_evidence_refs` exist and are E₁/E₂  
**Conformance:** E2-CONF-5: Replay with `replay_context` produces bitwise-identical outcome  
**Conformance:** E2-CONF-6: `decision.outcome.obligations` fulfilled before operation completes

### 2.4 E₃ — Audit Evidence

```typescript
interface E3Payload {
  auditor: EvidenceSource;
  audit_type: AuditType;                      // ROUTINE_COMPLIANCE, INVESTIGATION, REMEDIATION_VERIFICATION, etc.
  subject_evidence_refs: EvidenceId[];        // MUST be E₂ or E₃
  findings: AuditFinding[];
  remediation_refs: EvidenceId[];             // E₂/E₃ remediation evidence
  risk_assessment: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE";
}

interface AuditFinding {
  rule: ConformanceRuleId;                    // e.g., "ACC-CONFORMANCE-2", "CSD-T-004"
  status: "COMPLIANT" | "NON_COMPLIANT" | "PARTIAL" | "NOT_APPLICABLE";
  details: string;
  evidence_refs?: EvidenceId[];               // Supporting evidence
}
```

**Conformance:** E3-CONF-1: `auditor` is constitutionally authorized audit body  
**Conformance:** E3-CONF-2: All `subject_evidence_refs` exist  
**Conformance:** E3-CONF-3: `findings.rule` references valid conformance rule

### 2.5 E₄ — Constitutional Evidence

```typescript
interface E4Payload {
  constitutional_act: ConstitutionalActType;  // AMENDMENT, TREATY_RATIFICATION, PROMOTION, STEWARDSHIP_ACTION, etc.
  act_ref: string;                            // Treaty ID, Amendment ID, etc.
  authority_basis: string;                    // Constitutional article
  participants: EvidenceSource[];
  process: ConstitutionalProcess;
  outcome: ConstitutionalOutcome;
  artifacts_hash: Hash;                       // Hash of all act documents
}

interface ConstitutionalProcess {
  type: "VOTE" | "REVIEW" | "DELIBERATION" | "UNANIMOUS_CONSENT";
  threshold?: string;                         // "2/3", "UNANIMOUS", "MAJORITY"
  votes?: Record<string, "YES" | "NO" | "ABSTAIN">;
  review_period_days?: number;
  deliberation_record_ref?: EvidenceId;       // E₃/E₄
}

interface ConstitutionalOutcome {
  result: "RATIFIED" | "REJECTED" | "PROMOTED" | "ACTION_TAKEN" | "DEFERRED";
  effective_date?: string;
  conditions?: string[];
}
```

**Conformance:** E4-CONF-1: Only constitutionally authorized bodies produce E₄  
**Conformance:** E4-CONF-2: `authority_basis` references valid constitutional article  
**Conformance:** E4-CONF-3: `process` matches constitutional requirements for act type

---

## 3. Evidence Ledger Specification (Normative)

### 3.1 Ledger Interface

```typescript
interface EvidenceLedger {
  // Write
  append(entry: LedgerEntry): Promise<AppendResult>;
  appendBatch(entries: LedgerEntry[]): Promise<AppendResult[]>;
  
  // Read
  get(evidence_id: EvidenceId): Promise<LedgerEntry | null>;
  query(query: QueryParams): Promise<LedgerEntry[]>;
  queryIterator(query: QueryParams): AsyncIterator<LedgerEntry>;
  
  // Integrity
  verifyChain(params: VerifyChainParams): Promise<ChainVerificationResult>;
  getCheckpoint(params: CheckpointParams): Promise<Checkpoint>;
  replayFrom(checkpoint: Checkpoint): AsyncIterator<LedgerEntry>;
  
  // Federation
  importEvidence(evidence: CanonicalEvidenceRecord, federation_ref: FederationRef): Promise<ImportResult>;
  exportEvidence(evidence_id: EvidenceId): Promise<ExportPackage>;
}

interface LedgerEntry {
  sequence: number;                           // Monotonic global sequence
  evidence: CanonicalEvidenceRecord;
  received_at: string;                        // RFC3339Nano
  federation_ref?: FederationRef;             // If imported
}

interface AppendResult {
  sequence: number;
  chain_hash: Hash;
  verified: boolean;
}
```

### 3.2 Storage Layout

```
evidence-ledger/
├── e0/                     # Partition by level
│   ├── 2026/
│   │   ├── 07/
│   │   │   ├── 19/
│   │   │   │   ├── TEL-00001-0010000.log.zst
│   │   │   │   └── ORB-00001-0010000.log.zst
│   │   │   └── index.sqlite
│   │   └── ...
│   └── ...
├── e1/
├── e2/
├── e3/
├── e4/
├── causality/              # Causality Ledger
│   ├── 2026/07/19/
│   └── index.sqlite
├── events/                 # Event Log
│   ├── 2026/07/19/
│   └── index.sqlite
├── checkpoints/
│   ├── global-0000001.json
│   └── global-0000002.json
└── federation/
    ├── imports/
    └── exports/
```

**Format:** Each `.log.zst` file contains newline-delimited canonical JSON (zstd compressed)  
**Index:** SQLite with columns: `evidence_id, level, source, timestamp, sequence, chain_hash, file_offset`

### 3.3 Chaining Algorithm

```python
def compute_chain_hash(payload_hash: str, previous_chain_hash: str | None) -> str:
    if previous_chain_hash is None:
        combined = payload_hash + "GENESIS"
    else:
        combined = payload_hash + previous_chain_hash
    return f"sha3-256:{sha3_256(combined.encode('utf-8')).hexdigest()}"
```

**Genesis:** First entry per (source, level) has `previous_evidence_hash = null`, `chain_hash = sha3-256(payload_hash + "GENESIS")`

### 3.4 Checkpointing

```typescript
interface Checkpoint {
  global_sequence: number;
  timestamp: string;
  level_checkpoints: Record<EvidenceLevel, LevelCheckpoint>;
  merkle_root: Hash;                          // Merkle root of all entries up to sequence
}

interface LevelCheckpoint {
  last_sequence: number;
  last_chain_hash: Hash;
  entry_count: number;
}
```

**Frequency:** Every 10,000 global entries OR every 1 hour, whichever first

---

## 4. Causality Ledger Specification (Normative)

### 4.1 Causality Record

```typescript
interface CausalityRecord {
  causality_id: CausalityId;                  // C-OSA-{YYYYMMDD}-{seq}
  cause: EvidenceId;
  effect: EvidenceId;
  relation: CausalityRelation;
  strength: "DEFINITIVE" | "PROBABILISTIC" | "CONTRIBUTORY";
  timestamp: string;                          // When established
  established_by: EvidenceSource;
  signature: Signature;                       // ed25519 over canonical form
}

type CausalityRelation = 
  | "PROCESSES"           // E₀ → E₁
  | "INPUTS_TO"           // E₁ → E₂
  | "DECIDES_ON"          // E₂ → E₂ (chained decisions)
  | "AUDITS"              // E₂/E₃ → E₃
  | "REMEDIATES"          // E₂/E₃ → E₂/E₃
  | "GOVERNS";            // E₄ → E₀-E₃
```

### 4.2 Completeness Requirement

**For every evidence reference in any payload, a CausalityRecord MUST exist:**

```
∀ e ∈ Evidence, ∀ ref ∈ e.payload.*_evidence_refs:
  ∃ c ∈ Causality: c.cause = ref ∧ c.effect = e.evidence_id
```

### 4.3 Query Interface

```typescript
interface CausalityLedger {
  getCauses(effect: EvidenceId): Promise<CausalityRecord[]>;
  getEffects(cause: EvidenceId): Promise<CausalityRecord[]>;
  getLineage(evidence_id: EvidenceId, direction: "upstream" | "downstream" | "both"): Promise<LineageGraph>;
  verifyCompleteness(evidence_id: EvidenceId): Promise<CompletenessResult>;
}

interface LineageGraph {
  nodes: Map<EvidenceId, CanonicalEvidenceRecord>;
  edges: CausalityRecord[];
  roots: EvidenceId[];                        // No upstream causes
  leaves: EvidenceId[];                       // No downstream effects
}
```

---

## 5. Event Log Specification (Normative)

### 5.1 Event Record

```typescript
interface EventRecord {
  event_id: EventId;                          // EV-OSA-{YYYYMMDD}-{seq}
  type: EventType;
  timestamp: string;                          // RFC3339Nano
  source: EvidenceSource;
  payload: EventPayload;
  evidence_produced: EvidenceId[];            // Evidence generated by this event
  causality_refs: CausalityId[];              // Causality records established
}

type EventType = 
  // Sensor
  | "SENSOR_READING" | "SENSOR_CALIBRATION" | "SENSOR_FAILURE"
  // Processing
  | "TRANSFORM_STARTED" | "TRANSFORM_COMPLETED" | "TRANSFORM_FAILED"
  // Governance
  | "AUTHORITY_REQUESTED" | "AUTHORITY_GRANTED" | "AUTHORITY_EXERCISED" 
  | "AUTHORITY_DELEGATED" | "AUTHORITY_REVOKED"
  | "POLICY_COMPILED" | "POLICY_DEPLOYED"
  | "KERNEL_AUTHZ_GRANTED" | "KERNEL_AUTHZ_DENIED"
  // Decision
  | "DECISION_MADE" | "DECISION_REPLAYED" | "DECISION_VERIFIED"
  // Mission
  | "MISSION_STARTED" | "MISSION_ACTION" | "MISSION_COMPLETED" | "MISSION_FAILED"
  // Agent
  | "AGENT_SPAWNED" | "AGENT_ACTION" | "AGENT_TERMINATED"
  // Simulation
  | "SIMULATION_STARTED" | "SIMULATION_STEP" | "SIMULATION_COMPLETED"
  // Replay
  | "REPLAY_REQUESTED" | "REPLAY_COMPLETED" | "REPLAY_DIVERGED"
  // Verification
  | "VERIFICATION_REQUESTED" | "VERIFICATION_PASSED" | "VERIFICATION_FAILED"
  // Evidence
  | "EVIDENCE_WRITTEN" | "EVIDENCE_VERIFIED" | "CHAIN_VERIFIED" | "CHAIN_BROKEN"
  // Audit
  | "AUDIT_STARTED" | "AUDIT_COMPLETED" | "FINDING_ISSUED" | "REMEDIATION_MANDATED"
  // Constitutional
  | "AMENDMENT_PROPOSED" | "AMENDMENT_RATIFIED" | "TREATY_SIGNED" | "TREATY_RATIFIED"
  | "PROMOTION_REQUESTED" | "PROMOTION_GRANTED" | "STEWARDSHIP_ACTION"
  // Federation
  | "TREATY_NEGOTIATED" | "TOKEN_IMPORTED" | "TOKEN_EXPORTED" 
  | "REVOCATION_PROPAGATED" | "EVIDENCE_EXCHANGED";
```

### 5.2 Event Payloads (Selected)

```typescript
// SENSOR_READING
interface SensorReadingPayload {
  sensor_id: string;
  reading_hash: Hash;                         // Hash of raw reading
  metadata: SensorMetadata;
}

// DECISION_MADE
interface DecisionMadePayload {
  decision_id: DecisionId;
  authority_ref: AuthorityId;
  policy_ref: PolicyId;
  result: "ALLOW" | "DENY" | "CONDITIONAL";
  evidence_ref: EvidenceId;                   // E₂ produced
}

// REPLAY_DIVERGED
interface ReplayDivergedPayload {
  original_decision_id: DecisionId;
  replay_decision_id: DecisionId;
  divergence_point: string;
  original_outcome_hash: Hash;
  replay_outcome_hash: Hash;
}
```

---

## 6. Federation Evidence Exchange Protocol (FEEP)

### 6.1 Protocol Overview

```typescript
interface FEEP {
  // Export from local ledger
  exportEvidence(evidence_ids: EvidenceId[]): Promise<ExportPackage>;
  
  // Import to local ledger
  importEvidence(pkg: ExportPackage, treaty_id: TreatyId): Promise<ImportResult>;
  
  // Verify imported evidence
  verifyImported(evidence_id: EvidenceId): Promise<VerificationResult>;
  
  // Sync with peer
  syncWithPeer(peer: PeerEndpoint, treaty_id: TreatyId): Promise<SyncResult>;
}
```

### 6.2 Export Package

```typescript
interface ExportPackage {
  package_id: string;                         // PKG-OSA-{YYYYMMDD}-{seq}
  treaty_id: TreatyId;
  exported_at: string;
  evidence: CanonicalEvidenceRecord[];        // Full records
  causality: CausalityRecord[];               // Relevant causality
  events: EventRecord[];                      // Relevant events
  chain_proof: ChainProof;                    // Merkle proof of chain inclusion
  exporter_signature: Signature;              // Federation gateway key
}

interface ChainProof {
  evidence_id: EvidenceId;
  merkle_root: Hash;
  merkle_path: Hash[];                        // Siblings from leaf to root
  leaf_index: number;
}
```

### 6.3 Import Process

1. Verify `exporter_signature` with treaty gateway key
2. Verify `chain_proof` against known federation merkle roots
3. For each evidence record:
   - Verify signature
   - Verify chain_hash links to previous (or GENESIS)
   - Verify all causality records present
   - Write to local ledger with `federation_ref`
4. Record import as E₂ evidence in local ledger
5. Emit import event

### 6.4 Federation Chain Preservation

**Invariant:** Imported evidence chain_hash MUST match exporter's chain_hash  
**Invariant:** Causality records crossing federation boundary preserved  
**Invariant:** Local ledger sequence continues; imported entries get local sequence but preserve original chain_hash

---

## 7. Verification Procedures (Normative)

### 7.1 Level 1: Signature Verification (V1)

```python
def verify_signature(evidence: CanonicalEvidenceRecord, public_key: bytes) -> bool:
    return ed25519_verify(public_key, evidence.chain_hash.encode(), evidence.signature)
```

### 7.2 Level 2: Chain Integrity (V2)

```python
def verify_chain(ledger: EvidenceLedger, source: EvidenceSource, level: EvidenceLevel) -> ChainVerificationResult:
    entries = ledger.query({"source": source, "level": level})
    prev_hash = None
    for entry in entries:
        expected = compute_chain_hash(entry.evidence.payload_hash, prev_hash)
        if entry.evidence.chain_hash != expected:
            return ChainVerificationResult(ok=False, broken_at=entry.sequence, expected=expected, actual=entry.evidence.chain_hash)
        prev_hash = entry.evidence.chain_hash
    return ChainVerificationResult(ok=True, entries_verified=len(entries))
```

### 7.3 Level 3: Input Reference Validity (V3)

```python
def verify_input_refs(ledger: EvidenceLedger, evidence: CanonicalEvidenceRecord) -> bool:
    if evidence.level == "E0":
        return True  # No inputs
    refs = get_input_refs(evidence.payload)
    for ref in refs:
        if not ledger.get(ref):
            return False
    return True
```

### 7.4 Level 4: Constitutional Binding (V4)

```python
def verify_constitutional_binding(ledger: EvidenceLedger, gk: GovernanceKernel, evidence: E2Evidence) -> bool:
    # 1. Authority exists and valid
    auth = gk.getAuthority(evidence.payload.authority_ref)
    if not auth or not auth.valid:
        return False
    
    # 2. Policy compiled and verified
    policy = gk.getPolicy(evidence.payload.policy_ref)
    if not policy or policy.wasm_hash != evidence.payload.policy_version_hash:
        return False
    
    # 3. Kernel authorization exists and granted
    authz = gk.getAuthorization(evidence.payload.kernel_authorization_ref)
    if not authz or not authz.granted:
        return False
    
    return True
```

### 7.5 Level 5: Replay Verification (V5)

```python
async def verify_replay(de: DecisionEngine, evidence: E2Evidence) -> ReplayVerificationResult:
    if not evidence.payload.replay_context:
        return ReplayVerificationResult(ok=False, reason="NO_REPLAY_CONTEXT")
    
    ctx = evidence.payload.replay_context
    # Reconstruct inputs
    input_evidence = await ledger.getBatch(evidence.payload.input_evidence_refs)
    # Replay
    replay_result = await de.replay(ctx.policy_wasm_hash, input_evidence, ctx)
    
    # Compare bitwise
    original_outcome_hash = hash_canonical(evidence.payload.decision.outcome)
    replay_outcome_hash = hash_canonical(replay_result.outcome)
    
    return ReplayVerificationResult(
        ok=(original_outcome_hash == replay_outcome_hash),
        original_hash=original_outcome_hash,
        replay_hash=replay_outcome_hash
    )
```

---

## 8. Storage & Performance Requirements

| Requirement | Specification |
|-------------|---------------|
| Write latency (E₀) | < 10ms p99 |
| Write latency (E₁-E₄) | < 50ms p99 |
| Read latency (by ID) | < 5ms p99 |
| Chain verification (1M entries) | < 30s |
| Replay verification (single decision) | < 100ms |
| Storage redundancy | 3x replication, cross-region |
| Retention | Perpetual (constitutional archive) |
| Federation sync interval | ≤ 5 minutes (configurable per treaty) |

---

## 9. Conformance Test Vectors

| Test ID | Level | Description | Expected |
|---------|-------|-------------|----------|
| EV-T-001 | E₀ | Sensor gateway produces valid E₀ | Signature valid, chain correct |
| EV-T-002 | E₁ | Processor produces valid E₁ | Input refs exist, transform spec complete |
| EV-T-003 | E₂ | Decision produces valid E₂ | Authority/policy/kernel refs valid, replay works |
| EV-T-004 | E₃ | Audit produces valid E₃ | Auditor authorized, findings structured |
| EV-T-005 | E₄ | Constitutional act produces valid E₄ | Authority basis valid, process correct |
| EV-T-006 | Chain | Chain integrity across 100K entries | Verified |
| EV-T-007 | Causality | All E₁ refs have PROCESSES causality | Complete |
| EV-T-008 | Causality | All E₂ refs have INPUTS_TO causality | Complete |
| EV-T-009 | Federation | Export/import preserves chain | Chain hash matches |
| EV-T-010 | Federation | Imported evidence queryable | Returns with federation_ref |
| EV-T-011 | V1 | Signature verification | Valid sigs pass, invalid fail |
| EV-T-012 | V2 | Chain verification | Detects single-bit tampering |
| EV-T-013 | V3 | Input reference validity | Missing refs detected |
| EV-T-014 | V4 | Constitutional binding | Invalid authority/policy/kernel detected |
| EV-T-015 | V5 | Replay determinism | Bitwise match for valid, divergence detected for tampered |

---

## 10. Normative References

| Ref | Document |
|-----|----------|
| [CONST] | OSA-Constitution-v1.0.md |
| [ACC] | OSA-ACC-v1.0.md |
| [CSD] | OSA-CSD-v1.0.md |
| [CECD] | OSA-CECD-v1.0.md |
| [ECED] | OSA-ECED-v1.0.md |
| [RT] | OSA-Runtime-Specifications-v1.0.md |
| [FEEP] | OSA-FEEP-v1.0.md |

---

*Normative evidence specification. All OSA evidence systems MUST conform.*