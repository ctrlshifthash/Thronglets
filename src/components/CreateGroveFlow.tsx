'use client';

import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import { toSolanaWalletConnectors, useSignAndSendTransaction, useWallets } from '@privy-io/react-auth/solana';
import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useState } from 'react';

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

interface Quota {
  created: number;
  freeLimit: number;
  remainingFree: number;
  nextIsFree: boolean;
  feeSol: number;
  feeWallet: string;
  cluster?: 'mainnet-beta' | 'devnet';
}

const rpcFor = (c?: string) => (c === 'devnet' ? 'https://api.devnet.solana.com' : 'https://api.mainnet-beta.solana.com');
const chainFor = (c?: string): 'solana:mainnet' | 'solana:devnet' => (c === 'devnet' ? 'solana:devnet' : 'solana:mainnet');
const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

function Inner() {
  const router = useRouter();
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const address = wallets[0]?.address ?? null;

  const [quota, setQuota] = useState<Quota | null>(null);
  const [name, setName] = useState('');
  const [sig, setSig] = useState('');
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadQuota = useCallback(async () => {
    if (!address) return;
    try {
      const r = await fetch(`/api/towns/quota?wallet=${address}`);
      if (r.ok) setQuota((await r.json()) as Quota);
    } catch {
      /* transient */
    }
  }, [address]);

  useEffect(() => {
    void loadQuota();
  }, [loadQuota]);

  const finishCreate = async (paymentSignature?: string): Promise<boolean> => {
    const r = await fetch('/api/towns/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, wallet: address, paymentSignature }),
    });
    const d = (await r.json()) as { slug?: string; token?: string; error?: string; message?: string };
    if (!r.ok || !d.slug || !d.token) {
      setError(d.message || d.error || 'Could not plant the grove.');
      return false;
    }
    localStorage.setItem(`grove-token-${d.slug}`, d.token);
    try {
      const list = JSON.parse(localStorage.getItem('my-groves') ?? '[]') as Array<{ slug: string; name: string }>;
      list.push({ slug: d.slug, name: name.trim() || 'My Grove' });
      localStorage.setItem('my-groves', JSON.stringify(list.slice(0, 24)));
    } catch {
      /* ignore */
    }
    router.push(`/town/${d.slug}`);
    return true;
  };

  const plantFree = async () => {
    setBusy(true);
    setError(null);
    try {
      await finishCreate();
    } catch {
      setError('Could not plant the grove.');
    } finally {
      setBusy(false);
    }
  };

  const payAndPlant = async () => {
    if (!address || !quota?.feeWallet || !wallets[0]) return;
    setBusy(true);
    setError(null);
    setStatus('Preparing payment…');
    try {
      const conn = new Connection(rpcFor(quota.cluster), 'confirmed');
      const { blockhash } = await conn.getLatestBlockhash();
      const tx = new Transaction();
      tx.feePayer = new PublicKey(address);
      tx.recentBlockhash = blockhash;
      tx.add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(address),
          toPubkey: new PublicKey(quota.feeWallet),
          lamports: Math.round(quota.feeSol * 1_000_000_000),
        })
      );
      const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
      setStatus('Approve the payment in your wallet…');
      const res = await signAndSendTransaction({
        transaction: new Uint8Array(serialized),
        wallet: wallets[0],
        chain: chainFor(quota.cluster),
      });
      const signature = bs58.encode(res.signature);
      setStatus('Confirming payment + planting…');
      // Give the cluster a moment to make the tx queryable before we verify.
      await new Promise((r) => setTimeout(r, 2500));
      const okCreate = await finishCreate(signature);
      if (!okCreate) {
        setSig(signature);
        setManual(true);
        setError('Paid, but planting didn’t confirm yet. Paste/keep the signature below and retry.');
      }
    } catch {
      setError('Wallet payment didn’t go through. You can pay manually below instead.');
      setManual(true);
    } finally {
      setBusy(false);
      setStatus(null);
    }
  };

  const verifyManual = async () => {
    if (!sig.trim()) return;
    setBusy(true);
    setError(null);
    setStatus('Verifying payment…');
    try {
      await finishCreate(sig.trim());
    } catch {
      setError('Could not verify that signature.');
    } finally {
      setBusy(false);
      setStatus(null);
    }
  };

  const copyFee = () => {
    if (!quota?.feeWallet) return;
    void navigator.clipboard?.writeText(quota.feeWallet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  if (!ready) return <p className="cg-note">Loading wallet…</p>;

  if (!authenticated || !address) {
    return (
      <div className="cg-connect">
        <p className="cg-note">Connect your Solana wallet to plant a grove. Your first {2} are free.</p>
        <button className="tl-filter px intro-btn" onClick={login}>CONNECT WALLET</button>
      </div>
    );
  }

  const nameField = (
    <input
      className="grove-name-input"
      type="text"
      maxLength={20}
      placeholder="e.g. Mossy Hollow"
      value={name}
      onChange={(e) => setName(e.target.value)}
    />
  );
  const tooShort = name.trim().length < 2;

  return (
    <div className="cg-flow">
      <div className="cg-wallet px">
        ◎ {short(address)}
        {quota && (
          <span className="cg-quota">
            {quota.nextIsFree
              ? `${quota.remainingFree} free grove${quota.remainingFree === 1 ? '' : 's'} left`
              : `${quota.created} made · next costs ${quota.feeSol} SOL`}
          </span>
        )}
      </div>

      {nameField}

      {!quota ? (
        <p className="cg-note">Checking your groves…</p>
      ) : quota.nextIsFree ? (
        <button className="tl-filter px intro-btn" disabled={busy || tooShort} onClick={() => void plantFree()}>
          {busy ? 'PLANTING…' : 'PLANT THE GROVE (FREE)'}
        </button>
      ) : (
        <>
          <p className="cg-fee">
            You’ve used your {quota.freeLimit} free groves. To stop farming, each extra grove costs{' '}
            <b>{quota.feeSol} SOL</b>, paid to the treasury.
          </p>
          {!manual ? (
            <button className="tl-filter px intro-btn" disabled={busy || tooShort || !quota.feeWallet} onClick={() => void payAndPlant()}>
              {busy ? (status ?? 'WORKING…') : `PAY ${quota.feeSol} SOL & PLANT`}
            </button>
          ) : (
            <div className="cg-manual">
              <p className="cg-note">
                Send <b>{quota.feeSol} SOL</b> to:
              </p>
              <div className="cg-addr">
                <code>{quota.feeWallet}</code>
                <button className="dash-ca-copy px" onClick={copyFee}>{copied ? 'COPIED' : 'COPY'}</button>
              </div>
              <input
                className="grove-name-input"
                type="text"
                placeholder="paste the transaction signature"
                value={sig}
                onChange={(e) => setSig(e.target.value)}
              />
              <button className="tl-filter px intro-btn" disabled={busy || tooShort || !sig.trim()} onClick={() => void verifyManual()}>
                {busy ? (status ?? 'VERIFYING…') : 'VERIFY & PLANT'}
              </button>
            </div>
          )}
          <button className="cg-toggle" onClick={() => setManual((m) => !m)}>
            {manual ? '← pay with wallet instead' : 'having trouble? pay manually'}
          </button>
        </>
      )}

      {status && !error && <p className="cg-status">{status}</p>}
      {error && <p className="cg-error">{error}</p>}
    </div>
  );
}

export function CreateGroveFlow() {
  if (!APP_ID) {
    return <p className="cg-note">Wallet connect isn’t configured yet.</p>;
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
