<div align="center">
  <h1 > Monarch </h1>
  <img height=80 src="./imgs/logo.png"/>
  <h5 align="center"> Customized lending on Morpho Blue.</h5>

  <!-- move badges here -->
  <img src="https://img.shields.io/github/license/antoncoding/monarch?style=flat-square" alt="LICENSE" />
  <img src="https://img.shields.io/badge/code_style-biome-js?style=flat-square" alt="style" />
  <img src="https://img.shields.io/github/languages/top/antoncoding/monarch?style=flat-square" alt="GitHub top language" />
  
  <br/>
  <br/>
</div>

## Overview

Monarch is an open, verifiable interface for Morpho markets that allows you to navigate the Morpho ecosystem safely without any intermediaries. Interact directly with battle-tested Morpho contracts while maintaining full control and visibility over your lending positions.

## Core Features

* **Direct Market Operations**: Supply, withdraw, borrow, and repay to Morpho markets directly with transaction previews showing post-action APY changes

* **Smart Rebalancing**: Move positions seamlessly between markets—from one to many or many to one—with batched transactions for gas efficiency

* **Market History & Analysis**: Search market history, track rate changes, analyze volume graphs, and make informed decisions with comprehensive market data

* **Oracle Breakdown**: Deep dive into Chainlink, Compound, and Redstone oracles with detailed information on oracle types, deviation thresholds, and price feed configurations

* **AutoVaults** (Beta): Set up your own Morpho vaults and automate your lending strategies with customizable parameters.

## Security

This project has **no additional contract dependencies** beyond the heavily tested contracts deployed by the Morpho team:

- **Morpho Blue**: Core lending protocol - [Source Code](https://github.com/morpho-org/morpho-blue/tree/main/src)
- **Morpho Bundler V2**: Batched transaction execution - [Source Code](https://github.com/morpho-org/morpho-blue-bundlers/blob/main/src/chain-agnostic/ChainAgnosticBundlerV2.sol)
- **Morpho Vaults V2**: For Autovault users - [Source Code](https://github.com/morpho-org/vault-v2)


## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (recommended package manager)

### Installation

```bash
# Install dependencies
pnpm install
```

### Development

```bash
# Start development server
pnpm dev
```

The app will be available at `http://localhost:3000`

### Building

```bash
# Build for production
pnpm build
```

### Code Quality

This project uses [Biome](https://biomejs.dev/) with the [Ultracite](https://github.com/lvce-editor/ultracite) preset for linting and formatting:

```bash
# Check code quality
pnpm lint:check

# Auto-fix issues
pnpm lint
```

See [CLAUDE.md](./.claude/CLAUDE.md) for detailed code standards.

### Styling

See [docs/Styling.md](./docs/Styling.md) for comprehensive UI component and styling guidelines
