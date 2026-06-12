'use client';

import React from 'react';

// Pump.fun uses its official pill mark; X and GitHub take the parchment ink.
// eslint-disable-next-line @next/next/no-img-element
const PumpIcon = <img src="/pump-icon.png" alt="" className="social-img" />;

const XIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const GithubIcon = (
  <svg viewBox="0 0 16 16" width="19" height="19" aria-hidden fill="currentColor">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.03.08-2.13 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.93.08 2.13.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

const LINKS = [
  { href: 'https://pump.fun', label: 'Pump.fun', icon: PumpIcon },
  { href: 'https://x.com/playThronglets', label: 'X', icon: XIcon },
  { href: 'https://github.com/playThronglets/Thronglets', label: 'GitHub', icon: GithubIcon },
];

export function SocialLinks() {
  return (
    <nav className="social-nav" aria-label="Links">
      {LINKS.map((l) => (
        <a key={l.label} className="social-box" href={l.href} target="_blank" rel="noreferrer" title={l.label} aria-label={l.label}>
          {l.icon}
        </a>
      ))}
    </nav>
  );
}
