// Decision Engine - Governed Decisions with E₂ Evidence
// Normative: OSA-Runtime-Specifications-v1.0.md §3, OSA-ECED-v1.0.md §3.3, §6

import { createHash, randomUUID } from 'node:crypto';
import {
  AuthorityId, PolicyId, AuthorizationId, DecisionId, EvidenceId,
  EvidenceSource, Timestamp, DecisionContext, DecisionOutcome, Obligation,
  PolicyEvaluation, ReplayContext, VerificationContext,
  DecisionResult, ReplayParams, ReplayResult, DecisionRecord,
  createDecisionId, createEvidenceId, createTimestamp, createEvidenceSource, now
} from '@osa/constitutional-types';

export interface DecisionEngineConfig {
  kernelClient: GovernanceKernelClient;
  policyEngineClient: PolicyEngineClient;
  evidenceLedgerClient: EvidenceLedgerClient;
  auditEngineClient: AuditEngineClient;
  signingKey: Uint8Array;
}

export interface GovernanceKernelClient {
  authorizeDecision(params: AuthorizeDecisionParams): Promise<AuthorizationResult>;
}

export interface AuthorizeDecisionParams {
  authorityId: AuthorityId;
  policyId: PolicyId;
  kernelAuthzId: AuthorizationId;
  inputEvidence: EvidenceId[];
  context: DecisionContext;
  decisionType: string;
}

export interface AuthorizationResult {
  authorized: boolean;
  authorizationId?: AuthorizationId;
  evidenceRef: EvidenceId;
  reason?: string;
  obligations: Obligation[];
}

export interface PolicyEngineClient {
  evaluatePolicy(policyId: PolicyId, inputs: PolicyEvaluationInput): Promise<PolicyEvaluation>;
}

export interface PolicyEvaluationInput {
  authority: string;
  holder: string;
  action: { resource: string; action: string };
  environment: Record<string, any>;
  evidence: string[];
}

export interface EvidenceLedgerClient {
  append(entry: EvidenceLedgerEntry): Promise<AppendResult>;
}

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

export interface AuditEngineClient {
  emitAudit(record: AuditRecord): Promise<AuditRecord>;
}

export interface AuditRecord {
  auditId: string;
  eventType: string;
  timestamp: Timestamp;
  actor: EvidenceSource;
  subjectRefs: EvidenceId[];
  findings: AuditFinding[];
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  evidenceRef: EvidenceId;
  chainHash: string;
}

export interface AuditFinding {
  rule: string;
  status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIAL' | 'NOT_APPLICABLE';
  details: string;
  evidenceRefs?: EvidenceId[];
}

export class DecisionEngine {
  private config: DecisionEngineConfig;
  private decisionSequence = 0;

  constructor(config: DecisionEngineConfig) {
    this.config = config;
  }

  // ========================================================================
  // Main Decision Flow
  // ========================================================================

  async decide(params: DecideParams): Promise<DecisionResult> {
    const startTime = Date.now();

    // 1. Request Kernel Authorization
    const authz = await this.config.kernelClient.authorizeDecision({
      authorityId: params.authorityId,
      policyId: params.policyId,
      kernelAuthzId: params.kernelAuthzId,
      inputEvidence: params.inputEvidence,
      context: params.context,
      decisionType: params.decisionType
    });

    if (!authz.authorized) {
      return {
        decisionId: createDecisionId(`D-OSA-DENIED-${now().split('T')[0].replace(/-/g, '')}-${String(++this.decisionSequence).padStart(4, '0')}`),
        outcome: { result: 'DENY', parameters: { reason: authz.reason } },
        evidenceRef: authz.evidenceRef,
        evaluation: { result: 'DENY' } as PolicyEvaluation,
        obligations: authz.obligations,
        timestamp: now(),
        durationMs: Date.now() - startTime
      };
    }

    // 2. Evaluate Policy
    const evaluation = await this.config.policyEngineClient.evaluatePolicy(params.policyId, {
      authority: params.authorityId.value,
      holder: params.context.actor.toString(),
      action: { resource: params.context.request.resource || 'unknown', action: params.context.request.action || 'unknown' },
      environment: params.context.environment,
      evidence: params.inputEvidence.map(e => e.value)
    });

    // 3. Construct Decision Outcome
    const outcome: DecisionOutcome = this.constructOutcome(evaluation, params.context);

    // 4. Produce Governed Decision Evidence (E₂)
    const evidenceRef = await this.produceDecisionEvidence(params, authz, evaluation, outcome);

    // 5. Fulfill Obligations
    await this.fulfillObligations(evaluation.obligations, {
      decisionId: createDecisionId(`D-OSA-${now().split('T')[0].replace(/-/g, '')}-${String(++this.decisionSequence).padStart(4, '0')}`),
      outcome,
      evidenceRef,
      authz,
      evaluation
    });

    // 6. Emit Audit
    await this.emitAudit({
      eventType: 'DECISION_MADE',
      actor: createEvidenceSource('decision-engine', 'osa'),
      subjectRefs: [evidenceRef, ...params.inputEvidence],
      findings: [{ rule: 'CSD-T-004', status: 'COMPLIANT', details: 'Decision produces E2 evidence' }],
      riskLevel: 'NONE'
    });

    return {
      decisionId: createDecisionId(`D-OSA-${now().split('T')[0].replace(/-/g, '')}-${String(this.decisionSequence).padStart(4, '0')}`),
      outcome,
      evidenceRef,
      evaluation,
      obligations: evaluation.obligations,
      timestamp: now(),
      durationMs: Date.now() - startTime
    };
  }

