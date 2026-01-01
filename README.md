<div align="center">
  <br/>
  <h1> Monarch </h1>
  <br/>
  <p><strong>Lending with full control</strong></p>
  <p align="center">
    <img src="./imgs/bg.png" alt="Monarch Interface" width="720"/>
  </p>

  <p>
    <img src="https://img.shields.io/github/license/antoncoding/monarch?style=flat-square" alt="License" />
    <img src="https://img.shields.io/badge/code_style-biome-js?style=flat-square" alt="Biome" />
  </p>
</div>

<br/>


<br/>

## What is Monarch?

An open interface for [Morpho Blue](https://github.com/morpho-org/morpho-blue) markets. Direct protocol access. Full transparency. Zero platform fees.

## Features

| | |
|---|---|
| **Markets** | Find best morpho markets with advanced filters. Compare APY, utilization, and risk metrics. |
| **Positions** | Supply, borrow, withdraw, repay. Batch rebalancing across markets. |
| **AutoVaults** | Deploy automated lending strategies with custom allocation rules. |

## Quick Start

```bash
pnpm install
pnpm dev
```

Open [localhost:3000](http://localhost:3000)

## Build

```bash
pnpm build        # Production build
pnpm lint:check   # Check code quality
pnpm lint         # Auto-fix issues
```

## Contracts

No additional dependencies. Direct interaction with audited Morpho contracts:

- [morpho-blue](https://github.com/morpho-org/morpho-blue) — Core protocol
- [morpho-blue-bundlers](https://github.com/morpho-org/morpho-blue-bundlers) — Transaction batching
- [vault-v2](https://github.com/morpho-org/vault-v2) — AutoVault infrastructure

---

<p align="center">
  <a href="./docs/DEVELOPER_GUIDE.md">Developer Guide</a>
</p>
