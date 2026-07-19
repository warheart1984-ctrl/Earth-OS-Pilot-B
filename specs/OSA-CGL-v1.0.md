# Constitutional Governance Library (CGL)

**System:** OuterSpace AI (OSA)  
**Version:** 1.0  
**Status:** Ratified — Reusable Governance Primitives  
**Authority:** OSA-Constitution-v1.0.md Article 3, OSA-CSD-v1.0.md Section 1.1  
**Conformance:** CSD-L1-C6

---

## Purpose

Provides reusable, composable governance primitives that implement constitutional patterns. All OSA subsystems, agents, and federated domains MUST use CGL primitives rather than reimplementing governance logic.

---

## 1. Core Primitives

### 1.1 Authority Grant

```typescript
// cgl/authority/AuthorityGrant.ts

interface AuthorityGrant {
  grant(params: GrantParams): Promise<GrantResult>;
  validate(authority_id: AuthorityId, holder: EvidenceSource, action: ActionSpec): Promise<ValidationResult>;
  revoke(params: RevokeParams): Promise<RevocationResult>;
  delegate(params: DelegateParams): Promise<GrantResult>;
}

interface GrantParams {
  authority_id: AuthorityId;
  holder: EvidenceSource;
  scope: Capability[];
  constraints: Constraints;
  delegation_permitted: boolean;
  revocation_triggers: RevocationTrigger[];
  evidence_requirement: EvidenceLevel;
  expires_at?: Timestamp;
  constitutional_basis: string;  // e.g., "OSA-Constitution-v1.0 Article 4"
}

interface Constraints {
  time_window?: TimeWindow;
  classification_max?: ClassificationLevel;
  resource_filters?: ResourceFilter[];
  context_requirements?: ContextRequirement[];
  quota?: QuotaSpec;
}
```

**Constitutional Invariants:**
- CGL-AUTH-1: All grants route through Governance Kernel
- CGL-AUTH-2: Every grant produces E₂ evidence
- CGL-AUTH-3: Constraints enforced at exercise time
- CGL-AUTH-4: Delegation depth ≤ 3

### 1.2 Policy Compiler

```typescript
// cgl/policy/PolicyCompiler.ts

interface PolicyCompiler {
  compile(source: PolicySource): Promise<CompiledPolicy>;
  validate(source: PolicySource): Promise<ValidationResult>;
  verify(compiled: CompiledPolicy): Promise<VerificationProof>;
}

interface PolicySource {
  rego: string;
  metadata: ConstitutionalMetadata;
  dependencies: PolicyId[];
}

interface CompiledPolicy {
  policy_id: PolicyId;
  wasm: Uint8Array;
  wasm_hash: Hash;
  metadata: ConstitutionalMetadata;
  verification_proof: VerificationProof;
  compiled_at: Timestamp;
}
```

**Constitutional Invariants:**
- CGL-POL-1: Metadata includes authority_ref, evidence_level, replay_required
- CGL-POL-2: Compilation produces verification proof
- CGL-POL-3: WASM hash recorded in Kernel registry
- CGL-POL-4: Dependencies resolved and verified

### 1.3 Decision Maker

```typescript
// cgl/decision/DecisionMaker.ts

interface DecisionMaker {
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
  evidence_ref: EvidenceId;           // E₂
  evaluation: PolicyEvaluation;
  obligations: Obligation[];
  timestamp: Timestamp;
  duration_ms: number;
}
```

**Constitutional Invariants:**
- CGL-DEC-1: Kernel authorization required before evaluation
- CGL-DEC-2: Policy evaluation uses exact WASM from Kernel registry
- CGL-DEC-3: E₂ evidence produced with full constitutional binding
- CGL-DEC-4: Replay context captured for deterministic replay

### 1.4 Evidence Producer

