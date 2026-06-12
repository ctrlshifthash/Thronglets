'use client';

import React, { useEffect, useRef } from 'react';
import type { TownDetail } from '@/lib/types';
import type { ObserverApi } from './ObserverScene';

// Mounts the Phaser observer view. Phaser is imported inside the
// effect so it never touches the server bundle.
export default function ObserverCanvas({
  town,
  onReady,
  onAgentSelect,
}: {
  town: TownDetail;
  onReady?: (api: ObserverApi) => void;
  onAgentSelect?: (id: number | null) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let destroyed = false;
    let game: import('phaser').Game | null = null;

    void (async () => {
      const Phaser = await import('phaser');
      const { ObserverScene } = await import('./ObserverScene');
      if (destroyed || !hostRef.current) return;

      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: hostRef.current,
        backgroundColor: '#07070f',
        pixelArt: true,
        roundPixels: true,
        scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
      });
      game.registry.set('boot', { town, onReady, onAgentSelect });
      game.scene.add('main', ObserverScene as never, true);
    })();

    return () => {
      destroyed = true;
      game?.destroy(true);
      game = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={hostRef} className="game-mount" />;
}
