// Agent Runtime - Autonomous Agents Under Constitutional Authority
// Normative: OSA-Runtime-Specifications-v1.0.md §5, OSA-CGL-v1.0.md

import { randomUUID } from 'node:crypto';
import {
  AuthorityId, PolicyId, AgentId, EvidenceId, EvidenceSource, Timestamp,
  Capability, Constraints, DecisionContext, DecisionOutcome, Obligation,
  DecisionResult, createAgentId, createEvidenceId, createEvidenceSource, now
} from '@osa/constitutional-types';

export interface AgentRuntimeConfig {
  kernelClient: KernelClient;
  decisionEngineClient: DecisionEngineClient;
  evidenceLedgerClient: EvidenceLedgerClient;
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
  revocationTriggers: Array<{ type: string; parameters?: any }>;
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
  revocationTriggers: Array<{ type: string; parameters?: any }>;
  evidenceRequirement: 'E2' | 'E3' | 'E4';
  issuedAt: Timestamp;
  expiresAt?: Timestamp;
  constitutionalBasis: string;
  evidenceRef: EvidenceId;
}

export interface RevokeAuthorityParams {
  authorityId: AuthorityId;
  trigger: { type: string; parameters?: any };
  evidence: EvidenceId;
}

export interface RevocationResult {
  revoked: boolean;
  authorityId: AuthorityId;
  cascadedDelegations: AuthorityId[];
  evidenceRef: EvidenceId;
}

export interface DecisionEngineClient {
  decide(params: DecideParams): Promise<DecisionResult>;
}

export interface DecideParams {
  authorityId: AuthorityId;
  policyId: PolicyId;
  kernelAuthzId: string;
  inputEvidence: EvidenceId[];
  context: DecisionContext;
  decisionType: string;
}

export interface EvidenceLedgerClient {
  append(entry: any): Promise<any>;
}

export interface Agent {
  agentId: AgentId;
  authorityId: AuthorityId;
  policyId: PolicyId;
  state: AgentState;
  capabilities: Capability[];
  constraints: Constraints;
  spawnedAt: Timestamp;
  lastActionAt?: Timestamp;
  evidenceRefs: EvidenceId[];
  status: 'SPAWNING' | 'RUNNING' | 'PAUSED' | 'TERMINATING' | 'TERMINATED';
}

export type AgentState = Record<string, any>;

export interface SpawnAgentParams {
  policyId: PolicyId;
  initialState?: AgentState;
  capabilities: Capability[];
  constraints: Constraints;
  authorityBasis: string;
  expiresAt?: Timestamp;
}

export interface AgentActionParams {
  agentId: AgentId;
  action: { resource: string; action: string; parameters?: any };
  inputEvidence: EvidenceId[];
}

export interface AgentActionResult {
  actionId: string;
  outcome: DecisionOutcome;
  evidenceRef: EvidenceId;
  newState: AgentState;
}

export interface TerminateAgentParams {
  agentId: AgentId;
  reason: string;
}

export interface TerminationResult {
  terminated: boolean;
  agentId: AgentId;
  evidenceRef: EvidenceId;
}

export class AgentRuntime {
  private config: AgentRuntimeConfig;
  private agents: Map<string, Agent> = new Map();
  private agentSequence = 0;

  constructor(config: AgentRuntimeConfig) {
    this.config = config;
  }

  // ========================================================================
  // Agent Lifecycle
  // ========================================================================

  async spawnAgent(params: SpawnAgentParams): Promise<Agent> {
    // 1. Request authority grant from Governance Kernel
    const agentSource = createEvidenceSource('agent', `agent-${randomUUID().slice(0, 8)}`);
    
    const grant = await this.config.kernelClient.grantAuthority({
      holder: agentSource,
      scope: params.capabilities,
      constraints: params.constraints,
      delegationPermitted: false,
      revocationTriggers: [
        { type: 'expiry', parameters: {} },
        { type: 'scope_exceedance', parameters: {} },
        { type: 'evidence_failure', parameters: {} },
        { type: 'identity_compromise', parameters: {} }
      ],
      evidenceRequirement: 'E2',
      constitutionalBasis: params.authorityBasis,
      expiresAt: params.expiresAt
    });

    // 2. Create agent record
    const agentId = createAgentId(`agent:osa:${params.authorityBasis.toLowerCase().replace(/\s+/g, '-')}:${randomUUID().slice(0, 8)}`);
    
    const agent: Agent = {
      agentId,
      authorityId: grant.authorityId,
      policyId: params.policyId,
      state: params.initialState || {},
      capabilities: params.capabilities,
      constraints: params.constraints,
      spawnedAt: now(),
      evidenceRefs: [grant.evidenceRef],
      status: 'RUNNING'
    };

    this.agents.set(agentId.value, agent);

    // 3. Emit spawn audit
    await this.emitAudit({
      eventType: 'AGENT_SPAWNED',
      actor: createEvidenceSource('agent-runtime', 'osa'),
      subjectRefs: [grant.evidenceRef],
      findings: [{ rule: 'CSD-T-010', status: 'COMPLIANT', details: `Agent spawned with authority ${grant.authorityId.value}` }],
      riskLevel: 'NONE'
    });

    return agent;
  }

