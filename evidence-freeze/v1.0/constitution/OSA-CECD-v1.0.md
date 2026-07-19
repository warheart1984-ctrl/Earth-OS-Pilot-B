# Constitutional Evidence & Consequence Document (CECD)

**System:** OuterSpace AI (OSA)  
**Version:** 1.0  
**Status:** Ratified — Constitutional Evidence Framework  
**Authority:** OSA Constitution Articles 4, 5  
**Reference:** OSA-Constitution-v1.0.md, OSA-ACC-v1.0.md, OSA-CSD-v1.0.md

---

## Purpose

Defines the complete evidence framework for OSA: evidence levels, production requirements, consequence protocols, and the constitutional evidence lifecycle. This is the operational contract for evidence in the constitutional system.

---

## 1. Evidence Level Definitions (Normative)

### 1.1 E₀ — Raw Observation Evidence

**Definition:** Direct sensor output, telemetry, or raw data capture with no processing.

**Production Trigger:** Any sensor, telemetry stream, or raw data ingestion event.

**Required Fields:**
```json
{
  "evidence_id": "E0-OSA-TEL-20260719-0001",
  "level": "E0",
  "timestamp": "2026-07-19T12:00:00.000Z",
  "source": "sensor:sat-123:gps",
  "sensor_type": "GPS",
  "payload": { "lat": 45.123, "lon": -122.456, "alt": 408000, "velocity": 7660 },
  "payload_hash": "sha3-256:a1b2c3d4...",
  "sensor_metadata": { "satellite_id": "SAT-123", "instrument": "GPS-Receiver", "mode": "precise" },
  "chain_hash": "sha3-256:prev_hash...",
  "signature": "sig:sensor-gateway:..."
}
```

**Constitutional Requirements:**
- Produced at ingestion point (sensor gateway)
- Immutable once written
- Cryptographically signed by sensor gateway
- Chain-linked to previous E₀ from same source
- Retention: Perpetual (constitutional archive)

---

### 1.2 E₁ — Processed Observation Evidence

**Definition:** Transformed, calibrated, or derived data from E₀ with full transform provenance.

**Production Trigger:** Any data processing pipeline stage (calibration, fusion, feature extraction, cataloging).

**Required Fields:**
```json
{
  "evidence_id": "E1-OSA-ORB-20260719-0001",
  "level": "E1",
  "timestamp": "2026-07-19T12:00:05.000Z",
  "source": "processor:orbital-determinator:v2.1",
  "transform": {
    "type": "orbit_determination",
    "algorithm": "batch_least_squares",
    "version": "2.1.0",
    "parameters": { "gravity_model": "EGM2008", "drag_model": "NRLMSISE-00" }
  },
  "input_evidence_refs": ["E0-OSA-TEL-20260719-0001", "E0-OSA-TEL-20260719-0002", "E0-OSA-TEL-20260719-0003"],
  "payload": { "orbital_elements": { "sma": 6778.137, "ecc": 0.000123, "inc": 51.6416, ... }, "covariance": [...] },
  "payload_hash": "sha3-256:b2c3d4e5...",
  "previous_evidence_hash": "sha3-256:prev_hash...",
  "chain_hash": "sha3-256:chain_hash...",
  "signature": "sig:processor:orbital-determinator:..."
}
```

**Constitutional Requirements:**
- Every input E₀ referenced by evidence_id
- Transform fully specified (algorithm, version, parameters)
- Processor cryptographically signs output
- Chain-linked to previous E₁ from same processor
- Retention: Perpetual

---

### 1.3 E₂ — Governed Decision Evidence (Minimum for Authority Exercise)

**Definition:** Evidence of a decision made under constitutional authority, bound to policy and authority grant.

**Production Trigger:** Every exercise of constitutional authority (ACC Section 2.2).

