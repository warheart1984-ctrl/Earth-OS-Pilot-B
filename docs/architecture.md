# EarthOS Pilot B — Federated Constitutional Network

## Purpose

EarthOS Pilot B extends Pilot A from a single-node sandbox into a multi-cluster, federated constitutional network enabling cross-domain authority propagation, federated revocation, and federated evidence lineage.

## Architecture

```
┌─────────────────────┐     Federation      ┌─────────────────────┐
│  Cluster A          │◄──── Treaty ────────►│  Cluster B          │
│  ┌───────────────┐  │                     │  ┌───────────────┐  │
│  │ Registry A     │  │                     │  │ Registry B     │  │
│  │ CAL Tokens A   │  │                     │  │ CAL Tokens B   │  │
│  │ Replay Engine A│  │                     │  │ Replay Engine B│  │
│  └───────────────┘  │                     │  └───────────────┘  │
└──────────┬──────────┘                     └──────────┬──────────┘
           │                                           │
           └───────────────Federation Core─────────────┘
                           │
                    ┌──────┴──────┐
                    │ Federated   │
                    │ Governance  │
                    └─────────────┘
```
