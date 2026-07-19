// Constitutional Types for OSA
// Normative: OSA-Constitution-v1.0.md, OSA-ACC-v1.0.md, OSA-CSD-v1.0.md, OSA-CECD-v1.0.md, OSA-ECED-v1.0.md

// ============================================================================
// Core Identity Types (String Brands for Type Safety)
// ============================================================================

export type AuthorityId = string;
export type PolicyId = string;
export type AuthorizationId = string;
export type DecisionId = string;
export type EvidenceId = string;
export type CausalityId = string;
export type EventId = string;
export type AuditId = string;
export type Hash = string;
export type Signature = string;
export type Timestamp = string;

// Constructor functions
export function createAuthorityId(value: string): AuthorityId { return value; }
export function createPolicyId(value: string): PolicyId { return value; }
export function createAuthorizationId(value: string): AuthorizationId { return value; }
export function createDecisionId(value: string): DecisionId { return value; }
export function createEvidenceId(value: string): EvidenceId { return value; }
export function createCausalityId(value: string): CausalityId { return value; }
export function createEventId(value: string): EventId { return value; }
export function createAuditId(value: string): AuditId { return value; }
export function createHash(value: string): Hash { return value; }
export function createSignature(value: string): Signature { return value; }
export function createTimestamp(value: string): Timestamp { return value; }
export function now(): Timestamp { return new Date().toISOString(); }

// ============================================================================
// Evidence Source (ECED §1.3)
// ============================================================================

export type EvidenceSourceType = 
  | 'sensor' 
  | 'processor' 
  | 'agent' 
  | 'governance-kernel' 
  | 'audit-engine' 
  | 'ratification-assembly' 
  | 'constitutional-review-council' 
  | 'evidence-stewardship-board' 
  | 'promotion-authority' 
  | 'federation-gateway';

export interface EvidenceSource {
  type: EvidenceSourceType;
  identifier: string;
  version?: string;
  toString(): string;
}

export function createEvidenceSource(
  type: EvidenceSourceType, 
  identifier: string, 
  version?: string
): EvidenceSource {
  return {
    type,
    identifier,
    version,
    toString(): string {
      return version ? `${type}:${identifier}:${version}` : `${type}:${identifier}`;
    }
  };
}

// ============================================================================
// Evidence Levels (CECD §1, ECED §2)
// ============================================================================

export type EvidenceLevel = 'E0' | 'E1' | 'E2' | 'E3' | 'E4';

// ============================================================================
// Capability & Constraints (ACC §1.2)
// ============================================================================

export interface Capability {
  resource: string;
  action: string;
}

export interface Constraints {
  timeWindow?: TimeWindow;
  classificationMax?: ClassificationLevel;
  resourceFilters?: ResourceFilter[];
  contextRequirements?: ContextRequirement[];
  quota?: QuotaSpec;
}

export interface TimeWindow { 
  start: Timestamp; 
  end: Timestamp; 
}

export type ClassificationLevel = 'UNCLASSIFIED' | 'CONFIDENTIAL' | 'SECRET' | 'TOP_SECRET';

export interface ResourceFilter { 
  pattern: string; 
  action: 'allow' | 'deny'; 
}

export interface ContextRequirement {
  key: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: any;
  delegatedFrom?: string;
}

export interface QuotaSpec {
  requestsPerSecond: number;
  requestsPerDay: number;
  burstAllowance: number;
}

// ============================================================================
// Revocation Triggers (ACC §2.4)
// ============================================================================

export type RevocationTrigger = 
  | { type: 'expiry'; parameters: Record<string, never> }
  | { type: 'classification_breach'; parameters: { maxLevel: ClassificationLevel } }
  | { type: 'scope_exceedance'; parameters: Record<string, never> }
  | { type: 'evidence_failure'; parameters: Record<string, never> }
  | { type: 'identity_compromise'; parameters: Record<string, never> }
  | { type: 'parent_revoked'; parameters: { parentAuthorityId: AuthorityId } };

export type EvidenceLevelRequirement = 'E2' | 'E3' | 'E4';

// ============================================================================
// Constitutional Metadata (CSD §2.2)
// ============================================================================

