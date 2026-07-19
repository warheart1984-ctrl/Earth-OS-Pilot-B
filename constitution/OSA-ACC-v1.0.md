# Authority & Consequence Contract (ACC)

**System:** OuterSpace AI (OSA)  
**Version:** 1.0  
**Status:** Ratified — Constitutional Contract  
**Authority:** OSA Constitution Article 4  
**Reference:** OSA-Constitution-v1.0.md Article 4

---

## Purpose

Defines the complete authority model for OSA: how authority is granted, exercised, delegated, revoked, and the consequences of misuse. All authority in OSA traces to this contract and the Constitution.

---

## 1. Authority Model

### 1.1 Authority Sources

| Source | Description | Evidence Required |
|--------|-------------|-------------------|
| **Constitutional** | Direct from Constitution (Articles 1, 4, 6) | E₄ Constitutional Evidence |
| **Delegated** | Granted by constitutional authority holder | E₂ Governed Decision Evidence |
| **Treaty** | Granted via ratified federation treaty | E₄ Treaty Evidence |
| **Policy** | Granted by compiled constitutional policy | E₂ Policy Evidence |

### 1.2 Authority Properties

Every authority grant **MUST** specify:
- `authority_id` — Globally unique identifier
- `source` — One of the above sources
- `holder` — Entity granted authority (agent, process, domain, platform)
- `scope` — Explicit capability set (resource + action pairs)
- `constraints` — Conditions, time limits, context requirements
- `delegation_permitted` — Boolean, default false
- `revocation_trigger` — Conditions for automatic revocation
- `evidence_requirement` — Minimum evidence level (default E₂)
- `issued_at` — Timestamp
- `expires_at` — Timestamp or null

### 1.3 Authority Representation

```json
{
  "authority_id": "auth:osa:orbital-awareness:satellite-tracking",
  "source": "delegated",
  "holder": "agent:orbital-awareness-tracker",
  "scope": [
    {"resource": "satellite:catalog", "action": "read"},
    {"resource": "orbital:ephemeris", "action": "compute"},
    {"resource": "debris:catalog", "action": "query"}
  ],
  "constraints": {
    "time_window": "2026-07-19T00:00:00Z/2026-07-20T00:00:00Z",
    "classification_max": "UNCLASSIFIED",
    "orbital_regimes": ["LEO", "MEO", "GEO"]
  },
  "delegation_permitted": false,
  "revocation_trigger": ["classification_breach", "scope_exceedance", "evidence_failure"],
  "evidence_requirement": "E2",
  "issued_at": "2026-07-19T12:00:00Z",
  "expires_at": "2026-07-20T00:00:00Z",
  "signature": "sig:constitutional-kernel:...",
  "evidence_ref": "E2-OSA-ORB-20260719-001"
}
```

---

## 2. Authority Lifecycle

### 2.1 Granting

**Process:**
1. Requestor submits authority request with justification
2. Constitutional authority holder evaluates against Constitution + Policy
3. Policy Engine compiles policy → authority grant
4. Governance Kernel verifies constitutional compliance
5. Evidence Ledger records E₂ grant evidence
6. Authority becomes active

**Requirements:**
- All grants route through Governance Kernel
- Policy Engine compilation mandatory
- Evidence Ledger entry mandatory
- Replay Engine checkpoint mandatory

### 2.2 Exercise

**Process:**
1. Holder invokes authority via authenticated call
2. Governance Kernel verifies:
   - Authority exists and is valid
   - Holder matches
   - Scope covers requested action
   - Constraints satisfied
   - Evidence requirement met
3. Kernel authorizes or denies
4. Operation executes
5. Evidence Ledger records E₂ exercise evidence
6. Audit Engine emits audit record

**Requirements:**
- Every exercise produces evidence (minimum E₂)
- Kernel authorization mandatory
- Audit trail mandatory
- Replay checkpoint mandatory

### 2.3 Delegation

**Rules:**
- Only permitted if `delegation_permitted: true`
- Delegation creates new authority grant with:
  - `source: "delegated"`
  - `holder`: new delegatee
  - `scope`: subset of parent scope
  - `constraints`: superset of parent constraints
  - `delegation_chain`: parent chain + new link
- Maximum delegation depth: 3
- All delegations require Kernel verification

### 2.4 Revocation

**Triggers (automatic):**
- `expires_at` reached
- `revocation_trigger` condition met
- Constitutional violation detected
- Holder identity compromised
- Parent authority revoked (cascades)

**Triggers (manual):**
- Constitutional Steward order
- Constitutional Review Council majority
- Ratification Assembly supermajority
- Policy Engine recompilation removing grant

