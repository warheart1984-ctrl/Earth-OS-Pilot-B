// Mission Orchestrator - Multi-step Mission Governance
// Normative: OSA-Runtime-Specifications-v1.0.md §4

import { randomUUID } from 'node:crypto';
import {
  AuthorityId, PolicyId, AuthorizationId, DecisionId, EvidenceId,
  EvidenceSource, Timestamp, DecisionContext, DecisionOutcome, Obligation,
  MissionId, MissionPlan, MissionStatus, MissionAction,
  createMissionId, createDecisionId, createEvidenceId, createTimestamp, createEvidenceSource, now
} from '@osa/constitutional-types';

export interface MissionOrchestratorConfig {
  kernelClient: KernelClient;
  decisionEngineClient: DecisionEngineClient;
  evidenceLedgerClient: EvidenceLedgerClient;
  auditEngineClient: AuditEngineClient;
  signingKey: Uint8Array;
}

export interface KernelClient {
  grantAuthority(params: GrantAuthorityParams): Promise<AuthorityGrant>;
  revokeAuthority(params: RevokeAuthorityParams): Promise<RevocationResult>;
}

export interface GrantAuthorityParams {
  holder: EvidenceSource;
  scope: Capability[];
  constraints: Constraints;
  delegationPermitted: boolean;
  revocationTriggers: RevocationTrigger[];
  evidenceRequirement: 'E2' | 'E3' | 'E4';
  constitutionalBasis: string;
  expiresAt?: Timestamp;
}

export interface AuthorityGrant {
  authorityId: AuthorityId;
  holder: EvidenceSource;
  scope: Capability[];
  constraints: Constraints;
  delegationPermitted: boolean;
  revocationTriggers: RevocationTrigger[];
  evidenceRequirement: 'E2' | 'E3' | 'E4';
  issuedAt: Timestamp;
  expiresAt?: Timestamp;
  constitutionalBasis: string;
  evidenceRef: EvidenceId;
  signature: string;
}

export interface RevokeAuthorityParams {
  authorityId: AuthorityId;
  trigger: RevocationTrigger;
  evidence: EvidenceId;
}

export interface RevocationResult {
  revoked: boolean;
  authorityId: AuthorityId;
  trigger: RevocationTrigger;
  cascadedDelegations: AuthorityId[];
  evidenceRef: EvidenceId;
  timestamp: Timestamp;
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

export interface DecisionResult {
  decisionId: DecisionId;
  outcome: DecisionOutcome;
  evidenceRef: EvidenceId;
  evaluation: any;
  obligations: Obligation[];
  timestamp: Timestamp;
  durationMs: number;
}

export interface EvidenceLedgerClient {
  append(entry: any): Promise<{ sequence: number; chainHash: string; verified: boolean }>;
}

export interface AuditEngineClient {
  emitAudit(record: any): Promise<any>;
}

export interface Capability {
  resource: string;
  action: string;
}

export interface Constraints {
  timeWindow?: TimeWindow;
  classificationMax?: string;
  resourceFilters?: any[];
  contextRequirements?: any[];
  quota?: any;
}

export interface TimeWindow { start: Timestamp; end: Timestamp; }

export type RevocationTrigger = 
  | { type: 'expiry'; parameters: {} }
  | { type: 'classification_breach'; parameters: { maxLevel: string } }
  | { type: 'scope_exceedance'; parameters: {} }
  | { type: 'evidence_failure'; parameters: {} }
  | { type: 'identity_compromise'; parameters: {} }
  | { type: 'parent_revoked'; parameters: { parentAuthorityId: AuthorityId } };

export interface MissionPlan {
  missionId: MissionId;
  name: string;
  description: string;
  steps: MissionStep[];
  authorityRef: AuthorityId;
  policyRef: PolicyId;
  constraints: Constraints;
  createdAt: Timestamp;
  createdBy: EvidenceSource;
}

export interface MissionStep {
  stepId: string;
  name: string;
  description: string;
  action: MissionAction;
  preconditions: Precondition[];
  postconditions: Postcondition[];
  timeoutMs: number;
  retryPolicy: RetryPolicy;
  authorityScope: Capability[];
}

export interface MissionAction {
  type: 'ORBITAL_MANEUVER' | 'OBSERVATION_TASK' | 'DATA_COLLECTION' | 'COMMUNICATION' | 'COMPUTATION' | 'CUSTOM';
  resource: string;
  action: string;
  parameters: Record<string, any>;
}

export interface Precondition {
  type: 'EVIDENCE_EXISTS' | 'STATE_MATCHES' | 'AUTHORITY_VALID' | 'CUSTOM';
  parameters: Record<string, any>;
}

export interface Postcondition {
  type: 'EVIDENCE_PRODUCED' | 'STATE_UPDATED' | 'NOTIFICATION_SENT' | 'CUSTOM';
  parameters: Record<string, any>;
}

export interface RetryPolicy {
  maxRetries: number;
  backoffMs: number;
  retryOn: string[];
}

export interface Mission {
  missionId: MissionId;
  plan: MissionPlan;
  authorityGrant: AuthorityGrant;
  status: MissionStatus;
  currentStep: number;
  stepResults: StepResult[];
  evidenceRefs: EvidenceId[];
  createdAt: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  abortedAt?: Timestamp;
  abortReason?: string;
}

export type MissionStatus = 'CREATED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'ABORTED';

export interface StepResult {
  stepId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  decisionId?: DecisionId;
  evidenceRef?: EvidenceId;
  outcome?: DecisionOutcome;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  error?: string;
  retryCount: number;
}

export interface CreateMissionParams {
  plan: MissionPlan;
  holder: EvidenceSource;
  expiresAt?: Timestamp;
}

export interface ExecuteMissionParams {
  missionId: MissionId;
  inputEvidence: EvidenceId[];
}

export interface ExecuteStepParams {
  missionId: MissionId;
  stepId: string;
  inputEvidence: EvidenceId[];
}

export interface AbortMissionParams {
  missionId: MissionId;
  reason: string;
}

export interface MissionResult {
  mission: Mission;
  evidenceRef: EvidenceId;
}

export class MissionOrchestrator {
  private config: MissionOrchestratorConfig;
  private missions: Map<string, Mission> = new Map();

