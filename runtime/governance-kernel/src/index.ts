// Governance Kernel - Public API
export { GovernanceKernel } from './kernel.js';
export type { GovernanceKernelConfig } from './kernel.js';

// Value exports
export { now, createEvidenceSource, randomUUID } from '@osa/constitutional-types';

// Type exports
export type { 
  EvidenceId, AuthorityId, PolicyId, AuthorizationId, DecisionId,
  Hash, Signature, EvidenceSource, Timestamp, Capability, Constraints,
  RevocationTrigger, EvidenceLevelRequirement, ConstitutionalMetadata,
  ActionSpec, DecisionContext, DecisionOutcome, Obligation,
  PolicyEvaluation, ReplayContext, VerificationContext,
  AuthorizationResult, AuthorityGrant, RevocationResult,
  CompiledPolicy, VerificationProof, DeploymentResult, ValidationResult,
  AuditRecord, AuditEventType, AuditFinding, ConstitutionalState
} from '@osa/constitutional-types';