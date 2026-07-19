# OSA Runtime Specifications — Layer 3 Constitutional Runtime

**System:** OuterSpace AI (OSA)  
**Version:** 1.0  
**Status:** Normative Specification  
**Authority:** OSA-CSD-v1.0.md Section 1.3  
**Conformance:** CSD-T-002 through CSD-T-007, CSD-T-010

---

## Overview

Layer 3 is the constitutional execution fabric. All modules are mandatory and non-bypassable. Every operation routes through the Governance Kernel, produces evidence, and is replayable/verifiable.

---

## 1. Governance Kernel — `OSA-GK-v1.0.md`

### 1.1 Purpose
Singular constitutional enforcement point. All authority exercises, policy evaluations, and governance decisions route through GK.

### 1.2 Interface (Internal)

```typescript
interface GovernanceKernel {
  // Authority Management
  verifyAuthority(params: VerifyAuthorityParams): Promise<AuthorizationResult>;
  grantAuthority(params: GrantAuthorityParams): Promise<AuthorityGrant>;
  revokeAuthority(params: RevokeAuthorityParams): Promise<RevocationResult>;
  delegateAuthority(params: DelegateAuthorityParams): Promise<AuthorityGrant>;
  
  // Policy Management
  compilePolicy(params: CompilePolicyParams): Promise<CompiledPolicy>;
  deployPolicy(params: DeployPolicyParams): Promise<DeploymentResult>;
  validatePolicy(params: ValidatePolicyParams): Promise<ValidationResult>;
  
  // Decision Authorization
  authorizeDecision(params: AuthorizeDecisionParams): Promise<AuthorizationResult>;
  
  // Audit
  emitAudit(params: EmitAuditParams): Promise<AuditRecord>;
  
  // Constitutional Queries
  getConstitutionalState(): Promise<ConstitutionalState>;
}
```

### 1.3 Types

```typescript
interface VerifyAuthorityParams {
  authority_id: AuthorityId;
  holder: EvidenceSource;
  action: ActionSpec;
  context: DecisionContext;
}

interface AuthorizationResult {
  authorized: boolean;
  authorization_id: AuthorizationId;  // If authorized
  evidence_ref: EvidenceId;           // E₂ authorization evidence
  reason?: string;                    // If denied
  obligations: Obligation[];          // Evidence production, etc.
}

interface CompilePolicyParams {
  source: PolicySource;               // Rego + constitutional metadata
  constitutional_metadata: ConstitutionalMetadata;
}

interface CompiledPolicy {
  policy_id: PolicyId;
  wasm_bundle: Uint8Array;            // Compiled WASM
  verification_proof: VerificationProof;
  policy_hash: Hash;                  // sha3-256 of WASM
  metadata: ConstitutionalMetadata;
}
```

### 1.4 Constitutional Invariants

| Invariant | Description | Test |
|-----------|-------------|------|
| GK-INV-1 | All authority exercises route through `verifyAuthority` | CSD-T-002 |
| GK-INV-2 | All policy compilations produce verification proof | CSD-T-003 |
| GK-INV-3 | All authorizations produce E₂ evidence | CSD-T-004 |
| GK-INV-4 | Revocation effective within 100ms | ACC-CONFORMANCE-3 |
| GK-INV-5 | Kernel state is replayable | CSD-T-005 |
| GK-INV-6 | Kernel decisions independently verifiable | CSD-T-006 |

### 1.5 State Model

```
KernelState {
  authority_grants: Map<AuthorityId, AuthorityGrant>
  compiled_policies: Map<PolicyId, CompiledPolicy>
  active_authorizations: Map<AuthorizationId, AuthorizationRecord>
  revocation_list: Set<AuthorityId>
  constitutional_metadata: ConstitutionalMetadata
  evidence_ledger_ref: EvidenceLedgerRef
}
```

**Persistence:** Append-only event log → Evidence Ledger

---

## 2. Policy Engine — `OSA-PE-v1.0.md`

### 2.1 Purpose
Compile, validate, and manage constitutional policies. Produces deterministic WASM bundles with verification proofs.

### 2.2 Compilation Pipeline

```
Source Policy (Rego + Meta)
       │
       ▼
Constitutional Validator  ──► Reject if non-compliant
       │
       ▼
OPA Compiler (Rego → WASM)
       │
       ▼
Verification Proof Generator
       │
       ▼
Governance Kernel Registry
```

### 2.3 Policy Source Structure

