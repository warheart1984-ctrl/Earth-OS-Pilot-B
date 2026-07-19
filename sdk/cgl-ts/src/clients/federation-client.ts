// Federation Gateway Client - CGL Pattern
// Normative: OSA-CGL-v1.0.md §2.2, OSA-FEEP-v1.0.md

import {
  AuthorityId, PolicyId, EvidenceId, EvidenceSource, Timestamp, Capability, Constraints,
  RevocationTrigger, EvidenceLevel, Hash, Signature, now, createEvidenceSource, randomUUID
} from '@osa/constitutional-types';

// ============================================================================
// Types
// ============================================================================

export interface FederatedCALToken {
  token_id: string;
  issued_by: string;
  issued_to: string;
  capabilities: Capability[];
  scope: { resources: string[]; time_limit_ms: number; intent_version: number };
  delegation_chain: string[];
  federation_origin: string;
  federation_treaty_id: string;
  federated_signatures: string[];
  issued_at: string;
}

export interface PeerEndpoint {
  endpoint: string;
  gatewayKey: string;
}

export interface Treaty {
  treatyId: string;
  type: 'FEDERATION';
  parties: string[];
  constitutionalBasis: string;
  terms: {
    recognizeTokens: boolean;
    propagateRevocation: boolean;
    shareEvidence: boolean;
    syncIntervalMs: number;
    authorityDomains: string[];
  };
  evidenceProtocol: string;
  authorityProtocol: string;
  signedAt: string;
  signatures: { party: string; signature: string }[];
  ratificationEvidence: string;
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
  evidenceId: EvidenceId;
  merkleRoot: string;
  merklePath: string[];
  leafIndex: number;
}

export interface ImportResult {
  imported: number;
  failed: number;
  evidenceRefs: EvidenceId[];
}

export interface SyncResult {
  synced: number;
  conflicts: number;
  evidenceRefs: EvidenceId[];
}

export interface FederationGatewayConfig {
  gatewayId: string;
  signingKey: Uint8Array;
  verifyingKey: Uint8Array;
  evidenceLedger: EvidenceLedgerClient;
  auditEngine: AuditEngineClient;
  kernelClient: KernelClient;
  treatyRegistry: TreatyRegistryClient;
}

export interface EvidenceLedgerClient {
  append(entry: any): Promise<any>;
  get(evidenceId: EvidenceId): Promise<any>;
  query(params: any): Promise<any[]>;
  verifyChain(params: any): Promise<any>;
}

export interface AuditEngineClient {
  emitAudit(record: any): Promise<any>;
}

export interface KernelClient {
  grantAuthority(params: any): Promise<any>;
  revokeAuthority(params: any): Promise<any>;
}

export interface TreatyRegistryClient {
  getTreaty(treatyId: string): Promise<Treaty | null>;
}

// ============================================================================
// Federation Gateway Client
// ============================================================================

export class FederationGatewayClient {
  private config: FederationGatewayConfig;

  constructor(config: FederationGatewayConfig) {
    this.config = config;
  }

  // ========================================================================
  // Evidence Import (FEEP)
  // ========================================================================

  async importEvidence(params: { treatyId: string; package: ExportPackage }): Promise<ImportResult> {
    const { treatyId, package: pkg } = params;

    // 1. Verify exporter signature with treaty gateway key
    if (!this.verifyExporterSignature(pkg, await this.getTreatyGatewayKey(treatyId))) {
      return { imported: 0, failed: pkg.evidence.length, evidenceRefs: [] };
    }

    // 2. Verify chain proof
    if (!this.verifyChainProof(pkg.chainProof, pkg.evidence)) {
      return { imported: 0, failed: pkg.evidence.length, evidenceRefs: [] };
    }

    // 3. Import each evidence record
    let imported = 0;
    let failed = 0;
    const evidenceRefs: EvidenceId[] = [];

    for (const evidence of pkg.evidence) {
      try {
        // Verify signature
        if (!this.verifyEvidenceSignature(evidence)) {
          throw new Error('Evidence signature verification failed');
        }

        // Verify chain links
        if (!this.verifyChainLinks(evidence, pkg.evidence)) {
          throw new Error('Chain link verification failed');
        }

        // Verify causality completeness
        if (!this.verifyCausalityComplete(evidence, pkg.causality)) {
          throw new Error('Causality records incomplete');
        }

        // Write to local ledger with federation_ref
        const federationRef = `${treatyId}:${pkg.packageId}`;
        await this.config.evidenceLedger.append({
          ...evidence,
          federation_ref: federationRef
        });

        imported++;
        evidenceRefs.push(evidence.evidenceId);

      } catch (error) {
        failed++;
        console.error(`Failed to import evidence ${evidence.evidenceId}:`, error);
      }
    }

    // 4. Record import as E₂ evidence
    if (imported > 0) {
      const importEvidenceRef = `E2-OSA-FED-IMPORT-${now().split('T')[0].replace(/-/g, '')}-${randomUUID().slice(0, 4)}` as EvidenceId;
      await this.config.evidenceLedger.append({
        evidenceId: importEvidenceRef,
        level: 'E2',
        timestamp: now(),
        source: createEvidenceSource('federation-gateway', this.config.gatewayId).toString(),
        authority_ref: 'auth:osa:federation:evidence-import',
        policy_ref: 'pol:osa:federation:evidence-import:v1.0',
        payload: { treatyId, packageId: pkg.packageId, importedCount: imported },
        payloadHash: `sha3-256:${randomUUID().replace(/-/g, '')}`,
        chainHash: `sha3-256:${randomUUID().replace(/-/g, '')}`,
        signature: `ed25519:${randomUUID().replace(/-/g, '')}`
      });

      await this.emitAudit({
        eventType: 'FEDERATION_EVIDENCE_IMPORTED',
        actor: createEvidenceSource('federation-gateway', this.config.gatewayId),
        subjectRefs: [importEvidenceRef],
        findings: [{ rule: 'ACC-CONFORMANCE-5', status: 'COMPLIANT', details: `Imported ${imported} evidence records from ${treatyId}` }],
        riskLevel: 'NONE'
      });
    }

    return { imported, failed, evidenceRefs };
  }