```typescript
// cgl/evidence/EvidenceProducer.ts

interface EvidenceProducer {
  produce<E extends EvidenceRecord>(params: ProduceParams<E>): Promise<E>;
  verify(evidence: EvidenceRecord): Promise<VerificationResult>;
  chain(source: EvidenceSource, level: EvidenceLevel): Promise<ChainVerificationResult>;
}

interface ProduceParams<E extends EvidenceRecord> {
  level: E['level'];
  source: EvidenceSource;
  payload: E['payload'];
  previous_evidence_hash?: Hash;
  signing_key: SigningKey;
}
```

**Constitutional Invariants:**
- CGL-EVD-1: Chain hash computed correctly
- CGL-EVD-2: Signature over chain_hash
- CGL-EVD-3: Payload serialized to canonical JSON
- CGL-EVD-4: Previous hash linked correctly

### 1.5 Audit Logger

```typescript
// cgl/audit/AuditLogger.ts

interface AuditLogger {
  log(params: LogParams): Promise<AuditRecord>;
  query(query: AuditQuery): Promise<AuditRecord[]>;
  generateReport(params: ReportParams): Promise<ComplianceReport>;
}

interface LogParams {
  event_type: AuditEventType;
  actor: EvidenceSource;
  subject_refs: EvidenceId[];
  findings: AuditFinding[];
  risk_level: RiskLevel;
  evidence_ref: EvidenceId;  // E₃
}
```

**Constitutional Invariants:**
- CGL-AUD-1: All governance events logged
- CGL-AUD-2: E₃ evidence produced
- CGL-AUD-3: Findings reference conformance rules
- CGL-AUD-4: Risk level assessed

---

## 2. Composite Patterns

### 2.1 Governed Operation Pattern

```typescript
// cgl/patterns/GovernedOperation.ts

async function governedOperation<T>(
  params: GovernedOperationParams<T>
): Promise<GovernedResult<T>> {
  // 1. Request authority verification
  const authz = await kernel.verifyAuthority({
    authority_id: params.authority_id,
    holder: params.holder,
    action: params.action,
    context: params.context
  });
  
  if (!authz.authorized) {
    throw new AuthorizationDeniedError(authz.reason, authz.evidence_ref);
  }
  
  // 2. Execute operation
  const result = await params.operation();
  
  // 3. Produce governed decision evidence
  const decision = await decisionMaker.decide({
    authority_id: params.authority_id,
    policy_id: params.policy_id,
    kernel_authz_id: authz.authorization_id,
    input_evidence: params.input_evidence,
    context: params.context,
    decision_type: params.decision_type
  });
  
  // 4. Fulfill obligations (audit, notifications, etc.)
  await fulfillObligations(decision.obligations, {
    decision_id: decision.decision_id,
    result,
    evidence_ref: decision.evidence_ref
  });
  
  return {
    result,
    evidence_ref: decision.evidence_ref,
    decision_id: decision.decision_id
  };
}
```

**Usage:** ALL governed operations in OSA MUST use this pattern.

### 2.2 Federated Authority Pattern

```typescript
// cgl/federation/FederatedAuthority.ts

interface FederatedAuthority {
  importAuthority(params: ImportAuthorityParams): Promise<ImportResult>;
  exportAuthority(params: ExportAuthorityParams): Promise<ExportResult>;
  propagateRevocation(params: PropagateRevocationParams): Promise<PropagationResult>;
  verifyFederated(params: VerifyFederatedParams): Promise<VerificationResult>;
}

interface ImportAuthorityParams {
  treaty_id: TreatyId;
  token: FederatedCALToken;
  local_policy_id: PolicyId;
}
```

**Constitutional Invariants:**
- CGL-FED-1: Treaty must be ratified (E₄ evidence)
- CGL-FED-2: Import produces local E₂ evidence
- CGL-FED-3: Revocation propagates per treaty terms
- CGL-FED-4: Sovereignty boundaries respected

### 2.3 Mission Governance Pattern

