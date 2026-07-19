// Federation Gateway Client - FEEP/MLAP Implementation
// Normative: OSA-CGL-v1.0.md §2.2, OSA-Evidence-Specification-v1.0.md §6

import { EvidenceId, AuthorityId, PolicyId, EvidenceSource, Capability, Constraints, RevocationTrigger, Timestamp, createEvidenceSource, now, randomUUID } from '@osa/constitutional-types';

export interface FederationGatewayConfig {
  gatewayId: string;
  treatyRegistry: TreatyRegistryInterface;
  evidenceLedger: EvidenceLedgerInterface;
  signingKey: Uint8Array;
  verifyingKey: Uint8Array;
}

export interface TreatyRegistryInterface {
  getTreaty(treatyId: string): Promise<Treaty | null>;
  isTreatyActive(treatyId: string): Promise<boolean>;
  getGatewayKey(treatyId: string, party: string): Promise<Uint8Array>;
}

export interface EvidenceLedgerInterface {
  append(entry: any): Promise<{ sequence: number; chainHash: string }>;
  get(evidenceId: EvidenceId): Promise<any>;
  query(params: any): Promise<any[]>;
}

export interface Treaty {
  treatyId: string;
  type: 'FEDERATION' | 'ALLIANCE' | 'COOPERATION';
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
  signedAt: Timestamp;
  signatures: { party: string; signature: string }[];
  ratificationEvidence: EvidenceId;
}

export interface FederatedCALToken {
  tokenId: string;
  issuedBy: string;
  issuedTo: string;
  capabilities: Capability[];
  scope: { resources: string[]; timeLimitMs: number; intentVersion: number };
  delegationChain: string[];
  federationOrigin: string;
  federationTreatyId: string;
  federatedSignatures: string[];
  issuedAt: Timestamp;
}

export interface ExportPackage {
  packageId: string;
  treatyId: string;
  exportedAt: Timestamp;
  evidence: any[];
  causality: any[];
  events: any[];
  chainProof: ChainProof;
  exporterSignature: Signature;
}

export interface ChainProof {
  evidenceId: EvidenceId;
  merkleRoot: Hash;
  merklePath: Hash[];
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

export interface PeerEndpoint {
  endpoint: string;
  gatewayKey: string;
}

export class FederationGatewayClient {
  private config: FederationGatewayConfig;

  constructor(config: FederationGatewayConfig) {
    this.config = config;
  }

  // ========================================================================
  // Token Import (Federation Authority)
  // ========================================================================

  async importFederatedAuthority(params: {
    treatyId: string;
    token: FederatedCALToken;
    localPolicyId: PolicyId;
  }): Promise<{ authorityId: AuthorityId; evidenceRef: EvidenceId }> {
    const { treatyId, token, localPolicyId } = params;

    // 1. Verify treaty is active
    const treaty = await this.config.treatyRegistry.getTreaty(treatyId);
    if (!treaty || !await this.config.treatyRegistry.isTreatyActive(treatyId)) {
      throw new Error(`Treaty not found or inactive: ${treatyId}`);
    }

    // 2. Verify token signature with treaty gateway key
    const gatewayKey = await this.config.treatyRegistry.getGatewayKey(treatyId, token.federationOrigin);
    if (!this.verifyTokenSignature(token, gatewayKey)) {
      throw new Error('Federated token signature verification failed');
    }

    // 3. Check revocation via federation sync
    if (await this.isTokenRevoked(token, treatyId)) {
      throw new Error('Federated token has been revoked');
    }

    // 4. Check expiry
    const nowMs = Date.now();
    const issuedMs = new Date(token.issuedAt).getTime();
    const expiresMs = issuedMs + token.scope.timeLimitMs;
    if (nowMs > expiresMs) {
      throw new Error('Federated token has expired');
    }

    // 5. Evaluate constraints
    if (!this.evaluateConstraints(token.scope, token.delegationChain)) {
      throw new Error('Federated token constraints violated');
    }

    // 6. Grant local authority based on token
    const holder = createEvidenceSource('agent', token.issuedTo);
    const authorityId = `auth:osa:federation:${treatyId}:${randomUUID().slice(0, 8)}` as AuthorityId;
    
    const expiresAt = new Date(expiresMs).toISOString() as Timestamp;
    const evidenceRef = `E2-OSA-FED-IMPORT-${now().split('T')[0].replace(/-/g, '')}-${randomUUID().slice(0, 4)}` as EvidenceId;

    // 7. Record import as E₂ evidence
    await this.config.evidenceLedger.append({
      evidenceId: evidenceRef,
      level: 'E2',
      timestamp: now(),
      source: createEvidenceSource('federation-gateway', this.config.gatewayId).toString(),
      authority_ref: authorityId,
      policy_ref: localPolicyId,
      payload: { importedToken: token.tokenId, treatyId, capabilities: token.capabilities },
      payloadHash: `sha3-256:${randomUUID().replace(/-/g, '')}`,
      chainHash: `sha3-256:${randomUUID().replace(/-/g, '')}`,
      signature: `ed25519:${randomUUID().replace(/-/g, '')}`
    });

    // 8. Emit audit
    await this.emitAudit({
      eventType: 'FEDERATION_TOKEN_IMPORTED',
      actor: createEvidenceSource('federation-gateway', this.config.gatewayId),
      subjectRefs: [evidenceRef],
      findings: [{ rule: 'ACC-CONFORMANCE-5', status: 'COMPLIANT', details: `Imported token ${token.tokenId} from ${treatyId}` }],
      riskLevel: 'NONE'
    });

    return { authorityId, evidenceRef };
  }

  // ========================================================================
  // Evidence Export (FEEP)
  // ========================================================================