  async executeAction(params: AgentActionParams): Promise<AgentActionResult> {
    const agent = this.agents.get(params.agentId.value);
    if (!agent) {
      throw new Error(`Agent not found: ${params.agentId.value}`);
    }

    if (agent.status !== 'RUNNING') {
      throw new Error(`Agent not in RUNNING state: ${agent.status}`);
    }

    // 1. Check capability
    const hasCapability = agent.capabilities.some(
      c => c.resource === params.action.resource && c.action === params.action.action
    );
    if (!hasCapability) {
      throw new Error(`Agent lacks capability: ${params.action.resource}:${params.action.action}`);
    }

    // 2. Request kernel authorization for this action
    const authzId = `authz:agent:${now().split('T')[0].replace(/-/g, '')}-${randomUUID().slice(0, 4)}`;

    // 3. Execute governed decision
    const decision = await this.config.decisionEngineClient.decide({
      authorityId: agent.authorityId,
      policyId: agent.policyId,
      kernelAuthzId: authzId,
      inputEvidence: params.inputEvidence,
      context: {
        actor: createEvidenceSource('agent', agent.agentId.value),
        request: params.action,
        environment: { agentState: agent.state },
        constraints: agent.constraints
      },
      decisionType: 'AGENT_ACTION'
    });

    // 4. Update agent state
    agent.lastActionAt = now();
    agent.evidenceRefs.push(decision.evidenceRef);
    agent.state = this.applyActionToState(agent.state, params.action, decision.outcome);

    // 5. Emit action audit
    await this.emitAudit({
      eventType: 'AGENT_ACTION',
      actor: createEvidenceSource('agent', agent.agentId.value),
      subjectRefs: [decision.evidenceRef, ...params.inputEvidence],
      findings: [{ rule: 'CSD-T-010', status: 'COMPLIANT', details: `Agent action: ${params.action.action}` }],
      riskLevel: 'NONE'
    });

    return {
      actionId: `action:${randomUUID()}`,
      outcome: decision.outcome,
      evidenceRef: decision.evidenceRef,
      newState: agent.state
    };
  }

  async getAgent(agentId: AgentId): Promise<Agent | null> {
    return this.agents.get(agentId.value) || null;
  }

  async terminateAgent(params: TerminateAgentParams): Promise<TerminationResult> {
    const agent = this.agents.get(params.agentId.value);
    if (!agent) {
      throw new Error(`Agent not found: ${params.agentId.value}`);
    }

    agent.status = 'TERMINATING';

    // 1. Revoke authority
    const revocation = await this.config.kernelClient.revokeAuthority({
      authorityId: agent.authorityId,
      trigger: { type: 'identity_compromise', parameters: { reason: params.reason } },
      evidence: agent.evidenceRefs[agent.evidenceRefs.length - 1]
    });

    // 2. Emit termination audit
    await this.emitAudit({
      eventType: 'AGENT_TERMINATED',
      actor: createEvidenceSource('agent-runtime', 'osa'),
      subjectRefs: [revocation.evidenceRef],
      findings: [{ rule: 'CSD-T-010', status: 'COMPLIANT', details: `Agent terminated: ${params.reason}` }],
      riskLevel: 'LOW'
    });

    agent.status = 'TERMINATED';

    return {
      terminated: true,
      agentId: params.agentId,
      evidenceRef: revocation.evidenceRef
    };
  }

  // ========================================================================
  // Helpers
  // ========================================================================

  private applyActionToState(state: AgentState, action: any, outcome: DecisionOutcome): AgentState {
    const newState = { ...state };
    newState.lastAction = { action: action.action, outcome: outcome.result, timestamp: now().value };
    if (outcome.parameters) {
      Object.assign(newState, outcome.parameters);
    }
    return newState;
  }

  private async emitAudit(record: any): Promise<void> {
    // In production, call audit engine
    console.log('[AUDIT]', JSON.stringify(record));
  }

  listAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  getAgentsByPolicy(policyId: PolicyId): Agent[] {
    return Array.from(this.agents.values()).filter(a => a.policyId.value === policyId.value);
  }
}