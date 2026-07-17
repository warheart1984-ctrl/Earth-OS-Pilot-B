import { randomUUID } from 'node:crypto';
import type { FederatedCALToken, FederationTreaty } from './types.js';
import { hashFederatedToken } from './types.js';
import { FederatedRegistry } from './registry.js';

export class FederationEngine {
  private readonly registry: FederatedRegistry;
  private treaties: Map<string, FederationTreaty> = new Map();
  private peers: Map<string, FederationEngine> = new Map();

  constructor(registry: FederatedRegistry) {
    this.registry = registry;
  }

  linkPeer(clusterId: string, engine: FederationEngine): void {
    this.peers.set(clusterId, engine);
  }

  issueToken(
    origin: string, treaty_id: string,
    issued_by: string, issued_to: string,
    capabilities: string[], scope: { resources: string[]; time_limit_ms: number; intent_version: number },
  ): FederatedCALToken {
    const token_id = randomUUID();
    const base = {
      token_id, issued_by, issued_to,
      capabilities: [...capabilities],
      scope: { ...scope, resources: [...scope.resources] },
      delegation_chain: [],
      federation_origin: origin,
      federation_treaty_id: treaty_id,
      federated_signatures: [],
    };
    const signature = hashFederatedToken(base);
    const token: FederatedCALToken = { ...base, signature, revoked: false, federated_signatures: [signature] };
    this.registry.recordTokenIssued(token);
    return token;
  }

  importToken(token: FederatedCALToken, localTreatyId: string): boolean {
    const treaty = this.treaties.get(localTreatyId);
    if (!treaty || !treaty.terms.recognize_tokens) return false;
    this.registry.recordFederationImport(token);
    return true;
  }

  getClusterId(): string {
    return (this.registry as unknown as { clusterId: string }).clusterId;
  }

  applyRemoteRevocation(token_id: string): void {
    this.registry.recordFederationExport(token_id);
    this.registry.recordTokenRevoked(token_id);
  }

  revokeToken(token_id: string): void {
    this.registry.recordTokenRevoked(token_id);
    for (const [tid, treaty] of this.treaties) {
      if (treaty.terms.propagate_revocation) {
        for (const cluster of treaty.clusters) {
          if (cluster !== this.getClusterId()) {
            this.registry.recordFederationExport(token_id);
            const peer = this.peers.get(cluster);
            if (peer) {
              peer.applyRemoteRevocation(token_id);
            }
          }
        }
      }
    }
  }

  signTreaty(treaty: FederationTreaty): void {
    this.treaties.set(treaty.treaty_id, treaty);
  }

  getTreaty(treatyId: string): FederationTreaty | undefined {
    return this.treaties.get(treatyId);
  }
}
