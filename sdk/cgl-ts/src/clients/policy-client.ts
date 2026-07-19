// Policy Engine Client - Rego→WASM compilation client
// Normative: OSA-CGL-v1.0.md

import { PolicyId, CompiledPolicy, VerificationProof, ValidationResult, ConstitutionalMetadata, now, randomUUID } from '@osa/constitutional-types';

export interface PolicyEngineClientConfig {
  endpoint: string;
  authToken?: string;
  timeoutMs?: number;
}

export interface CompileRequest {
  source: string;
  metadata: ConstitutionalMetadata;
  dependencies?: PolicyId[];
}

export interface CompileResult {
  policy: CompiledPolicy;
  wasmPath: string;
}

export interface EvaluationRequest {
  policyId: PolicyId;
  input: Record<string, any>;
}

export interface EvaluationResult {
  result: 'ALLOW' | 'DENY' | 'CONDITIONAL';
  obligations: any[];
  explanation: string;
}

export class PolicyEngineClient {
  private config: PolicyEngineClientConfig;

  constructor(config: PolicyEngineClientConfig) {
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

  async compilePolicy(source: string, metadata: ConstitutionalMetadata): Promise<CompiledPolicy> {
    return this.request<CompiledPolicy>('/api/v1/policy/compile', {
      method: 'POST',
      body: JSON.stringify({ source, metadata })
    });
  }

  async evaluatePolicy(policyId: PolicyId, input: Record<string, any>): Promise<EvaluationResult> {
    return this.request<EvaluationResult>(`/api/v1/policy/${policyId}/evaluate`, {
      method: 'POST',
      body: JSON.stringify({ input })
    });
  }

  async getPolicy(policyId: PolicyId): Promise<CompiledPolicy | null> {
    return this.request<CompiledPolicy | null>(`/api/v1/policy/${policyId}`);
  }

  async listPolicies(): Promise<CompiledPolicy[]> {
    return this.request<CompiledPolicy[]>('/api/v1/policy');
  }

  async removePolicy(policyId: PolicyId): Promise<boolean> {
    await this.request(`/api/v1/policy/${policyId}`, { method: 'DELETE' });
    return true;
  }

  async validatePolicy(source: string): Promise<ValidationResult> {
    return this.request<ValidationResult>('/api/v1/policy/validate', {
      method: 'POST',
      body: JSON.stringify({ source })
    });
  }
}