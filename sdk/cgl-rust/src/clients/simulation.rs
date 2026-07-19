// Simulation Runtime Client
// Normative: OSA-CGL-v1.0.md

use reqwest::Client;
use serde::{Deserialize, Serialize};
use crate::types::*;

#[derive(Clone)]
pub struct SimulationRuntimeClient {
    client: Client,
    endpoint: String,
    auth_token: Option<String>,
}

impl SimulationRuntimeClient {
    pub fn new(endpoint: &str) -> Self {
        Self {
            client: Client::new(),
            endpoint: endpoint.trim_end_matches('/').to_string(),
            auth_token: None,
        }
    }

    pub fn with_auth(mut self, token: String) -> Self {
        self.auth_token = Some(token);
        self
    }

    async fn request<T: for<'de> Deserialize<'de>>(&self, path: &str, body: Option<&impl Serialize>) -> Result<T, reqwest::Error> {
        let url = format!("{}{}", self.endpoint, path);
        let mut req = reqwest::Client::new().post(&url).json(body.unwrap_or(&serde_json::json!({})));
        
        if let Some(token) = &self.auth_token {
            req = req.header("Authorization", format!("Bearer {}", token));
        }
        req = req.header("Content-Type", "application/json");
        req = req.header("X-OSA-Request-ID", Uuid::new_v4().to_string());
        req = req.header("X-OSA-Timestamp", Utc::now().to_rfc3339());

        let response = req.send().await?;
        if !response.status().is_success() {
            return Err(response.error_for_status().unwrap_err());
        }
        response.json().await
    }

    pub async fn create_simulation(&self, config: SimulationConfig) -> Result<Simulation, reqwest::Error> {
        self.request("/api/v1/simulation", Some(&config)).await
    }

    pub async fn run_simulation(&self, simulation_id: &SimulationId) -> Result<RunResult, reqwest::Error> {
        self.request(&format!("/api/v1/simulation/{}/run", simulation_id.0), None).await
    }

    pub async fn pause_simulation(&self, simulation_id: &SimulationId) -> Result<(), reqwest::Error> {
        self.request(&format!("/api/v1/simulation/{}/pause", simulation_id.0), None).await
    }

    pub async fn resume_simulation(&self, simulation_id: &SimulationId) -> Result<(), reqwest::Error> {
        self.request(&format!("/api/v1/simulation/{}/resume", simulation_id.0), None).await
    }

    pub async fn abort_simulation(&self, simulation_id: &SimulationId, reason: String) -> Result<(), reqwest::Error> {
        self.request(&format!("/api/v1/simulation/{}/abort", simulation_id.0), Some(&serde_json::json!({ "reason": reason }))).await
    }

    pub async fn replay_simulation(&self, params: ReplayParams) -> Result<ReplayResult, reqwest::Error> {
        self.request("/api/v1/simulation/replay", Some(&params)).await
    }

    pub async fn get_simulation(&self, simulation_id: &SimulationId) -> Result<Option<Simulation>, reqwest::Error> {
        self.request(&format!("/api/v1/simulation/{}", simulation_id.0), None).await
    }

    pub async fn list_simulations(&self) -> Result<Vec<Simulation>, reqwest::Error> {
        self.request("/api/v1/simulation", None).await
    }

    pub async fn get_simulations_by_status(&self, status: SimulationStatus) -> Result<Vec<Simulation>, reqwest::Error> {
        self.request(&format!("/api/v1/simulation?status={}", status), None).await
    }
}