**Process:**
1. Revocation event emitted to Governance Kernel
2. Kernel invalidates authority immediately
3. All delegated authorities cascaded revoked
4. Evidence Ledger records E₃ revocation evidence
4. Audit Engine emits revocation audit
5. Replay Engine checkpoint
6. All active operations using authority terminated

---

## 3. Consequence Model

### 3.1 Violation Classes

| Class | Description | Consequence |
|-------|-------------|-------------|
| **Class I** | Unauthorized authority exercise | Immediate revocation, audit, replay review |
| **Class II** | Scope exceedance | Immediate revocation, evidence quarantine, investigation |
| **Class III** | Evidence fabrication/falsification | Permanent authority ban, constitutional review, potential expulsion |
| **Class IV** | Constitutional subversion attempt | Constitutional emergency protocols, Ratification Assembly referral |
| **Class V** | Federation treaty violation | Federation-wide revocation, treaty arbitration |

### 3.2 Consequence Execution

**All consequences are:**
- Automatic (Kernel-enforced)
- Evidence-based (E₃ minimum)
- Audited (Audit Engine)
- Replayable (Replay Engine)
- Appealed only via Constitutional Review Council

### 3.3 Consequence Records

```json
{
  "consequence_id": "conseq:osa:20260719-001",
  "violation_class": "Class II",
  "authority_id": "auth:osa:...",
  "holder": "agent:...",
  "evidence_refs": ["E3-OSA-VIOL-20260719-001", "E2-OSA-EXER-20260719-045"],
  "actions": ["revoke_authority", "quarantine_evidence", "initiate_investigation"],
  "executed_at": "2026-07-19T14:32:11Z",
  "executed_by": "governance-kernel",
  "appeal_deadline": "2026-07-26T14:32:11Z",
  "signature": "sig:governance-kernel:..."
}
```

---

## 4. Federation Authority

### 4.1 Treaty Authority

Federation treaties (EarthOS Pilot B) grant cross-domain authority:
- Requires ratified treaty (Constitution Article 8)
- Authority scope defined in treaty terms
- Subject to OSA Constitution supremacy
- Revocable by either party per treaty terms

### 4.2 Cross-Domain Authority Propagation

- MLAP (Multi-Layer Authority Protocol) governs propagation
- Each domain maintains sovereignty
- Authority never transcends constitutional boundaries
- Evidence exchange via FEEP (Federation Evidence Exchange Protocol)

---

## 5. Evidence Requirements for Authority

| Operation | Minimum Evidence | Ledger |
|-----------|------------------|--------|
| Grant | E₂ | Evidence Ledger |
| Exercise | E₂ | Evidence Ledger |
| Delegate | E₂ + delegation chain | Evidence Ledger |
| Revoke | E₃ | Evidence Ledger |
| Investigate | E₃ + E₄ | Evidence Ledger + Audit |
| Appeal | E₄ | Constitutional Evidence |

---

## 6. Governance Kernel Integration

**Kernel enforces:**
- All authority grants verified against Constitution + ACC
- All exercises authorized by Kernel
- All revocations immediate and cascading
- All evidence recorded before operation completes
- All operations replayable

**Kernel API (internal):**
```
verifyAuthority(authorityId, holder, action, context) -> AuthorizationResult
recordExercise(authorityId, holder, action, result, evidence) -> EvidenceReceipt
revokeAuthority(authorityId, trigger, evidence) -> RevocationResult
delegateAuthority(parentAuthId, delegatee, scope, constraints) -> AuthorityGrant
```

---

## 7. Conformance Requirements

**ACC-CONFORMANCE-1:** All authority grants conform to Section 1.2 structure  
**ACC-CONFORMANCE-2:** All exercises produce E₂+ evidence  
**ACC-CONFORMANCE-3:** All revocations execute within 100ms of trigger  
**ACC-CONFORMANCE-4:** Delegation depth never exceeds 3  
**ACC-CONFORMANCE-5:** All operations route through Governance Kernel  
**ACC-CONFORMANCE-6:** All consequences are automatic and evidence-based  

---

## 8. Amendment

ACC amendments follow Constitution Article 9 process.  
Entrenched clauses: Sections 1, 2, 3, 6 (require unanimous Ratification Assembly).

---

## Ratification

**Ratified by:** Constitutional Engineering Constitution Authority  
**Date:** 2026-07-19  
**Evidence ID:** E4-OSA-ACC-20260719-001  
**Hash:** `sha3-256:pending-ratification-evidence`  
**Constitutional Basis:** OSA-Constitution-v1.0 Article 4

---

*This contract is binding on all OSA subsystems, agents, federated domains, and derivative platforms.*