**Required Fields:**
```json
{
  "evidence_id": "E2-OSA-ORB-20260719-0001",
  "level": "E2",
  "timestamp": "2026-07-19T12:00:10.000Z",
  "source": "agent:orbital-awareness-tracker",
  "authority_ref": "auth:osa:orbital-awareness:satellite-tracking",
  "policy_ref": "pol:osa:orbital-tracking:v1.2",
  "policy_version_hash": "sha3-256:policy_hash...",
  "kernel_authorization_ref": "authz:gk:20260719-0001",
  "input_evidence_refs": ["E1-OSA-ORB-20260719-0001", "E1-OSA-ORB-20260719-0002"],
  "decision": {
    "type": "conjunction_assessment",
    "primary": "SAT-123",
    "secondary": "SAT-456",
    "tca": "2026-07-19T18:30:00Z",
    "miss_distance_km": 1.2,
    "collision_probability": 0.023,
    "action": "alert_issued",
    "alert_level": "YELLOW"
  },
  "decision_hash": "sha3-256:c3d4e5f6...",
  "previous_evidence_hash": "sha3-256:prev_hash...",
  "chain_hash": "sha3-256:chain_hash...",
  "signature": "sig:governance-kernel:..."
}
```

**Constitutional Requirements (MANDATORY):**
- `authority_ref` MUST resolve to valid ACC grant
- `policy_ref` MUST resolve to compiled, verified policy
- `kernel_authorization_ref` MUST reference Governance Kernel authz record
- All input evidence MUST be E₁ or E₂
- Decision MUST be deterministic given inputs + policy
- Governance Kernel MUST sign
- Chain-linked to previous E₂ from same agent
- Retention: Perpetual (constitutional record)

---

### 1.4 E₃ — Audit Evidence

**Definition:** Evidence of audit, review, investigation, or remediation of governed decisions.

**Production Trigger:** Audit Engine emission, investigation initiation, remediation completion.

**Required Fields:**
```json
{
  "evidence_id": "E3-OSA-AUDIT-20260719-0001",
  "level": "E3",
  "timestamp": "2026-07-19T14:30:00.000Z",
  "source": "audit-engine:constitutional-audit-v1.0",
  "auditor": "constitutional-review-council",
  "audit_type": "routine_compliance",
  "subject_evidence_refs": ["E2-OSA-ORB-20260719-0001", "E2-OSA-ORB-20260719-0002"],
  "findings": [
    { "rule": "ACC-CONFORMANCE-2", "status": "COMPLIANT", "details": "E2 evidence produced for all exercises" },
    { "rule": "CSD-T-004", "status": "COMPLIANT", "details": "Decision produces E2 evidence" }
  ],
  "remediation_refs": [],
  "audit_hash": "sha3-256:d4e5f6a7...",
  "previous_evidence_hash": "sha3-256:prev_hash...",
  "chain_hash": "sha3-256:chain_hash...",
  "signature": "sig:audit-engine:..."
}
```

**Constitutional Requirements:**
- References subject evidence (E₂ or E₃)
- Auditor MUST be constitutionally authorized
- Findings reference specific conformance rules
- Remediation references if applicable
- Audit Engine signs
- Retention: Perpetual

---

### 1.5 E₄ — Constitutional Evidence

**Definition:** Evidence of constitutional acts: amendments, treaties, ratifications, stewardship actions.

**Production Trigger:** Constitutional Amendment (Art 9), Treaty Ratification (Art 8), Promotion (Art 11), Stewardship actions.

**Required Fields:**
```json
{
  "evidence_id": "E4-OSA-TREATY-20260719-001",
  "level": "E4",
  "timestamp": "2026-07-19T12:00:00.000Z",
  "source": "ratification-assembly",
  "constitutional_act": "treaty_ratification",
  "act_ref": "treaty:osa:earthos-pilot-b:20260719",
  "authority_basis": "OSA-Constitution-v1.0 Article 8",
  "participants": ["OSA", "EarthOS-Pilot-B"],
  "vote": { "type": "supermajority", "threshold": "2/3", "result": "RATIFIED", "votes": { "yes": 8, "no": 1, "abstain": 1 } },
  "treaty_hash": "sha3-256:treaty_hash...",
  "previous_evidence_hash": "sha3-256:prev_hash...",
  "chain_hash": "sha3-256:chain_hash...",
  "signature": "sig:ratification-assembly:..."
}
```