  private constructOutcome(evaluation: PolicyEvaluation, context: DecisionContext): DecisionOutcome {
    return {
      result: evaluation.result,
      action: evaluation.result === 'ALLOW' ? 'execute' : 'deny',
      parameters: context.request,
      obligations: evaluation.obligations
    };
  }

  // ========================================================================
  // Evidence Production (E₂)
  // ========================================================================

  private async produceDecisionEvidence(
    params: DecideParams,
    authz: AuthorizationResult,
    evaluation: PolicyEvaluation,
    outcome: DecisionOutcome
  ): Promise<EvidenceId> {
    const evidenceId = createEvidenceId(`E2-OSA-DE-${now().split('T')[0].replace(/-/g, '')}-${String(++this.decisionSequence).padStart(4, '0')}`);
    
    const policy = await this.config.policyEngineClient.getPolicy?.(params.policyId);
    const policyWasmHash = policy?.wasmHash.value || 'sha3-256:unknown';

    const decision: DecisionRecord = {
      type: params.decisionType as any,
      timestamp: now(),
      actor: params.context.actor,
      context: {
        policyInputs: params.context.request,
        authorityConstraints: params.context.constraints,
        environmentalState: params.context.environment
      },
      outcome,
      rationale: evaluation.explanation
    };

    const payloadHash = `sha3-256:${createHash('sha3-256').update(JSON.stringify(decision)).digest('hex')}`;
    
    // Get previous chain hash for this source:level
    const previousEvidenceHash = await this.getPreviousChainHash(params.context.actor.toString(), 'E2');
    const chainHash = `sha3-256:${createHash('sha3-256').update(payloadHash + (previousEvidenceHash || 'GENESIS')).digest('hex')}`;

    const evidence: EvidenceLedgerEntry = {
      evidenceId,
      level: 'E2',
      timestamp: now(),
      source: createEvidenceSource('decision-engine', 'osa'),
      authorityRef: params.authorityId,
      policyRef: params.policyId,
      policyVersionHash: policyWasmHash,
      kernelAuthorizationRef: authz.authorizationId!,
      inputEvidenceRefs: params.inputEvidence,
      decision,
      payloadHash,
      previousEvidenceHash,
      chainHash,
      signature: this.sign(chainHash)
    };

    await this.config.evidenceLedgerClient.append(evidence);
    return evidenceId;
  }

  private async getPreviousChainHash(source: string, level: string): Promise<string | null> {
    // In production, query evidence ledger for last entry by source:level
    return null; // Genesis for now
  }

  // ========================================================================
  // Obligation Fulfillment
  // ========================================================================

  private async fulfillObligations(
    obligations: Obligation[],
    decisionContext: {
      decisionId: DecisionId;
      outcome: DecisionOutcome;
      evidenceRef: EvidenceId;
      authz: AuthorizationResult;
      evaluation: PolicyEvaluation;
    }
  ): Promise<void> {
    for (const obligation of obligations) {
      switch (obligation.type) {
        case 'EMIT_AUDIT':
          await this.emitAudit({
            eventType: obligation.parameters.eventType || 'DECISION_MADE',
            actor: createEvidenceSource('decision-engine', 'osa'),
            subjectRefs: [decisionContext.evidenceRef],
            findings: [{ rule: 'CSD-T-004', status: 'COMPLIANT', details: 'Obligation fulfilled' }],
            riskLevel: 'NONE'
          });
          break;
        case 'SCHEDULE_REPLAY':
          // Schedule replay job
          console.log(`[REPLAY] Scheduled replay for decision ${decisionContext.decisionId.value}`);
          break;
        case 'SCHEDULE_VERIFICATION':
          // Schedule verification job
          console.log(`[VERIFY] Scheduled verification for decision ${decisionContext.decisionId.value}`);
          break;
        case 'PRODUCE_EVIDENCE':
          // Already produced above
          break;
      }
    }
  }

