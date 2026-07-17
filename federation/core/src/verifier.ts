import type { FederatedRegistryEntry } from './types.js';

export class FederationVerifier {
  static validateFederatedHashChain(entries: FederatedRegistryEntry[]): { valid: boolean; breakAtIndex: number | null } {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const expectedPrev = i === 0 ? null : entries[i - 1].entry_hash;
      if (entry.previous_entry_hash !== expectedPrev) {
        return { valid: false, breakAtIndex: i };
      }
    }
    return { valid: true, breakAtIndex: null };
  }

  static compareClusterRegistries(
    registries: { clusterId: string; entries: FederatedRegistryEntry[] }[],
  ): { consistent: boolean; divergences: string[] } {
    const divergences: string[] = [];
    if (registries.length < 2) return { consistent: false, divergences: ['need >= 2 clusters'] };
    const baseline = registries[0];
    for (let i = 1; i < registries.length; i++) {
      const r = registries[i];
      if (r.entries.length !== baseline.entries.length) {
        divergences.push(`cluster ${r.clusterId}: entry count mismatch (${r.entries.length} vs ${baseline.entries.length})`);
      }
    }
    return { consistent: divergences.length === 0, divergences };
  }
}
