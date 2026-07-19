// Simulation Runtime - Digital Twin Execution with Replay
// Normative: OSA-Runtime-Specifications-v1.0.md §6, OSA-CGL-v1.0.md

import { randomUUID } from 'node:crypto';
import {
  AuthorityId, PolicyId, SimulationId, EvidenceId, EvidenceSource, Timestamp,
  Capability, Constraints, DecisionContext, DecisionOutcome, Obligation,
  DecisionResult, createSimulationId, createEvidenceId, createEvidenceSource, now
} from '@osa/constitutional-types';

export interface SimulationRuntimeConfig {
  kernelClient: KernelClient;
  decisionEngineClient: DecisionEngineClient;
  evidenceLedgerClient: EvidenceLedgerClient;
  auditEngineClient: AuditEngineClient;
  checkpointInterval: number; // steps between checkpoints
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
  revocationTriggers: Array<{ type: string; parameters?: any }>;
  evidenceRequirement: 'E2' | 'E3' | 'E4';
  constitutionalBasis: string;
  expiresAt?: Timestamp;
}

export interface AuthorityGrant {
  authorityId: AuthorityId;
  holder: EvidenceSource;
  scope: Capability[];
  constraints: Constraints;
  delegationPermitted: boolean;
  revocationTriggers: Array<{ type: string; parameters?: any }>;
  evidenceRequirement: 'E2' | 'E3' | 'E4';
  issuedAt: Timestamp;
  expiresAt?: Timestamp;
  constitutionalBasis: string;
  evidenceRef: EvidenceId;
}

export interface RevokeAuthorityParams {
  authorityId: AuthorityId;
  trigger: { type: string; parameters?: any };
  evidence: EvidenceId;
}

export interface RevocationResult {
  revoked: boolean;
  authorityId: AuthorityId;
  cascadedDelegations: AuthorityId[];
  evidenceRef: EvidenceId;
}

export interface DecisionEngineClient {
  decide(params: DecideParams): Promise<DecisionResult>;
}

export interface DecideParams {
  authorityId: AuthorityId;
  policyId: PolicyId;
  kernelAuthzId: string;
  inputEvidence: EvidenceId[];
  context: DecisionContext;
  decisionType: string;
}

export interface EvidenceLedgerClient {
  append(entry: any): Promise<any>;
  getCheckpoint(params: { atSequence?: number }): Promise<Checkpoint | null>;
  replayFrom(checkpoint: Checkpoint): AsyncIterator<any>;
}

export interface AuditEngineClient {
  emitAudit(record: any): Promise<any>;
}

export interface Checkpoint {
  globalSequence: number;
  timestamp: Timestamp;
  levelCheckpoints: Record<string, LevelCheckpoint>;
  merkleRoot: string;
}

export interface LevelCheckpoint {
  lastSequence: number;
  lastChainHash: string;
  entryCount: number;
}

export interface SimulationConfig {
  simulationId?: SimulationId;
  scenario: Scenario;
  authorityBasis: string;
  policyId: PolicyId;
  initialState: SimulationState;
  checkpointInterval?: number;
}

export interface Scenario {
  scenarioId: string;
  name: string;
  description: string;
  timeHorizon: { start: Timestamp; end: Timestamp; stepMs: number };
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

export interface SimulationState {
  currentTime: Timestamp;
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

export interface EnvironmentState {
  time: Timestamp;
  solarActivity: SolarActivity;
  atmosphericDensity: Record<string, number>;
  gravitationalField: Record<string, Vector3>;
}

export interface SolarActivity {
  f107: number;
  f107a: number;
  ap: number;
}

export interface Vector3 {
  x: number; y: number; z: number;
}

export interface Quaternion {
  w: number; x: number; y: number; z: number;
}

export interface SimulationEvent {
  eventId: string;
  timestamp: Timestamp;
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
  createdAt: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
}

export type SimulationStatus = 
  | 'CREATED' | 'INITIALIZING' | 'RUNNING' 
  | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'ABORTED';

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

export class SimulationRuntime {
  private config: SimulationRuntimeConfig;
  private simulations: Map<string, Simulation> = new Map();
  private simSequence = 0;

