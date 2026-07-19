// Agent Runtime Client - Autonomous agents under constitutional authority
// Normative: OSA-CGL-v1.0.md

import { AuthorityId, PolicyId, EvidenceId, AgentId, EvidenceSource, Capability, Constraints, DecisionContext, DecisionOutcome, Obligation, createAgentId, createEvidenceSource, now, randomUUID } from '@osa/constitutional-types';

export interface AgentRuntimeClientConfig {
  endpoint: string;
  authToken?: string;
  timeoutMs?: number;
}

export interface Agent {
  agentId: AgentId;
  authorityId: AuthorityId;
  policyId: PolicyId;
  state: Record<string, any>;
  capabilities: Capability[];
  constraints: Constraints;
  spawnedAt: string;
  lastActionAt?: string;
  evidenceRefs: EvidenceId[];
  status: 'SPAWNING' | 'RUNNING' | 'PAUSED' | 'TERMINATING' | 'TERMINATED';
}

export interface SpawnAgentParams {
  policyId: PolicyId;
  initialState?: Record<string, any>;
  capabilities: Capability[];
  constraints: Constraints;
  authorityBasis: string;
  expiresAt?: string;
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
  newState: Record<string, any>;
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

export class AgentRuntimeClient {
  private config: AgentRuntimeClientConfig;

  constructor(config: AgentRuntimeClientConfig) {
    this.config = config;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-OSA-Request-ID': randomUUID(),
      'X-OSA-Timestamp': now()
    };
    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs || 30000);

    try {
      const response = await fetch(`${this.config.endpoint}${path}`, {
        ...options,
        headers: { ...headers, ...options.headers },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  async spawnAgent(params: SpawnAgentParams): Promise<Agent> {
    return this.request<Agent>('/api/v1/agent/spawn', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  async executeAction(params: AgentActionParams): Promise<AgentActionResult> {
    return this.request<AgentActionResult>('/api/v1/agent/action', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  async getAgent(agentId: AgentId): Promise<Agent | null> {
    return this.request<Agent | null>(`/api/v1/agent/${agentId}`);
  }

  async terminateAgent(params: TerminateAgentParams): Promise<TerminationResult> {
    return this.request<TerminationResult>(`/api/v1/agent/${params.agentId}/terminate`, {
      method: 'POST',
      body: JSON.stringify({ reason: params.reason })
    });
  }

  async listAgents(): Promise<Agent[]> {
    return this.request<Agent[]>('/api/v1/agent');
  }

  async getAgentsByPolicy(policyId: string): Promise<Agent[]> {
    return this.request<Agent[]>(`/api/v1/agent?policyId=${policyId}`);
  }
}