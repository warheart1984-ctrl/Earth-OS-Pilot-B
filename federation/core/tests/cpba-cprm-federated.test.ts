import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateFederatedBarriers } from '../src/cpba-federated.js';
import { evaluateFederatedReadiness } from '../src/cprm-federated.js';
import type { FederatedCALToken, FederatedRegistryState, FederationTreaty } from '../src/types.js';

function makeTreaty(clusters: string[], signed: boolean): FederationTreaty {
  return {
    treaty_id: 'treaty-test-001',
    clusters,
    signed_at: Date.now(),
    terms: { recognize_tokens: true, propagate_revocation: true, share_evidence: true, sync_interval_ms: 1000 },
    signatures: signed ? clusters.map(() => 'sig') : [],
  };
}

function makeRegistry(hash: string, clusterId: string): FederatedRegistryState {
  return {
    registry_id: 'reg-test',
    cluster_id: clusterId,
    world_id: 'world-1',
    previous_registry_hash: null,
    registry_hash: hash,
    entries: [],
    created_at: Date.now(),
  };
}

function makeToken(revoked: boolean, federatedSigs: number): FederatedCALToken {
  return {
    token_id: 'tok-test-001',
    issued_by: 'steward:a',
    issued_to: 'agent:b',
    capabilities: ['fed:test'],
    scope: { resources: ['*'], time_limit_ms: 99999, intent_version: 1 },
    delegation_chain: [],
    signature: 'sha3-256:0000000000000000000000000000000000000000000000000000000000000000',
    revoked,
    federation_origin: 'cluster-a',
    federation_treaty_id: 'treaty-test-001',
    federated_signatures: Array(federatedSigs).fill('sig'),
  };
}

describe('FederatedCPBA', () => {
  it('allows promotion when all barriers satisfied', () => {
    const treaties = [makeTreaty(['a', 'b'], true)];
    const registries = [makeRegistry('abc', 'a'), makeRegistry('abc', 'b')];
    const tokens = [makeToken(false, 0), makeToken(true, 1)];
    const result = evaluateFederatedBarriers(treaties, registries, tokens, true);
    assert.equal(result.decision, 'PROMOTION_ALLOWED');
    assert.equal(result.barriers.every(b => b.status === 'SATISFIED'), true);
  });

  it('blocks when treaty not signed', () => {
    const treaties = [makeTreaty(['a', 'b'], false)];
    const result = evaluateFederatedBarriers(treaties, [makeRegistry('abc', 'a')], [], true);
    assert.equal(result.decision, 'PROMOTION_BLOCKED');
    assert.equal(result.barriers.find(b => b.id === 'B1-FED')?.status, 'OPEN');
  });

  it('blocks when registries diverge', () => {
    const treaties = [makeTreaty(['a', 'b'], true)];
    const registries = [makeRegistry('abc', 'a'), makeRegistry('def', 'b')];
    const result = evaluateFederatedBarriers(treaties, registries, [], true);
    assert.equal(result.decision, 'PROMOTION_BLOCKED');
    assert.equal(result.barriers.find(b => b.id === 'B2-FED')?.status, 'OPEN');
  });

  it('blocks when governance not approved', () => {
    const treaties = [makeTreaty(['a', 'b'], true)];
    const registries = [makeRegistry('abc', 'a')];
    const result = evaluateFederatedBarriers(treaties, registries, [], false);
    assert.equal(result.decision, 'PROMOTION_BLOCKED');
    assert.equal(result.barriers.find(b => b.id === 'B5-FED')?.status, 'OPEN');
  });

  it('single cluster is trivially consistent', () => {
    const treaties = [makeTreaty(['a'], true)];
    const result = evaluateFederatedBarriers(treaties, [makeRegistry('abc', 'a')], [], true);
    assert.equal(result.decision, 'PROMOTION_ALLOWED');
  });
});

describe('FederatedCPRM', () => {
  it('returns FR5 when all contracts pass', () => {
    const result = evaluateFederatedReadiness({
      treatySigned: true, evidenceGenerated: true, registryConsistent: true,
      revocationVerified: true, replayVerified: true, independentVerified: true,
      governanceApproved: true, securityApproved: true, conformancePassed: true,
      ratificationApproved: true,
    });
    assert.equal(result.readiness_state, 'FR5');
    assert.equal(result.promotion_eligible, true);
    assert.equal(result.blockers.length, 0);
  });

  it('returns FR0 when all contracts fail', () => {
    const result = evaluateFederatedReadiness({
      treatySigned: false, evidenceGenerated: false, registryConsistent: false,
      revocationVerified: false, replayVerified: false, independentVerified: false,
      governanceApproved: false, securityApproved: false, conformancePassed: false,
      ratificationApproved: false,
    });
    assert.equal(result.readiness_state, 'FR0');
    assert.equal(result.promotion_eligible, false);
    assert.equal(result.blockers.length, 10);
  });

  it('returns FR4 with one blocker', () => {
    const result = evaluateFederatedReadiness({
      treatySigned: true, evidenceGenerated: true, registryConsistent: true,
      revocationVerified: true, replayVerified: true, independentVerified: true,
      governanceApproved: true, securityApproved: true, conformancePassed: true,
      ratificationApproved: false,
    });
    assert.equal(result.readiness_state, 'FR4');
    assert.deepEqual(result.blockers, ['C10-FED']);
  });

  it('returns FR3 with three blockers', () => {
    const result = evaluateFederatedReadiness({
      treatySigned: true, evidenceGenerated: true, registryConsistent: true,
      revocationVerified: true, replayVerified: false, independentVerified: true,
      governanceApproved: true, securityApproved: false, conformancePassed: true,
      ratificationApproved: false,
    });
    assert.equal(result.readiness_state, 'FR3');
    assert.equal(result.blockers.length, 3);
  });

  it('includes descriptive detail on each contract', () => {
    const result = evaluateFederatedReadiness({
      treatySigned: true, evidenceGenerated: false, registryConsistent: true,
      revocationVerified: true, replayVerified: true, independentVerified: false,
      governanceApproved: true, securityApproved: true, conformancePassed: true,
      ratificationApproved: true,
    });
    const evidence = result.contract_results.find(c => c.contract === 'C2-FED');
    assert.equal(evidence?.result, 'FAIL');
    assert.ok(evidence?.detail);
    const treaty = result.contract_results.find(c => c.contract === 'C1-FED');
    assert.equal(treaty?.result, 'PASS');
    assert.ok(treaty?.detail);
  });
});