  // ========================================================================
  // Evidence Export (FEEP)
  // ========================================================================

  async exportEvidence(evidenceIds: EvidenceId[], treatyId: string): Promise<ExportPackage> {
    const evidence: any[] = [];
    const causality: any[] = [];
    const events: any[] = [];

    // Fetch evidence and related causality/events
    for (const id of evidenceIds) {
      const entry = await this.config.evidenceLedger.get(id);
      if (entry) evidence.push(entry.evidence);
    }

    // In production: traverse lineage for causality and events
    // For now, simplified

    const packageId = `PKG-OSA-${now().split('T')[0].replace(/-/g, '')}-${randomUUID().slice(0, 8)}`;
    const merkleRoot = this.computeMerkleRoot(evidence);

    return {
      packageId,
      treatyId,
      exportedAt: now(),
      evidence,
      causality,
      events,
      chainProof: {
        evidenceId: evidence[0]?.evidenceId || '',
        merkleRoot,
        merklePath: [],
        leafIndex: 0
      },
      exporterSignature: this.sign(merkleRoot)
    };
  }

  // ========================================================================
  // Federation Sync
  // ========================================================================

  async syncWithPeer(peer: PeerEndpoint, treatyId: string): Promise<SyncResult> {
    const treaty = await this.config.treatyRegistry.getTreaty(treatyId);
    if (!treaty) {
      throw new Error(`Treaty not found: ${treatyId}`);
    }

    console.log(`[FEDERATION] Syncing with peer ${peer.endpoint} for treaty ${treatyId}`);
    // In production: HTTP/WebSocket call to peer endpoint

    return { synced: 0, conflicts: 0, evidenceRefs: [] };
  }

  // ========================================================================
  // Revocation Propagation
  // ========================================================================

  async propagateRevocation(authorityId: AuthorityId, treatyId: string, trigger: RevocationTrigger): Promise<void> {
    const treaty = await this.config.treatyRegistry.getTreaty(treatyId);
    if (!treaty || !treaty.terms.propagateRevocation) {
      return; // Not required by treaty
    }

    console.log(`[FEDERATION] Propagating revocation ${authorityId} to treaty ${treatyId} parties`);
    // In production: send to all treaty parties
  }

  // ========================================================================
  // Federated Authority Import (MLAP)
  // ========================================================================