**Constitutional Requirements:**
- Only produced by constitutionally authorized bodies
- References constitutional article authorizing act
- Vote/decision process fully documented
- Signed by constitutional authority (Steward, Council, Assembly)
- Highest evidence level — governs all lower levels
- Retention: Perpetual (constitutional archive)

---

## 2. Evidence Lifecycle (Normative)

### 2.1 Production

| Level | Producer | Trigger | Verification |
|-------|----------|---------|--------------|
| E₀ | Sensor Gateway | Sensor reading | Gateway signature |
| E₁ | Processor | Transform complete | Processor signature + input refs |
| E₂ | Governance Kernel | Authority exercise | Kernel signature + authority + policy refs |
| E₃ | Audit Engine | Audit complete | Audit Engine signature + findings |
| E₄ | Constitutional Body | Constitutional act | Body signature + constitutional basis |

**All production MUST:**
- Occur atomically with operation
- Write to Evidence Ledger before operation completes
- Include chain_hash linking to previous same-level evidence
- Be cryptographically signed by producer

### 2.2 Storage

**Evidence Ledger (OSA-EL-v1.0.md) requirements:**
- Append-only, immutable
- Partitioned by evidence level
- Indexed by: evidence_id, source, timestamp, chain_hash, subject_refs
- Cryptographic integrity verification on read
- Replay checkpoint capability

### 2.3 Retrieval

**Query Patterns (ALL SUPPORTED):**
- By evidence_id (exact)
- By source + time range
- By chain_hash (integrity verification)
- By subject_refs (lineage traversal)
- By level + time range (audit sweeps)

### 2.4 Verification

**Verification Levels:**
- **V1:** Signature verification (producer key)
- **V2:** Chain integrity (hash chain unbroken)
- **V3:** Input reference validity (all refs exist)
- **V4:** Constitutional compliance (authority, policy, kernel authz)
- **V5:** Replay verification (decision reproduces)

**Verification Engine (OSA-VE-v1.0.md) MUST support all levels.**

---

## 3. Consequence Protocols (Normative)

### 3.1 Violation Detection

**Triggers (AUTOMATIC):**
- Governance Kernel authorization failure
- Evidence Ledger write failure
- Chain integrity verification failure
- Policy compilation verification failure
- Replay non-determinism detected
- Verification Engine failure
- ACC revocation trigger activation
- Audit finding: NON_COMPLIANT

### 3.2 Consequence Execution (Automatic, Kernel-Enforced)

| Violation | Immediate Action | Evidence | Escalation |
|-----------|------------------|----------|------------|
| Auth failure | Operation denied, audit emitted | E₃ | Constitutional Review Council |
| Evidence failure | Operation rolled back, quarantine | E₃ | Evidence Stewardship Board |
| Chain break | Read-only mode, investigation | E₃, E₄ | Constitutional Emergency |
| Replay failure | Component suspended, audit | E₃ | Promotion Authority |
| Verification failure | Component suspended, audit | E₃ | Constitutional Review Council |
| ACC revocation | Authority revoked, cascade | E₃ | Ratification Assembly (if systemic) |
| Audit non-compliance | Remediation mandated, deadline | E₃ | Constitutional Review Council |

### 3.3 Consequence Evidence

**All consequences produce E₃ minimum:**
```json
{
  "evidence_id": "E3-OSA-CONSEQ-20260719-001",
  "level": "E3",
  "timestamp": "2026-07-19T14:32:11.000Z",
  "source": "governance-kernel",
  "consequence_type": "authority_revocation",
  "trigger": "ACC_REVOCATION_TRIGGER:classification_breach",
  "subject_authority": "auth:osa:orbital-awareness:satellite-tracking",
  "subject_holder": "agent:orbital-awareness-tracker",
  "actions_taken": ["revoke_authority", "cascade_delegations", "quarantine_evidence", "emit_audit"],
  "evidence_refs": ["E2-OSA-ORB-20260719-045", "E2-OSA-ORB-20260719-046"],
  "remediation_required": true,
  "remediation_deadline": "2026-07-26T14:32:11.000Z",
  "audit_ref": "audit:gk:20260719-001",
  "audit_hash": "sha3-256:...",
  "chain_hash": "sha3-256:...",
  "signature": "sig:governance-kernel:..."
}
```

