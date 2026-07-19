// GraphQL Schema - OSA Layer 4 Intelligence Services
// Normative: OSA-API-Specifications-v1.0.md

export const typeDefs = `
# ============================================================================
# Common Types
# ============================================================================

scalar DateTime
scalar JSON
scalar Hash
scalar EvidenceId
scalar AuthorityId
scalar PolicyId
scalar DecisionId
scalar AuthorizationId

interface Evidenced {
  evidenceRef: EvidenceId!
  chainHash: Hash!
}

# ============================================================================
# Observation API
# ============================================================================

type ImagingTask {
  taskId: ID!
  status: TaskStatus!
  target: Target!
  parameters: ImagingParameters!
  evidenceRef: EvidenceId!
  createdAt: DateTime!
  completedAt: DateTime
}

type ImageryRecord {
  imageId: ID!
  timestamp: DateTime!
  bounds: GeoBounds!
  bands: [SpectralBand!]!
  resolutionM: Float!
  evidenceRef: EvidenceId!
}

type RemoteSensingProduct {
  productId: ID!
  timestamp: DateTime!
  region: GeoRegion!
  parameters: [String!]!
  evidenceRef: EvidenceId!
}

type EnvironmentalRecord {
  parameter: String!
  value: Float!
  unit: String!
  location: GeoPoint!
  timestamp: DateTime!
  evidenceRef: EvidenceId!
}

enum TaskStatus {
  QUEUED
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}

enum SpectralBand {
  VIS
  NIR
  SWIR
  MWIR
  LWIR
  PAN
}

input TargetInput {
  type: TargetType!
  bodyId: String!
  coordinates: GeoPointInput!
}

input ImagingParametersInput {
  resolutionM: Float!
  spectralBands: [SpectralBand!]!
  priority: TaskPriority
}

input ImageryFilter {
  region: GeoBoundsInput
  start: DateTime
  end: DateTime
  bands: [SpectralBand!]
  resolutionMax: Float
}

input EnvironmentalFilter {
  parameters: [String!]!
  region: GeoBoundsInput
  start: DateTime
  end: DateTime
}

# ============================================================================
# Navigation API
# ============================================================================

type OrbitalRoute {
  routeId: ID!
  maneuvers: [Maneuver!]!
  totalDeltaV: Float!
  evidenceRef: EvidenceId!
}

type Maneuver {
  time: DateTime!
  deltaV: Vector3!
  durationS: Float!
}

type MissionPlan {
  planId: ID!
  profile: MissionProfile!
  route: OrbitalRoute!
  validation: MissionValidation!
  evidenceRef: EvidenceId!
}

type MissionValidation {
  valid: Boolean!
  warnings: [String!]
  evidenceRef: EvidenceId!
}

type NavigationResult {
  success: Boolean!
  trajectory: TrajectoryPoint
  evidenceRef: EvidenceId!
}

type TrajectoryPoint {
  position: Vector3!
  velocity: Vector3!
  timestamp: DateTime!
}

input MissionProfileInput {
  vehicleId: String!
  initialState: VehicleStateInput!
  targetOrbit: OrbitParametersInput!
  constraints: RouteConstraintsInput!
}

input RouteConstraintsInput {
  maxDeltaV: Float
  maxDuration: Float
  avoidRegions: [GeoRegionInput!]
}

input VehicleStateInput {
  position: Vector3Input!
  velocity: Vector3Input!
  mass: Float!
}

input OrbitParametersInput {
  sma: Float!
  ecc: Float!
  inc: Float!
  raan: Float!
  argp: Float!
  ta: Float!
}

# ============================================================================
# Mission API
# ============================================================================

type Mission {
  missionId: ID!
  status: MissionStatus!
  plan: MissionPlan!
  telemetry: TelemetryStream!
  evidenceRefs: [EvidenceId!]!
}

enum MissionStatus {
  CREATED
  RUNNING
  PAUSED
  COMPLETED
  FAILED
  ABORTED
}

type MissionActionResult {
  actionId: ID!
  outcome: DecisionOutcome!
  evidenceRef: EvidenceId!
}

type MissionAbortResult {
  aborted: Boolean!
  evidenceRef: EvidenceId!
}

input MissionCreateInput {
  name: String!
  description: String!
  steps: [MissionStepInput!]!
  authorityRef: AuthorityId!
  policyRef: PolicyId!
  constraints: ConstraintsInput!
}

input MissionStepInput {
  stepId: String!
  name: String!
  description: String!
  action: MissionActionInput!
  preconditions: [PreconditionInput!]!
  postconditions: [PostconditionInput!]!
  timeoutMs: Float!
  retryPolicy: RetryPolicyInput!
  authorityScope: [CapabilityInput!]!
}

input MissionActionInput {
  type: MissionActionType!
  resource: String!
  action: String!
  parameters: JSON!
}

enum MissionActionType {
  ORBITAL_MANEUVER
  OBSERVATION_TASK
  DATA_COLLECTION
  COMMUNICATION
  COMPUTATION
  CUSTOM
}

input PreconditionInput {
  type: PreconditionType!
  parameters: JSON!
}

enum PreconditionType {
  EVIDENCE_EXISTS
  STATE_MATCHES
  AUTHORITY_VALID
  CUSTOM
}

input PostconditionInput {
  type: PostconditionType!
  parameters: JSON!
}

enum PostconditionType {
  EVIDENCE_PRODUCED
  STATE_UPDATED
  NOTIFICATION_SENT
  CUSTOM
}

input RetryPolicyInput {
  maxRetries: Int!
  backoffMs: Float!
  retryOn: [String!]!
}

# ============================================================================
# Knowledge API
# ============================================================================

type SpaceEntity {
  entityRef: ID!
  type: EntityType!
  properties: JSON!
  evidenceRefs: [EvidenceId!]!
  relationships: [SpaceRelationship!]!
}

type SpaceRelationship {
  relationshipRef: ID!
  type: RelationshipType!
  target: SpaceEntity!
  evidenceRefs: [EvidenceId!]!
}

enum EntityType {
  MISSION
  ASSET
  SATELLITE
  CELESTIAL_BODY
  RESEARCH
  EVIDENCE
}

enum RelationshipType {
  PART_OF
  OBSERVES
  COMMUNICATES_WITH
  ORBITS
  DERIVED_FROM
  SUPPORTS
}

type TraversalResult {
  nodes: [SpaceEntity!]!
  edges: [SpaceRelationship!]!
  roots: [EvidenceId!]!
  leaves: [EvidenceId!]!
}

input EntityFilter {
  types: [EntityType!]
  properties: JSON
}

input TraversalInput {
  start: ID!
  direction: TraversalDirection!
  maxDepth: Int
  relationshipTypes: [RelationshipType!]
}

enum TraversalDirection {
  UPSTREAM
  DOWNSTREAM
  BOTH
}

# ============================================================================
# Simulation API
# ============================================================================

type Simulation {
  simulationId: ID!
  scenario: Scenario!
  status: SimulationStatus!
  results: SimulationResults!
  replayId: ID
  evidenceRef: EvidenceId!
}

enum SimulationStatus {
  CREATED
  INITIALIZING
  RUNNING
  PAUSED
  COMPLETED
  FAILED
  ABORTED
}

type SimulationResults {
  finalState: SimulationState!
  metrics: SimulationMetrics!
  events: [SimulationEvent!]!
}

type SimulationState {
  currentTime: DateTime!
  step: Int!
  actors: [ActorState!]!
  environment: EnvironmentState!
  events: [SimulationEvent!]!
  metrics: SimulationMetrics!
}

type ActorState {
  actorId: String!
  position: Vector3!
  velocity: Vector3!
  attitude: Quaternion!
  angularVelocity: Vector3!
  mass: Float!
  custom: JSON!
}

type EnvironmentState {
  time: DateTime!
  solarActivity: SolarActivity!
  atmosphericDensity: JSON!
  gravitationalField: JSON!
}

type SolarActivity {
  f107: Float!
  f107a: Float!
  ap: Float!
}

type SimulationMetrics {
  stepsExecuted: Int!
  checkpointsCreated: Int!
  eventsGenerated: Int!
  evidenceProduced: Int!
  durationMs: Float!
}

type SimulationEvent {
  eventId: String!
  timestamp: DateTime!
  type: String!
  actorId: String
  data: JSON!
}

type StepResult {
  step: Int!
  success: Boolean!
  newState: SimulationState!
  events: [SimulationEvent!]!
  evidenceRef: EvidenceId!
  durationMs: Float!
  error: String
}

type RunResult {
  simulationId: ID!
  success: Boolean!
  finalState: SimulationState!
  totalSteps: Int!
  totalDurationMs: Float!
  evidenceRefs: [EvidenceId!]!
  error: String
}

input ScenarioInput {
  scenarioId: String!
  name: String!
  description: String!
  timeHorizon: TimeHorizonInput!
  environment: EnvironmentModelInput!
  actors: [ActorModelInput!]!
  physics: PhysicsModelInput
}

input TimeHorizonInput {
  start: DateTime!
  end: DateTime!
  stepMs: Float!
}

input EnvironmentModelInput {
  type: EnvironmentType!
  parameters: JSON!
  initialConditions: JSON!
}

enum EnvironmentType {
  ORBITAL
  ATMOSPHERIC
  TERRESTRIAL
  PLANETARY
  CUSTOM
}

input ActorModelInput {
  actorId: String!
  type: ActorType!
  initialState: JSON!
  behavior: BehaviorModelInput!
}

enum ActorType {
  SATELLITE
  GROUND_STATION
  DEBRIS
  CELESTIAL_BODY
  CUSTOM
}

input BehaviorModelInput {
  type: BehaviorType!
  parameters: JSON!
}

enum BehaviorType {
  KEPLERIAN
  PROPAGATED
  CONTROLLED
  SCRIPTED
  CUSTOM
}

input PhysicsModelInput {
  gravityModel: GravityModel!
  atmosphereModel: AtmosphereModel!
  solarRadiationPressure: Boolean!
  thirdBodyEffects: [String!]!
}

enum GravityModel {
  TWO_BODY
  J2
  J4
  EGM2008
  CUSTOM
}

enum AtmosphereModel {
  EXPONENTIAL
  NRLMSISE
  CUSTOM
}

input ReplayParamsInput {
  simulationId: ID!
  fromCheckpoint: Int
  policyWasmHash: Hash
  inputEvidenceHashes: [Hash!]!
  runtimeVersion: String
  deterministicSeed: String
}

# ============================================================================
# Evidence API
# ============================================================================

type EvidenceRecord {
  evidenceId: ID!
  level: EvidenceLevel!
  timestamp: DateTime!
  source: String!
  payload: JSON!
  payloadHash: Hash!
  chainHash: Hash!
  signature: Signature!
  inputEvidenceRefs: [EvidenceId!]!
}

enum EvidenceLevel {
  E0
  E1
  E2
  E3
  E4
}

type LineageGraph {
  nodes: [EvidenceRecord!]!
  edges: [CausalityRecord!]!
  roots: [EvidenceId!]!
  leaves: [EvidenceId!]!
}

type CausalityRecord {
  causalityId: ID!
  cause: EvidenceId!
  effect: EvidenceId!
  relation: CausalityRelation!
  strength: CausalityStrength!
  timestamp: DateTime!
  establishedBy: String!
  signature: Signature!
}

enum CausalityRelation {
  PROCESSES
  INPUTS_TO
  DECIDES_ON
  AUDITS
  REMEDIATES
  GOVERNS
}

enum CausalityStrength {
  DEFINITIVE
  PROBABILISTIC
  CONTRIBUTORY
}

type VerificationResult {
  verificationId: ID!
  passed: Boolean!
  findings: [VerificationFinding!]!
  evidenceRef: EvidenceId!
  verifiedAt: DateTime!
}

type VerificationFinding {
  rule: String!
  status: String!
  details: String!
}

input EvidenceFilter {
  level: EvidenceLevel
  source: String
  startTime: DateTime
  endTime: DateTime
}

# ============================================================================
# Verification API
# ============================================================================

type VerificationResult {
  verificationId: ID!
  passed: Boolean!
  findings: [VerificationFinding!]!
  evidenceRef: EvidenceId!
  verifiedAt: DateTime!
}

# ============================================================================
# Governance API
# ============================================================================

type AuthorityGrant {
  authorityId: AuthorityId!
  holder: String!
  scope: [Capability!]!
  constraints: Constraints!
  delegationPermitted: Boolean!
  revocationTriggers: [RevocationTrigger!]!
  evidenceRequirement: EvidenceLevel!
  issuedAt: DateTime!
  expiresAt: DateTime
  constitutionalBasis: String!
  evidenceRef: EvidenceId!
  signature: Signature!
}

type Capability {
  resource: String!
  action: String!
}

type Constraints {
  timeWindow: TimeWindow
  classificationMax: ClassificationLevel
  resourceFilters: [ResourceFilter!]
  contextRequirements: [ContextRequirement!]
  quota: QuotaSpec
}

type TimeWindow {
  start: DateTime!
  end: DateTime!
}

enum ClassificationLevel {
  UNCLASSIFIED
  CONFIDENTIAL
  SECRET
  TOP_SECRET
}

type ResourceFilter {
  pattern: String!
  action: String!
}

type ContextRequirement {
  key: String!
  operator: String!
  value: JSON!
  delegatedFrom: String
}

type QuotaSpec {
  requestsPerSecond: Int!
  requestsPerDay: Int!
  burstAllowance: Int!
}

type RevocationTrigger {
  type: RevocationTriggerType!
  parameters: JSON!
}

enum RevocationTriggerType {
  EXPIRY
  CLASSIFICATION_BREACH
  SCOPE_EXCEEDANCE
  EVIDENCE_FAILURE
  IDENTITY_COMPROMISE
  PARENT_REVOKED
}

type AuditRecord {
  auditId: ID!
  eventType: AuditEventType!
  timestamp: DateTime!
  actor: String!
  subjectRefs: [EvidenceId!]!
  findings: [AuditFinding!]!
  riskLevel: RiskLevel!
  evidenceRef: EvidenceId!
  chainHash: Hash!
}

enum AuditEventType {
  AUTHORITY_GRANT
  AUTHORITY_EXERCISE
  AUTHORITY_REVOKE
  AUTHORITY_DELEGATE
  POLICY_COMPILED
  POLICY_DEPLOYED
  POLICY_ROLLBACK
  KERNEL_AUTHZ_GRANTED
  KERNEL_AUTHZ_DENIED
  DECISION_MADE
  DECISION_DENIED
  DECISION_REPLAYED
  DECISION_VERIFIED
  REPLAY_DIVERGED
  VERIFICATION_FAILED
  CHAIN_VERIFIED
  CHAIN_BROKEN
  ROUTINE_AUDIT
  TRIGGERED_AUDIT
  FINDING_ISSUED
  REMEDIATION_MANDATED
  FEDERATION_EVENT
  CONSTITUTIONAL_AMENDMENT
  TREATY_RATIFIED
}

type AuditFinding {
  rule: String!
  status: FindingStatus!
  details: String!
  evidenceRefs: [EvidenceId!]
}

enum FindingStatus {
  COMPLIANT
  NON_COMPLIANT
  PARTIAL
  NOT_APPLICABLE
}

enum RiskLevel {
  CRITICAL
  HIGH
  MEDIUM
  LOW
  NONE
}

type ComplianceReport {
  reportId: ID!
  generatedAt: DateTime!
  period: TimeWindow!
  summary: ReportSummary!
  findings: [AuditFinding!]!
  evidenceRef: EvidenceId!
}

type ReportSummary {
  totalAudits: Int!
  compliant: Int!
  nonCompliant: Int!
  partial: Int!
  criticalFindings: Int!
  highFindings: Int!
  mediumFindings: Int!
  lowFindings: Int!
}

# ============================================================================
# Agent API
# ============================================================================

type Agent {
  agentId: ID!
  authorityId: AuthorityId!
  policyId: PolicyId!
  state: JSON!
  capabilities: [Capability!]!
  constraints: Constraints!
  spawnedAt: DateTime!
  lastActionAt: DateTime
  evidenceRefs: [EvidenceId!]!
  status: AgentStatus!
}

enum AgentStatus {
  SPAWNING
  RUNNING
  PAUSED
  TERMINATING
  TERMINATED
}

type AgentActionResult {
  actionId: ID!
  outcome: DecisionOutcome!
  evidenceRef: EvidenceId!
  newState: JSON!
}

type TerminationResult {
  terminated: Boolean!
  agentId: ID!
  evidenceRef: EvidenceId!
}

input SpawnAgentInput {
  policyId: PolicyId!
  initialState: JSON
  capabilities: [CapabilityInput!]!
  constraints: ConstraintsInput!
  authorityBasis: String!
  expiresAt: DateTime
}

input CapabilityInput {
  resource: String!
  action: String!
}

input ConstraintsInput {
  timeWindow: TimeWindowInput
  classificationMax: ClassificationLevel
  resourceFilters: [ResourceFilterInput!]
  contextRequirements: [ContextRequirementInput!]
  quota: QuotaSpecInput
}

input TimeWindowInput {
  start: DateTime!
  end: DateTime!
}

input ResourceFilterInput {
  pattern: String!
  action: String!
}

input ContextRequirementInput {
  key: String!
  operator: String!
  value: JSON!
  delegatedFrom: String
}

input QuotaSpecInput {
  requestsPerSecond: Int!
  requestsPerDay: Int!
  burstAllowance: Int!
}

# ============================================================================
# Decision API
# ============================================================================

type DecisionOutcome {
  result: DecisionResult!
  action: String
  classification: String
  parameters: JSON
  obligations: [Obligation!]!
}

enum DecisionResult {
  ALLOW
  DENY
  CONDITIONAL
}

type Obligation {
  type: ObligationType!
  parameters: JSON!
  deadline: DateTime
}

enum ObligationType {
  PRODUCE_EVIDENCE
  EMIT_AUDIT
  NOTIFY
  SCHEDULE_REPLAY
  SCHEDULE_VERIFICATION
}

type PolicyEvaluation {
  policyWasmHash: Hash!
  inputHash: Hash!
  result: DecisionResult!
  obligations: [Obligation!]!
  explanation: String!
  evaluationTimestamp: DateTime!
  evaluatorVersion: String!
}

# ============================================================================
# Common Scalars
# ============================================================================

scalar Vector3
scalar Quaternion

type Vector3 {
  x: Float!
  y: Float!
  z: Float!
}

type Quaternion {
  w: Float!
  x: Float!
  y: Float!
  z: Float!
}

input Vector3Input {
  x: Float!
  y: Float!
  z: Float!
}

type GeoPoint {
  lat: Float!
  lon: Float!
  alt: Float
}

input GeoPointInput {
  lat: Float!
  lon: Float!
  alt: Float
}

type GeoBounds {
  north: Float!
  south: Float!
  east: Float!
  west: Float!
}

input GeoBoundsInput {
  north: Float!
  south: Float!
  east: Float!
  west: Float!
}

type GeoRegion {
  type: String!
  coordinates: JSON!
}

input GeoRegionInput {
  type: String!
  coordinates: JSON!
}

enum TargetType {
  EARTH
  PLANETARY_BODY
}

enum TaskPriority {
  NOMINAL
  URGENT
}

# ============================================================================
# Queries
# ============================================================================

type Query {
  # Observation
  imageryCatalog(filter: ImageryFilter): [ImageryRecord!]!
  remoteSensingProduct(id: ID!): RemoteSensingProduct
  environmentalData(filter: EnvironmentalFilter): [EnvironmentalRecord!]!

  # Navigation
  # Computed via mutations

  # Mission
  mission(missionId: ID!): Mission
  missions(status: MissionStatus): [Mission!]!

  # Knowledge
  entity(ref: ID!): SpaceEntity
  queryEntities(filter: EntityFilter): [SpaceEntity!]!
  traverse(input: TraversalInput!): TraversalResult!

  # Simulation
  simulation(simulationId: ID!): Simulation
  simulations(status: SimulationStatus): [Simulation!]!

  # Evidence
  evidence(id: EvidenceId!): EvidenceRecord
  queryEvidence(filter: EvidenceFilter): [EvidenceRecord!]!
  lineage(evidenceId: EvidenceId!): LineageGraph!
  verify(evidenceId: EvidenceId!): VerificationResult!

  # Verification
  # Via mutations

  # Governance
  authority(authorityId: AuthorityId!): AuthorityGrant
  policy(policyId: PolicyId!): CompiledPolicy
  queryAudits(period: TimeWindow): [AuditRecord!]!
  audit(auditId: ID!): AuditRecord
  complianceReport(period: TimeWindow!): ComplianceReport
  constitutionalState: ConstitutionalState!

  # Agent
  agent(agentId: ID!): Agent
  agents(policyId: PolicyId): [Agent!]!

  # Decision
  # Via mutations
}

# ============================================================================
# Mutations
# ============================================================================

type Mutation {
  # Observation
  requestImaging(input: ImagingTaskInput!): ImagingTask!

  # Navigation
  computeRoute(input: MissionProfileInput!): OrbitalRoute!
  optimizeRoute(routeId: ID!, constraints: RouteConstraintsInput!): OrbitalRoute!
  planMission(input: MissionProfileInput!): MissionPlan!
  validateMission(planId: ID!): MissionValidation!
  executeNavigation(vehicleId: String!, plan: NavigationPlanInput!): NavigationResult!

  # Mission
  createMission(input: MissionCreateInput!): Mission!
  executeMission(missionId: ID!, inputEvidence: [EvidenceId!]!): Mission!
  executeStep(missionId: ID!, stepId: String!, inputEvidence: [EvidenceId!]!): MissionActionResult!
  abortMission(missionId: ID!, reason: String!): MissionAbortResult!

  # Knowledge
  upsertEntity(entity: SpaceEntityInput!): SpaceEntity!
  upsertRelationship(rel: SpaceRelationshipInput!): SpaceRelationship!

  # Simulation
  createSimulation(config: SimulationConfigInput!): Simulation!
  runSimulation(simulationId: ID!): RunResult!
  pauseSimulation(simulationId: ID!): Boolean!
  resumeSimulation(simulationId: ID!): Boolean!
  abortSimulation(simulationId: ID!, reason: String!): Boolean!
  replaySimulation(params: ReplayParamsInput!): ReplayResult!

  # Evidence
  submitEvidence(entry: EvidenceRecordInput!): EvidenceRecord!
  batchVerify(evidenceIds: [EvidenceId!]!): [VerificationResult!]!

  # Verification
  verifyDecision(decisionId: DecisionId!): VerificationResult!
  verifyEvidence(evidenceId: EvidenceId!): VerificationResult!
  verifyPolicy(policyId: PolicyId!): VerificationResult!
  verifyReplay(replayId: ID!): VerificationResult!

  # Governance
  grantAuthority(input: GrantAuthorityInput!): AuthorityGrant!
  revokeAuthority(authorityId: AuthorityId!, trigger: RevocationTriggerInput!, evidence: EvidenceId!): RevocationResult!
  delegateAuthority(input: DelegateAuthorityInput!): AuthorityGrant!
  compilePolicy(source: String!, metadata: ConstitutionalMetadataInput!): CompiledPolicy!
  deployPolicy(policyId: PolicyId!): DeploymentResult!

  # Agent
  spawnAgent(input: SpawnAgentInput!): Agent!
  agentAction(agentId: ID!, input: AgentActionParams!): AgentActionResult!
  terminateAgent(agentId: ID!, reason: String!): TerminationResult!

  # Decision
  decide(input: DecideParams!): DecisionResult!
  replay(input: ReplayParams!): ReplayResult!
}

# Mutation Input Types
input ImagingTaskInput {
  target: TargetInput!
  parameters: ImagingParametersInput!
  authorityRef: AuthorityId!
  evidenceRequirement: EvidenceLevel!
}

input NavigationPlanInput {
  routeId: ID!
  startTime: DateTime!
}

input SpaceEntityInput {
  entityRef: ID!
  type: EntityType!
  properties: JSON!
}

input SpaceRelationshipInput {
  relationshipRef: ID!
  type: RelationshipType!
  source: ID!
  target: ID!
}

input EvidenceRecordInput {
  evidenceId: EvidenceId!
  level: EvidenceLevel!
  timestamp: DateTime!
  source: String!
  payload: JSON!
  payloadHash: Hash!
  previousEvidenceHash: Hash
  chainHash: Hash!
  signature: Signature!
}

input SimulationConfigInput {
  simulationId: ID
  scenario: ScenarioInput!
  authorityBasis: String!
  policyId: PolicyId!
  initialState: JSON!
  checkpointInterval: Int
}

input GrantAuthorityInput {
  holder: String!
  scope: [CapabilityInput!]!
  constraints: ConstraintsInput!
  delegationPermitted: Boolean!
  revocationTriggers: [RevocationTriggerInput!]!
  evidenceRequirement: EvidenceLevel!
  constitutionalBasis: String!
  expiresAt: DateTime
}

input RevocationTriggerInput {
  type: RevocationTriggerType!
  parameters: JSON!
}

input DelegateAuthorityInput {
  parentAuthorityId: AuthorityId!
  delegatee: String!
  scope: [CapabilityInput!]!
  constraints: ConstraintsInput!
}

input ConstitutionalMetadataInput {
  authority: AuthorityId!
  evidenceLevel: EvidenceLevel!
  replayRequired: Boolean!
  verificationRequired: Boolean!
  constitutionalVersion: String!
  accVersion: String!
  csdVersion: String!
  cecdVersion: String!
  ecedVersion: String!
}

input DecideParams {
  authorityId: AuthorityId!
  policyId: PolicyId!
  kernelAuthzId: AuthorizationId!
  inputEvidence: [EvidenceId!]!
  context: DecisionContextInput!
  decisionType: String!
}

input DecisionContextInput {
  actor: String!
  request: JSON!
  environment: JSON!
  constraints: ConstraintsInput!
}

input ReplayParams {
  decisionId: DecisionId!
  policyWasmHash: Hash!
  inputEvidenceHashes: [Hash!]!
  runtimeVersion: String!
  deterministicSeed: String
}

input AgentActionParams {
  agentId: ID!
  action: { resource: String!; action: String!; parameters: JSON }!
  inputEvidence: [EvidenceId!]!
}

# ============================================================================
# Subscriptions
# ============================================================================

type Subscription {
  # Observation
  imageryCompleted(filter: ImageryFilter): ImageryRecord!
  
  # Mission
  missionStatusChanged(missionId: ID): Mission!
  missionStepCompleted(missionId: ID): MissionActionResult!
  
  # Simulation
  simulationStep(simulationId: ID): StepResult!
  simulationCompleted(simulationId: ID): RunResult!
  simulationEvent(simulationId: ID): SimulationEvent!
  
  # Evidence
  evidenceWritten(level: EvidenceLevel): EvidenceRecord!
  chainVerified(source: String, level: EvidenceLevel): ChainVerificationResult!
  chainBroken(source: String, level: EvidenceLevel): ChainVerificationResult!
  
  # Governance
  authorityGranted: AuthorityGrant!
  authorityRevoked: RevocationResult!
  policyDeployed: DeploymentResult!
  auditEmitted: AuditRecord!
  
  # Agent
  agentSpawned: Agent!
  agentAction(agentId: ID): AgentActionResult!
  agentTerminated: TerminationResult!
  
  # Decision
  decisionMade: DecisionResult!
  decisionReplayed: ReplayResult!
  decisionVerified: VerificationResult!
}

type ChainVerificationResult {
  ok: Boolean!
  entriesVerified: Int!
  brokenAt: Int
  expected: Hash
  actual: Hash
}

type ReplayResult {
  originalOutcome: DecisionOutcome!
  replayOutcome: DecisionOutcome
  match: Boolean!
  divergenceDetails: DivergenceDetails
  evidenceRef: EvidenceId!
}

type DivergenceDetails {
  point: String!
  originalHash: Hash!
  replayHash: Hash!
}

# ============================================================================
# Additional Types for Mutations
# ============================================================================

type CompiledPolicy {
  policyId: PolicyId!
  wasmHash: Hash!
  metadata: ConstitutionalMetadata!
  verificationProof: VerificationProof!
  compiledAt: DateTime!
}

type VerificationProof {
  proofType: String!
  formalVerification: FormalVerificationResult
  conformanceTests: [ConformanceTestResult!]!
  verifiedAt: DateTime!
  verifiedBy: String!
}

type FormalVerificationResult {
  prover: String!
  version: String!
  propertiesVerified: [String!]!
  proofArtifactHash: Hash!
  result: String!
}

type ConformanceTestResult {
  testId: String!
  name: String!
  result: String!
  durationMs: Float!
}

type DeploymentResult {
  deployed: Boolean!
  policyId: PolicyId!
  deploymentId: String!
  evidenceRef: EvidenceId!
}

type RevocationResult {
  revoked: Boolean!
  authorityId: AuthorityId!
  trigger: RevocationTrigger!
  cascadedDelegations: [AuthorityId!]!
  evidenceRef: EvidenceId!
  timestamp: DateTime!
}

type DecisionResult {
  decisionId: DecisionId!
  outcome: DecisionOutcome!
  evidenceRef: EvidenceId!
  evaluation: PolicyEvaluation!
  obligations: [Obligation!]!
  timestamp: DateTime!
  durationMs: Float!
}
`;