export interface ConstitutionalMetadata {
  authority: AuthorityId;
  evidenceLevel: EvidenceLevelRequirement;
  replayRequired: boolean;
  verificationRequired: boolean;
  constitutionalVersion: string;
  accVersion: string;
  csdVersion: string;
  cecdVersion?: string;
  ecedVersion?: string;
}

// ============================================================================
// Action Specification
// ============================================================================

export interface ActionSpec {
  resource: string;
  action: string;
  context?: Record<string, unknown>;
}

// ============================================================================
// Decision Context & Outcome (ECED §6)
// ============================================================================

export interface DecisionContext {
  actor: EvidenceSource;
  request: Record<string, unknown>;
  environment: Record<string, unknown>;
  constraints: Constraints;
}

export interface DecisionOutcome {
  result: 'ALLOW' | 'DENY' | 'CONDITIONAL';
  action?: string;
  classification?: string;
  parameters?: Record<string, unknown>;
  obligations?: Obligation[];
}

export interface Obligation {
  type: 'PRODUCE_EVIDENCE' | 'EMIT_AUDIT' | 'NOTIFY' | 'SCHEDULE_REPLAY' | 'SCHEDULE_VERIFICATION';
  parameters: Record<string, unknown>;
  deadline?: Timestamp;
}

// ============================================================================
// Policy Evaluation (RT §2.5)
// ============================================================================

export interface PolicyEvaluation {
  policyWasmHash: Hash;
  inputHash: Hash;
  result: 'ALLOW' | 'DENY' | 'CONDITIONAL';
  obligations: Obligation[];
  explanation: string;
  evaluationTimestamp: Timestamp;
  evaluatorVersion: string;
}

// ============================================================================
// Replay & Verification Context (ECED §3.3)
// ============================================================================

export interface ReplayContext {
  policyWasmHash: Hash;
  inputEvidenceHashes: Hash[];
  runtimeVersion: string;
  deterministicSeed?: string;
}

export interface VerificationContext {
  verifier: EvidenceSource;
  method: 'REPLAY' | 'INDEPENDENT_EVALUATION' | 'FORMAL_PROOF';
  verificationPolicyHash?: Hash;
}

// ============================================================================
// Authorization Result (RT §1.3)
// ============================================================================

export interface AuthorizationResult {
  authorized: boolean;
  authorizationId?: AuthorizationId;
  evidenceRef: EvidenceId;
  reason?: string;
  obligations: Obligation[];
}

// ============================================================================
// Authority Grant (ACC §1.2, §2.1)
// ============================================================================

export interface AuthorityGrant {
  authorityId: AuthorityId;
  holder: EvidenceSource;
  scope: Capability[];
  constraints: Constraints;
  delegationPermitted: boolean;
  revocationTriggers: RevocationTrigger[];
  evidenceRequirement: EvidenceLevelRequirement;
  issuedAt: Timestamp;
  expiresAt?: Timestamp;
  constitutionalBasis: string;
  evidenceRef: EvidenceId;
  signature: Signature;
}

// ============================================================================
// Revocation Result (ACC §2.4)
// ============================================================================

export interface RevocationResult {
  revoked: boolean;
  authorityId: AuthorityId;
  trigger: RevocationTrigger;
  cascadedDelegations: AuthorityId[];
  evidenceRef: EvidenceId;
  timestamp: Timestamp;
}

// ============================================================================
// Compiled Policy (CSD §2.2, RT §2)
// ============================================================================

export interface CompiledPolicy {
  policyId: PolicyId;
  wasm: Uint8Array;
  wasmHash: Hash;
  metadata: ConstitutionalMetadata;
  verificationProof: VerificationProof;
  compiledAt: Timestamp;
  compiledBy: EvidenceSource;
}

export interface VerificationProof {
  proofType: 'FORMAL_VERIFICATION' | 'CONFORMANCE_TEST' | 'BOTH';
  formalVerification?: FormalVerificationResult;
  conformanceTests?: ConformanceTestResult[];
  verifiedAt: Timestamp;
  verifiedBy: EvidenceSource;
}

export interface FormalVerificationResult {
  prover: string;
  version: string;
  propertiesVerified: string[];
  proofArtifactHash: Hash;
  result: 'PASS' | 'FAIL';
}

