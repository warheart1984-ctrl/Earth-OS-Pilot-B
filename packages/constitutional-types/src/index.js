// Constitutional Types for OSA
// Normative: OSA-Constitution-v1.0.md, OSA-ACC-v1.0.md, OSA-CSD-v1.0.md, OSA-CECD-v1.0.md, OSA-ECED-v1.0.md
// Constructor functions
export function createAuthorityId(value) { return value; }
export function createPolicyId(value) { return value; }
export function createAuthorizationId(value) { return value; }
export function createDecisionId(value) { return value; }
export function createEvidenceId(value) { return value; }
export function createCausalityId(value) { return value; }
export function createEventId(value) { return value; }
export function createAuditId(value) { return value; }
export function createHash(value) { return value; }
export function createSignature(value) { return value; }
export function createTimestamp(value) { return value; }
export function now() { return new Date().toISOString(); }
export function createEvidenceSource(type, identifier, version) {
    return {
        type,
        identifier,
        version,
        toString() {
            return version ? `${type}:${identifier}:${version}` : `${type}:${identifier}`;
        }
    };
}
// ============================================================================
// Utility Functions
// ============================================================================
export function randomUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