  constructor(config: MissionOrchestratorConfig) {
    this.config = config;
  }

  // ========================================================================
  // Mission Lifecycle
  // ========================================================================

  async createMission(params: CreateMissionParams): Promise<MissionResult> {
    // 1. Grant mission authority
    const authorityGrant = await this.config.kernelClient.grantAuthority({
      holder: params.holder,
      scope: this.extractCapabilities(params.plan.steps),
      constraints: params.plan.constraints,
      delegationPermitted: false,
      revocationTriggers: [
        { type: 'scope_exceedance', parameters: {} },
        { type: 'evidence_failure', parameters: {} },
        { type: 'identity_compromise', parameters: { reason: 'mission_abort' } }
      ],
      evidenceRequirement: 'E2',
      constitutionalBasis: `MISSION:${params.plan.missionId.value}`,
      expiresAt: params.expiresAt
    });

    // 2. Create mission record
    const mission: Mission = {
      missionId: params.plan.missionId,
      plan: params.plan,
      authorityGrant,
      status: 'CREATED',
      currentStep: 0,
      stepResults: params.plan.steps.map(s => ({
        stepId: s.stepId,
        status: 'PENDING',
        retryCount: 0
      })),
      evidenceRefs: [authorityGrant.evidenceRef],
      createdAt: now()
    };

    this.missions.set(mission.missionId.value, mission);

    // 3. Emit creation audit
    await this.emitAudit({
      eventType: 'MISSION_CREATED',
      actor: createEvidenceSource('mission-orchestrator', 'osa'),
      subjectRefs: [authorityGrant.evidenceRef],
      findings: [{ rule: 'CSD-T-010', status: 'COMPLIANT', details: `Mission ${mission.missionId.value} created` }],
      riskLevel: 'NONE'
    });

    return { mission, evidenceRef: authorityGrant.evidenceRef };
  }