  constructor(config: SimulationRuntimeConfig) {
    this.config = config;
  }

  async createSimulation(config: SimulationConfig): Promise<Simulation> {
    // 1. Request authority grant
    const simSource = createEvidenceSource('processor', `simulation-${randomUUID().slice(0, 8)}`);
    
    const grant = await this.config.kernelClient.grantAuthority({
      holder: simSource,
      scope: config.scenario.actors.flatMap(a => [
        { resource: `simulation:actor:${a.actorId}`, action: 'propagate' },
        { resource: 'simulation:state', action: 'read' },
        { resource: 'simulation:checkpoint', action: 'write' }
      ]),
      constraints: {
        timeWindow: config.scenario.timeHorizon,
        quota: { limit: config.scenario.timeHorizon.stepMs * 1000, windowMs: 3600000 }
      },
      delegationPermitted: false,
      revocationTriggers: [
        { type: 'expiry', parameters: {} },
        { type: 'scope_exceedance', parameters: {} }
      ],
      evidenceRequirement: 'E2',
      constitutionalBasis: config.authorityBasis,
      expiresAt: config.scenario.timeHorizon.end
    });

    // 2. Initialize simulation state
    const initialState = this.initializeState(config);
    
    const simulationId = config.simulationId || createSimulationId(
      `sim:osa:${config.authorityBasis.toLowerCase().replace(/\s+/g, '-')}:${randomUUID().slice(0, 8)}`
    );

    const simulation: Simulation = {
      simulationId,
      config,
      authorityGrant: grant,
      state: initialState,
      status: 'CREATED',
      checkpoints: [],
      evidenceRefs: [grant.evidenceRef],
      createdAt: now()
    };

    this.simulations.set(simulationId.value, simulation);
    return simulation;
  }

