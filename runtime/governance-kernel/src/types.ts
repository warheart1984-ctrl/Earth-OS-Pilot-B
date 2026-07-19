// Constitutional Types for OSA Governance Kernel
// Normative: OSA-Runtime-Specifications-v1.0.md, OSA-CGL-v1.0.md

export type EvidenceLevel = 'E0' | 'E1' | 'E2' | 'E3' | 'E4';

export type EvidenceId = string; // Format: E{level}-OSA-{domain}-{YYYYMMDD}-{seq}
export type AuthorityId = string; // Format: auth:osa:{domain}:{capability}
export type PolicyId = string; // Format: pol:osa:{domain}:{name}:v{version}
export type AuthorizationId = string; // Format: authz:gk:{YYYYMMDD}-{seq}
export type DecisionId = string; // Format: D-OSA-{YYYYMMDD}-{seq}
export type CausalityId = string; // Format: C-OSA-{YYYYMMDD}-{seq}
export type EventId = string; // Format: EV-OSA-{YYYYMMDD}-{seq}
export type AuditId = string; // Format: AUD-OSA-{YYYYMMDD}-{seq}

export type Hash = string; // Format: sha3-256:{hex}
export type Signature = string; // Format: ed25519:{hex}

export interface EvidenceSource {
  type: 'sensor' | 'processor' | 'agent' | 'governance-kernel' | 'audit-engine' 
    | 'ratification-assembly' | 'constitutional-review-council' 
    | 'evidence-stewardship-board' | 'promotion-authority' | 'federation-gateway';
  identifier: string;
  version?: string;
  
  toString(): string;
}

export function createEvidenceSource(
  type: EvidenceSource['type'], 
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

export type Timestamp = string; // RFC3339Nano

export function now(): Timestamp {
  return new Date().toISOString();
}

export interface Capability {
  resource: string;
  action: string;
}

export interface Constraints {
  timeWindow?: { start: Timestamp; end: Timestamp };
  classificationMax?: 'UNCLASSIFIED' | 'CONFIDENTIAL' | 'SECRET' | 'TOP_SECRET';
  resourceFilters?: Record<string, unknown>[];
  contextRequirements?: Record<string, unknown>[];
  quota?: { limit: number; windowMs: number };
}

export interface RevocationTrigger {
  type: 'expiry' | 'classification_breach' | 'scope_exceedance' | 'evidence_failure' | 'constitutional_violation';
  parameters?: Record<string, unknown>;
}

export type EvidenceLevelRequirement = 'E2' | 'E3' | 'E4';

export interface ConstitutionalMetadata {
  authority: AuthorityId;
  evidenceLevel: EvidenceLevelRequirement;
  replayRequired: boolean;
  verificationRequired: boolean;
  constitutionalVersion: string;
  accVersion: string;
  csdVersion: string;
}

export interface ActionSpec {
  resource: string;
  action: string;
  context?: Record<string, unknown>;
}

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
}

export interface PolicyEvaluation {
  policyWasmHash: Hash;
  inputHash: Hash;
  result: 'ALLOW' | 'DENY' | 'CONDITIONAL';
  obligations: Obligation[];
  explanation: string;
  evaluationTimestamp: Timestamp;
  evaluatorVersion: string;
}

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

export interface AuthorizationResult {
  authorized: boolean;
  authorizationId?: AuthorizationId;
  evidenceRef: EvidenceId;
  reason?: string;
  obligations: Obligation[];
}

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

export interface RevocationResult {
  revoked: boolean;
  authorityId: AuthorityId;
  trigger: RevocationTrigger;
  cascadedDelegations: AuthorityId[];
  evidenceRef: EvidenceId;
  timestamp: Timestamp;
}

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
  propertiesVerified: string[];
  proofArtifactHash: Hash;
}

export interface ConformanceTestResult {
  testId: string;
  passed: boolean;
  details?: string;
}

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

export type AuditEventType = 
  | 'AUTHORITY_GRANT' | 'AUTHORITY_EXERCISE' | 'AUTHORITY_REVOKE' | 'AUTHORITY_DELEGATE'
  | 'POLICY_COMPILED' | 'POLICY_DEPLOYED' | 'POLICY_ROLLBACK'
  | 'DECISION_MADE' | 'DECISION_REPLAYED' | 'DECISION_VERIFIED'
  | 'REPLAY_DIVERGED' | 'VERIFICATION_FAILED' | 'CHAIN_VERIFIED' | 'CHAIN_BROKEN'
  | 'FEDERATION_EVENT' | 'CONSTITUTIONAL_AMENDMENT' | 'TREATY_RATIFIED';

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