  async executeMission(params: ExecuteMissionParams): Promise<Mission> {
    const mission = this.getMission(params.missionId);
    if (!mission) throw new Error(`Mission not found: ${params.missionId.value}`);

    if (mission.status !== 'CREATED' && mission.status !== 'PAUSED') {
      throw new Error(`Mission not in executable state: ${mission.status}`);
    }

    mission.status = 'RUNNING';
    mission.startedAt = now();

    await this.emitAudit({
      eventType: 'MISSION_STARTED',
      actor: createEvidenceSource('mission-orchestrator', 'osa'),
      subjectRefs: [mission.authorityGrant.evidenceRef, ...params.inputEvidence],
      findings: [{ rule: 'CSD-T-010', status: 'COMPLIANT', details: `Mission ${mission.missionId.value} started` }],
      riskLevel: 'NONE'
    });

    // Execute steps sequentially
    while (mission.currentStep < mission.plan.steps.length && mission.status === 'RUNNING') {
      const step = mission.plan.steps[mission.currentStep];
      const result = await this.executeStep({
        missionId: mission.missionId,
        stepId: step.stepId,
        inputEvidence: params.inputEvidence
      });

      if (result.status === 'FAILED') {
        if (result.retryCount >= step.retryPolicy.maxRetries) {
          await this.failMission(mission, step, result.error || 'Step failed');
          break;
        }
        // Retry with backoff
        await this.sleep(step.retryPolicy.backoffMs * Math.pow(2, result.retryCount));
        continue;
      }

      mission.currentStep++;
    }

    if (mission.status === 'RUNNING' && mission.currentStep >= mission.plan.steps.length) {
      await this.completeMission(mission);
    }

    return mission;
  }

  async executeStep(params: ExecuteStepParams): Promise<StepResult> {
    const mission = this.getMission(params.missionId);
    if (!mission) throw new Error(`Mission not found: ${params.missionId.value}`);

    const step = mission.plan.steps.find(s => s.stepId === params.stepId);
    if (!step) throw new Error(`Step not found: ${params.stepId}`);

    const stepResult = mission.stepResults[mission.currentStep];
    stepResult.status = 'RUNNING';
    stepResult.startedAt = now();

    const authzId = `authz:mission:${params.missionId.value}:${params.stepId}:${now().split('T')[0].replace(/-/g, '')}`;

    try {
      const decision = await this.config.decisionEngineClient.decide({
        authorityId: mission.authorityGrant.authorityId,
        policyId: mission.plan.policyRef,
        kernelAuthzId: authzId,
        inputEvidence: params.inputEvidence,
        context: {
          actor: createEvidenceSource('mission-orchestrator', params.missionId.value),
          request: { step: params.stepId, action: step.action },
          environment: { missionId: params.missionId.value, step: step.stepId },
          constraints: mission.authorityGrant.constraints
        },
        decisionType: 'MISSION_STEP'
      });

      stepResult.status = 'COMPLETED';
      stepResult.decisionId = decision.decisionId;
      stepResult.evidenceRef = decision.evidenceRef;
      stepResult.outcome = decision.outcome;
      stepResult.completedAt = now();

      mission.evidenceRefs.push(decision.evidenceRef);

      await this.emitAudit({
        eventType: 'MISSION_STEP_COMPLETED',
        actor: createEvidenceSource('mission-orchestrator', 'osa'),
        subjectRefs: [decision.evidenceRef, ...params.inputEvidence],
        findings: [{ rule: 'CSD-T-010', status: 'COMPLIANT', details: `Mission step ${params.stepId} completed` }],
        riskLevel: 'NONE'
      });

      // Verify postconditions
      await this.verifyPostconditions(step, decision);

      return stepResult;

    } catch (error) {
      stepResult.status = 'FAILED';
      stepResult.error = error instanceof Error ? error.message : String(error);
      stepResult.completedAt = now();
      stepResult.retryCount++;

      await this.emitAudit({
        eventType: 'MISSION_STEP_FAILED',
        actor: createEvidenceSource('mission-orchestrator', 'osa'),
        subjectRefs: [],
        findings: [{ rule: 'CSD-T-010', status: 'NON_COMPLIANT', details: `Step ${params.stepId} failed: ${stepResult.error}` }],
        riskLevel: 'HIGH'
      });

      return stepResult;
    }
  }

  async abortMission(params: AbortMissionParams): Promise<Mission> {
    const mission = this.getMission(params.missionId);
    if (!mission) throw new Error(`Mission not found: ${params.missionId.value}`);

    if (mission.status === 'COMPLETED' || mission.status === 'ABORTED') {
      throw new Error(`Mission already ${mission.status}`);
    }

    // Revoke mission authority
    const revocation = await this.config.kernelClient.revokeAuthority({
      authorityId: mission.authorityGrant.authorityId,
      trigger: { type: 'identity_compromise', parameters: { reason: params.reason } },
      evidence: mission.evidenceRefs[mission.evidenceRefs.length - 1]
    });

    mission.status = 'ABORTED';
    mission.abortedAt = now();
    mission.abortReason = params.reason;
    mission.evidenceRefs.push(revocation.evidenceRef);

    await this.emitAudit({
      eventType: 'MISSION_ABORTED',
      actor: createEvidenceSource('mission-orchestrator', 'osa'),
      subjectRefs: [revocation.evidenceRef],
      findings: [{ rule: 'CSD-T-010', status: 'COMPLIANT', details: `Mission aborted: ${params.reason}` }],
      riskLevel: 'MEDIUM'
    });

    return mission;
  }

