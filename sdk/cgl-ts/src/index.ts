// Constitutional Governance Library (CGL) - TypeScript SDK
// Normative: OSA-CGL-v1.0.md
// Main entry point - exports all primitives, patterns, and clients

// ============================================================================
// Core Types (from @osa/constitutional-types)
// ============================================================================

export * from '@osa/constitutional-types';

// ============================================================================
// Client Interfaces (for implementation)
// ============================================================================

export interface KernelClient {
  verifyAuthority(params: VerifyAuthorityParams): Promise<AuthorizationResult>;
  grantAuthority(params: GrantAuthorityParams): Promise<AuthorityGrant>;
  revokeAuthority(params: RevokeAuthorityParams): Promise<RevocationResult>;
}

export interface VerifyAuthorityParams {
  authorityId: string;
  holder: EvidenceSource;
  action: { resource: string; action: string };
  context: DecisionContext;
}

export interface AuthorizationResult {
  authorized: boolean;
  authorizationId?: string;
  evidenceRef: string;
  reason?: string;
  obligations: Obligation[];
}

export interface GrantAuthorityParams {
  holder: EvidenceSource;
  scope: Capability[];
  constraints: Constraints;
  delegationPermitted: boolean;
  revocationTriggers: RevocationTrigger[];
  evidenceRequirement: 'E2' | 'E3' | 'E4';
  constitutionalBasis: string;
  expiresAt?: string;
}

export interface AuthorityGrant {
  authorityId: string;
  holder: EvidenceSource;
  scope: Capability[];
  constraints: Constraints;
  delegationPermitted: boolean;
  revocationTriggers: RevocationTrigger[];
  evidenceRequirement: 'E2' | 'E3' | 'E4';
  issuedAt: string;
  expiresAt?: string;
  constitutionalBasis: string;
  evidenceRef: string;
  signature: string;
}

export interface RevokeAuthorityParams {
  authorityId: string;
  trigger: RevocationTrigger;
  evidence: string;
}

export interface RevocationResult {
  revoked: boolean;
  authorityId: string;
  cascadedDelegations: string[];
  evidenceRef: string;
  timestamp: string;
}

export interface DecisionEngineClient {
  decide(params: DecideParams): Promise<DecisionResult>;
}

export interface DecideParams {
  authorityId: string;
  policyId: string;
  kernelAuthzId: string;
  inputEvidence: string[];
  context: DecisionContext;
  decisionType: string;
}

export interface DecisionResult {
  decisionId: string;
  outcome: DecisionOutcome;
  evidenceRef: string;
  evaluation: PolicyEvaluation;
  obligations: Obligation[];
  timestamp: string;
  durationMs: number;
}

export interface PolicyEvaluation {
  policyWasmHash: string;
  inputHash: string;
  result: 'ALLOW' | 'DENY' | 'CONDITIONAL';
  obligations: Obligation[];
  explanation: string;
  evaluationTimestamp: string;
  evaluatorVersion: string;
}

export interface EvidenceLedgerClient {
  append(entry: any): Promise<AppendResult>;
  get(evidenceId: string): Promise<any>;
  query(params: any): Promise<any[]>;
}

export interface AppendResult {
  sequence: number;
  chainHash: string;
  verified: boolean;
}

export interface AuditEngineClient {
  emitAudit(record: any): Promise<any>;
}

export interface FederationGatewayClient {
  importEvidence(params: ImportEvidenceParams): Promise<ImportResult>;
  exportEvidence(params: ExportEvidenceParams): Promise<ExportPackage>;
  syncWithPeer(params: SyncParams): Promise<SyncResult>;
}

export interface ImportEvidenceParams {
  treatyId: string;
  package: ExportPackage;
}

export interface ImportResult {
  imported: number;
  failed: number;
  evidenceRefs: string[];
}

export interface ExportEvidenceParams {
  evidenceIds: string[];
  treatyId: string;
}

export interface ExportPackage {
  packageId: string;
  treatyId: string;
  exportedAt: string;
  evidence: any[];
  causality: any[];
  events: any[];
  chainProof: ChainProof;
  exporterSignature: string;
}

