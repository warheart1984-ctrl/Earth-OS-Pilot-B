// Kernel Client - Governance Kernel HTTP/gRPC client
// Normative: OSA-CGL-v1.0.md

import { AuthorityId, PolicyId, AuthorizationId, EvidenceId, EvidenceSource, Timestamp, Capability, Constraints, RevocationTrigger, EvidenceLevelRequirement, AuthorizationResult, AuthorityGrant, RevocationResult, CompiledPolicy, VerificationProof, DeploymentResult, ValidationResult, AuditRecord, AuditEventType, AuditFinding, ConstitutionalState, createEvidenceSource, now, randomUUID } from '@osa/constitutional-types';

export interface KernelClientConfig {
  endpoint: string;
  authToken?: string;
  timeoutMs?: number;
}

export class KernelClient {
  private config: KernelClientConfig;

  constructor(config: KernelClientConfig) {
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

  // Authority Management
  async verifyAuthority(params: {
    authorityId: AuthorityId;
    holder: EvidenceSource;
    action: { resource: string; action: string };
    context: any;
  }): Promise<AuthorizationResult> {
    return this.request<AuthorizationResult>('/api/v1/kernel/authority/verify', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  async grantAuthority(params: {
    holder: EvidenceSource;
    scope: Capability[];
    constraints: Constraints;
    delegationPermitted: boolean;
    revocationTriggers: RevocationTrigger[];
    evidenceRequirement: EvidenceLevelRequirement;
    constitutionalBasis: string;
    expiresAt?: Timestamp;
  }): Promise<AuthorityGrant> {
    return this.request<AuthorityGrant>('/api/v1/kernel/authority/grant', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  async revokeAuthority(params: {
    authorityId: AuthorityId;
    trigger: RevocationTrigger;
    evidence: EvidenceId;
  }): Promise<RevocationResult> {
    return this.request<RevocationResult>('/api/v1/kernel/authority/revoke', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  // Policy Management
  async compilePolicy(source: string, metadata: any): Promise<CompiledPolicy> {
    return this.request<CompiledPolicy>('/api/v1/kernel/policy/compile', {
      method: 'POST',
      body: JSON.stringify({ source, metadata })
    });
  }

  async deployPolicy(policyId: PolicyId): Promise<DeploymentResult> {
    return this.request<DeploymentResult>('/api/v1/kernel/policy/deploy', {
      method: 'POST',
      body: JSON.stringify({ policy_id: policyId })
    });
  }

  async validatePolicy(policyId: PolicyId): Promise<ValidationResult> {
    return this.request<ValidationResult>('/api/v1/kernel/policy/validate', {
      method: 'POST',
      body: JSON.stringify({ policy_id: policyId })
    });
  }

  // Decision Authorization
  async authorizeDecision(params: {
    authorityId: AuthorityId;
    policyId: PolicyId;
    kernelAuthzId: AuthorizationId;
    inputEvidence: EvidenceId[];
    context: any;
    decisionType: string;
  }): Promise<AuthorizationResult> {
    return this.request<AuthorizationResult>('/api/v1/kernel/decision/authorize', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  // Audit
  async emitAudit(record: AuditRecord): Promise<AuditRecord> {
    return this.request<AuditRecord>('/api/v1/kernel/audit', {
      method: 'POST',
      body: JSON.stringify(record)
    });
  }

  // State
  async getConstitutionalState(): Promise<ConstitutionalState> {
    return this.request<ConstitutionalState>('/api/v1/kernel/state');
  }
}