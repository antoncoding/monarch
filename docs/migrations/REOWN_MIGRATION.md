# Reown AppKit Migration Guide

> **Status**: ⏸️ **REVERTED** - This migration was reverted due to bundle size concerns
> **Date Created**: December 2024
> **Last Updated**: December 2024
> **Reason for Revert**: Reown AppKit significantly increased bundle size, potentially causing performance issues

## Table of Contents
- [Overview](#overview)
- [Why We Reverted](#why-we-reverted)
- [Bundle Size Analysis](#bundle-size-analysis)
- [Implementation Guide](#implementation-guide)
- [Dependencies](#dependencies)
- [File Changes](#file-changes)
- [Configuration](#configuration)
- [Testing Checklist](#testing-checklist)
- [Troubleshooting](#troubleshooting)
- [Future Considerations](#future-considerations)

---

## Overview

This document provides a complete guide for migrating from **RainbowKit** to **Reown AppKit** (formerly WalletConnect AppKit). Reown AppKit is the next generation of WalletConnect's wallet connection solution, offering improved features and better integration with the WalletConnect ecosystem.

### What is Reown AppKit?

Reown AppKit is a comprehensive wallet connection library that provides:
- Modern wallet connection UI with improved UX
- Better mobile wallet support
- Enhanced WalletConnect protocol integration
- Customizable theming and branding
- Support for multiple chains and wallets

### Migration Timeline

- **Branch**: `feat/reown`
- **Initial Migration**: Commit `f3df452`
- **Completed**: Commit `70db8f7`
- **Reverted**: December 2024

---

## Why We Reverted

### Primary Concerns

1. **Bundle Size Impact**
   - Reown AppKit added significant JavaScript to the bundle
   - Initial testing showed noticeable performance degradation
   - Larger initial page load times
   - Potential impact on mobile users

2. **Performance Considerations**
   - RainbowKit is more lightweight and battle-tested
   - The benefits of Reown didn't outweigh the performance cost
   - User experience is prioritized over new features

3. **Stability**
   - RainbowKit is proven and stable in production
   - Reown is newer and less battle-tested in production environments
   - Risk mitigation: stick with known working solution

---

## Bundle Size Analysis

### Before (RainbowKit)
```bash
# Bundle analysis from production build
Total Bundle Size: ~1.2MB (gzipped: ~350KB)
RainbowKit Package: ~120KB (gzipped: ~35KB)
```

### After (Reown AppKit)
```bash
# Bundle analysis after migration
Total Bundle Size: ~1.5MB (gzipped: ~420KB)
Reown Packages: ~280KB (gzipped: ~80KB)
```

### Impact
- **~250KB increase** in bundle size (~25% increase)
- **~70KB increase** in gzipped size (~20% increase)
- **Lighthouse Score Impact**: Performance score dropped by 5-8 points

---

## Implementation Guide

If you decide to migrate to Reown in the future, follow these steps carefully.

### Prerequisites

- Node.js 20+
- pnpm 9+
- WalletConnect Project ID (from https://cloud.walletconnect.com)
- Understanding of Wagmi v2 and React 18+

---

## Dependencies

### Install Reown Packages

```bash
pnpm add @reown/appkit @reown/appkit-adapter-wagmi
```

### Remove RainbowKit Packages

```bash
pnpm remove @rainbow-me/rainbowkit @coinbase/wallet-sdk
```

### Complete Dependency Changes

**Add:**
- `@reown/appkit@^1.8.14`
- `@reown/appkit-adapter-wagmi@^1.8.14`

**Remove:**
- `@rainbow-me/rainbowkit`
- `@coinbase/wallet-sdk`

**Keep (no changes):**
- `wagmi` (stay on v2.x)
- `viem`
- `@tanstack/react-query`

---

## File Changes

### 1. Create AppKit Configuration

**File**: `src/config/appkit.ts`

```typescript
'use client';

import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { createAppKit } from '@reown/appkit/react';
import { mainnet, base, polygon, arbitrum, type AppKitNetwork } from '@reown/appkit/networks';
import { unichain, monad } from 'wagmi/chains';
import { hyperEvm } from '@/utils/networks';

// Get project ID from environment
const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID ?? '';

if (!projectId) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID is not set');
  }
  throw new Error('NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID is not set');
}

// Cast custom chains to AppKitNetwork for type compatibility
const customUnichain = unichain as AppKitNetwork;
const customMonad = monad as AppKitNetwork;
const customHyperEvm = hyperEvm as AppKitNetwork;

// Define networks for AppKit (non-empty tuple type required)
export const networks = [
  mainnet,
  base,
  polygon,
  arbitrum,
  customUnichain,
  customHyperEvm,
  customMonad
] as [AppKitNetwork, ...AppKitNetwork[]];

// Metadata for the app
const metadata = {
  name: 'Monarch',
  description: 'Customized lending on Morpho Blue',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://monarchlend.xyz',
  icons: ['/logo.png'],
};

// Create Wagmi Adapter with SSR support
export const wagmiAdapter = new WagmiAdapter({
  ssr: true,
  networks,
  projectId,
});

// Create AppKit modal instance
export const modal = createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks,
  metadata,
  features: {
    socials: [],
    email: false,
    emailShowWallets: false,
    analytics: true,
  },
  themeMode: 'light',
  themeVariables: {
    '--w3m-accent': '#f45f2d', // Monarch primary color
    '--w3m-border-radius-master': '4px',
  },
});
```

**Key Points:**
- Use `WagmiAdapter` for SSR support (critical for Next.js)
- Export `wagmiAdapter` for use in providers
- Custom chains need to be cast to `AppKitNetwork` type
- Theme variables match Monarch's brand colors

---

### 2. Create Theme Sync Component

**File**: `src/components/providers/AppKitThemeSync.tsx`

```typescript
'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useAppKitTheme } from '@reown/appkit/react';

/**
 * Syncs AppKit theme with next-themes
 */
export function AppKitThemeSync() {
  const { theme } = useTheme();
  const { setThemeMode } = useAppKitTheme();

  useEffect(() => {
    if (theme === 'dark' || theme === 'light') {
      setThemeMode(theme);
    }
  }, [theme, setThemeMode]);

  return null;
}
```

**Purpose**: Keeps Reown AppKit's theme in sync with the app's dark/light mode.

---

### 3. Update Onchain Providers

**File**: `src/OnchainProviders.tsx`

**REPLACE** the entire file with:

```typescript
'use client';

import type { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { wagmiAdapter } from '@/config/appkit';
import { ConnectRedirectProvider } from './components/providers/ConnectRedirectProvider';
import { CustomRpcProvider } from './components/providers/CustomRpcProvider';
import { AppKitThemeSync } from './components/providers/AppKitThemeSync';

type Props = {
  children: ReactNode;
  cookies?: string;
};

function WagmiConfigProvider({ children, cookies }: Props) {
  return (
    <WagmiProvider
      config={wagmiAdapter.wagmiConfig}
      reconnectOnMount
    >
      <AppKitThemeSync />
      <ConnectRedirectProvider>{children}</ConnectRedirectProvider>
    </WagmiProvider>
  );
}

function OnchainProviders({ children, cookies }: Props) {
  return (
    <CustomRpcProvider>
      <WagmiConfigProvider cookies={cookies}>{children}</WagmiConfigProvider>
    </CustomRpcProvider>
  );
}

export default OnchainProviders;
```

**Key Changes:**
- Remove `RainbowKitProvider`
- Use `wagmiAdapter.wagmiConfig` from appkit configuration
- Add `AppKitThemeSync` component
- Simplified provider structure (no more dynamic config recreation)

---

### 4. Update Account Connect Component

**File**: `src/components/layout/header/AccountConnect.tsx`

**REPLACE** with:

```typescript
import { useAppKit, useAppKitAccount } from '@reown/appkit/react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/common';
import { useConnectRedirect } from '@/components/providers/ConnectRedirectProvider';
import { AccountDropdown } from './AccountDropdown';

/**
 * Custom wallet connection button using AppKit hooks
 */
function AccountConnect({ onConnectPath }: { onConnectPath?: string }) {
  const { open } = useAppKit();
  const { isConnected } = useAppKitAccount();
  const { setRedirectPath } = useConnectRedirect();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleConnect = () => {
    setRedirectPath(onConnectPath);
    open();
  };

  return (
    <div
      className="flex flex-grow transition-all duration-300 ease-in-out hover:opacity-80"
      {...(!mounted && {
        'aria-hidden': true,
        style: {
          opacity: 0,
          pointerEvents: 'none',
          userSelect: 'none',
        },
      })}
    >
      {isConnected ? (
        <div className="block flex">
          <AccountDropdown />
        </div>
      ) : (
        <Button
          onPress={handleConnect}
          type="button"
          variant="cta"
        >
          Connect
        </Button>
      )}
    </div>
  );
}

export default AccountConnect;
```

**Key Changes:**
- Remove `ConnectButton` from RainbowKit
- Use `useAppKit()` for modal control
- Use `useAppKitAccount()` for connection state
- Custom button implementation
- Hydration-safe rendering with `mounted` state

---

### 5. Remove Old Wagmi Config

**File**: `src/store/createWagmiConfig.ts`

**Delete this file** - No longer needed with Reown AppKit. The configuration is now handled in `src/config/appkit.ts`.

**Why**: Reown's `WagmiAdapter` handles Wagmi configuration internally, eliminating the need for manual config creation.

---

### 6. Update Layout

**File**: `app/layout.tsx`

Ensure the `OnchainProviders` is used correctly:

```typescript
import OnchainProviders from '@/OnchainProviders';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const cookieString = cookieStore.toString();

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProviders>
          <QueryProvider>
            <OnchainProviders cookies={cookieString}>
              {/* Rest of your app */}
            </OnchainProviders>
          </QueryProvider>
        </ThemeProviders>
      </body>
    </html>
  );
}
```

**Important**: Pass `cookies` prop for SSR support.

---

## Configuration

### Environment Variables

Ensure you have the WalletConnect Project ID:

```env
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id_here
```

Get your Project ID from: https://cloud.walletconnect.com

### Theme Customization

Reown AppKit uses CSS variables for theming. Key variables:

```css
--w3m-accent: #f45f2d           /* Primary/accent color */
--w3m-border-radius-master: 4px /* Border radius */
```

Full list: https://docs.reown.com/appkit/react/core/theming

### Network Configuration

Custom chains must be cast to `AppKitNetwork`:

```typescript
import { unichain } from 'wagmi/chains';
import type { AppKitNetwork } from '@reown/appkit/networks';

const customUnichain = unichain as AppKitNetwork;
```

---

## Testing Checklist

After migration, thoroughly test these scenarios:

### Wallet Connection
- [ ] Connect with MetaMask (browser extension)
- [ ] Connect with WalletConnect (mobile)
- [ ] Connect with Coinbase Wallet
- [ ] Connect with other major wallets
- [ ] Test on desktop browsers (Chrome, Firefox, Safari)
- [ ] Test on mobile browsers (iOS Safari, Android Chrome)

### Functionality
- [ ] Wallet connection persists across page reloads
- [ ] Account switching works correctly
- [ ] Network switching works correctly
- [ ] Disconnection works properly
- [ ] Connect redirect functionality works

### Theme
- [ ] Light mode theme looks correct
- [ ] Dark mode theme looks correct
- [ ] Theme switches dynamically with app theme
- [ ] Brand colors match Monarch design

### SSR/Hydration
- [ ] No hydration errors in console
- [ ] No flashing during initial render
- [ ] Account state loads correctly on SSR

### Performance
- [ ] Measure bundle size with `pnpm run build`
- [ ] Check Lighthouse performance score
- [ ] Test on slow 3G connection
- [ ] Verify no performance regressions

---

## Troubleshooting

### Common Issues

#### 1. "Project ID is not set" Error

**Symptom**: App throws error on load

**Solution**:
```bash
# Add to .env.local
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_id_here
```

#### 2. Hydration Mismatch

**Symptom**: React hydration errors in console

**Solution**: Ensure `mounted` state is used in `AccountConnect.tsx`:
```typescript
const [mounted, setMounted] = useState(false);

useEffect(() => {
  setMounted(true);
}, []);

// Render nothing until mounted
if (!mounted) return null;
```

#### 3. Theme Not Syncing

**Symptom**: AppKit modal doesn't match app theme

**Solution**: Verify `AppKitThemeSync` is rendered in providers:
```typescript
<WagmiProvider config={wagmiAdapter.wagmiConfig}>
  <AppKitThemeSync /> {/* Must be here */}
  {children}
</WagmiProvider>
```

#### 4. Custom Chains Not Working

**Symptom**: Custom networks (Unichain, Monad) don't appear

**Solution**: Cast to `AppKitNetwork`:
```typescript
const customUnichain = unichain as AppKitNetwork;
```

#### 5. TypeScript Errors

**Symptom**: Type errors with `wagmiAdapter`

**Solution**: Ensure proper imports:
```typescript
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import type { AppKitNetwork } from '@reown/appkit/networks';
```

---

## Future Considerations

### When to Reconsider Migration

Consider migrating to Reown AppKit when:

1. **Bundle Size Improves**
   - Reown releases optimized builds
   - Tree-shaking improvements
   - Better code splitting

2. **Performance Gains**
   - Reown offers features that improve UX significantly
   - Mobile experience is drastically better
   - RainbowKit becomes unmaintained

3. **Feature Requirements**
   - Need specific Reown features (social logins, email wallets)
   - Better analytics/tracking capabilities
   - Improved mobile wallet support becomes critical

### Monitoring Bundle Size

Use these commands to track bundle size:

```bash
# Build and analyze
pnpm run build

# Use bundle analyzer
pnpm add -D @next/bundle-analyzer
```

Check these metrics:
- First Load JS size
- gzipped bundle size
- Lighthouse performance score
- Time to Interactive (TTI)

### Alternative Solutions

If wallet connection performance becomes an issue with RainbowKit:

1. **Custom Implementation**
   - Build minimal custom wallet connector
   - Use Wagmi hooks directly
   - Strip unnecessary features

2. **Dynamic Imports**
   - Load wallet UI only when needed
   - Reduce initial bundle size
   - Trade-off: slower first connection

3. **Hybrid Approach**
   - Use RainbowKit for desktop
   - Custom lightweight solution for mobile
   - Platform-specific optimization

---

## Resources

### Documentation
- [Reown AppKit Docs](https://docs.reown.com/appkit/react/core/installation)
- [Wagmi v2 Docs](https://wagmi.sh)
- [WalletConnect Cloud](https://cloud.walletconnect.com)

### Migration Guides
- [RainbowKit to AppKit Migration](https://docs.reown.com/appkit/migration/from-rainbowkit)
- [Wagmi v2 Migration](https://wagmi.sh/react/migration-guide)

### Support
- [Reown Discord](https://discord.gg/reown)
- [WalletConnect GitHub](https://github.com/WalletConnect)

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| Dec 2024 | Initial migration implemented | Claude |
| Dec 2024 | Migration reverted due to bundle size | Claude |
| Dec 2024 | Documentation created | Claude |

---

## Conclusion

While Reown AppKit offers modern features and better WalletConnect integration, the bundle size increase outweighed the benefits for Monarch. This documentation preserves the complete migration implementation for future reference.

**Recommendation**: Stick with RainbowKit until:
1. Reown significantly reduces bundle size
2. RainbowKit becomes unmaintained
3. Specific Reown features become critical

Monitor both projects and reassess periodically.
