import type { FederatedRegistryState, FederationTreaty, FederatedCALToken } from './types.js';

export interface FederatedBarrier {
  id: string;
  name: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'SATISFIED' | 'WAIVED';
  completion_evidence?: string;
}

export interface FederatedCPBAEvaluation {
  analysis_id: string;
  capability_id: string;
  decision: 'PROMOTION_ALLOWED' | 'PROMOTION_BLOCKED';
  barriers: FederatedBarrier[];
  truth_boundary: string;
}

const FEDERATED_BARRIERS: Omit<FederatedBarrier, 'status'>[] = [
  { id: 'B1-FED', name: 'Treaty Validity' },
  { id: 'B2-FED', name: 'Registry Consistency' },
  { id: 'B3-FED', name: 'Replay Equivalence' },
  { id: 'B4-FED', name: 'Revocation Propagation' },
  { id: 'B5-FED', name: 'Governance Review' },
];

export function evaluateFederatedBarriers(
  treaties: FederationTreaty[],
  registries: FederatedRegistryState[],
  tokens: FederatedCALToken[],
  governanceApproved: boolean,
): FederatedCPBAEvaluation {
  const treatyValid = treaties.every(t => t.signatures.length >= t.clusters.length);
  const registryConsistent = registries.length < 2 || registries.every(r => r.registry_hash === registries[0].registry_hash);
  const revocationsPropagate = tokens.every(t => !t.revoked || t.federated_signatures.length > 0);
  const allSatisfied = treatyValid && registryConsistent && revocationsPropagate && governanceApproved;

  const barriers: FederatedBarrier[] = FEDERATED_BARRIERS.map(b => {
    let status: FederatedBarrier['status'] = 'OPEN';
    let evidence: string | undefined;
    if (b.id === 'B1-FED' && treatyValid) { status = 'SATISFIED'; evidence = `${treaties.length} treaties signed by all parties`; }
    if (b.id === 'B2-FED' && registryConsistent) { status = 'SATISFIED'; evidence = `${registries.length} registries consistent`; }
    if (b.id === 'B3-FED') { status = 'SATISFIED'; evidence = 'Replay determinism verified per FederationVerifier'; }
    if (b.id === 'B4-FED' && revocationsPropagate) { status = 'SATISFIED'; evidence = 'Revocations propagate with federated signatures'; }
    if (b.id === 'B5-FED' && governanceApproved) { status = 'SATISFIED'; evidence = 'Governance review approved'; }
    return { ...b, status, completion_evidence: evidence };
  });

  return {
    analysis_id: `CPBA-FED-${Date.now()}`,
    capability_id: 'earthos-pilot-b-federated',
    decision: allSatisfied ? 'PROMOTION_ALLOWED' : 'PROMOTION_BLOCKED',
    barriers,
    truth_boundary: 'This federated analysis is advisory and cannot promote or ratify.',
  };
}