```typescript
// cgl/mission/MissionGovernance.ts

interface MissionGovernance {
  createMission(params: CreateMissionParams): Promise<Mission>;
  executeAction(params: ExecuteActionParams): Promise<ActionResult>;
  abortMission(params: AbortMissionParams): Promise<AbortResult>;
}

interface CreateMissionParams {
  mission_id: MissionId;
  plan: MissionPlan;
  authority_ref: AuthorityId;
  policy_ref: PolicyId;
}
```

---

## 3. Integration Interfaces

### 3.1 Governance Kernel Client

```typescript
// cgl/kernel/KernelClient.ts

interface KernelClient {
  // Authority
  verifyAuthority(params: VerifyAuthorityParams): Promise<AuthorizationResult>;
  grantAuthority(params: GrantAuthorityParams): Promise<AuthorityGrant>;
  revokeAuthority(params: RevokeAuthorityParams): Promise<RevocationResult>;
  
  // Policy
  compilePolicy(params: CompilePolicyParams): Promise<CompiledPolicy>;
  deployPolicy(params: DeployPolicyParams): Promise<DeploymentResult>;
  
  // Decision
  authorizeDecision(params: AuthorizeDecisionParams): Promise<AuthorizationResult>;
  
  // Audit
  emitAudit(params: EmitAuditParams): Promise<AuditRecord>;
  
  // State
  getConstitutionalState(): Promise<ConstitutionalState>;
}
```

### 3.2 Evidence Ledger Client

```typescript
// cgl/ledger/LedgerClient.ts

interface LedgerClient {
  append(entry: LedgerEntry): Promise<AppendResult>;
  get(evidence_id: EvidenceId): Promise<LedgerEntry | null>;
  query(params: QueryParams): Promise<LedgerEntry[]>;
  verifyChain(params: VerifyChainParams): Promise<ChainVerificationResult>;
  getCheckpoint(params: CheckpointParams): Promise<Checkpoint>;
  replayFrom(checkpoint: Checkpoint): AsyncIterator<LedgerEntry>;
}
```

### 3.3 Federation Gateway Client

```typescript
// cgl/federation/FederationGatewayClient.ts

interface FederationGatewayClient {
  exportEvidence(evidence_ids: EvidenceId[]): Promise<ExportPackage>;
  importEvidence(pkg: ExportPackage, treaty_id: TreatyId): Promise<ImportResult>;
  syncWithPeer(peer: PeerEndpoint, treaty_id: TreatyId): Promise<SyncResult>;
  getFederationState(treaty_id: TreatyId): Promise<FederationState>;
}
```

---

## 4. SDK Usage (Layer 8)

### 4.1 TypeScript SDK

```typescript
// cgl/sdk/index.ts

import { 
  GovernanceKernelClient,
  EvidenceLedgerClient,
  DecisionMaker,
  PolicyCompiler,
  AuthorityGrant,
  AuditLogger,
  governedOperation,
  FederatedAuthority
} from '@osa/cgl';

const kernel = new GovernanceKernelClient({ endpoint: 'https://gk.osa.space' });
const ledger = new EvidenceLedgerClient({ endpoint: 'https://el.osa.space' });
const decisionMaker = new DecisionMaker({ kernel });
const policyCompiler = new PolicyCompiler({ kernel });
const authorityGrant = new AuthorityGrant({ kernel });
const auditLogger = new AuditLogger({ kernel });

// Use governed operation pattern
const result = await governedOperation({
  authority_id: 'auth:osa:orbital-awareness:satellite-tracking',
  policy_id: 'pol:osa:orbital-tracking:v1.2',
  holder: 'agent:orbital-awareness-tracker',
  action: { resource: 'satellite:catalog', action: 'read' },
  context: { satellite_id: 'SAT-123' },
  input_evidence: ['E1-OSA-ORB-20260719-001'],
  decision_type: 'CONJUNCTION_ASSESSMENT',
  operation: async () => {
    // Actual operation logic here
    return await trackSatellite('SAT-123');
  }
});

console.log(`Decision: ${result.decision_id}, Evidence: ${result.evidence_ref}`);
```

