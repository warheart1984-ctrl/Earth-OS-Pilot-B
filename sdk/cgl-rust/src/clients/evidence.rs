// Evidence Ledger Client
// Normative: OSA-CGL-v1.0.md

use crate::types::*;
use reqwest::Client;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum EvidenceError {
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

pub type EvidenceResult<T> = Result<T, EvidenceError>;

#[derive(Clone)]
pub struct EvidenceLedgerClient {
    client: Client,
    base_url: String,
    auth_token: Option<String>,
}

impl EvidenceLedgerClient {
    pub fn new(base_url: impl Into<String>) -> Self {
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(60))
                .build()
                .expect("Failed to create HTTP client"),
            base_url: base_url.into(),
            auth_token: None,
        }
    }

    pub fn with_auth_token(mut self, token: String) -> Self {
        self.auth_token = Some(token);
        self
    }

    async fn request<T: for<'de> Deserialize<'de>>(&self, path: &str, body: Option<serde_json::Value>) -> EvidenceResult<T> {
        let url = format!("{}{}", self.base_url, path);
        let mut req = reqwest::Client::new().post(&url);

        if let Some(token) = &self.auth_token {
            req = req.header("Authorization", format!("Bearer {}", token));
        }

        let mut req = req.header("X-OSA-Request-ID", Uuid::new_v4().to_string())
                         .header("X-OSA-Timestamp", Timestamp::now().0.to_rfc3339())
                         .header("Content-Type", "application/json");

        if let Some(body) = body {
            req = req.json(&body);
        }

        let response = req.send().await?;
        
        if !response.status().is_success() {
            return Err(EvidenceError::Http(reqwest::Error::from(response.status())));
        }

        Ok(response.json().await?)
    }

    // Write Operations
    pub async fn append(&self, entry: EvidenceLedgerEntry) -> EvidenceResult<AppendResult> {
        self.request("/api/v1/evidence", Some(serde_json::to_value(entry)?)).await
    }

    pub async fn append_batch(&self, entries: Vec<EvidenceLedgerEntry>) -> EvidenceResult<Vec<AppendResult>> {
        let mut results = Vec::new();
        for entry in entries {
            results.push(self.append(entry).await?);
        }
        Ok(results)
    }

    // Read Operations
    pub async fn get(&self, evidence_id: EvidenceId) -> EvidenceResult<Option<LedgerEntry>> {
        let url = format!("{}/api/v1/evidence/{}", self.base_url, evidence_id.0);
        let response = reqwest::Client::new().get(&url).send().await?;
        
        if response.status() == 404 {
            return Ok(None);
        }
        Ok(Some(response.json().await?))
    }

    pub async fn query(&self, params: QueryParams) -> EvidenceResult<Vec<LedgerEntry>> {
        let mut query = Vec::new();
        if let Some(level) = params.level { query.push(("level", level.to_string())); }
        if let Some(source) = params.source { query.push(("source", source)); }
        if let Some(start) = params.start_time { query.push(("start_time", start.0.to_rfc3339())); }
        if let Some(end) = params.end_time { query.push(("end_time", end.0.to_rfc3339())); }
        if let Some(limit) = params.limit { query.push(("limit", limit.to_string())); }
        if let Some(offset) = params.offset { query.push(("offset", offset.to_string())); }

        let url = format!("{}/api/v1/evidence?{}", self.base_url, 
            query.into_iter().map(|(k, v)| format!("{}={}", k, v)).collect::<Vec<_>>().join("&"));
        
        Ok(reqwest::Client::new().get(&url).send().await?.json().await?)
    }

    // Integrity
    pub async fn verify_chain(&self, params: VerifyChainParams) -> EvidenceResult<ChainVerificationResult> {
        self.request("/api/v1/evidence/verify", Some(serde_json::to_value(params)?)).await
    }

    pub async fn get_checkpoint(&self, params: CheckpointParams) -> EvidenceResult<Option<Checkpoint>> {
        let mut query = Vec::new();
        if let Some(seq) = params.at_sequence {
            query.push(("atSequence", seq.to_string()));
        }
        let url = format!("{}/api/v1/evidence/checkpoint?{}", self.base_url, 
            query.into_iter().map(|(k, v)| format!("{}={}", k, v)).collect::<Vec<_>>().join("&"));
        
        let response = reqwest::Client::new().get(&url).send().await?;
        if response.status() == 404 {
            return Ok(None);
        }
        Ok(Some(response.json().await?))
    }

    pub async fn replay_from(&self, checkpoint: Checkpoint) -> EvidenceResult<Vec<LedgerEntry>> {
        let url = format!("{}/api/v1/evidence/replay?from={}", self.base_url, checkpoint.global_sequence);
        Ok(reqwest::Client::new().get(&url).send().await?.json().await?)
    }

    // Federation
    pub async fn import_evidence(&self, evidence: EvidenceRecord, federation_ref: String) -> EvidenceResult<ImportResult> {
        let mut body = serde_json::to_value(evidence)?;
        body["federationRef"] = serde_json::Value::String(federation_ref);
        self.request("/api/v1/evidence/import", Some(body)).await
    }

    pub async fn export_evidence(&self, evidence_ids: Vec<EvidenceId>) -> EvidenceResult<ExportPackage> {
        self.request("/api/v1/evidence/export", Some(serde_json::json!({ "evidenceIds": evidence_ids }))).await
    }
}

// Re-export types
pub use crate::types::{
    EvidenceRecord, LedgerEntry, ChainVerificationResult, Checkpoint, LevelCheckpoint, AppendResult,
 QueryParams, VerifyChainParams, CheckpointParams, ExportPackage, ChainProof, ImportResult,
 VerifyChainParams, CheckpointParams as _,
};