```rego
package osa.orbital.awareness

# CONSTITUTIONAL METADATA (MANDATORY)
__constitutional__ := {
  "authority": "auth:osa:orbital-awareness:satellite-tracking",
  "evidence_level": "E2",
  "replay_required": true,
  "verification_required": true,
  "constitutional_version": "OSA-Constitution-v1.0",
  "acc_version": "OSA-ACC-v1.0",
  "csd_version": "OSA-CSD-v1.0"
}

# POLICY RULES
allow_tracking(agent, satellite) {
  has_authority(agent, "satellite:catalog", "read")
  satellite.classification <= agent.clearance
  not revoked(agent.authority_id)
}

# EVIDENCE PRODUCTION (MANDATORY)
evidence_decision(decision) {
  decision.evidence_level = "E2"
  decision.authority_ref = input.authority_id
  decision.policy_ref = "pol:osa:orbital-tracking:v1.2"
  decision.kernel_authz_ref = input.kernel_authz_id
}
```

### 2.4 Constitutional Metadata Schema

```typescript
interface ConstitutionalMetadata {
  authority: AuthorityId;
  evidence_level: "E2" | "E3" | "E4";
  replay_required: boolean;
  verification_required: boolean;
  constitutional_version: string;
  acc_version: string;
  csd_version: string;
  ceed_version: string;
  ecde_version: string;
}
```

### 2.5 Compiled Policy Format

```typescript
interface CompiledPolicy {
  policy_id: PolicyId;
  wasm_module: Uint8Array;           // OPA WASM
  wasm_hash: Hash;                   // sha3-256
  verification_proof: VerificationProof;
  metadata: ConstitutionalMetadata;
  compiled_at: Timestamp;
  compiled_by: EvidenceSource;       // Policy Engine
}
```

### 2.6 Verification Proof

```typescript
interface VerificationProof {
  proof_type: "FORMAL_VERIFICATION" | "CONFORMANCE_TEST" | "BOTH";
  formal_verification?: FormalVerificationResult;
  conformance_tests?: ConformanceTestResult[];
  verified_at: Timestamp;
  verified_by: EvidenceSource;
}
```

### 2.7 Invariants

| Invariant | Description |
|-----------|-------------|
| PE-INV-1 | All policies carry constitutional metadata |
| PE-INV-2 | Compilation produces verification proof |
| PE-INV-3 | WASM hash recorded in Kernel registry |
| PE-INV-4 | Policy evaluation deterministic given same inputs |
| PE-INV-5 | Policy version lineage maintained |

---

## 3. Decision Engine — `OSA-DE-v1.0.md`

### 3.1 Purpose
Execute governed decisions under authority, producing E₂ evidence with full constitutional binding.

### 3.2 Decision Flow

```
Request + Authority + Context
         │
         ▼
Governance Kernel Authorization
         │
         ▼
Policy Engine Evaluation (WASM)
         │
         ▼
Decision Construction
         │
         ▼
Evidence Production (E₂)
         │
         ▼
Evidence Ledger Write
         │
         ▼
Response + Evidence Ref
```

### 3.3 Interface

```typescript
interface DecisionEngine {
  decide(params: DecideParams): Promise<DecisionResult>;
  replay(params: ReplayParams): Promise<ReplayResult>;
}

interface DecideParams {
  authority_id: AuthorityId;
  policy_id: PolicyId;
  kernel_authz_id: AuthorizationId;
  input_evidence: EvidenceId[];
  context: DecisionContext;
  decision_type: DecisionType;
}

interface DecisionResult {
  decision_id: DecisionId;
  outcome: DecisionOutcome;
  evidence_ref: EvidenceId;        // E₂
  evaluation: PolicyEvaluation;    // From Policy Engine
  obligations: Obligation[];       // Audit, replay, etc.
  timestamp: Timestamp;
  duration_ms: number;
}
```

### 3.4 Decision Context

```typescript
interface DecisionContext {
  actor: EvidenceSource;
  request: any;                    // Original request payload
  environment: EnvironmentState;   // System state snapshot
  constraints: ConstraintSet;      // From authority + policy
}
```

### 3.5 Invariants

| Invariant | Description |
|-----------|-------------|
| DE-INV-1 | Every decision produces E₂ evidence |
| DE-INV-2 | Decision references authority + policy + kernel authz |
| DE-INV-3 | Policy evaluation uses exact WASM from Kernel registry |
| DE-INV-4 | Deterministic: same inputs → same outcome |
| DE-INV-5 | Evidence written before response returned |