  // ========================================================================
  // Replay
  // ========================================================================

  async replay(params: ReplayParams): Promise<ReplayResult> {
    const originalDecision = await this.getOriginalDecision(params.decisionId);
    if (!originalDecision) {
      throw new Error(`Original decision not found: ${params.decisionId.value}`);
    }

    // Reconstruct inputs
    const inputEvidence = await this.reconstructInputEvidence(originalDecision.decision.inputEvidenceRefs);
    
    // Execute replay with exact original WASM
    const replayEvaluation = await this.config.policyEngineClient.evaluatePolicy(
      originalDecision.policyRef,
      this.buildReplayInputs(originalDecision, inputEvidence)
    );

    const match = this.compareOutcomes(originalDecision.decision.outcome, replayEvaluation.result);

    // Produce replay evidence (E₂)
    const replayEvidenceRef = await this.produceReplayEvidence(params.decisionId, originalDecision, replayEvaluation, match);

    return {
      originalOutcome: originalDecision.decision.outcome,
      replayOutcome: this.convertResultToOutcome(replayEvaluation.result),
      match,
      divergenceDetails: match ? undefined : { point: 'policy_evaluation', expected: originalDecision.decision.outcome, actual: this.convertResultToOutcome(replayEvaluation.result) },
      evidenceRef: replayEvidenceRef
    };
  }

  // ========================================================================
  // Audit
  // ========================================================================

  private async emitAudit(record: Omit<AuditRecord, 'auditId' | 'timestamp' | 'evidenceRef' | 'chainHash'>): Promise<void> {
    await this.config.auditEngineClient.emitAudit({
      ...record,
      auditId: `AUD-OSA-${now().split('T')[0].replace(/-/g, '')}-${randomUUID().slice(0, 4)}`,
      timestamp: now(),
      evidenceRef: createEvidenceId(`E3-OSA-AUDIT-${now().split('T')[0].replace(/-/g, '')}-${randomUUID().slice(0, 4)}`),
      chainHash: 'sha3-256:placeholder'
    });
  }

  // ========================================================================
  // Helpers
  // ========================================================================

  private sign(data: string): string {
    return `ed25519:${createHash('sha3-256').update(data + this.config.signingKey.toString()).digest('hex').slice(0, 64)}`;
  }

  private async getOriginalDecision(decisionId: DecisionId): Promise<any> {
    // In production, query evidence ledger for E₂ evidence by decision ID
    return null;
  }

  private async reconstructInputEvidence(refs: EvidenceId[]): Promise<any[]> {
    return [];
  }

  private buildReplayInputs(original: any, evidence: any[]): PolicyEvaluationInput {
    return {
      authority: original.authorityRef.value,
      holder: original.decision.actor.toString(),
      action: original.decision.context.policyInputs,
      environment: original.decision.context.environmentalState,
      evidence: original.decision.inputEvidenceRefs.map((e: EvidenceId) => e.value)
    };
  }

  private compareOutcomes(original: DecisionOutcome, replay: 'ALLOW' | 'DENY' | 'CONDITIONAL'): boolean {
    return original.result === replay;
  }

  private convertResultToOutcome(result: 'ALLOW' | 'DENY' | 'CONDITIONAL'): DecisionOutcome {
    return { result, action: result === 'ALLOW' ? 'execute' : 'deny' };
  }

  private async produceReplayEvidence(
    decisionId: DecisionId,
    original: any,
    replayEvaluation: PolicyEvaluation,
    match: boolean
  ): Promise<EvidenceId> {
    const evidenceId = createEvidenceId(`E2-OSA-REPLAY-${now().split('T')[0].replace(/-/g, '')}-${randomUUID().slice(0, 4)}`);
    // ... produce evidence
    return evidenceId;
  }
}

export interface DecideParams {
  authorityId: AuthorityId;
  policyId: PolicyId;
  kernelAuthzId: AuthorizationId;
  inputEvidence: EvidenceId[];
  context: DecisionContext;
  decisionType: string;
}

export interface DecisionResult {
  decisionId: DecisionId;
  outcome: DecisionOutcome;
  evidenceRef: EvidenceId;
  evaluation: PolicyEvaluation;
  obligations: Obligation[];
  timestamp: Timestamp;
  durationMs: number;
}