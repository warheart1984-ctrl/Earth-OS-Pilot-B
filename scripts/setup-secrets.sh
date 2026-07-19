#!/bin/bash
# OSA Secrets Setup Script
# Run once per environment to generate Ed25519 signing keys

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
KEYS_DIR="$ROOT_DIR/keys"

echo "Setting up OSA constitutional signing keys..."

mkdir -p "$KEYS_DIR"

# Generate Ed25519 keys for each constitutional component
components=(
  "governance-kernel"
  "evidence-ledger"
  "policy-engine"
  "decision-engine"
  "agent-runtime"
  "mission-orchestrator"
  "simulation-runtime"
  "federation-gateway"
)

for component in "${components[@]}"; do
  key_file="$KEYS_DIR/${component}-signing.key"
  pub_file="$KEYS_DIR/${component}-signing.key.pub"

  if [ ! -f "$key_file" ]; then
    echo "Generating key for $component..."
    openssl genpkey -algorithm ed25519 -out "$key_file"
    openssl pkey -in "$key_file" -pubout -out "$pub_file"
    chmod 600 "$key_file"
    chmod 644 "$pub_file"
  else
    echo "Key for $component already exists, skipping"
  fi
done

# Generate shared JWT secret for API gateway
jwt_file="$KEYS_DIR/jwt-secret"
if [ ! -f "$jwt_file" ]; then
  echo "Generating JWT secret..."
  openssl rand -base64 64 > "$jwt_file"
  chmod 600 "$jwt_file"
else
  echo "JWT secret already exists, skipping"
fi

# Generate federation gateway keys
fed_key="$KEYS_DIR/federation-signing.key"
fed_pub="$KEYS_DIR/federation-signing.key.pub"
if [ ! -f "$fed_key" ]; then
  echo "Generating federation gateway keys..."
  openssl genpkey -algorithm ed25519 -out "$fed_key"
  openssl pkey -in "$fed_key" -pubout -out "$fed_pub"
  chmod 600 "$fed_key"
  chmod 644 "$fed_pub"
else
  echo "Federation keys already exist, skipping"
fi

# Set permissions
chmod 700 "$KEYS_DIR"
chmod 600 "$KEYS_DIR"/*.key
chmod 644 "$KEYS_DIR"/*.pub

echo ""
echo "Keys generated in $KEYS_DIR"
echo ""
echo "Next steps:"
echo "1. Add keys to Docker secrets or Kubernetes secrets"
echo "2. Set GITHUB_TOKEN and CONFORMANCE_AUTH_TOKEN in GitHub Actions secrets"
echo "3. Run: docker-compose up -d"
echo ""
echo "Constitutional signing keys ready for Evidence Freeze v1.0"