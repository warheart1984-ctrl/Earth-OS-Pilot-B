// Main CGL Library Entry Point
// Normative: OSA-CGL-v1.0.md

// Core Types
pub mod types {
    pub mod mod {
        pub use super::*;
    }
}

// Clients
pub mod clients {
    pub mod kernel;
    pub mod evidence;
    pub mod decision;
    pub mod policy;
    pub mod agent;
    pub mod mission;
    pub mod simulation;
    pub mod federation;
}

// Patterns
pub mod patterns {
    pub mod governed_operation;
    pub mod federated_authority;
    pub mod mission_governance;
}

// Re-export commonly used types
pub use types::mod::*;
pub use clients::kernel::KernelClient;
pub use clients::evidence::EvidenceLedgerClient;
pub use clients::decision::DecisionEngineClient;
pub use clients::policy::PolicyEngineClient;
pub use clients::agent::AgentRuntimeClient;
pub use clients::mission::MissionOrchestratorClient;
pub use clients::simulation::SimulationRuntimeClient;
pub use clients::federation::FederationGatewayClient;

// Convenience functions
use types::*;
use crate::types::*;

/// Create a new OSA client configuration
pub struct OSAClientConfig {
    pub kernel_endpoint: String,
    pub ledger_endpoint: String,
    pub decision_endpoint: String,
    pub policy_endpoint: Option<String>,
    pub agent_endpoint: Option<String>,
    pub mission_endpoint: Option<String>,
    pub simulation_endpoint: Option<String>,
    pub federation_endpoint: Option<String>,
    pub auth_token: Option<String>,
}

/// Create a new OSA client from configuration
pub async fn create_osa_client(config: OSAClientConfig) -> Result<OSAClient, Box<dyn std::error::Error>> {
    let kernel = KernelClient::new(&config.kernel_endpoint);
    let ledger = EvidenceLedgerClient::new(&config.ledger_endpoint);
    let decision = DecisionEngineClient::new(&config.decision_endpoint);
    
    let policy = config.policy_endpoint.map(PolicyEngineClient::new);
    let agent = config.agent_endpoint.map(AgentRuntimeClient::new);
    let mission = config.mission_endpoint.map(MissionOrchestratorClient::new);
    let simulation = config.simulation_endpoint.map(SimulationRuntimeClient::new);
    let federation = config.federation_endpoint.map(FederationGatewayClient::new);
    
    Ok(OSAClient {
        kernel,
        ledger,
        decision,
        policy,
        agent,
        mission,
        simulation,
        federation,
    })
}

/// High-level OSA client
pub struct OSAClient {
    pub kernel: KernelClient,
    pub ledger: EvidenceLedgerClient,
    pub decision: DecisionEngineClient,
    pub policy: Option<PolicyEngineClient>,
    pub agent: Option<AgentRuntimeClient>,
    pub mission: Option<MissionOrchestratorClient>,
    pub simulation: Option<SimulationRuntimeClient>,
    pub federation: Option<FederationGatewayClient>,
}

impl OSAClient {
    /// Execute a governed operation (canonical pattern)
    pub async fn governed_operation<T, F, Fut>(&self, params: GovernedOperationParams<T, F>) -> Result<GovernedResult<T>, Box<dyn std::error::Error>> 
    where
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = T>,
    {
        // 1. Request kernel authorization
        let authz = self.kernel.verify_authority(VerifyAuthorityParams {
            authority_id: params.authority_id,
            holder: params.holder,
            action: params.action,
            context: params.context,
        }).await?;
        
        if !authz.authorized {
            return Err(Box::new(GovernedError::AuthorizationDenied { 
                reason: authz.reason.unwrap_or_default(), 
                evidence_ref: authz.evidence_ref 
            }));
        }

        // 2. Execute the operation
        let result = params.operation().await;

        // 3. Produce governed decision evidence
        let decision = self.decision.decide(DecideParams {
            authority_id: params.authority_id,
            policy_id: params.policy_id,
            kernel_authz_id: authz.authorization_id.ok_or("Missing authorization ID")?,
            input_evidence: params.input_evidence,
            context: params.context,
            decision_type: params.decision_type,
        }).await?;

        // 4. Fulfill obligations
        self.fulfill_obligations(&authz.obligations, &decision).await?;

        Ok(GovernedResult {
            result,
            evidence_ref: decision.evidence_ref,
            decision_id: decision.decision_id,
        })
    }

    async fn fulfill_obligations(&self, obligations: &[Obligation], decision: &DecisionResult) -> Result<(), Box<dyn std::error::Error>> {
        for obligation in obligations {
            match obligation.obligation_type {
                ObligationType::EmitAudit => {
                    // Emit audit via kernel
                }
                ObligationType::ScheduleReplay => {
                    // Schedule replay
                }
                ObligationType::ScheduleVerification => {
                    // Schedule verification
                }
                _ => {}
            }
        }
        Ok(())
    }
}

#[derive(Debug)]
pub struct GovernedOperationParams<T, F> {
    pub authority_id: AuthorityId,
    pub policy_id: PolicyId,
    pub holder: EvidenceSource,
    pub action: ActionSpec,
    pub context: DecisionContext,
    pub input_evidence: Vec<EvidenceId>,
    pub decision_type: String,
    pub operation: F,
}

#[derive(Debug)]
pub struct GovernedResult<T> {
    pub result: T,
    pub evidence_ref: EvidenceId,
    pub decision_id: DecisionId,
}

#[derive(Debug, Error)]
pub enum GovernedError {
    #[error("Authorization denied: {reason} (evidence: {evidence_ref:?})")]
    AuthorizationDenied { reason: String, evidence_ref: EvidenceId },
}

/// Create standard evidence source
pub fn create_evidence_source(
    source_type: EvidenceSourceType,
    identifier: String,
    version: Option<String>,
) -> EvidenceSource {
    EvidenceSource::new(source_type, identifier, version)
}

/// Current timestamp
pub fn now() -> Timestamp {
    Timestamp::now()
}

/// Generate random UUID
pub fn random_uuid() -> String {
    Uuid::new_v4().to_string()
}

/// Validate constitutional metadata in policy source
pub fn validate_constitutional_metadata(source: &str) -> Result<ConstitutionalMetadata, Box<dyn std::error::Error>> {
    let meta_match = regex::Regex::new(r#"__constitutional__\s*:=\s*\{([\s\S]*?)\}"#)?;
    if let Some(caps) = meta_match.captures(source) {
        let meta_str = format!("{{{}}}", &caps[1]);
        let metadata: ConstitutionalMetadata = serde_json::from_str(&meta_str)?;
        
        if metadata.evidence_level < EvidenceLevelRequirement::E2 {
            return Err("evidence_level must be E2, E3, or E4 for governed policies".into());
        }
        if !metadata.replay_required {
            return Err("replay_required must be true for governed policies".into());
        }
        if !metadata.verification_required {
            return Err("verification_required must be true for governed policies".into());
        }
        
        Ok(metadata)
    } else {
        Err("Missing __constitutional__ metadata block".into())
    }
}