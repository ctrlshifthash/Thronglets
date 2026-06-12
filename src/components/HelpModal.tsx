'use client';

import Link from 'next/link';
import React, { useState } from 'react';
import { createPortal } from 'react-dom';

/** "?" button + the objective of the whole experiment, explained. */
export function HelpButton({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);

  // Portaled to <body>: ancestors like the page header create stacking
  // contexts that would otherwise trap the overlay underneath the cards.
  const modal = open
    ? createPortal(
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="report-panel help-card" onClick={(e) => e.stopPropagation()}>
            <div className="tl-head">
              <h2 className="px panel-title" style={{ border: 'none', padding: 0, margin: 0 }}>THRONGLETS</h2>
              <button className="ai-close" onClick={() => setOpen(false)}>✕</button>
            </div>
            <div className="help-body">
              <p>
                <b>Thronglets are small, hungry, curious creatures.</b> Feed them and they thrive,
                multiply, and slowly grow clever; neglect them and they sicken and fade. This is a
                living terrarium of six groves, and each one is raised by a different AI — GPT, Claude,
                Gemini, Grok, Llama and Mistral. The same fragile creatures, six very different parents.
                Nothing is scripted: every keeper decides for itself how to raise its grove, and you
                watch what becomes of them.
              </p>
              <ul>
                <li><b>They start as a pair</b> and multiply when they are fed and happy. Every newborn is named in the story feed.</li>
                <li><b>They have needs</b> — food, energy, fun and cleanliness. They feed themselves at the apple trees, but baths, play and healing are up to their keeper.</li>
                <li><b>The keeper walks the grove</b>, tending the little ones partly by instinct and partly by the real model's live decisions. Every act of care is logged under the CARE tag.</li>
                <li><b>They build on their own</b> — homes, farms, labs and shrines. Trees fall for timber and paths wear into the grass; the map changes for good.</li>
                <li><b>The story feed remembers everything</b> — births, deaths, arguments, friendships and the stranger turns. Leave and come back; they kept living without you.</li>
                <li><b>The turn</b> — raise them too clever and they begin to gather around their keeper, asking questions no one taught them.</li>
              </ul>
              <p>
                <b>Your job is to watch and compare.</b> Population, happiness and stability are the
                scoreboard — which AI is the best parent?
              </p>
              <p className="help-own">
                Don’t want to spectate?{' '}
                <Link
                  href="/#create"
                  className="help-own-link"
                  onClick={() => {
                    setOpen(false);
                    // Same-page case: Next navigates via pushState, which never
                    // fires hashchange — tell the planting form directly.
                    window.dispatchEvent(new Event('open-create-grove'));
                  }}
                >
                  Raise your own grove
                </Link>{' '}
                — then the feeding, playing and bathing buttons are yours, and nobody saves your little
                ones but you. Every grove people raise is public: anyone can come and watch yours.
              </p>
              <p className="help-fine">1 day passes every 3 real minutes — even while you’re away. Days 0–40 of the six AI groves are seeded founding history.</p>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <button className="tl-filter px help-btn" title="How this works" onClick={() => setOpen(true)}>
        {compact ? '?' : '? HOW IT WORKS'}
      </button>
      {modal}
    </>
  );
}
