// Decision Engine Client - Governed decisions client
// Normative: OSA-CGL-v1.0.md

import { AuthorityId, PolicyId, AuthorizationId, EvidenceId, DecisionId, DecisionContext, DecisionOutcome, Obligation, PolicyEvaluation, ReplayParams, ReplayResult, DecisionResult, createDecisionId, now, randomUUID } from '@osa/constitutional-types';

export interface DecisionEngineClientConfig {
  endpoint: string;
  authToken?: string;
  timeoutMs?: number;
}

export interface DecideParams {
  authorityId: AuthorityId;
  policyId: PolicyId;
  kernelAuthzId: AuthorizationId;
  inputEvidence: EvidenceId[];
  context: DecisionContext;
  decisionType: string;
}

export class DecisionEngineClient {
  private config: DecisionEngineClientConfig;

  constructor(config: DecisionEngineClientConfig) {
    this.config = config;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-OSA-Request-ID': randomUUID(),
      'X-OSA-Timestamp': now()
    };

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

  async decide(params: DecideParams): Promise<DecisionResult> {
    return this.request<DecisionResult>('/api/v1/decision/decide', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  async replay(params: ReplayParams): Promise<ReplayResult> {
    return this.request<ReplayResult>('/api/v1/decision/replay', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }
}