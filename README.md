<div align="center">
  <h1>Monarch</h1>
  <img height=80 src="./imgs/logo.png"/>
  <h5>Customized lending on Morpho Blue</h5>

  <img src="https://img.shields.io/github/license/antoncoding/monarch?style=flat-square" alt="LICENSE" />
  <img src="https://img.shields.io/badge/code_style-biome-js?style=flat-square" alt="style" />
  <img src="https://img.shields.io/github/languages/top/antoncoding/monarch?style=flat-square" alt="GitHub top language" />

  <br/>
  <br/>
</div>

Monarch is an open, verifiable interface for Morpho Blue markets. Interact directly with battle-tested Morpho contracts while maintaining full control and visibility over your lending positions.

## Key Features

- **Direct Market Operations**: Supply, withdraw, borrow, and repay with real-time APY previews
- **Smart Rebalancing**: Move positions between markets with batched transactions
- **Market Analytics**: Track history, rate changes, and volume with comprehensive data
- **Oracle Integration**: Deep dive into Chainlink, Compound, and Redstone price feeds
- **AutoVaults** (Beta): Create and manage automated lending strategies

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9.15+

### Installation & Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Visit `http://localhost:3000` to see the app.

### Building

```bash
# Build for production
pnpm build

# Check code quality
pnpm lint:check

# Auto-fix linting issues
pnpm lint
```

## Documentation

- **[Architecture Guide](./docs/ARCHITECTURE.md)** - Tech stack, data fetching patterns, and developer guide
- **[Styling Guide](./docs/Styling.md)** - UI component patterns and design system
- **[Code Standards](./.claude/CLAUDE.md)** - Code quality guidelines (Biome/Ultracite)

## Security

This project has **no additional contract dependencies** beyond official Morpho contracts:

- [Morpho Blue](https://github.com/morpho-org/morpho-blue) - Core lending protocol
- [Morpho Bundler V2](https://github.com/morpho-org/morpho-blue-bundlers) - Transaction batching
- [Morpho Vaults V2](https://github.com/morpho-org/vault-v2) - Infrastructure for Auto Vaults
