// Conformance Suite Types
// Normative: OSA-Conformance-Specification-v1.0.md

export interface TestVector {
  id: string;
  level: ConformanceLevel;
  category: string;
  description: string;
  setup: TestSetup;
  input: any;
  expected: TestExpectation;
  evidenceRequirements: EvidenceRequirement[];
  timeoutMs: number;
  retryCount: number;
  deterministic: boolean;
}

export interface TestSetup {
  preconditions: string[];
  fixtures: Record<string, any>;
  environment: Record<string, any>;
}

export interface TestExpectation {
  status: 'PASS' | 'FAIL' | 'ERROR';
  output?: any;
  evidence?: EvidenceExpectation;
  error?: ErrorExpectation;
  metrics?: MetricExpectation[];
}

export interface EvidenceExpectation {
  level: EvidenceLevel;
  minCount: number;
  requiredRefs: string[];
  chainValid: boolean;
  causalityComplete: boolean;
}

export interface ErrorExpectation {
  code: string;
  messageContains?: string;
  evidenceRef?: string;
}

export interface MetricExpectation {
  name: string;
  operator: 'lt' | 'lte' | 'gt' | 'gte' | 'eq';
  value: number;
  unit: string;
}

export interface EvidenceRequirement {
  level: EvidenceLevel;
  trigger: string;
  required: boolean;
}

export interface TestResult {
  vectorId: string;
  status: 'PASS' | 'FAIL' | 'ERROR' | 'SKIPPED';
  durationMs: number;
  actualOutput?: any;
  actualEvidence?: any;
  actualError?: any;
  actualMetrics?: Record<string, number>;
  evidenceProduced?: any[];
  divergenceDetails?: any;
  failureReason?: string;
  errorDetails?: any;
}

export interface TestSuiteResult {
  suiteName: string;
  level: ConformanceLevel;
  timestamp: string;
  durationMs: number;
  results: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    errors: number;
    skipped: number;
  };
  evidenceSummary: {
    totalEvidenceProduced: number;
    byLevel: Record<EvidenceLevel, number>;
    chainVerificationPassed: number;
    chainVerificationFailed: number;
    causalityComplete: number;
    causalityIncomplete: number;
    replayMatches: number;
    replayDivergences: number;
  };
}

export interface TestReport {
  suite: string;
  level: ConformanceLevel;
  timestamp: string;
  durationMs: number;
  summary: {
    total: number;
    passed: number;
    failed: number;
    errors: number;
    skipped: number;
  };
  results: TestResult[];
  evidenceSummary: {
    totalEvidenceProduced: number;
    byLevel: Record<EvidenceLevel, number>;
    chainVerificationPassed: number;
    chainVerificationFailed: number;
    causalityComplete: number;
    causalityIncomplete: number;
    replayMatches: number;
    replayDivergences: number;
  };
  certification: {
    level: ConformanceLevel;
    granted: boolean;
    conditions?: string[];
    evidenceRef: string;
  };
}

export interface ConformanceLevel {
  L1: 'L1';
  L2: 'L2';
  L3: 'L3';
  L4: 'L4';
  L5: 'L5';
}

export type ConformanceLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

export type EvidenceLevel = 'E0' | 'E1' | 'E2' | 'E3' | 'E4';

export interface CertificationResult {
  level: ConformanceLevel;
  granted: boolean;
  conditions?: string[];
  evidenceRef: string;
}

export interface RunnerConfig {
  kernelEndpoint: string;
  ledgerEndpoint: string;
  policyEndpoint: string;
  decisionEndpoint: string;
  agentEndpoint?: string;
  missionEndpoint?: string;
  simulationEndpoint?: string;
  federationEndpoint?: string;
  apiKey: string;
  timeoutMs?: number;
  retryCount?: number;
  parallel?: boolean;
  filter?: string[];
}

export interface ConformanceRunner {
  initialize(config: RunnerConfig): Promise<void>;
  execute(suite: string): Promise<TestSuiteResult>;
  finalize(): Promise<void>;
  validateEvidence(evidence: any): Promise<ValidationResult>;
  validateChain(params: ChainValidationParams): Promise<ChainValidationResult>;
  validateCausality(params: CausalityValidationParams): Promise<CausalityValidationResult>;
  validateReplay(params: ReplayValidationParams): Promise<ReplayValidationResult>;
  simulateFederation(config: FederationSimConfig): Promise<FederationSimResult>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  evidenceRef?: string;
}

export interface ChainValidationParams {
  ledger: any;
  source: string;
  level: EvidenceLevel;
  fromSequence?: number;
  toSequence?: number;
}

export interface ChainValidationResult {
  ok: boolean;
  entriesVerified: number;
  brokenAt?: number;
  expected?: string;
  actual?: string;
}

export interface CausalityValidationParams {
  ledger: any;
  evidenceId: string;
}

export interface CausalityValidationResult {
  complete: boolean;
  missingRefs: string[];
  extraRefs: string[];
}

export interface ReplayValidationParams {
  decisionEngine: any;
  policyWasmHash: string;
  inputEvidenceHashes: string[];
}

export interface ReplayValidationResult {
  match: boolean;
  originalHash: string;
  replayHash: string;
  divergencePoint?: string;
}

export interface FederationSimConfig {
  clusters: number;
  treaties: any[];
  operations: any[];
}

export interface FederationSimResult {
  success: boolean;
  evidenceLineage: any[];
  revocationPropagation: any[];
  authorityGraph: any;
}