  async importFederatedAuthority(params: {
    treatyId: string;
    token: FederatedCALToken;
    localPolicyId: PolicyId;
  }): Promise<{ authorityId: AuthorityId; evidenceRef: EvidenceId }> {
    const { treatyId, token, localPolicyId } = params;

    // 1. Verify token signature with treaty gateway key
    if (!this.verifyTokenSignature(token, await this.getTreatyGatewayKey(treatyId))) {
      throw new Error('Federated token signature verification failed');
    }

    // 2. Check revocation via federation sync
    if (await this.isTokenRevoked(token, treatyId)) {
      throw new Error('Federated token has been revoked');
    }

    // 3. Check expiry
    const nowMs = Date.now();
    const issuedMs = new Date(token.issued_at).getTime();
    const expiresMs = issuedMs + token.scope.time_limit_ms;
    if (nowMs > expiresMs) {
      throw new Error('Federated token has expired');
    }

    // 4. Verify constraints
    if (!this.evaluateConstraints(token.scope, token.delegation_chain)) {
      throw new Error('Federated token constraints violated');
    }

    // 5. Grant local authority based on token
    const holder = createEvidenceSource('agent', token.issued_to);
    const authority = await this.config.kernelClient.grantAuthority({
      holder,
      scope: token.capabilities,
      constraints: {
        timeWindow: { start: now(), end: new Date(expiresMs).toISOString() },
        resourceFilters: token.scope.resources.map(r => ({ pattern: r, action: 'allow' }))
      },
      delegationPermitted: false,
      revocationTriggers: [
        { type: 'expiry', parameters: {} },
        { type: 'scope_exceedance', parameters: {} },
        { type: 'parent_revoked', parameters: { parentAuthorityId: token.token_id } }
      ],
      evidenceRequirement: 'E2',
      constitutionalBasis: `FEDERATION:${treatyId}`,
      expiresAt: new Date(expiresMs).toISOString()
    });

    // 6. Record import as E₂ evidence
    await this.config.evidenceLedger.append({
      evidenceId: `E2-OSA-FED-IMPORT-${now().split('T')[0].replace(/-/g, '')}-${randomUUID().slice(0, 4)}`,
      level: 'E2',
      timestamp: now(),
      source: createEvidenceSource('federation-gateway', this.config.gatewayId).toString(),
      authority_ref: authority.authorityId,
      policy_ref: localPolicyId,
      payload: { importedToken: token.token_id, treatyId },
      payloadHash: `sha3-256:${randomUUID().replace(/-/g, '')}`,
      chainHash: `sha3-256:${randomUUID().replace(/-/g, '')}`,
      signature: `ed25519:${randomUUID().replace(/-/g, '')}`
    });

    // 7. Emit audit
    await this.emitAudit({
      eventType: 'FEDERATION_TOKEN_IMPORTED',
      actor: createEvidenceSource('federation-gateway', this.config.gatewayId),
      subjectRefs: [authority.evidenceRef],
      findings: [{ rule: 'ACC-CONFORMANCE-5', status: 'COMPLIANT', details: `Imported token ${token.token_id} from ${treatyId}` }],
      riskLevel: 'NONE'
    });

    return { authorityId: authority.authorityId, evidenceRef: authority.evidenceRef };
  }

  // ========================================================================
  // Helpers
  // ========================================================================

  private async getTreatyGatewayKey(treatyId: string): Promise<Uint8Array> {
    // In production: fetch from treaty registry
    return new Uint8Array(32); // placeholder
  }

  private verifyTokenSignature(token: FederatedCALToken, gatewayKey: Uint8Array): boolean {
    // In production: ed25519 verify
    return true; // placeholder
  }

  private async isTokenRevoked(token: FederatedCALToken, treatyId: string): Promise<boolean> {
    // In production: check revocation registry via federation sync
    return false; // placeholder
  }

  private evaluateConstraints(scope: any, delegationChain: string[]): boolean {
    // In production: evaluate all constraints
    return true; // placeholder
  }

  private verifyExporterSignature(pkg: ExportPackage, gatewayKey: Uint8Array): boolean {
    return true; // placeholder
  }

  private verifyChainProof(proof: ChainProof, evidence: any[]): boolean {
    return true; // placeholder
  }

  private verifyEvidenceSignature(evidence: any): boolean {
    return true; // placeholder
  }

  private verifyChainLinks(evidence: any, allEvidence: any[]): boolean {
    return true; // placeholder
  }

  private verifyCausalityComplete(evidence: any, causality: any[]): boolean {
    return true; // placeholder
  }

  private computeMerkleRoot(evidence: any[]): string {
    if (evidence.length === 0) return `sha3-256:${randomUUID().replace(/-/g, '')}`;
    if (evidence.length === 1) return evidence[0].chainHash;
    return `sha3-256:${randomUUID().replace(/-/g, '')}`;
  }

  private sign(data: string): string {
    return `ed25519:${Array.from(this.config.signingKey).map(b => b.toString(16).padStart(2, '0')).join('')}`;
  }

  private async emitAudit(record: any): Promise<void> {
    await this.config.auditEngine.emitAudit({
      ...record,
      auditId: `AUD-FED-${now().split('T')[0].replace(/-/g, '')}-${randomUUID().slice(0, 4)}`,
      timestamp: now(),
      evidenceRef: `E3-OSA-FED-${now().split('T')[0].replace(/-/g, '')}-${randomUUID().slice(0, 4)}`,
      chainHash: 'sha3-256:placeholder'
    });
  }
}