#[derive(Debug, Serialize)]
pub struct SimulationConfig {
    pub simulation_id: Option<SimulationId>,
    pub scenario: Scenario,
    pub authority_basis: String,
    pub policy_id: PolicyId,
    pub initial_state: SimulationState,
    pub checkpoint_interval: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Scenario {
    pub scenario_id: String,
    pub name: String,
    pub description: String,
    pub time_horizon: TimeHorizon,
    pub environment: EnvironmentModel,
    pub actors: Vec<ActorModel>,
    pub physics: Option<PhysicsModel>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TimeHorizon {
    pub start: Timestamp,
    pub end: Timestamp,
    pub step_ms: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EnvironmentModel {
    #[serde(rename = "type")]
    pub env_type: EnvironmentType,
    pub parameters: serde_json::Value,
    pub initial_conditions: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum EnvironmentType {
    Orbital,
    Atmospheric,
    Terrestrial,
    Planetary,
    Custom,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ActorModel {
    pub actor_id: String,
    #[serde(rename = "type")]
    pub actor_type: ActorType,
    pub initial_state: serde_json::Value,
    pub behavior: BehaviorModel,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ActorType {
    Satellite,
    GroundStation,
    Debris,
    CelestialBody,
    Custom,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BehaviorModel {
    #[serde(rename = "type")]
    pub behavior_type: BehaviorType,
    pub parameters: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum BehaviorType {
    Keplerian,
    Propagated,
    Controlled,
    Scripted,
    Custom,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PhysicsModel {
    pub gravity_model: GravityModel,
    pub atmosphere_model: AtmosphereModel,
    pub solar_radiation_pressure: bool,
    pub third_body_effects: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum GravityModel {
    TwoBody,
    J2,
    J4,
    Egm2008,
    Custom,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AtmosphereModel {
    Exponential,
    Nrlmsise,
    Custom,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SimulationState {
    pub current_time: Timestamp,
    pub step: u64,
    pub actors: std::collections::HashMap<String, ActorState>,
    pub environment: EnvironmentState,
    pub events: Vec<SimulationEvent>,
    pub metrics: SimulationMetrics,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ActorState {
    pub actor_id: String,
    pub position: Vector3,
    pub velocity: Vector3,
    pub attitude: Quaternion,
    pub angular_velocity: Vector3,
    pub mass: f64,
    pub custom: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EnvironmentState {
    pub time: Timestamp,
    pub solar_activity: SolarActivity,
    pub atmospheric_density: serde_json::Value,
    pub gravitational_field: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SolarActivity {
    pub f107: f64,
    pub f107a: f64,
    pub ap: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SimulationEvent {
    pub event_id: String,
    pub timestamp: Timestamp,
    #[serde(rename = "type")]
    pub event_type: String,
    pub actor_id: Option<String>,
    pub data: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SimulationMetrics {
    pub steps_executed: u64,
    pub checkpoints_created: u64,
    pub events_generated: u64,
    pub evidence_produced: u64,
    pub duration_ms: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Simulation {
    pub simulation_id: SimulationId,
    pub config: SimulationConfig,
    pub authority_grant: AuthorityGrant,
    pub state: SimulationState,
    pub status: SimulationStatus,
    pub checkpoints: Vec<Checkpoint>,
    pub evidence_refs: Vec<EvidenceId>,
    pub created_at: Timestamp,
    pub started_at: Option<Timestamp>,
    pub completed_at: Option<Timestamp>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SimulationStatus {
    Created,
    Initializing,
    Running,
    Paused,
    Completed,
    Failed,
    Aborted,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Checkpoint {
    pub global_sequence: u64,
    pub timestamp: Timestamp,
    pub level_checkpoints: std::collections::HashMap<String, LevelCheckpoint>,
    pub merkle_root: Hash,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LevelCheckpoint {
    pub last_sequence: u64,
    pub last_chain_hash: Hash,
    pub entry_count: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StepResult {
    pub step: u64,
    pub success: bool,
    pub new_state: SimulationState,
    pub events: Vec<SimulationEvent>,
    pub evidence_ref: EvidenceId,
    pub duration_ms: u64,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RunResult {
    pub simulation_id: SimulationId,
    pub success: bool,
    pub final_state: SimulationState,
    pub total_steps: u64,
    pub total_duration_ms: u64,
    pub evidence_refs: Vec<EvidenceId>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ReplayParams {
    pub simulation_id: SimulationId,
    pub from_checkpoint: Option<u32>,
    pub policy_wasm_hash: Option<Hash>,
    pub input_evidence_hashes: Option<Vec<Hash>>,
    pub runtime_version: Option<String>,
    pub deterministic_seed: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReplayResult {
    pub original_outcome: serde_json::Value,
    pub replay_outcome: Option<serde_json::Value>,
    pub match_result: bool,
    pub divergence_details: Option<DivergenceDetails>,
    pub evidence_ref: EvidenceId,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DivergenceDetails {
    pub point: String,
    pub original_hash: Hash,
    pub replay_hash: Hash,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SimulationStatus {
    Created,
    Initializing,
    Running,
    Paused,
    Completed,
    Failed,
    Aborted,
}