---

## 4. Mission Orchestrator — `OSA-MO-v1.0.md`

### 4.1 Purpose
Coordinate multi-step missions under constitutional authority. Each mission action is a governed decision.

### 4.2 Mission Model

```typescript
interface Mission {
  mission_id: MissionId;
  plan: MissionPlan;
  authority_ref: AuthorityId;          // Mission-level authority
  status: MissionStatus;
  current_step: number;
  evidence_refs: EvidenceId[];         // E₂ per action
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

### 4.3 Interface

```typescript
interface MissionOrchestrator {
  createMission(params: CreateMissionParams): Promise<Mission>;
  executeAction(params: ExecuteActionParams): Promise<ActionResult>;
  getMission(mission_id: MissionId): Promise<Mission>;
  abortMission(mission_id: MissionId, reason: string): Promise<AbortResult>;
  replayMission(mission_id: MissionId): Promise<ReplayResult>;
}
```

### 4.4 Mission Action = Governed Decision

Every mission action:
1. Requests kernel authorization for action-specific authority
2. Evaluates mission policy
3. Produces E₂ evidence
4. Records in mission evidence chain

---

## 5. Agent Runtime — `OSA-AR-v1.0.md`

### 5.1 Purpose
Execute autonomous agents under granted authority. Every agent action is a governed decision.

### 5.2 Agent Model

```typescript
interface Agent {
  agent_id: AgentId;
  authority_ref: AuthorityId;          // Granted at spawn
  policy_ref: PolicyId;                // Agent behavior policy
  state: AgentState;
  spawned_at: Timestamp;
  evidence_refs: EvidenceId[];         // E₂ per action
}
```

### 5.3 Interface

```typescript
interface AgentRuntime {
  spawnAgent(params: SpawnAgentParams): Promise<Agent>;
  executeAction(params: AgentActionParams): Promise<ActionResult>;
  getAgent(agent_id: AgentId): Promise<Agent>;
  terminateAgent(agent_id: AgentId, reason: string): Promise<TerminationResult>;
}
```

### 5.4 Agent Lifecycle

```
SPAWN → AUTHORITY_GRANT → KERNEL_AUTHZ → RUNNING
                                        │
                                        ▼
                              ACTION → DECIDE → EVIDENCE
                                        │
                                        ▼
                              TERMINATE → EVIDENCE
```

---

## 6. Simulation Runtime — `OSA-SR-v1.0.md`

### 6.1 Purpose
Execute digital twin simulations with constitutional governance. Every simulation step produces replayable evidence.

### 6.2 Simulation Model

```typescript
interface Simulation {
  simulation_id: SimulationId;
  scenario: Scenario;
  authority_ref: AuthorityId;
  policy_ref: PolicyId;
  state: SimulationState;
  step: number;
  evidence_chain: EvidenceId[];        // E₂ per step
  status: SimulationStatus;
}
```

### 6.3 Interface

```typescript
interface SimulationRuntime {
  createSimulation(params: CreateSimulationParams): Promise<Simulation>;
  step(simulation_id: SimulationId): Promise<StepResult>;
  run(simulation_id: SimulationId, steps: number): Promise<RunResult>;
  replay(params: ReplayParams): Promise<ReplayResult>;
  getSimulation(simulation_id: SimulationId): Promise<Simulation>;
}
```

### 6.4 Determinism Requirements

- Same scenario + same policy + same seed → identical state sequence
- Each step produces E₂ evidence with replay_context
- State snapshots at configurable intervals
- Full replay from any checkpoint

---

## 7. Replay Engine — `OSA-RE-v1.0.md`

### 7.1 Purpose
Deterministically replay any governed decision or simulation. Verifies integrity of evidence chain.

### 7.2 Interface

```typescript
interface ReplayEngine {
  replayDecision(params: ReplayDecisionParams): Promise<ReplayResult>;
  replaySimulation(params: ReplaySimulationParams): Promise<ReplayResult>;
  replayMission(params: ReplayMissionParams): Promise<ReplayResult>;
  verifyReplay(params: VerifyReplayParams): Promise<VerificationResult>;
}

interface ReplayDecisionParams {
  decision_id: DecisionId;
  policy_wasm_hash: Hash;              // Must match original
  input_evidence_hashes: Hash[];       // Must match original
}

