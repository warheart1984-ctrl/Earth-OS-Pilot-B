// Federation Gateway Client - FEEP/MLAP Implementation
// Normative: OSA-CGL-v1.0.md §2.2, OSA-Evidence-Specification-v1.0.md §6

use reqwest::Client;
use serde::{Deserialize, Serialize};
use crate::types::*;

#[derive(Clone)]
pub struct FederationGatewayClient {
    client: Client,
    endpoint: String,
    auth_token: Option<String>,
}

impl FederationGatewayClient {
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

    // Evidence Import (FEEP)
    pub async fn import_evidence(&self, params: ImportEvidenceParams) -> Result<ImportResult, reqwest::Error> {
        self.request("/api/v1/federation/evidence/import", Some(&params)).await
    }

    // Evidence Export (FEEP)
    pub async fn export_evidence(&self, params: ExportEvidenceParams) -> Result<ExportPackage, reqwest::Error> {
        self.request("/api/v1/federation/evidence/export", Some(&params)).await
    }

    // Federation Sync
    pub async fn sync_with_peer(&self, params: SyncParams) -> Result<SyncResult, reqwest::Error> {
        self.request("/api/v1/federation/sync", Some(&params)).await
    }

    // Revocation Propagation
    pub async fn propagate_revocation(&self, params: PropagateRevocationParams) -> Result<(), reqwest::Error> {
        let _: serde_json::Value = self.request("/api/v1/federation/revocation/propagate", Some(&params)).await?;
        Ok(())
    }

    // Federated Authority Import (MLAP)
    pub async fn import_federated_authority(&self, params: ImportFederatedAuthorityParams) -> Result<AuthorityGrant, reqwest::Error> {
        self.request("/api/v1/federation/authority/import", Some(&params)).await
    }
}

#[derive(Debug, Serialize)]
pub struct ImportEvidenceParams {
    pub treaty_id: String,
    pub package: ExportPackage,
}

#[derive(Debug, Serialize)]
pub struct ExportEvidenceParams {
    pub evidence_ids: Vec<EvidenceId>,
    pub treaty_id: String,
}

#[derive(Debug, Serialize)]
pub struct SyncParams {
    pub peer: PeerEndpoint,
    pub treaty_id: String,
}

#[derive(Debug, Deserialize)]
pub struct SyncResult {
    pub synced: u32,
    pub conflicts: u32,
    pub evidence_refs: Vec<EvidenceId>,
}

#[derive(Debug, Serialize)]
pub struct PropagateRevocationParams {
    pub authority_id: AuthorityId,
    pub treaty_id: String,
    pub trigger: RevocationTrigger,
}

#[derive(Debug, Serialize)]
pub struct ImportFederatedAuthorityParams {
    pub treaty_id: String,
    pub token: FederatedCALToken,
    pub local_policy_id: PolicyId,
}

#[derive(Debug, Serialize)]
pub struct FederatedCALToken {
    pub token_id: String,
    pub issued_by: String,
    pub issued_to: String,
    pub capabilities: Vec<Capability>,
    pub scope: TokenScope,
    pub delegation_chain: Vec<String>,
    pub federation_origin: String,
    pub federation_treaty_id: String,
    pub federated_signatures: Vec<String>,
    pub issued_at: Timestamp,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TokenScope {
    pub resources: Vec<String>,
    pub time_limit_ms: u64,
    pub intent_version: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PeerEndpoint {
    pub endpoint: String,
    pub gateway_key: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportPackage {
    pub package_id: String,
    pub treaty_id: String,
    pub exported_at: Timestamp,
    pub evidence: Vec<EvidenceRecord>,
    pub causality: Vec<CausalityRecord>,
    pub events: Vec<EventRecord>,
    pub chain_proof: ChainProof,
    pub exporter_signature: Signature,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChainProof {
    pub evidence_id: EvidenceId,
    pub merkle_root: Hash,
    pub merkle_path: Vec<Hash>,
    pub leaf_index: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EvidenceRecord {
    pub evidence_id: EvidenceId,
    pub level: EvidenceLevel,
    pub timestamp: Timestamp,
    pub source: String,
    pub payload: serde_json::Value,
    pub payload_hash: Hash,
    pub previous_evidence_hash: Option<Hash>,
    pub chain_hash: Hash,
    pub signature: Signature,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CausalityRecord {
    pub causality_id: CausalityId,
    pub cause: EvidenceId,
    pub effect: EvidenceId,
    pub relation: CausalityRelation,
    pub strength: CausalityStrength,
    pub timestamp: Timestamp,
    pub established_by: String,
    pub signature: Signature,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CausalityRelation {
    Processes,
    InputsTo,
    DecidesOn,
    Audits,
    Remediates,
    Governs,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CausalityStrength {
    Definitive,
    Probabilistic,
    Contributory,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EventRecord {
    pub event_id: EventId,
    #[serde(rename = "type")]
    pub event_type: String,
    pub timestamp: Timestamp,
    pub source: String,
    pub payload: serde_json::Value,
    pub evidence_produced: Vec<EvidenceId>,
    pub causality_refs: Vec<CausalityId>,
}

#[derive(Debug, Deserialize)]
pub struct ImportResult {
    pub imported: u32,
    pub failed: u32,
    pub evidence_refs: Vec<EvidenceId>,
}