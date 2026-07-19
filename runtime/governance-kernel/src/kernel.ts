// Governance Kernel - Constitutional Enforcement Point
// Normative: OSA-Runtime-Specifications-v1.0.md §1, OSA-CGL-v1.0.md

import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import {
  EvidenceId, AuthorityId, PolicyId, AuthorizationId, DecisionId,
  Hash, Signature, EvidenceSource, Timestamp, Capability, Constraints,
  RevocationTrigger, EvidenceLevelRequirement, ConstitutionalMetadata,
  ActionSpec, DecisionContext, DecisionOutcome, Obligation,
  PolicyEvaluation, ReplayContext, VerificationContext,
  AuthorizationResult, AuthorityGrant, RevocationResult,
  CompiledPolicy, VerificationProof, DeploymentResult, ValidationResult,
  AuditRecord, AuditEventType, AuditFinding, ConstitutionalState,
  AuthorizationRecord, now, createEvidenceSource
} from '@osa/constitutional-types';

export interface GovernanceKernelConfig {
  kernelId: string;
  constitutionalMetadata: ConstitutionalMetadata;
  evidenceLedger: EvidenceLedgerInterface;
  policyEngine: PolicyEngineInterface;
  auditEngine: AuditEngineInterface;
  signingKey: Uint8Array;
  verifyingKey: Uint8Array;
}

export interface EvidenceLedgerInterface {
  append(evidence: any): Promise<{ sequence: number; chainHash: Hash }>;
  get(evidenceId: EvidenceId): Promise<any>;
  query(params: any): Promise<any[]>;
}

export interface PolicyEngineInterface {
  compilePolicy(source: string, metadata: ConstitutionalMetadata): Promise<CompiledPolicy>;
  evaluatePolicy(policyId: PolicyId, inputs: Record<string, any>): Promise<PolicyEvaluation>;
  getPolicy(policyId: PolicyId): Promise<CompiledPolicy | null>;
}

export interface AuditEngineInterface {
  emitAudit(record: AuditRecord): Promise<AuditRecord>;
  queryAudits(params: any): Promise<AuditRecord[]>;
}

export class GovernanceKernel {
  private readonly config: GovernanceKernelConfig;
  private readonly authorityGrants: Map<string, AuthorityGrant> = new Map();
  private readonly compiledPolicies: Map<string, CompiledPolicy> = new Map();
  private readonly activeAuthorizations: Map<string, AuthorizationRecord> = new Map();
  private readonly revocationList: Set<string> = new Set();
  private authorizationSequence = 0;
  private randomUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  constructor(config: GovernanceKernelConfig) {
    this.config = config;
  }

  // ========================================================================
  // Authority Management
  // ========================================================================

  async verifyAuthority(params: {
    authorityId: AuthorityId;
    holder: EvidenceSource;
    action: ActionSpec;
    context: DecisionContext;
  }): Promise<AuthorizationResult> {
    const grant = this.authorityGrants.get(params.authorityId);
    
    if (!grant) {
      return this.denyAuthorization(params, 'AUTHORITY_NOT_FOUND', 'Authority grant not found');
    }

    if (this.revocationList.has(params.authorityId)) {
      return this.denyAuthorization(params, 'AUTHORITY_REVOKED', 'Authority has been revoked');
    }

    if (grant.expiresAt && new Date(grant.expiresAt) < new Date()) {
      return this.denyAuthorization(params, 'AUTHORITY_EXPIRED', 'Authority grant has expired');
    }

    if (grant.holder.toString() !== params.holder.toString()) {
      return this.denyAuthorization(params, 'HOLDER_MISMATCH', 'Authority holder mismatch');
    }

    const hasCapability = grant.scope.some(
      cap => cap.resource === params.action.resource && cap.action === params.action.action
    );
    if (!hasCapability) {
      return this.denyAuthorization(params, 'SCOPE_EXCEEDANCE', 'Action not within granted scope');
    }

    if (!this.evaluateConstraints(grant.constraints, params.context)) {
      return this.denyAuthorization(params, 'CONSTRAINT_VIOLATION', 'Context violates authority constraints');
    }

    this.authorizationSequence++;
    const authorizationId: AuthorizationId = `authz:gk:${now().split('T')[0].replace(/-/g, '')}-${String(this.authorizationSequence).padStart(4, '0')}`;

    const evidenceRef = await this.produceAuthorizationEvidence(params, authorizationId, grant);
    
    this.activeAuthorizations.set(authorizationId, { 
      authorizationId, 
      authorityId: params.authorityId,
      holder: params.holder,
      policyId: 'pol:osa:kernel:authorization:v1.0' as PolicyId,
      inputEvidence: [],
      context: params.context,
      granted: true,
      timestamp: now(),
      evidenceRef
    });

    await this.emitAudit({
      eventType: 'KERNEL_AUTHZ_GRANTED',
      actor: createEvidenceSource('governance-kernel', this.config.kernelId),
      subjectRefs: [evidenceRef],
      findings: [{ rule: 'ACC-CONFORMANCE-2', status: 'COMPLIANT', details: 'Authority exercise authorized' }],
      riskLevel: 'NONE'
    });

    return {
      authorized: true,
      authorizationId,
      evidenceRef,
      obligations: [
        { type: 'PRODUCE_EVIDENCE', parameters: { level: grant.evidenceRequirement } },
        { type: 'EMIT_AUDIT', parameters: { eventType: 'AUTHORITY_EXERCISE' } }
      ]
    };
  }