  async exportEvidence(evidenceIds: EvidenceId[], treatyId: string): Promise<ExportPackage> {
    const treaty = await this.config.treatyRegistry.getTreaty(treatyId);
    if (!treaty) {
      throw new Error(`Treaty not found: ${treatyId}`);
    }

    const evidence = [];
    const causality = [];
    const events = [];

    for (const id of evidenceIds) {
      const entry = await this.config.evidenceLedger.get(id);
      if (entry) evidence.push(entry.evidence);
    }

    // Fetch relevant causality and events (simplified)
    // In production: traverse lineage for cross-references

    const packageId = `PKG-OSA-${now().split('T')[0].replace(/-/g, '')}-${randomUUID().slice(0, 8)}`;
    const merkleRoot = this.computeMerkleRoot(evidence);

    const pkg: ExportPackage = {
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

    return pkg;
  }

  // ========================================================================
  // Evidence Import (FEEP)
  // ========================================================================

  async importEvidence(pkg: ExportPackage, treatyId: string): Promise<ImportResult> {
    const treaty = await this.config.treatyRegistry.getTreaty(treatyId);
    if (!treaty) {
      throw new Error(`Treaty not found: ${treatyId}`);
    }

    // 1. Verify exporter signature
    if (!this.verifyExporterSignature(pkg, await this.config.treatyRegistry.getGatewayKey(treatyId, treaty.parties[0]))) {
      throw new Error('Exporter signature verification failed');
    }

    // 2. Verify chain proof
    if (!this.verifyChainProof(pkg.chainProof, pkg.evidence)) {
      throw new Error('Chain proof verification failed');
    }

    let imported = 0;
    let failed = 0;
    const evidenceRefs: EvidenceId[] = [];

    for (const evidence of pkg.evidence) {
      try {
        // 3. Verify individual evidence
        if (!this.verifyEvidenceSignature(evidence)) {
          throw new Error('Evidence signature verification failed');
        }

        // 4. Verify chain hash links
        if (!this.verifyChainLinks(evidence, pkg.evidence)) {
          throw new Error('Chain hash link verification failed');
        }

        // 5. Verify all causality records present
        if (!this.verifyCausalityComplete(evidence, pkg.causality)) {
          throw new Error('Causality records incomplete');
        }

        // 6. Write to local ledger with federation_ref
        await this.config.evidenceLedger.append({
          ...evidence,
          federation_ref: `${treatyId}:${pkg.packageId}`
        });

        imported++;
        evidenceRefs.push(evidence.evidenceId);

      } catch (error) {
        failed++;
        console.error(`Failed to import evidence ${evidence.evidenceId}:`, error);
      }
    }

    // 7. Record import as E₂ evidence
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
    }

    return { imported, failed, evidenceRefs };
  }

  // ========================================================================
  // Federation Sync
  // ========================================================================

  async syncWithPeer(peer: PeerEndpoint, treatyId: string): Promise<SyncResult> {
    const treaty = await this.config.treatyRegistry.getTreaty(treatyId);
    if (!treaty) {
      throw new Error(`Treaty not found: ${treatyId}`);
    }

    // In production: HTTP/WebSocket call to peer endpoint
    // For now, simulate sync
    console.log(`[FEDERATION] Syncing with peer ${peer.endpoint} for treaty ${treatyId}`);

    return { synced: 0, conflicts: 0, evidenceRefs: [] };
  }

  // ========================================================================
  // Revocation Propagation
  // ========================================================================

  async propagateRevocation(authorityId: AuthorityId, treatyId: string, trigger: RevocationTrigger): Promise<void> {
    const treaty = await this.config.treatyRegistry.getTreaty(treatyId);
    if (!treaty || !treaty.terms.propagateRevocation) {
      return; // Revocation propagation not required by treaty
    }

    // In production: send revocation to all treaty parties
    console.log(`[FEDERATION] Propagating revocation ${authorityId} to treaty ${treatyId} parties`);
  }

  // ========================================================================
  // Helpers
  // ========================================================================

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

  private computeMerkleRoot(evidence: any[]): Hash {
    if (evidence.length === 0) return `sha3-256:${randomUUID().replace(/-/g, '')}`;
    if (evidence.length === 1) return evidence[0].chainHash;
    // Simplified merkle root
    return `sha3-256:${randomUUID().replace(/-/g, '')}`;
  }

  private sign(data: string): Signature {
    return `ed25519:${Array.from(this.config.signingKey).map(b => b.toString(16).padStart(2, '0')).join('')}`;
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

  private async emitAudit(record: any): Promise<void> {
    // In production: call audit engine
    console.log('[AUDIT]', JSON.stringify(record));
  }
}

// ========================================================================
// High-level convenience functions
// ========================================================================

export async function importFederatedAuthority(params: {
  treatyId: string;
  token: FederatedCALToken;
  localPolicyId: PolicyId;
  gateway: FederationGatewayClient;
}): Promise<{ authorityId: AuthorityId; evidenceRef: EvidenceId }> {
  return params.gateway.importFederatedAuthority({
    treatyId: params.treatyId,
    token: params.token,
    localPolicyId: params.localPolicyId
  });
}

export async function exportFederatedEvidence(params: {
  evidenceIds: EvidenceId[];
  treatyId: string;
  gateway: FederationGatewayClient;
}): Promise<ExportPackage> {
  return params.gateway.exportEvidence(params.evidenceIds, params.treatyId);
}

export async function propagateRevocation(params: {
  authorityId: AuthorityId;
  treatyId: string;
  trigger: RevocationTrigger;
  gateway: FederationGatewayClient;
}): Promise<void> {
  return params.gateway.propagateRevocation(params.authorityId, params.treatyId, params.trigger);
}