interface ReplayResult {
  original_outcome: DecisionOutcome;
  replay_outcome: DecisionOutcome;
  match: boolean;                      // Bitwise equality
  divergence_details?: DivergenceDetails;
  evidence_ref: EvidenceId;            // E₂ replay evidence
}
```

### 7.3 Invariants

| Invariant | Description |
|-----------|-------------|
| RE-INV-1 | Replay uses exact original WASM (hash verified) |
| RE-INV-2 | Replay uses exact original input evidence (hash verified) |
| RE-INV-3 | Replay outcome bitwise-equals original |
| RE-INV-4 | Divergence produces E₃ audit evidence |
| RE-INV-5 | Replay produces E₂ evidence |

---

## 8. Verification Engine — `OSA-VE-v1.0.md`

### 8.1 Purpose
Independent verification of decisions, evidence, policies, and replays.

### 8.2 Verification Types

| Type | Description | Evidence Level |
|------|-------------|----------------|
| VERIFY_DECISION | Re-evaluate decision independently | E₃ |
| VERIFY_EVIDENCE | Verify evidence integrity + chain | E₃ |
| VERIFY_POLICY | Verify policy compilation + deployment | E₃ |
| VERIFY_REPLAY | Verify replay correctness | E₃ |
| VERIFY_CHAIN | Verify evidence chain integrity | E₃ |

### 8.3 Interface

```typescript
interface VerificationEngine {
  verify(params: VerifyParams): Promise<VerificationResult>;
}

interface VerifyParams {
  type: VerificationType;
  target: VerificationTarget;
  verifier: EvidenceSource;          // Independent verifier
  criteria: VerificationCriteria;
}

interface VerificationResult {
  verification_id: VerificationId;
  passed: boolean;
  findings: VerificationFinding[];
  evidence_ref: EvidenceId;          // E₃
  verified_at: Timestamp;
}
```

### 8.4 Independence Requirement

Verifier MUST be independent of original decision maker:
- Different process
- Different code path (separate WASM instance)
- No shared mutable state
- Constitutional Review Council approves verifier deployments

---

## 9. Evidence Ledger — `OSA-EL-v1.0.md`

### 9.1 Purpose
Immutable, append-only storage for all constitutional evidence (E₀–E₄). Cryptographically chained, queryable, replayable.

### 9.2 Data Model

```typescript
interface EvidenceLedgerEntry {
  sequence: number;                   // Global sequence
  evidence: EvidenceRecord;           // ECED-compliant
  causality_refs: CausalityId[];      // Explicit causality
  partition: "E0" | "E1" | "E2" | "E3" | "E4";
  written_at: Timestamp;
  writer: EvidenceSource;             // Kernel, Engine, etc.
}
```

### 9.3 Interface

```typescript
interface EvidenceLedger {
  append(entry: EvidenceLedgerEntry): Promise<AppendResult>;
  get(evidence_id: EvidenceId): Promise<EvidenceLedgerEntry | null>;
  query(params: QueryParams): Promise<EvidenceLedgerEntry[]>;
  verifyChain(params: VerifyChainParams): Promise<ChainVerificationResult>;
  getCheckpoint(params: CheckpointParams): Promise<Checkpoint>;
  replayFrom(checkpoint: Checkpoint): AsyncIterator<EvidenceLedgerEntry>;
}
```

### 9.4 Storage Requirements

| Requirement | Specification |
|-------------|---------------|
| Immutability | Append-only, no delete/update |
| Chaining | Each entry references previous hash |
| Partitioning | By evidence level (E₀–E₄) |
| Indexing | By evidence_id, source, timestamp, chain_hash, subject_refs |
| Integrity | Cryptographic verification on read |
| Replay | Checkpoint + iterator from any point |
| Federation | FEEP import/export with chain preservation |

### 9.5 Invariants

| Invariant | Description |
|-----------|-------------|
| EL-INV-1 | All evidence written before operation completes |
| EL-INV-2 | Chain integrity verified on every read |
| EL-INV-3 | E₀–E₄ partitioning enforced |
| EL-INV-4 | Federation import preserves chain |
| EL-INV-5 | Checkpoint every 10,000 entries |

---

## 10. Audit Engine — `OSA-AE-v1.0.md`

### 10.1 Purpose
Produce constitutional audit records (E₃) for all governance events.

### 10.2 Audit Events

| Event | Trigger | Evidence |
|-------|---------|----------|
| AUTHORITY_GRANT | GK grantAuthority | E₃ |
| AUTHORITY_EXERCISE | GK authorizeDecision | E₃ |
| AUTHORITY_REVOKE | GK revokeAuthority | E₃ |
| POLICY_DEPLOY | GK deployPolicy | E₃ |
| DECISION_MADE | DE decide | E₃ |
| REPLAY_DIVERGED | RE replay | E₃ |
| VERIFICATION_FAILED | VE verify | E₃ |
| CHAIN_BROKEN | EL verifyChain | E₃ |
| FEDERATION_EVENT | Federation treaty ops | E₃ |

### 10.3 Interface

```typescript
interface AuditEngine {
  emitAudit(params: EmitAuditParams): Promise<AuditRecord>;
  queryAudits(params: AuditQueryParams): Promise<AuditRecord[]>;
  generateComplianceReport(params: ReportParams): Promise<ComplianceReport>;
}

