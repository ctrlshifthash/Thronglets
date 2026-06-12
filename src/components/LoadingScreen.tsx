'use client';

import { usePathname } from 'next/navigation';
import React, { useEffect, useState } from 'react';

/**
 * Site-entry splash. Mounted in the root layout, so it plays once on a
 * full page load (and refresh) but never on in-app navigation — the
 * layout persists across route changes. The little one flickers and
 * fades like something half-glimpsed, then the grove is revealed.
 */
export function LoadingScreen() {
  const pathname = usePathname();
  const isDocs = pathname?.startsWith('/docs') ?? false;
  const [phase, setPhase] = useState<'show' | 'fading' | 'gone'>('show');

  useEffect(() => {
    if (isDocs) return;
    const t1 = setTimeout(() => setPhase('fading'), 2600);
    const t2 = setTimeout(() => setPhase('gone'), 3350);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isDocs]);

  if (isDocs || phase === 'gone') return null;

  return (
    <div className={`loader-screen${phase === 'fading' ? ' loader-out' : ''}`} aria-hidden>
      <div className="loader-vignette" />
      <div className="loader-stack">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/thronglets-loader.gif" alt="" className="loader-img" />
        <div className="loader-title px-xl">THRONGLETS</div>
        <div className="loader-sub px">the grove is waking</div>
      </div>
    </div>
  );
}