  private evaluateConstraints(constraints: Constraints, context: DecisionContext): boolean {
    if (constraints.timeWindow) {
      const nowMs = Date.now();
      const start = new Date(constraints.timeWindow.start).getTime();
      const end = new Date(constraints.timeWindow.end).getTime();
      if (nowMs < start || nowMs > end) return false;
    }

    if (constraints.classificationMax && context.environment.classification) {
      const levels = ['UNCLASSIFIED', 'CONFIDENTIAL', 'SECRET', 'TOP_SECRET'];
      const maxIdx = levels.indexOf(constraints.classificationMax);
      const ctxIdx = levels.indexOf(context.environment.classification as string);
      if (ctxIdx > maxIdx) return false;
    }

    if (constraints.quota) {
      // Quota enforcement would check against usage tracker
    }

    return true;
  }

  private async produceAuthorizationEvidence(
    params: { authorityId: AuthorityId; holder: EvidenceSource; action: ActionSpec; context: DecisionContext },
    authorizationId: AuthorizationId,
    grant: AuthorityGrant
  ): Promise<EvidenceId> {
    const evidenceId: EvidenceId = `E2-OSA-GK-${now().split('T')[0].replace(/-/g, '')}-${String(this.authorizationSequence).padStart(4, '0')}`;

    const evidence = {
      evidence_id: evidenceId,
      level: 'E2',
      timestamp: now(),
      source: createEvidenceSource('governance-kernel', this.config.kernelId).toString(),
      authority_ref: params.authorityId,
      policy_ref: 'pol:osa:kernel:authorization:v1.0',
      policy_version_hash: 'sha3-256:kernel-auth-policy',
      kernel_authorization_ref: authorizationId,
      input_evidence_refs: [],
      decision: {
        type: 'AUTHORIZATION',
        timestamp: now(),
        actor: params.holder.toString(),
        context: { action: params.action, constraints: grant.constraints },
        outcome: { result: 'ALLOW', action: params.action.action },
        rationale: 'Authority verified by Governance Kernel'
      },
      payload_hash: 'sha3-256:placeholder',
      previous_evidence_hash: 'sha3-256:placeholder',
      chain_hash: 'sha3-256:placeholder',
      signature: 'ed25519:placeholder'
    };

    await this.config.evidenceLedger.append(evidence);
    return evidenceId;
  }

  private denyAuthorization(params: any, reason: string, details: string): AuthorizationResult {
    const evidenceId: EvidenceId = `E3-OSA-GK-${now().split('T')[0].replace(/-/g, '')}-${String(this.authorizationSequence + 1).padStart(4, '0')}`;

    this.emitAudit({
      eventType: 'KERNEL_AUTHZ_DENIED',
      actor: createEvidenceSource('governance-kernel', this.config.kernelId),
      subjectRefs: [],
      findings: [{ rule: 'ACC-CONFORMANCE-2', status: 'NON_COMPLIANT', details }],
      riskLevel: 'HIGH'
    });

    return {
      authorized: false,
      evidenceRef: evidenceId,
      reason,
      obligations: [{ type: 'EMIT_AUDIT', parameters: { eventType: 'AUTHORIZATION_DENIED', reason } }]
    };
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
    const authorityId: AuthorityId = `auth:osa:${params.constitutionalBasis.toLowerCase().replace(/\s+/g, '-')}:${randomUUID().slice(0, 8)}`;

    const grant: AuthorityGrant = {
      authorityId,
      holder: params.holder,
      scope: params.scope,
      constraints: params.constraints,
      delegationPermitted: params.delegationPermitted,
      revocationTriggers: params.revocationTriggers,
      evidenceRequirement: params.evidenceRequirement,
      issuedAt: now(),
      expiresAt: params.expiresAt,
      constitutionalBasis: params.constitutionalBasis,
      evidenceRef: `E2-OSA-GRANT-${now().split('T')[0].replace(/-/g, '')}-${randomUUID().slice(0, 4)}`,
      signature: 'ed25519:placeholder'
    };

    this.authorityGrants.set(authorityId, grant);

    await this.emitAudit({
      eventType: 'AUTHORITY_GRANT',
      actor: createEvidenceSource('governance-kernel', this.config.kernelId),
      subjectRefs: [grant.evidenceRef],
      findings: [{ rule: 'ACC-CONFORMANCE-1', status: 'COMPLIANT', details: 'Authority grant recorded' }],
      riskLevel: 'NONE'
    });

    return grant;
  }

