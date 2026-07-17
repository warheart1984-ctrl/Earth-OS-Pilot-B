import { createHash } from 'node:crypto';
import type { FederatedCALToken, FederatedRegistryEntry, FederatedRegistryState } from './types.js';
import { hashFederatedToken } from './types.js';

export class FederatedRegistry {
  private entries: FederatedRegistryEntry[] = [];
  private readonly clusterId: string;
  private readonly registryId: string;
  private readonly worldId: string;

  constructor(clusterId: string, worldId: string, registryId?: string) {
    this.clusterId = clusterId;
    this.worldId = worldId;
    this.registryId = registryId ?? `registry:${clusterId}`;
  }

  recordTokenIssued(token: FederatedCALToken): FederatedRegistryEntry {
    return this.appendEntry('token_issued', token.token_id, token);
  }

  recordTokenRevoked(token_id: string): FederatedRegistryEntry {
    return this.appendEntry('token_revoked', token_id);
  }

  recordFederationExport(token_id: string): FederatedRegistryEntry {
    return this.appendEntry('federation_export', token_id);
  }

  recordFederationImport(token: FederatedCALToken): FederatedRegistryEntry {
    return this.appendEntry('federation_import', token.token_id, token);
  }

  getToken(token_id: string): FederatedCALToken | undefined {
    const entry = this.entries.find(
      (e) => e.token_id === token_id && (e.entry_type === 'token_issued' || e.entry_type === 'federation_import') && e.token,
    );
    return entry?.token;
  }

  isTokenRevoked(token_id: string): boolean {
    return this.entries.some((e) => e.token_id === token_id && e.entry_type === 'token_revoked');
  }

  getEntries(): FederatedRegistryEntry[] {
    return [...this.entries];
  }

  snapshot(): FederatedRegistryState {
    return {
      registry_id: this.registryId,
      cluster_id: this.clusterId,
      world_id: this.worldId,
      previous_registry_hash: this.computePreviousHash(),
      registry_hash: this.computeRegistryHash(),
      entries: [...this.entries],
      created_at: Date.now(),
    };
  }

  private appendEntry(
    entry_type: FederatedRegistryEntry['entry_type'],
    token_id: string,
    token?: FederatedCALToken,
  ): FederatedRegistryEntry {
    const previousEntryHash = this.computePreviousHash();
    const base = {
      sequence: this.entries.length + 1,
      entry_type,
      token_id,
      token,
      previous_entry_hash: previousEntryHash,
      timestamp: Date.now(),
      cluster_id: this.clusterId,
    };
    const entry: FederatedRegistryEntry = {
      ...base,
      entry_hash: this.hashEntry(base),
    };
    this.entries.push(entry);
    return entry;
  }

  private hashEntry(entry: Omit<FederatedRegistryEntry, 'entry_hash'>): string {
    const canonical = JSON.stringify(entry, Object.keys(entry).sort());
    return `sha3-256:${createHash('sha3-256').update(canonical, 'utf8').digest('hex')}`;
  }

  private computePreviousHash(): string | null {
    return this.entries.length > 0 ? this.entries[this.entries.length - 1].entry_hash : null;
  }

  private computeRegistryHash(): string {
    const raw = this.entries.length > 0 ? this.entries[this.entries.length - 1].entry_hash : 'null';
    return `sha3-256:${createHash('sha3-256').update(raw, 'utf8').digest('hex')}`;
  }
}
