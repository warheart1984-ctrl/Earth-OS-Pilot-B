// Simulation Runtime Client
// Normative: OSA-CGL-v1.0.md

import { SimulationId, EvidenceId, AuthorityId, PolicyId, Capability, Constraints, EvidenceSource, createSimulationId, now, randomUUID } from '@osa/constitutional-types';

export interface SimulationRuntimeClientConfig {
  endpoint: string;
  authToken?: string;
  timeoutMs?: number;
}

export interface Scenario {
  scenarioId: string;
  name: string;
  description: string;
  timeHorizon: { start: string; end: string; stepMs: number };
  environment: EnvironmentModel;
  actors: ActorModel[];
  physics?: PhysicsModel;
}

export interface EnvironmentModel {
  type: 'ORBITAL' | 'ATMOSPHERIC' | 'TERRESTRIAL' | 'PLANETARY' | 'CUSTOM';
  parameters: Record<string, any>;
  initialConditions: Record<string, any>;
}

export interface ActorModel {
  actorId: string;
  type: 'SATELLITE' | 'GROUND_STATION' | 'DEBRIS' | 'CELESTIAL_BODY' | 'CUSTOM';
  initialState: Record<string, any>;
  behavior: BehaviorModel;
}

export interface BehaviorModel {
  type: 'KEPLERIAN' | 'PROPAGATED' | 'CONTROLLED' | 'SCRIPTED' | 'CUSTOM';
  parameters: Record<string, any>;
}

export interface PhysicsModel {
  gravityModel: 'TWO_BODY' | 'J2' | 'J4' | 'EGM2008' | 'CUSTOM';
  atmosphereModel: 'EXPONENTIAL' | 'NRLMSISE' | 'CUSTOM';
  solarRadiationPressure: boolean;
  thirdBodyEffects: string[];
}

export interface SimulationConfig {
  simulationId?: SimulationId;
  scenario: Scenario;
  authorityBasis: string;
  policyId: PolicyId;
  initialState: SimulationState;
  checkpointInterval?: number;
}

export interface SimulationState {
  currentTime: string;
  step: number;
  actors: Map<string, ActorState>;
  environment: EnvironmentState;
  events: SimulationEvent[];
  metrics: SimulationMetrics;
}

export interface ActorState {
  actorId: string;
  position: Vector3;
  velocity: Vector3;
  attitude: Quaternion;
  angularVelocity: Vector3;
  mass: number;
  custom: Record<string, any>;
}

export interface Vector3 {
  x: number; y: number; z: number;
}

export interface Quaternion {
  w: number; x: number; y: number; z: number;
}

export interface EnvironmentState {
  time: string;
  solarActivity: SolarActivity;
  atmosphericDensity: Record<string, number>;
  gravitationalField: Record<string, Vector3>;
}

export interface SolarActivity {
  f107: number;
  f107a: number;
  ap: number;
}

export interface SimulationEvent {
  eventId: string;
  timestamp: string;
  type: string;
  actorId?: string;
  data: any;
}

export interface SimulationMetrics {
  stepsExecuted: number;
  checkpointsCreated: number;
  eventsGenerated: number;
  evidenceProduced: number;
  durationMs: number;
}

export interface Simulation {
  simulationId: SimulationId;
  config: SimulationConfig;
  authorityGrant: AuthorityGrant;
  state: SimulationState;
  status: SimulationStatus;
  checkpoints: Checkpoint[];
  evidenceRefs: EvidenceId[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export type SimulationStatus = 'CREATED' | 'INITIALIZING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'ABORTED';

export interface Checkpoint {
  globalSequence: number;
  timestamp: string;
  levelCheckpoints: Record<string, LevelCheckpoint>;
  merkleRoot: string;
}

export interface LevelCheckpoint {
  lastSequence: number;
  lastChainHash: string;
  entryCount: number;
}

export interface StepResult {
  step: number;
  success: boolean;
  newState: SimulationState;
  events: SimulationEvent[];
  evidenceRef: EvidenceId;
  durationMs: number;
  error?: string;
}

export interface RunResult {
  simulationId: SimulationId;
  success: boolean;
  finalState: SimulationState;
  totalSteps: number;
  totalDurationMs: number;
  evidenceRefs: EvidenceId[];
  error?: string;
}

export interface ReplayParams {
  simulationId: SimulationId;
  fromCheckpoint?: number;
  policyWasmHash?: string;
  inputEvidenceHashes?: string[];
  runtimeVersion?: string;
  deterministicSeed?: string;
}

export interface ReplayResult {
  originalOutcome: any;
  replayOutcome: any;
  match: boolean;
  divergenceDetails?: {
    point: string;
    originalHash: string;
    replayHash: string;
  };
  evidenceRef: EvidenceId;
}

export interface AuthorityGrant {
  authorityId: string;
  holder: any;
  scope: any[];
  constraints: any;
  delegationPermitted: boolean;
  revocationTriggers: any[];
  evidenceRequirement: string;
  issuedAt: string;
  expiresAt?: string;
  constitutionalBasis: string;
  evidenceRef: string;
  signature: string;
}

export interface SimulationRuntimeClientConfig {
  endpoint: string;
  authToken?: string;
  timeoutMs?: number;
}

export class SimulationRuntimeClient {
  private config: SimulationRuntimeClientConfig;

  constructor(config: SimulationRuntimeClientConfig) {
    this.config = config;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-OSA-Request-ID': randomUUID(),
      'X-OSA-Timestamp': now()
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs || 300000);

    try {
      const response = await fetch(`${this.config.endpoint}${path}`, {
        ...options,
        headers: { ...headers, ...options.headers },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  async createSimulation(config: SimulationConfig): Promise<Simulation> {
    return this.request<Simulation>('/api/v1/simulation', {
      method: 'POST',
      body: JSON.stringify(config)
    });
  }

  async runSimulation(simulationId: SimulationId): Promise<RunResult> {
    return this.request<RunResult>(`/api/v1/simulation/${simulationId}/run`, {
      method: 'POST'
    });
  }

  async pauseSimulation(simulationId: SimulationId): Promise<void> {
    await this.request<void>(`/api/v1/simulation/${simulationId}/pause`, { method: 'POST' });
  }

  async resumeSimulation(simulationId: SimulationId): Promise<void> {
    await this.request<void>(`/api/v1/simulation/${simulationId}/resume`, { method: 'POST' });
  }

  async abortSimulation(simulationId: SimulationId, reason: string): Promise<void> {
    await this.request<void>(`/api/v1/simulation/${simulationId}/abort`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  async replaySimulation(params: ReplayParams): Promise<ReplayResult> {
    return this.request<ReplayResult>('/api/v1/simulation/replay', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  async getSimulation(simulationId: SimulationId): Promise<Simulation | null> {
    return this.request<Simulation | null>(`/api/v1/simulation/${simulationId}`);
  }

  async listSimulations(): Promise<Simulation[]> {
    return this.request<Simulation[]>('/api/v1/simulation');
  }

  async getSimulationsByStatus(status: string): Promise<Simulation[]> {
    return this.request<Simulation[]>(`/api/v1/simulation?status=${status}`);
  }
}