  async revokeAuthority(params: {
    authorityId: AuthorityId;
    trigger: RevocationTrigger;
    evidence: EvidenceId;
  }): Promise<RevocationResult> {
    const grant = this.authorityGrants.get(params.authorityId);
    if (!grant) {
      throw new Error(`Authority not found: ${params.authorityId}`);
    }

    this.revocationList.add(params.authorityId);

    const cascadedDelegations: AuthorityId[] = [];
    for (const [id, g] of this.authorityGrants) {
      if (g.constraints.contextRequirements?.some(r => r.delegatedFrom === params.authorityId)) {
        this.revocationList.add(id);
        cascadedDelegations.push(id);
      }
    }

    const evidenceRef: EvidenceId = `E3-OSA-REVOKE-${now().split('T')[0].replace(/-/g, '')}-${randomUUID().slice(0, 4)}`;

    await this.emitAudit({
      eventType: 'AUTHORITY_REVOKE',
      actor: createEvidenceSource('governance-kernel', this.config.kernelId),
      subjectRefs: [params.evidence],
      findings: [{ rule: 'ACC-CONFORMANCE-3', status: 'COMPLIANT', details: `Revoked: ${params.trigger.type}` }],
      riskLevel: 'MEDIUM'
    });

    return {
      revoked: true,
      authorityId: params.authorityId,
      trigger: params.trigger,
      cascadedDelegations,
      evidenceRef,
      timestamp: now()
    };
  }

  async delegateAuthority(params: {
    parentAuthorityId: AuthorityId;
    delegatee: EvidenceSource;
    scope: Capability[];
    constraints: Constraints;
  }): Promise<AuthorityGrant> {
    const parent = this.authorityGrants.get(params.parentAuthorityId);
    if (!parent) {
      throw new Error(`Parent authority not found: ${params.parentAuthorityId}`);
    }

    if (!parent.delegationPermitted) {
      throw new Error('Delegation not permitted on parent authority');
    }

    if (this.revocationList.has(params.parentAuthorityId)) {
      throw new Error('Parent authority revoked');
    }

    const derivedConstraints: Constraints = {
      ...parent.constraints,
      ...params.constraints,
      contextRequirements: [
        ...(parent.constraints.contextRequirements || []),
        ...(params.constraints.contextRequirements || []),
        { key: 'delegatedFrom', operator: 'eq', value: params.parentAuthorityId }
      ]
    };

    return this.grantAuthority({
      holder: params.delegatee,
      scope: params.scope.filter(c => 
        parent.scope.some(p => p.resource === c.resource && p.action === c.action)
      ),
      constraints: derivedConstraints,
      delegationPermitted: false,
      revocationTriggers: [...parent.revocationTriggers, { type: 'scope_exceedance', parameters: {} }],
      evidenceRequirement: parent.evidenceRequirement,
      constitutionalBasis: `DELEGATION:${parent.constitutionalBasis}`,
      expiresAt: parent.expiresAt
    });
  }

  // ========================================================================
  // Policy Management
  // ========================================================================

  async compilePolicy(params: {
    source: string;
    metadata: ConstitutionalMetadata;
  }): Promise<CompiledPolicy> {
    const compiled = await this.config.policyEngine.compilePolicy(params.source, params.metadata);
    this.compiledPolicies.set(compiled.policyId, compiled);
    return compiled;
  }

  async deployPolicy(params: { policyId: PolicyId }): Promise<DeploymentResult> {
    const policy = this.compiledPolicies.get(params.policyId);
    if (!policy) {
      throw new Error(`Policy not found: ${params.policyId}`);
    }

    const evidenceRef: EvidenceId = `E2-OSA-PE-${now().split('T')[0].replace(/-/g, '')}-${randomUUID().slice(0, 4)}`;

    await this.emitAudit({
      eventType: 'POLICY_DEPLOYED',
      actor: createEvidenceSource('governance-kernel', this.config.kernelId),
      subjectRefs: [evidenceRef],
      findings: [{ rule: 'CSD-T-003', status: 'COMPLIANT', details: 'Policy deployed to kernel registry' }],
      riskLevel: 'NONE'
    });

    return {
      deployed: true,
      policyId: params.policyId,
      deploymentId: `deploy:${randomUUID()}`,
      evidenceRef
    };
  }

