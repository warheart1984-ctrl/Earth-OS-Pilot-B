import { describe, it } from 'node:test';
import assert from 'node:assert';
import { FederatedRegistry } from '../src/registry.js';
import { FederationEngine } from '../src/engine.js';
import { FederationVerifier } from '../src/verifier.js';

void describe('FederatedRegistry', () => {
  void it('records token issuance', () => {
    const reg = new FederatedRegistry('cluster-a', 'world:earthos');
    reg.recordTokenIssued({
      token_id: '00000000-0000-0000-0000-000000000001',
      issued_by: 'steward:root-a', issued_to: 'agent:alice',
      capabilities: ['federation:read'],
      scope: { resources: ['shared:docs'], time_limit_ms: 9999999999999, intent_version: 1 },
      delegation_chain: [], signature: 'sha3-256:abc', revoked: false,
      federation_origin: 'cluster-a', federation_treaty_id: 'treaty-ab', federated_signatures: [],
    });
    assert.strictEqual(reg.getEntries().length, 1);
  });

  void it('validates hash chain', () => {
    const reg = new FederatedRegistry('cluster-a', 'world:earthos');
    reg.recordTokenRevoked('t1');
    reg.recordFederationExport('t1');
    const { valid } = FederationVerifier.validateFederatedHashChain(reg.getEntries());
    assert.ok(valid);
  });
});

void describe('FederationEngine', () => {
  void it('issues federated tokens', () => {
    const reg = new FederatedRegistry('cluster-a', 'world:earthos');
    const eng = new FederationEngine(reg);
    const token = eng.issueToken('cluster-a', 'treaty-ab', 'steward:root-a', 'agent:alice',
      ['federation:read'], { resources: ['shared:docs'], time_limit_ms: 9999999999999, intent_version: 1 });
    assert.ok(token.federation_origin);
    assert.ok(token.federation_treaty_id);
  });

  void it('imports tokens between clusters', () => {
    const regA = new FederatedRegistry('cluster-a', 'world:earthos');
    const regB = new FederatedRegistry('cluster-b', 'world:earthos');
    const engA = new FederationEngine(regA);
    const engB = new FederationEngine(regB);
    engA.signTreaty({ treaty_id: 'treaty-ab', clusters: ['cluster-a', 'cluster-b'], signed_at: Date.now(),
      terms: { recognize_tokens: true, propagate_revocation: true, share_evidence: true, sync_interval_ms: 1000 }, signatures: [] });
    engB.signTreaty({ treaty_id: 'treaty-ab', clusters: ['cluster-a', 'cluster-b'], signed_at: Date.now(),
      terms: { recognize_tokens: true, propagate_revocation: true, share_evidence: true, sync_interval_ms: 1000 }, signatures: [] });
    const token = engA.issueToken('cluster-a', 'treaty-ab', 'steward:root-a', 'agent:alice',
      ['federation:read'], { resources: ['shared:docs'], time_limit_ms: 9999999999999, intent_version: 1 });
    const imported = engB.importToken(token, 'treaty-ab');
    assert.ok(imported);
    const found = regB.getToken(token.token_id);
    assert.ok(found);
  });

  void it('propagates revocation across clusters', () => {
    const regA = new FederatedRegistry('cluster-a', 'world:earthos');
    const regB = new FederatedRegistry('cluster-b', 'world:earthos');
    const engA = new FederationEngine(regA);
    const engB = new FederationEngine(regB);
    engA.linkPeer('cluster-b', engB);
    engB.linkPeer('cluster-a', engA);
    engA.signTreaty({ treaty_id: 'treaty-ab', clusters: ['cluster-a', 'cluster-b'], signed_at: Date.now(),
      terms: { recognize_tokens: true, propagate_revocation: true, share_evidence: true, sync_interval_ms: 1000 }, signatures: [] });
    engB.signTreaty({ treaty_id: 'treaty-ab', clusters: ['cluster-a', 'cluster-b'], signed_at: Date.now(),
      terms: { recognize_tokens: true, propagate_revocation: true, share_evidence: true, sync_interval_ms: 1000 }, signatures: [] });
    const token = engA.issueToken('cluster-a', 'treaty-ab', 'steward:root-a', 'agent:alice',
      ['federation:read'], { resources: ['shared:docs'], time_limit_ms: 9999999999999, intent_version: 1 });
    engB.importToken(token, 'treaty-ab');
    engA.revokeToken(token.token_id);
    const revokedInB = regB.isTokenRevoked(token.token_id);
    assert.ok(revokedInB);
  });
});

void describe('FederationVerifier', () => {
  void it('detects registry divergence', () => {
    const regA = new FederatedRegistry('cluster-a', 'world:earthos');
    regA.recordTokenRevoked('t1');
    const regB = new FederatedRegistry('cluster-b', 'world:earthos');
    const result = FederationVerifier.compareClusterRegistries([
      { clusterId: 'cluster-a', entries: regA.getEntries() },
      { clusterId: 'cluster-b', entries: regB.getEntries() },
    ]);
    assert.strictEqual(result.consistent, false);
  });

  void it('confirms registry consistency', () => {
    const regA = new FederatedRegistry('cluster-a', 'world:earthos');
    regA.recordTokenRevoked('t1');
    const regB = new FederatedRegistry('cluster-b', 'world:earthos');
    regB.recordTokenRevoked('t1');
    const result = FederationVerifier.compareClusterRegistries([
      { clusterId: 'cluster-a', entries: regA.getEntries() },
      { clusterId: 'cluster-b', entries: regB.getEntries() },
    ]);
    assert.strictEqual(result.consistent, true);
  });
});