  async getMission(missionId: MissionId): Promise<Mission | null> {
    return this.missions.get(missionId.value) || null;
  }

  listMissions(): Mission[] {
    return Array.from(this.missions.values());
  }

  getMissionsByStatus(status: MissionStatus): Mission[] {
    return Array.from(this.missions.values()).filter(m => m.status === status);
  }

  // ========================================================================
  // Helpers
  // ========================================================================

  private extractCapabilities(steps: MissionStep[]): Capability[] {
    const capabilities = new Map<string, Capability>();
    for (const step of steps) {
      for (const cap of step.authorityScope) {
        capabilities.set(`${cap.resource}:${cap.action}`, cap);
      }
    }
    return Array.from(capabilities.values());
  }

  private getMission(missionId: MissionId): Mission | null {
    return this.missions.get(missionId.value) || null;
  }

  private async failMission(mission: Mission, step: MissionStep, error: string): Promise<void> {
    mission.status = 'FAILED';
    mission.completedAt = now();

    const authzId = `authz:mission:fail:${mission.missionId.value}:${now().split('T')[0].replace(/-/g, '')}`;
    const decision = await this.config.decisionEngineClient.decide({
      authorityId: mission.authorityGrant.authorityId,
      policyId: mission.plan.policyRef,
      kernelAuthzId: authzId,
      inputEvidence: [],
      context: {
        actor: createEvidenceSource('mission-orchestrator', mission.missionId.value),
        request: { action: 'mission_fail', error },
        environment: { missionId: mission.missionId.value },
        constraints: mission.authorityGrant.constraints
      },
      decisionType: 'MISSION_FAIL'
    });

    mission.evidenceRefs.push(decision.evidenceRef);

    await this.emitAudit({
      eventType: 'MISSION_FAILED',
      actor: createEvidenceSource('mission-orchestrator', 'osa'),
      subjectRefs: [decision.evidenceRef],
      findings: [{ rule: 'CSD-T-010', status: 'NON_COMPLIANT', details: `Mission failed at step ${step.stepId}: ${error}` }],
      riskLevel: 'HIGH'
    });
  }

  private async completeMission(mission: Mission): Promise<void> {
    mission.status = 'COMPLETED';
    mission.completedAt = now();

    const authzId = `authz:mission:complete:${mission.missionId.value}:${now().split('T')[0].replace(/-/g, '')}`;
    const decision = await this.config.decisionEngineClient.decide({
      authorityId: mission.authorityGrant.authorityId,
      policyId: mission.plan.policyRef,
      kernelAuthzId: authzId,
      inputEvidence: [],
      context: {
        actor: createEvidenceSource('mission-orchestrator', mission.missionId.value),
        request: { action: 'mission_complete' },
        environment: { missionId: mission.missionId.value },
        constraints: mission.authorityGrant.constraints
      },
      decisionType: 'MISSION_COMPLETE'
    });

    mission.evidenceRefs.push(decision.evidenceRef);

    await this.emitAudit({
      eventType: 'MISSION_COMPLETED',
      actor: createEvidenceSource('mission-orchestrator', 'osa'),
      subjectRefs: [decision.evidenceRef],
      findings: [{ rule: 'CSD-T-010', status: 'COMPLIANT', details: `Mission ${mission.missionId.value} completed successfully` }],
      riskLevel: 'NONE'
    });
  }

  private async verifyPostconditions(step: MissionStep, decision: DecisionResult): Promise<void> {
    for (const post of step.postconditions) {
      if (post.type === 'EVIDENCE_PRODUCED' && !decision.evidenceRef) {
        throw new Error(`Postcondition failed: evidence not produced for step ${step.stepId}`);
      }
    }
  }

  private async emitAudit(record: any): Promise<void> {
    await this.config.auditEngineClient.emitAudit({
      ...record,
      auditId: `AUD-MO-${now().split('T')[0].replace(/-/g, '')}-${randomUUID().slice(0, 4)}`,
      timestamp: now(),
      evidenceRef: createEvidenceId(`E3-OSA-MO-${now().split('T')[0].replace(/-/g, '')}-${randomUUID().slice(0, 4)}`),
      chainHash: 'sha3-256:placeholder'
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}