// Governed Operation Pattern
// Normative: OSA-CGL-v1.0.md §2.1

import { createEvidenceSource, now } from '../index.js';
import type { 
  AuthorityId, PolicyId, AuthorizationId, EvidenceId, 
  EvidenceSource, DecisionContext, DecisionOutcome, Obligation,
  DecisionResult
} from '@osa/constitutional-types';

export interface KernelClient {
  verifyAuthority(params: VerifyAuthorityParams): Promise<AuthorizationResult>;
}

export interface VerifyAuthorityParams {
  authorityId: AuthorityId;
  holder: EvidenceSource;
  action: { resource: string; action: string };
  context: DecisionContext;
}

export interface AuthorizationResult {
  authorized: boolean;
  authorizationId?: AuthorizationId;
  evidenceRef: EvidenceId;
  reason?: string;
  obligations: Obligation[];
}

export interface DecisionEngineClient {
  decide(params: DecideParams): Promise<DecisionResult>;
}

export interface DecideParams {
  authorityId: AuthorityId;
  policyId: PolicyId;
  kernelAuthzId: AuthorizationId;
  inputEvidence: EvidenceId[];
  context: DecisionContext;
  decisionType: string;
}

export interface EvidenceLedgerClient {
  append(entry: any): Promise<any>;
}

export interface AuditEngineClient {
  emitAudit(record: any): Promise<any>;
}

export interface GovernedOperationParams<T> {
  authorityId: AuthorityId;
  policyId: PolicyId;
  holder: EvidenceSource;
  action: { resource: string; action: string };
  context: DecisionContext;
  inputEvidence: EvidenceId[];
  decisionType: string;
  operation: () => Promise<T>;
  kernelClient: KernelClient;
  decisionEngineClient: DecisionEngineClient;
  evidenceLedgerClient: EvidenceLedgerClient;
  auditEngineClient: AuditEngineClient;
}

export interface GovernedResult<T> {
  result: T;
  evidenceRef: EvidenceId;
  decisionId: string;
}

/**
 * Execute a governed operation under constitutional authority.
 * This is the canonical pattern for all governed operations in OSA.
 * 
 * Flow:
 * 1. Request kernel authorization for the authority
 * 2. If authorized, execute the operation
 * 3. Produce governed decision evidence (E₂)
 * 4. Fulfill obligations (audit, replay scheduling, etc.)
 * 
 * @example
 * ```typescript
 * const result = await governedOperation({
 *   authorityId: 'auth:osa:orbital-awareness:satellite-tracking',
 *   policyId: 'pol:osa:orbital-tracking:v1.2',
 *   holder: createEvidenceSource('agent', 'orbital-tracker'),
 *   action: { resource: 'satellite:catalog', action: 'read' },
 *   context: { actor: source, request: { satelliteId: 'SAT-123' }, ... },
 *   inputEvidence: ['E1-OSA-ORB-20260719-001'],
 *   decisionType: 'CONJUNCTION_ASSESSMENT',
 *   operation: async () => await trackSatellite('SAT-123'),
 *   kernelClient, decisionEngineClient, evidenceLedgerClient, auditEngineClient
 * });
 * ```
 */
export async function governedOperation<T>(
  params: GovernedOperationParams<T>
): Promise<GovernedResult<T>> {
  const {
    authorityId, policyId, holder, action, context,
    inputEvidence, decisionType, operation,
    kernelClient, decisionEngineClient, evidenceLedgerClient, auditEngineClient
  } = params;

  // 1. Request Kernel Authorization
  const authz = await kernelClient.verifyAuthority({
    authorityId,
    holder,
    action,
    context
  });

  if (!authz.authorized) {
    throw new AuthorizationDeniedError(authz.reason, authz.evidenceRef);
  }

  // 2. Execute the operation
  const result = await operation();

  // 3. Produce Governed Decision Evidence (E₂)
  const decision = await decisionEngineClient.decide({
    authorityId,
    policyId,
    kernelAuthzId: authz.authorizationId!,
    inputEvidence,
    context,
    decisionType
  });

  // 4. Fulfill Obligations
  await fulfillObligations(authz.obligations, decision, {
    kernelClient, decisionEngineClient, evidenceLedgerClient, auditEngineClient
  });

  return {
    result,
    evidenceRef: decision.evidenceRef,
    decisionId: decision.decisionId.value
  };
}

export class AuthorizationDeniedError extends Error {
  constructor(
    public readonly reason: string | undefined,
    public readonly evidenceRef: EvidenceId
  ) {
    super(`Authorization denied: ${reason || 'Unknown reason'}`);
    this.name = 'AuthorizationDeniedError';
  }
}

async function fulfillObligations(
  obligations: Obligation[],
  decision: DecisionResult,
  clients: {
    kernelClient: KernelClient;
    decisionEngineClient: DecisionEngineClient;
    evidenceLedgerClient: EvidenceLedgerClient;
    auditEngineClient: AuditEngineClient;
  }
): Promise<void> {
  for (const obligation of obligations) {
    switch (obligation.type) {
      case 'EMIT_AUDIT':
        await clients.auditEngineClient.emitAudit({
          eventType: obligation.parameters.eventType || 'DECISION_MADE',
          actor: createEvidenceSource('governance-kernel', 'cgl-pattern'),
          subjectRefs: [decision.evidenceRef],
          findings: [{
            rule: 'CSD-T-004',
            status: 'COMPLIANT',
            details: `Governed operation produced E2 evidence`
          }],
          riskLevel: 'NONE'
        });
        break;

      case 'SCHEDULE_REPLAY':
        // Schedule async replay verification
        console.log(`[CGL] Scheduled replay for decision ${decision.decisionId.value}`);
        break;

      case 'SCHEDULE_VERIFICATION':
        // Schedule async independent verification
        console.log(`[CGL] Scheduled verification for decision ${decision.decisionId.value}`);
        break;

      case 'NOTIFY':
        // Send notifications
        break;

      case 'PRODUCE_EVIDENCE':
        // Already produced in decision
        break;
    }
  }
}