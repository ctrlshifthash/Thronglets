'use client';

import React, { useEffect, useState } from 'react';
import { musicPlaying, startMusic, stopMusic } from '@/lib/music';

/**
 * ♪ button. Music is ON by default — it starts as soon as the browser
 * allows (immediately, or on the first click anywhere). The button only
 * exists so people can turn it off; that choice is remembered.
 */
export function MusicToggle() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const wantOn = localStorage.getItem('grove-music') !== '0';
    if (wantOn && !musicPlaying()) startMusic();
    setOn(wantOn);
  }, []);

  const toggle = () => {
    if (on) {
      stopMusic();
      localStorage.setItem('grove-music', '0');
      setOn(false);
    } else {
      startMusic();
      localStorage.setItem('grove-music', '1');
      setOn(true);
    }
  };

  return (
    <button className={`tl-filter px help-btn${on ? ' active' : ''}`} title="Grove music" onClick={toggle}>
      {on ? '♪ ON' : '♪ OFF'}
    </button>
  );
}