export interface ChainProof {
  evidenceId: string;
  merkleRoot: string;
  merklePath: string[];
  leafIndex: number;
}

export interface SyncParams {
  peer: PeerEndpoint;
  treatyId: string;
}

export interface PeerEndpoint {
  endpoint: string;
  gatewayKey: string;
}

export interface SyncResult {
  synced: number;
  conflicts: number;
  evidenceRefs: string[];
}

// ============================================================================
// Patterns
// ============================================================================

export { governedOperation, AuthorizationDeniedError } from './patterns/governed-operation.js';
export { importFederatedAuthority, exportFederatedEvidence, propagateRevocation, type FederatedCALToken } from './patterns/federated-authority.js';

// ============================================================================
// Utility Functions
// ============================================================================

import { createEvidenceSource, now } from '@osa/constitutional-types';

export { createEvidenceSource, now };

/**
 * Create a standard decision context for operations
 */
export function createDecisionContext(
  actor: EvidenceSource,
  request: any,
  environment: Record<string, any>,
  constraints: Constraints
): DecisionContext {
  return { actor, request, environment, constraints };
}

/**
 * Create standard obligations for governed operations
 */
export function createStandardObligations(): Obligation[] {
  return [
    { type: 'PRODUCE_EVIDENCE', parameters: { level: 'E2' } },
    { type: 'EMIT_AUDIT', parameters: { eventType: 'DECISION_MADE' } },
    { type: 'SCHEDULE_REPLAY', parameters: {} },
    { type: 'SCHEDULE_VERIFICATION', parameters: {} }
  ];
}

/**
 * Validate constitutional metadata in policy source
 */
export function validateConstitutionalMetadata(source: string): {
  valid: boolean;
  errors: string[];
  metadata?: any;
} {
  const metaMatch = source.match(/__constitutional__\s*:=\s*\{([\s\S]*?)\}/);
  if (!metaMatch) {
    return { valid: false, errors: ['Missing __constitutional__ metadata block'] };
  }

  try {
    const metadata = JSON.parse(`{${metaMatch[1]}}`);
    const errors: string[] = [];

    if (!metadata.authority) errors.push('Missing authority in constitutional metadata');
    if (!metadata.evidence_level) errors.push('Missing evidence_level in constitutional metadata');
    if (!['E2', 'E3', 'E4'].includes(metadata.evidence_level)) {
      errors.push('evidence_level must be E2, E3, or E4 for governed policies');
    }
    if (typeof metadata.replay_required !== 'boolean') errors.push('Missing replay_required in constitutional metadata');
    if (metadata.replay_required !== true) errors.push('replay_required must be true for governed policies');
    if (typeof metadata.verification_required !== 'boolean') errors.push('Missing verification_required in constitutional metadata');
    if (metadata.verification_required !== true) errors.push('verification_required must be true for governed policies');

    return { valid: errors.length === 0, errors, metadata };
  } catch (e) {
    return { valid: false, errors: ['Invalid constitutional metadata JSON'] };
  }
}

/**
 * Create a governance kernel client configuration
 */
export interface KernelClientConfig {
  endpoint: string;
  authToken?: string;
  timeoutMs?: number;
}

/**
 * Create an evidence ledger client configuration
 */
export interface EvidenceLedgerClientConfig {
  endpoint: string;
  authToken?: string;
  timeoutMs?: number;
}

/**
 * Create a decision engine client configuration
 */
export interface DecisionEngineClientConfig {
  endpoint: string;
  authToken?: string;
  timeoutMs?: number;
}

/**
 * Create a federation gateway client configuration
 */
export interface FederationGatewayClientConfig {
  endpoint: string;
  gatewayKey: string;
  timeoutMs?: number;
}

// Re-export types for convenience
export type {
  EvidenceSource,
  DecisionContext,
  DecisionOutcome,
  Obligation,
  Capability,
  Constraints,
  RevocationTrigger,
  PolicyId,
  AuthorityId,
  EvidenceId,
  Timestamp,
  Hash,
  Signature
} from '@osa/constitutional-types';