  async validatePolicy(params: { policyId: PolicyId }): Promise<ValidationResult> {
    const policy = this.compiledPolicies.get(params.policyId);
    if (!policy) {
      return { valid: false, errors: ['Policy not found'] };
    }

    const errors: string[] = [];
    if (!policy.metadata.authority) errors.push('Missing authority reference');
    if (!policy.verificationProof) errors.push('Missing verification proof');
    if (!policy.wasmHash) errors.push('Missing WASM hash');

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // ========================================================================
  // Decision Authorization
  // ========================================================================

  async authorizeDecision(params: {
    authorityId: AuthorityId;
    policyId: PolicyId;
    kernelAuthzId: AuthorizationId;
    inputEvidence: EvidenceId[];
    context: DecisionContext;
    decisionType: string;
  }): Promise<AuthorizationResult> {
    const authz = this.activeAuthorizations.get(params.kernelAuthzId);
    if (!authz) {
      return { authorized: false, evidenceRef: 'E3-DENIED' as EvidenceId, reason: 'Invalid kernel authorization', obligations: [] };
    }

    const grant = this.authorityGrants.get(params.authorityId);
    if (!grant || this.revocationList.has(params.authorityId)) {
      return { authorized: false, evidenceRef: 'E3-DENIED' as EvidenceId, reason: 'Authority invalid or revoked', obligations: [] };
    }

    const policy = this.compiledPolicies.get(params.policyId);
    if (!policy) {
      return { authorized: false, evidenceRef: 'E3-DENIED' as EvidenceId, reason: 'Policy not deployed', obligations: [] };
    }

    const evaluation = await this.config.policyEngine.evaluatePolicy(params.policyId, {
      authority: params.authorityId,
      holder: params.context.actor.toString(),
      action: params.context.request,
      environment: params.context.environment,
      evidence: params.inputEvidence.map(e => e)
    });

    const evidenceRef: EvidenceId = `E2-OSA-DEC-${now().split('T')[0].replace(/-/g, '')}-${randomUUID().slice(0, 4)}`;

    const authorized = evaluation.result !== 'DENY';

    await this.emitAudit({
      eventType: authorized ? 'DECISION_MADE' : 'DECISION_DENIED',
      actor: createEvidenceSource('governance-kernel', this.config.kernelId),
      subjectRefs: [evidenceRef, ...params.inputEvidence],
      findings: [{ rule: 'CSD-T-004', status: authorized ? 'COMPLIANT' : 'NON_COMPLIANT', details: `Decision ${authorized ? 'allowed' : 'denied'}` }],
      riskLevel: authorized ? 'NONE' : 'HIGH'
    });

    return {
      authorized,
      authorizationId: params.kernelAuthzId,
      evidenceRef,
      reason: authorized ? undefined : evaluation.explanation,
      obligations: evaluation.obligations
    };
  }

  // ========================================================================
  // Audit Emission
  // ========================================================================

  async emitAudit(params: {
    eventType: AuditEventType;
    actor: EvidenceSource;
    subjectRefs: EvidenceId[];
    findings: AuditFinding[];
    riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  }): Promise<AuditRecord> {
    return this.config.auditEngine.emitAudit({
      auditId: `audit:${randomUUID()}`,
      eventType: params.eventType,
      timestamp: now(),
      actor: params.actor,
      subjectRefs: params.subjectRefs,
      findings: params.findings,
      riskLevel: params.riskLevel,
      evidenceRef: `E3-OSA-AUDIT-${now().split('T')[0].replace(/-/g, '')}-${randomUUID().slice(0, 4)}`,
      chainHash: 'sha3-256:placeholder'
    });
  }

  // ========================================================================
  // Constitutional State
  // ========================================================================

  getConstitutionalState(): ConstitutionalState {
    return {
      authorityGrants: new Map(this.authorityGrants),
      compiledPolicies: new Map(this.compiledPolicies),
      activeAuthorizations: new Map(this.activeAuthorizations),
      revocationList: new Set(this.revocationList),
      metadata: this.config.constitutionalMetadata
    };
  }

  // ========================================================================
  // Utility
  // ========================================================================

  private hash(data: string): Hash {
    return `sha3-256:${createHash('sha3-256').update(data).digest('hex')}`;
  }

  private sign(data: string): Signature {
    const hex = Array.from(this.config.signingKey).map(b => b.toString(16).padStart(2, '0')).join('');
    return `ed25519:${hex}`;
  }
}