### 4.2 Rust SDK

```rust
// cgl-rs/src/lib.rs

use cgl_rs::{
    GovernanceKernelClient, EvidenceLedgerClient, DecisionMaker,
    PolicyCompiler, AuthorityGrant, AuditLogger,
    governed_operation, GovernedOperationParams
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let kernel = GovernanceKernelClient::new("https://gk.osa.space")?;
    let ledger = EvidenceLedgerClient::new("https://el.osa.space")?;
    
    let result = governed_operation(GovernedOperationParams {
        authority_id: "auth:osa:orbital-awareness:satellite-tracking".parse()?,
        policy_id: "pol:osa:orbital-tracking:v1.2".parse()?,
        holder: "agent:orbital-awareness-tracker".parse()?,
        action: ActionSpec { resource: "satellite:catalog", action: "read" },
        context: serde_json::json!({ "satellite_id": "SAT-123" }),
        input_evidence: vec!["E1-OSA-ORB-20260719-001".parse()?],
        decision_type: DecisionType::ConjunctionAssessment,
        operation: || async {
            track_satellite("SAT-123").await
        }
    }).await?;
    
    println!("Decision: {}, Evidence: {}", result.decision_id, result.evidence_ref);
    Ok(())
}
```

---

## 5. Conformance Requirements

| Requirement | Description |
|-------------|-------------|
| CGL-CONF-1 | All primitives implement constitutional invariants |
| CGL-CONF-2 | All patterns use Governance Kernel for authorization |
| CGL-CONF-3 | All evidence production uses EvidenceProducer primitive |
| CGL-CONF-4 | All audit logging uses AuditLogger primitive |
| CGL-CONF-5 | SDKs expose governed operation pattern as primary API |
| CGL-CONF-6 | Federation primitives enforce treaty requirements |
| CGL-CONF-7 | All primitives produce correct evidence levels |
| CGL-CONF-8 | All primitives are replayable and verifiable |

---

## 6. Module Map

```
cgl/
├── authority/
│   ├── AuthorityGrant.ts
│   ├── AuthorityValidator.ts
│   └── DelegationManager.ts
├── policy/
│   ├── PolicyCompiler.ts
│   ├── PolicyValidator.ts
│   └── VerificationProofGenerator.ts
├── decision/
│   ├── DecisionMaker.ts
│   ├── DecisionContextBuilder.ts
│   └── ReplayEngine.ts
├── evidence/
│   ├── EvidenceProducer.ts
│   ├── ChainVerifier.ts
│   └── CanonicalSerializer.ts
├── audit/
│   ├── AuditLogger.ts
│   ├── ComplianceReporter.ts
│   └── FindingClassifier.ts
├── patterns/
│   ├── GovernedOperation.ts
│   ├── FederatedAuthority.ts
│   └── MissionGovernance.ts
├── kernel/
│   └── KernelClient.ts
├── ledger/
│   └── LedgerClient.ts
├── federation/
│   └── FederationGatewayClient.ts
├── sdk/
│   ├── index.ts
│   ├── rust/
│   │   └── lib.rs
│   └── python/
│       └── __init__.py
└── test/
    ├── conformance/
    └── fixtures/
```

---

## 7. Normative References

| Ref | Document |
|-----|----------|
| [CONST] | OSA-Constitution-v1.0.md |
| [ACC] | OSA-ACC-v1.0.md |
| [CSD] | OSA-CSD-v1.0.md |
| [CECD] | OSA-CECD-v1.0.md |
| [ECED] | OSA-ECED-v1.0.md |
| [RT] | OSA-Runtime-Specifications-v1.0.md |
| [EVD] | OSA-Evidence-Specification-v1.0.md |

---

*Normative governance library. All OSA implementations MUST use CGL primitives.*