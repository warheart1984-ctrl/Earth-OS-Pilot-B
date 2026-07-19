// Federated Authority Pattern
// Normative: OSA-CGL-v1.0.md §2.2

import { createEvidenceSource, now } from '../index.js';
import type { 
  AuthorityId, PolicyId, EvidenceId, EvidenceSource, 
  Capability, Constraints, RevocationTrigger
} from '@osa/constitutional-types';

export interface FederationGatewayClient {
  importEvidence(params: ImportEvidenceParams): Promise<ImportResult>;
  exportEvidence(params: ExportEvidenceParams): Promise<ExportPackage>;
  syncWithPeer(params: SyncParams): Promise<SyncResult>;
}

export interface ImportEvidenceParams {
  treatyId: string;
  package: ExportPackage;
}

export interface ImportResult {
  imported: number;
  failed: number;
  evidenceRefs: EvidenceId[];
}

export interface ExportEvidenceParams {
  evidenceIds: EvidenceId[];
  treatyId: string;
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

export interface SyncParams {
  peer: PeerEndpoint;
  treatyId: string;
}

export interface PeerEndpoint {
  endpoint: string;
  gatewayKey: string;
}

export interface SyncResult {
  synced: number;
  conflicts: number;
  evidenceRefs: EvidenceId[];
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
  expiresAt?: string;
}

export interface AuthorityGrant {
  authorityId: AuthorityId;
  holder: EvidenceSource;
  scope: Capability[];
  constraints: Constraints;
  delegationPermitted: boolean;
  revocationTriggers: RevocationTrigger[];
  evidenceRequirement: 'E2' | 'E3' | 'E4';
  issuedAt: string;
  expiresAt?: string;
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
  cascadedDelegations: AuthorityId[];
  evidenceRef: EvidenceId;
  timestamp: string;
}

export interface EvidenceLedgerClient {
  append(entry: any): Promise<any>;
}

export interface AuditEngineClient {
  emitAudit(record: any): Promise<any>;
}

/**
 * Import a federated authority token from a peer domain.
 * 
 * @example
 * ```typescript
 * const authority = await importFederatedAuthority({
 *   treatyId: 'treaty:osa:earthos-pilot-b:20260719',
 *   token: {
 *     token_id: 'cal:earthos:orbital:20260719-001',
 *     issued_by: 'governance-kernel',
 *     issued_to: 'agent:orbital-tracker',
 *     capabilities: [{ resource: 'satellite:catalog', action: 'read' }],
 *     scope: { resources: ['satellite:*'], time_limit_ms: 86400000, intent_version: 1 },
 *     delegation_chain: [],
 *     federation_origin: 'EarthOS-Pilot-B',
 *     federation_treaty_id: 'treaty:osa:earthos-pilot-b:20260719',
 *     federated_signatures: ['sha3-256:...']
 *   },
 *   localPolicyId: 'pol:osa:orbital-tracking:v1.2',
 *   kernelClient, evidenceLedgerClient, auditEngineClient
 * });
 * ```
 */
export async function importFederatedAuthority(params: {
  treatyId: string;
  token: FederatedCALToken;
  localPolicyId: PolicyId;
  kernelClient: KernelClient;
  evidenceLedgerClient: EvidenceLedgerClient;
  auditEngineClient: AuditEngineClient;
}): Promise<AuthorityGrant> {
  const { treatyId, token, localPolicyId, kernelClient, evidenceLedgerClient, auditEngineClient } = params;

  // 1. Verify token signature with treaty gateway key
  if (!verifyTokenSignature(token, await getTreatyGatewayKey(treatyId))) {
    throw new Error('Federated token signature verification failed');
  }

  // 2. Check revocation via federation sync
  if (await isTokenRevoked(token, treatyId)) {
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
  if (!evaluateConstraints(token.scope, token.delegation_chain)) {
    throw new Error('Federated token constraints violated');
  }

  // 5. Grant local authority based on token
  const holder = createEvidenceSource('agent', token.issued_to);
  const authority = await kernelClient.grantAuthority({
    holder,
    scope: token.capabilities,
    constraints: {
      timeWindow: { 
        start: now(), 
        end: new Date(expiresMs).toISOString() 
      },
      resourceFilters: token.scope.resources.map(r => ({ pattern: r, action: 'allow' }))
    },
    delegationPermitted: false,
    revocationTriggers: [
      { type: 'expiry', parameters: {} },
      { type: 'scope_exceedance', parameters: {} },
      { type: 'parent_revoked', parameters: { parentAuthorityId: { value: token.token_id } } }
    ],
    evidenceRequirement: 'E2',
    constitutionalBasis: `FEDERATION:${treatyId}`,
    expiresAt: new Date(expiresMs).toISOString()
  });

  // 6. Record import as E₂ evidence
  await evidenceLedgerClient.append({
    evidenceId: `E2-OSA-FED-IMPORT-${now().split('T')[0].replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6)}`,
    level: 'E2',
    timestamp: now(),
    source: createEvidenceSource('federation-gateway', 'osa').toString(),
    authority_ref: authority.authorityId.value,
    policy_ref: localPolicyId.value,
    payload: { importedToken: token.token_id, treatyId },
    payloadHash: `sha3-256:placeholder`,
    chainHash: `sha3-256:placeholder`,
    signature: `ed25519:placeholder`
  });

  // 7. Emit audit
  await auditEngineClient.emitAudit({
    eventType: 'FEDERATION_TOKEN_IMPORTED',
    actor: createEvidenceSource('federation-gateway', 'osa'),
    subjectRefs: [authority.evidenceRef],
    findings: [{ rule: 'ACC-CONFORMANCE-5', status: 'COMPLIANT', details: `Imported token ${token.token_id} from ${treatyId}` }],
    riskLevel: 'NONE'
  });

  return authority;
}

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

function verifyTokenSignature(token: FederatedCALToken, gatewayKey: string): boolean {
  // In production: verify ed25519 signature
  return true; // placeholder
}

async function getTreatyGatewayKey(treatyId: string): Promise<string> {
  // In production: fetch from treaty registry
  return 'gateway-key-placeholder';
}

async function isTokenRevoked(token: FederatedCALToken, treatyId: string): Promise<boolean> {
  // In production: check revocation registry via federation sync
  return false; // placeholder
}

function evaluateConstraints(scope: any, delegationChain: string[]): boolean {
  // In production: evaluate all constraints
  return true; // placeholder
}

/**
 * Export evidence package for federation exchange
 */
export async function exportFederatedEvidence(params: {
  evidenceIds: EvidenceId[];
  treatyId: string;
  federationGatewayClient: FederationGatewayClient;
}): Promise<ExportPackage> {
  return params.federationGatewayClient.exportEvidence({
    evidenceIds: params.evidenceIds,
    treatyId: params.treatyId
  });
}

/**
 * Propagate revocation to federation peers
 */
export async function propagateRevocation(params: {
  authorityId: AuthorityId;
  treatyId: string;
  trigger: RevocationTrigger;
  federationGatewayClient: FederationGatewayClient;
}): Promise<void> {
  // In production: send revocation to all peers via federation gateway
  console.log(`[FEDERATION] Propagating revocation for ${authorityId.value} to treaty ${params.treatyId}`);
}