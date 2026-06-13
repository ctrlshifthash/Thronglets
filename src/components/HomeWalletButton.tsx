'use client';

import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import { toSolanaWalletConnectors, useWallets } from '@privy-io/react-auth/solana';
import Link from 'next/link';
import React from 'react';

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

function Inner() {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const address = wallets[0]?.address ?? null;

  // Connected — show the wallet and route through to the full rewards view.
  if (authenticated && address) {
    return (
      <Link className="home-wallet px" href="/dashboard" title="View your rewards dashboard">
        <span className="home-wallet-dot" aria-hidden />
        {address.slice(0, 4)}…{address.slice(-4)}
      </Link>
    );
  }

  return (
    <button
      className="home-wallet px"
      onClick={login}
      disabled={!ready}
      title="Connect your Solana wallet"
    >
      CONNECT WALLET
    </button>
  );
}

export function HomeWalletButton() {
  // Privy not configured yet — fall back to a link into the dashboard.
  if (!APP_ID) {
    return (
      <Link className="home-wallet px" href="/dashboard" title="Open your rewards dashboard">
        CONNECT WALLET
      </Link>
    );
  }

  return (
    <PrivyProvider
      appId={APP_ID}
      config={{
        appearance: { walletChainType: 'solana-only' },
        externalWallets: { solana: { connectors: toSolanaWalletConnectors() } },
      }}
    >
      <Inner />
    </PrivyProvider>
  );
}