export interface ConformanceTestResult {
  testId: string;
  name: string;
  result: 'PASS' | 'FAIL';
  durationMs: number;
}

// ============================================================================
// Deployment & Validation Results (RT §2.6, §2.7)
// ============================================================================

export interface DeploymentResult {
  deployed: boolean;
  policyId: PolicyId;
  deploymentId: string;
  evidenceRef: EvidenceId;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  evidenceRef?: EvidenceId;
}

// ============================================================================
// Audit Types (CECD §3, RT §10)
// ============================================================================

export type AuditEventType = 
  | 'AUTHORITY_GRANT' 
  | 'AUTHORITY_EXERCISE' 
  | 'AUTHORITY_REVOKE'
  | 'AUTHORITY_DELEGATE' 
  | 'POLICY_COMPILED' 
  | 'POLICY_DEPLOYED'
  | 'KERNEL_AUTHZ_GRANTED' 
  | 'KERNEL_AUTHZ_DENIED'
  | 'DECISION_MADE' 
  | 'DECISION_DENIED'
  | 'REPLAY_DIVERGED' 
  | 'VERIFICATION_FAILED'
  | 'CHAIN_VERIFIED' 
  | 'CHAIN_BROKEN'
  | 'FEDERATION_EVENT' 
  | 'CONSTITUTIONAL_AMENDMENT' 
  | 'TREATY_RATIFIED';

export interface AuditFinding {
  rule: string;
  status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIAL' | 'NOT_APPLICABLE';
  details: string;
  evidenceRefs?: EvidenceId[];
}

export interface AuditRecord {
  auditId: AuditId;
  eventType: AuditEventType;
  timestamp: Timestamp;
  actor: EvidenceSource;
  subjectRefs: EvidenceId[];
  findings: AuditFinding[];
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  evidenceRef: EvidenceId;
  chainHash: Hash;
}

// ============================================================================
// Constitutional State (RT §1.5)
// ============================================================================

export interface ConstitutionalState {
  authorityGrants: Map<string, AuthorityGrant>;
  compiledPolicies: Map<string, CompiledPolicy>;
  activeAuthorizations: Map<string, AuthorizationRecord>;
  revocationList: Set<string>;
  metadata: ConstitutionalMetadata;
}

export interface AuthorizationRecord {
  authorizationId: AuthorizationId;
  authorityId: AuthorityId;
  holder: EvidenceSource;
  policyId: PolicyId;
  inputEvidence: EvidenceId[];
  context: DecisionContext;
  granted: boolean;
  timestamp: Timestamp;
  evidenceRef: EvidenceId;
}

// ============================================================================
// Decision Record (ECED §3.3, §6.2)
// ============================================================================

export interface DecisionRecord {
  type: string;
  timestamp: string;
  actor: EvidenceSource;
  context: {
    policyInputs: any;
    authorityConstraints: any;
    environmentalState: any;
  };
  outcome: DecisionOutcome;
  rationale: string;
}

// ============================================================================
// Replay Types (RT §7)
// ============================================================================

export interface ReplayParams {
  decisionId: DecisionId;
  policyWasmHash: Hash;
  inputEvidenceHashes: Hash[];
  runtimeVersion: string;
  deterministicSeed?: string;
}

export interface ReplayResult {
  originalOutcome: DecisionOutcome;
  replayOutcome: DecisionOutcome | null;
  match: boolean;
  divergenceDetails?: {
    point: string;
    originalHash: Hash;
    replayHash: Hash;
  };
  evidenceRef: EvidenceId;
}

// ============================================================================
// Evidence Ledger Types (OSA-Evidence-Specification-v1.0.md)
// ============================================================================

export interface EvidenceLedgerEntry {
  evidenceId: EvidenceId;
  level: 'E2';
  timestamp: Timestamp;
  source: EvidenceSource;
  authorityRef: AuthorityId;
  policyRef: PolicyId;
  policyVersionHash: string;
  kernelAuthorizationRef: AuthorizationId;
  inputEvidenceRefs: EvidenceId[];
  decision: DecisionRecord;
  payloadHash: string;
  previousEvidenceHash: string | null;
  chainHash: string;
  signature: string;
}

export interface AppendResult {
  sequence: number;
  chainHash: string;
  verified: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================

export function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}