#!/bin/bash
# Independent Replay Demonstration Script
# Evidence ID: E4-OSA-REPLAY-20260719-001

set -euo pipefail

LEDGER_URL="${LEDGER_URL:-http://localhost:8082}"
POLICY_ENGINE_URL="${POLICY_ENGINE_URL:-http://localhost:8083}"
DECISION_ENGINE_URL="${DECISION_ENGINE_URL:-http://localhost:8084}"
OUTPUT_DIR="${OUTPUT_DIR:-./replay/results}"
DECISION_COUNT="${DECISION_COUNT:-1000}"

mkdir -p "$OUTPUT_DIR"

echo "=== OSA Independent Replay Demonstration ==="
echo "Evidence ID: E4-OSA-REPLAY-20260719-001"
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Decision Count: $DECISION_COUNT"
echo ""

# Step 1: Extract original decisions from evidence ledger
echo "Step 1: Extracting original decisions from evidence ledger..."
EXTRACTED_DECISIONS="$OUTPUT_DIR/extracted-decisions.json"

cat > "$OUTPUT_DIR/extract-decisions.py" << 'EOF'
import json
import requests
import sys

LEDGER_URL = "http://localhost:8082"
DECISION_COUNT = 1000

# Query evidence ledger for E2 decisions
params = {
    "level": "E2",
    "limit": DECISION_COUNT
}

response = requests.get(f"{LEDGER_URL}/api/v1/evidence", params=params)
response.raise_for_status()
data = response.json()

decisions = []
for entry in data.get("results", []):
    evidence = entry.get("evidence", {})
    if evidence.get("decision"):
        decisions.append({
            "decision_id": evidence["decision"].get("type", "") + "-" + evidence["evidence_id"],
            "authority_ref": evidence.get("authority_ref"),
            "policy_ref": evidence.get("policy_ref"),
            "policy_version_hash": evidence.get("policy_version_hash"),
            "kernel_authorization_ref": evidence.get("kernel_authorization_ref"),
            "input_evidence_refs": evidence.get("input_evidence_refs", []),
            "decision": evidence["decision"],
            "replay_context": evidence.get("replay_context", {})
        })

with open(sys.argv[1], "w") as f:
    json.dump(decisions, f, indent=2)

print(f"Extracted {len(decisions)} decisions to {sys.argv[1]}")
EOF

python3 "$OUTPUT_DIR/extract-decisions.py" "$EXTRACTED_DECISIONS"

# Step 2: Run independent replay
echo "Step 2: Running independent replay..."
REPLAY_RESULTS="$OUTPUT_DIR/replay-results.json"

cat > "$OUTPUT_DIR/run-replay.py" << 'EOF'
import json
import requests
import sys
import hashlib

DECISION_ENGINE_URL = "http://localhost:8084"

with open(sys.argv[1]) as f:
    decisions = json.load(f)

results = []
matches = 0
divergences = 0

for i, decision in enumerate(decisions):
    if i % 100 == 0:
        print(f"  Replaying decision {i+1}/{len(decisions)}...")
    
    replay_params = {
        "decision_id": decision["decision_id"],
        "policy_wasm_hash": decision["replay_context"].get("policy_wasm_hash", ""),
        "input_evidence_hashes": decision["replay_context"].get("input_evidence_hashes", []),
        "runtime_version": decision["replay_context"].get("runtime_version", "decision-engine-1.0.0"),
        "deterministic_seed": decision["replay_context"].get("deterministic_seed")
    }
    
    try:
        response = requests.post(
            f"{DECISION_ENGINE_URL}/api/v1/decision/replay",
            json=replay_params
        )
        response.raise_for_status()
        replay_result = response.json()
        
        # Compare outcomes bitwise
        original_outcome = json.dumps(decision["decision"]["outcome"], sort_keys=True)
        replay_outcome = json.dumps(replay_result.get("replay_outcome", {}), sort_keys=True)
        
        original_hash = hashlib.sha3_256(original_outcome.encode()).hexdigest()
        replay_hash = hashlib.sha3_256(replay_outcome.encode()).hexdigest()
        
        match = original_hash == replay_hash
        if match:
            matches += 1
        else:
            divergences += 1
        
        results.append({
            "decision_id": decision["decision_id"],
            "match": match,
            "original_hash": original_hash,
            "replay_hash": replay_hash,
            "divergence_details": replay_result.get("divergence_details") if not match else None
        })
        
    except Exception as e:
        results.append({
            "decision_id": decision["decision_id"],
            "match": False,
            "error": str(e)
        })
        divergences += 1

with open(sys.argv[1], "w") as f:
    json.dump({
        "total": len(decisions),
        "matches": matches,
        "divergences": divergences,
        "match_rate": matches / len(decisions) if decisions else 0,
        "results": results
    }, f, indent=2)

print(f"Replay complete: {matches}/{len(decisions)} matches ({matches/len(decisions)*100:.2f}%)")
EOF

python3 "$OUTPUT_DIR/run-replay.py" "$EXTRACTED_DECISIONS" "$REPLAY_RESULTS"

# Step 3: Generate replay evidence
echo "Step 3: Generating replay evidence..."
cat > "$OUTPUT_DIR/generate-replay-evidence.py" << 'EOF'
import json
import hashlib
import sys
from datetime import datetime

with open(sys.argv[1]) as f:
    replay_data = json.load(f)

evidence = {
    "evidence_id": f"E2-OSA-REPLAY-{datetime.utcnow().strftime('%Y%m%d')}-001",
    "level": "E2",
    "timestamp": datetime.utcnow().isoformat() + "Z",
    "source": "replay-engine:osa:v1.0.0",
    "payload": {
        "replay_type": "independent_verification",
        "total_decisions": replay_data["total"],
        "matches": replay_data["matches"],
        "divergences": replay_data["divergences"],
        "match_rate": replay_data["match_rate"],
        "sample_results": replay_data["results"][:10]  # First 10 for brevity
    },
    "payload_hash": "",
    "previous_evidence_hash": "sha3-256:genesis",
    "chain_hash": "",
    "signature": "ed25519:replay-engine-signature"
}

# Compute hashes
payload_str = json.dumps(evidence["payload"], sort_keys=True)
evidence["payload_hash"] = f"sha3-256:{hashlib.sha3_256(payload_str.encode()).hexdigest()}"
chain_str = evidence["payload_hash"] + evidence["previous_evidence_hash"]
evidence["chain_hash"] = f"sha3-256:{hashlib.sha3_256(chain_str.encode()).hexdigest()}"

with open(sys.argv[2], "w") as f:
    json.dump(evidence, f, indent=2)

print(f"Replay evidence generated: {sys.argv[2]}")
print(f"Evidence ID: {evidence['evidence_id']}")
print(f"Match Rate: {replay_data['match_rate']*100:.2f}%")
EOF

REPLAY_EVIDENCE="$OUTPUT_DIR/replay-evidence.json"
python3 "$OUTPUT_DIR/generate-replay-evidence.py" "$REPLAY_RESULTS" "$REPLAY_EVIDENCE"

echo ""
echo "=== Replay Demonstration Complete ==="
echo "Results: $REPLAY_RESULTS"
echo "Evidence: $REPLAY_EVIDENCE"
echo ""

# Display summary
python3 -c "
import json
with open('$REPLAY_RESULTS') as f:
    data = json.load(f)
print(f'Total Decisions: {data[\"total\"]}')
print(f'Bitwise Matches: {data[\"matches\"]} ({data[\"match_rate\"]*100:.2f}%)')
print(f'Divergences: {data[\"divergences\"]}')
print(f'Evidence Generated: $REPLAY_EVIDENCE')
"