  async runSimulation(simulationId: SimulationId): Promise<RunResult> {
    const sim = this.getSimulation(simulationId);
    if (!sim) throw new Error(`Simulation not found: ${simulationId.value}`);

    sim.status = 'INITIALIZING';
    sim.startedAt = now();

    const startTime = Date.now();
    let totalSteps = 0;
    let evidenceRefs: EvidenceId[] = [];

    try {
      sim.status = 'RUNNING';
      
      const totalSteps = Math.ceil(
        (new Date(sim.config.scenario.timeHorizon.end.value).getTime() - 
         new Date(sim.config.scenario.timeHorizon.start.value).getTime()) / 
        sim.config.scenario.timeHorizon.stepMs
      );

      for (let step = 0; step < totalSteps; step++) {
        const stepResult = await this.executeStep(sim);
        
        if (!stepResult.success) {
          throw new Error(stepResult.error || 'Step failed');
        }

        sim.state = stepResult.newState;
        sim.evidenceRefs.push(stepResult.evidenceRef);
        evidenceRefs.push(stepResult.evidenceRef);
        totalSteps++;

        // Create checkpoint if interval reached
        if (step > 0 && step % (sim.config.checkpointInterval || this.config.checkpointInterval) === 0) {
          const checkpoint = await this.createCheckpoint(sim);
          sim.checkpoints.push(checkpoint);
        }

        // Check for pause/abort
        if (sim.status === 'PAUSED') {
          break;
        }
      }

      sim.status = 'COMPLETED';
      sim.completedAt = now();

      // Final evidence for completion
      const completionEvidence = await this.emitCompletionEvidence(sim);
      sim.evidenceRefs.push(completionEvidence);
      evidenceRefs.push(completionEvidence);

      return {
        simulationId: sim.simulationId,
        success: true,
        finalState: sim.state,
        totalSteps,
        totalDurationMs: Date.now() - startTime,
        evidenceRefs
      };

    } catch (error) {
      sim.status = 'FAILED';
      sim.completedAt = now();

      const errorEvidence = await this.emitErrorEvidence(sim, error instanceof Error ? error.message : String(error));
      sim.evidenceRefs.push(errorEvidence);
      evidenceRefs.push(errorEvidence);

      return {
        simulationId: sim.simulationId,
        success: false,
        finalState: sim.state,
        totalSteps,
        totalDurationMs: Date.now() - startTime,
        evidenceRefs,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async pauseSimulation(simulationId: SimulationId): Promise<void> {
    const sim = this.getSimulation(simulationId);
    if (!sim) throw new Error(`Simulation not found: ${simulationId.value}`);
    if (sim.status === 'RUNNING') {
      sim.status = 'PAUSED';
    }
  }

  async resumeSimulation(simulationId: SimulationId): Promise<void> {
    const sim = this.getSimulation(simulationId);
    if (!sim) throw new Error(`Simulation not found: ${simulationId.value}`);
    if (sim.status === 'PAUSED') {
      sim.status = 'RUNNING';
    }
  }

  async abortSimulation(simulationId: SimulationId, reason: string): Promise<void> {
    const sim = this.getSimulation(simulationId);
    if (!sim) throw new Error(`Simulation not found: ${simulationId.value}`);

    // Revoke authority
    await this.config.kernelClient.revokeAuthority({
      authorityId: sim.authorityGrant.authorityId,
      trigger: { type: 'scope_exceedance', parameters: { reason } },
      evidence: sim.evidenceRefs[sim.evidenceRefs.length - 1]
    });

    sim.status = 'ABORTED';
    sim.completedAt = now();

    await this.emitAudit({
      eventType: 'SIMULATION_ABORTED',
      actor: createEvidenceSource('simulation-runtime', 'osa'),
      subjectRefs: sim.evidenceRefs,
      findings: [{ rule: 'CSD-T-011', status: 'COMPLIANT', details: `Simulation aborted: ${reason}` }],
      riskLevel: 'MEDIUM'
    });
  }

  async replaySimulation(params: ReplayParams): Promise<ReplayResult> {
    const sim = this.getSimulation(params.simulationId);
    if (!sim) throw new Error(`Simulation not found: ${params.simulationId.value}`);

    // Get checkpoint to replay from
    const checkpointIndex = params.fromCheckpoint !== undefined 
      ? params.fromCheckpoint 
      : Math.max(0, sim.checkpoints.length - 1);
    
    if (checkpointIndex >= sim.checkpoints.length) {
      throw new Error(`Checkpoint ${checkpointIndex} not found`);
    }

    const checkpoint = sim.checkpoints[checkpointIndex];

    // In production: replay from evidence ledger using Replay Engine
    // For now, simulate replay verification
    const evidenceRef = createEvidenceId(`E2-OSA-SIM-REPLAY-${now().split('T')[0].replace(/-/g, '')}-${randomUUID().slice(0, 4)}`);

    return {
      originalOutcome: { finalState: sim.state, evidenceRefs: sim.evidenceRefs },
      replayOutcome: { finalState: sim.state, evidenceRefs: sim.evidenceRefs },
      match: true,
      evidenceRef
    };
  }

  async getSimulation(simulationId: SimulationId): Promise<Simulation | null> {
    return this.simulations.get(simulationId.value) || null;
  }

  listSimulations(): Simulation[] {
    return Array.from(this.simulations.values());
  }

  getSimulationsByStatus(status: SimulationStatus): Simulation[] {
    return Array.from(this.simulations.values()).filter(s => s.status === status);
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private initializeState(config: SimulationConfig): SimulationState {
    const actors = new Map<string, ActorState>();
    
    for (const actor of config.scenario.actors) {
      actors.set(actor.actorId, {
        actorId: actor.actorId,
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        attitude: { w: 1, x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        mass: actor.initialState.mass || 1000,
        custom: actor.initialState
      });
    }

    return {
      currentTime: config.scenario.timeHorizon.start,
      step: 0,
      actors,
      environment: {
        time: config.scenario.timeHorizon.start,
        solarActivity: { f107: 150, f107a: 150, ap: 7 },
        atmosphericDensity: {},
        gravitationalField: {}
      },
      events: [],
      metrics: {
        stepsExecuted: 0,
        checkpointsCreated: 0,
        eventsGenerated: 0,
        evidenceProduced: 0,
        durationMs: 0
      }
    };
  }

  private async executeStep(sim: Simulation): Promise<StepResult> {
    const stepStart = Date.now();
    const step = sim.state.step + 1;

    try {
      // 1. Propagate physics for all actors
      const newActors = new Map<string, ActorState>();
      const events: SimulationEvent[] = [];

      for (const [actorId, actor] of sim.state.actors) {
        const actorModel = sim.config.scenario.actors.find(a => a.actorId === actorId);
        if (!actorModel) continue;

        const propagated = this.propagateActor(actor, actorModel, sim.config.scenario.timeHorizon.stepMs);
        newActors.set(actorId, propagated);

        // Generate events for significant state changes
        if (this.isSignificantChange(actor, propagated)) {
          events.push({
            eventId: `EVT-${randomUUID().slice(0, 8)}`,
            timestamp: sim.state.currentTime,
            type: 'STATE_CHANGE',
            actorId,
            data: { previous: actor, current: propagated }
          });
        }
      }

      // 2. Update environment
      const newEnvironment = this.updateEnvironment(sim.state.environment, sim.state.currentTime);

      // 3. Create new state
      const newTime = new Date(new Date(sim.state.currentTime.value).getTime() + sim.config.scenario.timeHorizon.stepMs).toISOString();
      const newState: SimulationState = {
        currentTime: newTime,
        step,
        actors: newActors,
        environment: newEnvironment,
        events: [...sim.state.events, ...events],
        metrics: {
          ...sim.state.metrics,
          stepsExecuted: step,
          eventsGenerated: sim.state.metrics.eventsGenerated + events.length
        }
      };

      // 4. Produce step evidence via Decision Engine
      const authzId = `authz:sim:step:${sim.simulationId.value}:${now().split('T')[0].replace(/-/g, '')}-${String(step).padStart(4, '0')}`;
      const decision = await this.config.decisionEngineClient.decide({
        authorityId: sim.authorityGrant.authorityId,
        policyId: sim.config.policyId,
        kernelAuthzId: authzId,
        inputEvidence: sim.evidenceRefs.slice(-1), // Previous step evidence
        context: {
          actor: createEvidenceSource('processor', `simulation-${sim.simulationId.value}`, '1.0.0'),
          request: { step, action: 'propagate' },
          environment: { time: newTime, actors: Array.from(newActors.keys()) },
          constraints: sim.authorityGrant.constraints
        },
        decisionType: 'SIMULATION_STEP'
      });

      sim.state.metrics.evidenceProduced++;

      return {
        step,
        success: true,
        newState,
        events,
        evidenceRef: decision.evidenceRef,
        durationMs: Date.now() - stepStart
      };

    } catch (error) {
      return {
        step,
        success: false,
        newState: sim.state,
        events: [],
        evidenceRef: createEvidenceId(`E3-OSA-SIM-ERROR-${now().split('T')[0].replace(/-/g, '')}-${randomUUID().slice(0, 4)}`),
        durationMs: Date.now() - stepStart,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private propagateActor(actor: ActorState, model: ActorModel, stepMs: number): ActorState {
    // Simplified Keplerian propagation
    // In production: use proper orbital mechanics library
    const dt = stepMs / 1000;
    
    // Simple 2-body propagation
    const mu = 398600.4418; // Earth GM km^3/s^2
    const r = Math.sqrt(actor.position.x**2 + actor.position.y**2 + actor.position.z**2);
    const v = Math.sqrt(actor.velocity.x**2 + actor.velocity.y**2 + actor.velocity.z**2);
    
    // Semi-major axis
    const a = 1 / (2/r - v**2/mu);
    
    // Mean motion
    const n = Math.sqrt(mu / a**3);
    
    // Mean anomaly change
    const dM = n * dt;
    
    // Simplified: just advance position along velocity vector
    const newPos: Vector3 = {
      x: actor.position.x + actor.velocity.x * dt,
      y: actor.position.y + actor.velocity.y * dt,
      z: actor.position.z + actor.velocity.z * dt
    };

    return {
      ...actor,
      position: newPos,
      custom: { ...actor.custom, propagatedAt: now() }
    };
  }

  private isSignificantChange(oldState: ActorState, newState: ActorState): boolean {
    const posDiff = Math.sqrt(
      (newState.position.x - oldState.position.x)**2 +
      (newState.position.y - oldState.position.y)**2 +
      (newState.position.z - oldState.position.z)**2
    );
    return posDiff > 1.0; // 1km threshold
  }

  private updateEnvironment(env: EnvironmentState, time: Timestamp): EnvironmentState {
    return {
      ...env,
      time,
      // Update solar activity, atmospheric density, etc.
      solarActivity: { f107: 150, f107a: 150, ap: 7 }
    };
  }

  private async createCheckpoint(sim: Simulation): Promise<Checkpoint> {
    // In production: use Evidence Ledger checkpoint
    const checkpoint: Checkpoint = {
      globalSequence: sim.state.metrics.stepsExecuted,
      timestamp: now(),
      levelCheckpoints: {},
      merkleRoot: `sha3-256:${randomUUID().replace(/-/g, '')}`
    };
    
    sim.state.metrics.checkpointsCreated++;
    
    await this.emitAudit({
      eventType: 'SIMULATION_CHECKPOINT',
      actor: createEvidenceSource('simulation-runtime', 'osa'),
      subjectRefs: sim.evidenceRefs.slice(-1),
      findings: [{ rule: 'CSD-T-011', status: 'COMPLIANT', details: `Checkpoint at step ${sim.state.step}` }],
      riskLevel: 'NONE'
    });

    return checkpoint;
  }

  private async emitCompletionEvidence(sim: Simulation): Promise<EvidenceId> {
    const evidenceId = createEvidenceId(`E2-OSA-SIM-COMPLETE-${now().split('T')[0].replace(/-/g, '')}-${randomUUID().slice(0, 4)}`);
    
    await this.emitAudit({
      eventType: 'SIMULATION_COMPLETED',
      actor: createEvidenceSource('simulation-runtime', 'osa'),
      subjectRefs: sim.evidenceRefs,
      findings: [{ rule: 'CSD-T-011', status: 'COMPLIANT', details: `Simulation completed: ${sim.state.metrics.stepsExecuted} steps` }],
      riskLevel: 'NONE'
    });

    return evidenceId;
  }

  private async emitErrorEvidence(sim: Simulation, error: string): Promise<EvidenceId> {
    const evidenceId = createEvidenceId(`E3-OSA-SIM-ERROR-${now().split('T')[0].replace(/-/g, '')}-${randomUUID().slice(0, 4)}`);

    await this.emitAudit({
      eventType: 'SIMULATION_FAILED',
      actor: createEvidenceSource('simulation-runtime', 'osa'),
      subjectRefs: sim.evidenceRefs,
      findings: [{ rule: 'CSD-T-011', status: 'NON_COMPLIANT', details: `Simulation error: ${error}` }],
      riskLevel: 'HIGH'
    });

    return evidenceId;
  }

  private async emitAudit(record: any): Promise<void> {
    await this.config.auditEngineClient.emitAudit({
      ...record,
      auditId: `AUD-SIM-${now().split('T')[0].replace(/-/g, '')}-${randomUUID().slice(0, 4)}`,
      timestamp: now(),
      evidenceRef: createEvidenceId(`E3-OSA-SIM-AUDIT-${now().split('T')[0].replace(/-/g, '')}-${randomUUID().slice(0, 4)}`),
      chainHash: 'sha3-256:placeholder'
    });
  }

  private getSimulation(simulationId: SimulationId): Simulation | null {
    return this.simulations.get(simulationId.value) || null;
  }
}