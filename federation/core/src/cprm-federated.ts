export interface FederatedContractResult {
  contract: string;
  name: string;
  result: 'PASS' | 'FAIL';
  detail?: string;
}

export type FederatedReadinessState = 'FR0' | 'FR1' | 'FR2' | 'FR3' | 'FR4' | 'FR5';

export interface FederatedCPRMEvaluation {
  evaluation_id: string;
  capability_id: string;
  contract_results: FederatedContractResult[];
  blockers: string[];
  readiness_state: FederatedReadinessState;
  promotion_eligible: boolean;
  ratification_eligible: boolean;
  truth_boundary: string;
}

const FEDERATED_CONTRACTS: { contract: string; name: string }[] = [
  { contract: 'C1-FED', name: 'TREATY' },
  { contract: 'C2-FED', name: 'EVIDENCE' },
  { contract: 'C3-FED', name: 'CONSISTENCY' },
  { contract: 'C4-FED', name: 'REVOCATION' },
  { contract: 'C5-FED', name: 'REPLAY' },
  { contract: 'C6-FED', name: 'INDEPENDENCE' },
  { contract: 'C7-FED', name: 'GOVERNANCE' },
  { contract: 'C8-FED', name: 'SECURITY' },
  { contract: 'C9-FED', name: 'CONFORMANCE' },
  { contract: 'C10-FED', name: 'RATIFICATION' },
];

function computeReadinessState(results: FederatedContractResult[]): FederatedReadinessState {
  const failed = results.filter(r => r.result === 'FAIL').length;
  if (failed === 10) return 'FR0';
  if (failed >= 7) return 'FR1';
  if (failed >= 5) return 'FR2';
  if (failed >= 3) return 'FR3';
  if (failed >= 1) return 'FR4';
  return 'FR5';
}

export interface FederatedReadinessInputs {
  treatySigned: boolean;
  evidenceGenerated: boolean;
  registryConsistent: boolean;
  revocationVerified: boolean;
  replayVerified: boolean;
  independentVerified: boolean;
  governanceApproved: boolean;
  securityApproved: boolean;
  conformancePassed: boolean;
  ratificationApproved: boolean;
}

export function evaluateFederatedReadiness(inputs: FederatedReadinessInputs): FederatedCPRMEvaluation {
  const checks: [boolean, string, string][] = [
    [inputs.treatySigned, 'Treaty established and signed by all clusters', 'No treaty or missing signatures'],
    [inputs.evidenceGenerated, 'Cross-cluster evidence lineage maintained', 'Evidence packets not generated'],
    [inputs.registryConsistent, 'Registry hash chains consistent across clusters', 'Registry state diverged'],
    [inputs.revocationVerified, 'Revocation propagation mechanism verified', 'Revocation propagation not tested'],
    [inputs.replayVerified, 'Federated replay equivalence confirmed', 'Replay determinism not verified'],
    [inputs.independentVerified, 'Independent verification across clusters passed', 'Independent verification not performed'],
    [inputs.governanceApproved, 'Federation governance review completed', 'Governance review not completed'],
    [inputs.securityApproved, 'Cross-cluster security review completed', 'Security review not completed'],
    [inputs.conformancePassed, 'L4/L5 conformance verified', 'CCT conformance tests not passed'],
    [inputs.ratificationApproved, 'Federated readiness ratified', 'Ratification not approved'],
  ];

  const results: FederatedContractResult[] = FEDERATED_CONTRACTS.map((c, i) => ({
    ...c,
    result: checks[i][0] ? 'PASS' as const : 'FAIL' as const,
    detail: checks[i][0] ? checks[i][1] : checks[i][2],
  }));

  const blockers = results.filter(r => r.result === 'FAIL').map(r => r.contract);
  const state = computeReadinessState(results);

  return {
    evaluation_id: `CPRM-FED-${Date.now()}`,
    capability_id: 'earthos-pilot-b-federated',
    contract_results: results,
    blockers,
    readiness_state: state,
    promotion_eligible: state === 'FR5',
    ratification_eligible: state === 'FR5',
    truth_boundary: 'This federated readiness record is advisory and cannot promote or ratify.',
  };
}