interface AuditRecord {
  audit_id: AuditId;
  event_type: AuditEventType;
  timestamp: Timestamp;
  actor: EvidenceSource;
  subject_refs: EvidenceId[];
  findings: AuditFinding[];
  risk_level: RiskLevel;
  evidence_ref: EvidenceId;            // E₃
  chain_hash: Hash;
}
```

---

## 11. Cross-Module Invariants

| Invariant | Modules | Description |
|-----------|---------|-------------|
| RT-INV-1 | All | Every governed operation → GK → DE → EL → AE |
| RT-INV-2 | All | Evidence level matches constitutional requirement |
| RT-INV-3 | GK, DE, RE, VE | Determinism: same inputs → same outputs |
| RT-INV-4 | GK, PE, DE | Policy WASM hash consistency |
| RT-INV-5 | EL, RE, VE | Chain integrity verified at each layer |
| RT-INV-6 | MO, AR, SR | All actions are governed decisions |
| RT-INV-7 | All | No bypass of Governance Kernel |

---

## 12. Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Constitutional Runtime                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │ Governance  │  │  Policy     │  │  Decision   │           │
│  │   Kernel    │◄─┤  Engine     │◄─┤  Engine     │           │
│  └──────┬──────┘  └─────────────┘  └──────┬──────┘           │
│         │                                │                   │
│         ▼                                ▼                   │
│  ┌─────────────────────────────────────────────────┐         │
│  │              Evidence Ledger                     │         │
│  └─────────────────────────────────────────────────┘         │
│         │                                │                   │
│         ▼                                ▼                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │   Replay    │  │Verification │  │    Audit    │           │
│  │   Engine    │  │   Engine    │  │   Engine    │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
│         ▲                                ▲                   │
│         │                                │                   │
│  ┌──────┴──────┐  ┌─────────────┐  ┌─────┴──────┐            │
│  │  Mission    │  │   Agent     │  │ Simulation │            │
│  │ Orchestrator│  │  Runtime    │  │  Runtime   │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

---

## 13. Conformance Test Vectors

| Test ID | Module | Scenario | Expected |
|---------|--------|----------|----------|
| RT-T-001 | GK | Valid authority exercise | Authz granted, E₂ produced |
| RT-T-002 | GK | Revoked authority exercise | Authz denied, E₃ audit |
| RT-T-003 | PE | Valid policy compilation | WASM + proof produced |
| RT-T-004 | PE | Policy missing metadata | Rejected |
| RT-T-005 | DE | Decision under authority | E₂ evidence, kernel authz |
| RT-T-006 | DE | Decision without authority | Denied, E₃ audit |
| RT-T-007 | RE | Decision replay | Bitwise match, E₂ |
| RT-T-008 | RE | Replay with wrong WASM | Divergence, E₃ |
| RT-T-009 | VE | Verify valid decision | Pass, E₃ |
| RT-T-010 | VE | Verify tampered evidence | Fail, E₃ |
| RT-T-011 | EL | Chain integrity | Verified |
| RT-T-012 | EL | Federation import | Chain preserved |
| RT-T-013 | AE | Audit emission | E₃ produced |
| RT-T-014 | MO | Mission action | E₂ per action |
| RT-T-015 | AR | Agent action | E₂ per action |
| RT-T-016 | SR | Simulation step | E₂ per step |

---

## References

| Spec | Document |
|------|----------|
| Constitution | OSA-Constitution-v1.0.md |
| ACC | OSA-ACC-v1.0.md |
| CSD | OSA-CSD-v1.0.md |
| CECD | OSA-CECD-v1.0.md |
| ECED | OSA-ECED-v1.0.md |
| API Specs | OSA-API-Specifications-v1.0.md |

---

*Normative runtime specification. All Layer 3 implementations MUST conform.*