---

## 4. Evidence Production Requirements by Layer

| Layer | Component | Minimum Evidence | Production Point |
|-------|-----------|------------------|------------------|
| 2 | Orbital Awareness | E₁ | Every output |
| 2 | Observation Intelligence | E₁ | Every product |
| 2 | Navigation Intelligence | E₂ | Every routed decision |
| 2 | Scientific Intelligence | E₁ | Every product |
| 2 | Knowledge Graph | E₁ | Every upsert |
| 3 | Governance Kernel | E₂ (authz), E₃ (audit) | Every authz, every audit |
| 3 | Policy Engine | E₂ | Every compilation |
| 3 | Decision Engine | E₂ | Every decision |
| 3 | Mission Orchestrator | E₂ | Every mission action |
| 3 | Agent Runtime | E₂ | Every agent action |
| 3 | Simulation Runtime | E₂ | Every simulation step |
| 3 | Replay Engine | E₂ | Every replay |
| 3 | Verification Engine | E₃ | Every verification |
| 3 | Evidence Ledger | E₀–E₄ | Every write |
| 3 | Audit Engine | E₃ | Every audit |
| 4 | All APIs | E₁+ (responses), E₂ (mutations) | Every request |
| 5 | All Stores | E₀–E₄ (per record level) | Every write |
| 6 | EarthOS Integration | E₂ | Every cross-domain call |
| 8 | All SDKs | E₂ | Every governed operation |

---

## 5. Federation Evidence Exchange (FEEP)

**Protocol:** OSA-FEEP-v1.0.md (referenced)

**Requirements:**
- Evidence exchanged at E₂+ level
- Chain integrity preserved across domains
- Cryptographic verification on receipt
- Local Evidence Ledger records import as E₂
- Cross-cluster lineage maintained via `federation_chain_ref`

---

## 6. Conformance Requirements

**CECD-CONFORMANCE-1:** All E₀ production at sensor gateway  
**CECD-CONFORMANCE-2:** All transforms produce E₁ with full input refs  
**CECD-CONFORMANCE-3:** All authority exercises produce E₂ with authority+policy+kernel refs  
**CECD-CONFORMANCE-4:** All audits produce E₃ with findings + subject refs  
**CECD-CONFORMANCE-5:** All constitutional acts produce E₄  
**CECD-CONFORMANCE-6:** Chain integrity verified on every read  
**CECD-CONFORMANCE-7:** Consequence protocols automatic, produce E₃+  
**CECD-CONFORMANCE-8:** Federation exchange preserves evidence level + chain  

---

## 7. Normative References

| Ref | Document |
|-----|----------|
| [CONST] | OSA-Constitution-v1.0.md |
| [ACC] | OSA-ACC-v1.0.md |
| [CSD] | OSA-CSD-v1.0.md |
| [ECED] | OSA-ECED-v1.0.md |
| [EL] | OSA-EL-v1.0.md |
| [VE] | OSA-VE-v1.0.md |
| [AE] | OSA-AE-v1.0.md |
| [FEEP] | OSA-FEEP-v1.0.md |

---

## Ratification

**Ratified by:** Constitutional Engineering Constitution Authority  
**Date:** 2026-07-19  
**Evidence ID:** E4-OSA-CECD-20260719-001  
**Hash:** `sha3-256:pending-ratification-evidence`  
**Constitutional Basis:** OSA-Constitution-v1.0 Articles 4, 5

---

*This document defines the constitutional evidence framework. All OSA systems MUST produce, store, verify, and exchange evidence per this specification.*