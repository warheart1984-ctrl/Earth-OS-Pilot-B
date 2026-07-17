# EarthOS Pilot B — Schemas

Pilot B inherits schemas from the CESF v1.2 canonical definitions:

| Schema | Canonical Location | Version |
|--------|-------------------|---------|
| CAL | `.codex/cse/schemas/cal.schema.json` | v1.0 |
| CRC | `.codex/cse/schemas/crc.schema.json` | v1.0 |
| CPBA | `.codex/cse/schemas/cpba.schema.json` | v1.0 |
| CPRM | `.codex/cse/schemas/cprm.schema.json` | v1.0 |

The federation layer does not introduce new schemas; it operates on the same CAL/CRC types with federated extensions defined in `federation/core/src/types.ts`.
