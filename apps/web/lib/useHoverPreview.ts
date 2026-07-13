'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Phase 3 (Hover Preview/Clip Preview roadmap) - shared hover-intent state
// machine for both the Video dashboard card's Hover Preview and the Clip
// gallery card's Clip Preview, since both need the exact same rules:
//
// - Debounced "intent," not every mouse pass-through: `active` only flips
//   true after HOVER_INTENT_DELAY_MS of continuous hover/focus, so a cursor
//   sweeping across a grid of cards never triggers a burst of fetches.
// - On-demand only: the caller is expected to not even set an <img src> (and
//   therefore not fetch anything) until `active` is true - this hook only
//   tracks intent, it never fetches anything itself.
// - Cancellation: leaving/blurring before the delay fires clears the pending
//   timer, so a quick pass-through never activates at all. Leaving/blurring
//   after it fired flips `active` back to false, which the caller is
//   expected to treat as "unmount the preview <img>" (not just hide it via
//   CSS) so an in-flight decode is dropped rather than finishing unseen.
// - Touch devices: gated behind the `(hover: hover) and (pointer: fine)`
//   media feature - touch has no stable hover concept (first tap acts as
//   both hover and click), so showing a preview there would just flash
//   confusingly right before navigation. Touch users get whatever's already
//   shown by default (storyboard/animated thumbnail/static image) and tap
//   straight through.
// - Accessibility: `onFocus`/`onBlur` mirror `onMouseEnter`/`onMouseLeave`
//   with the same debounce, so keyboard users get equivalent behavior
//   (tabbing onto a card, not just mousing over one) rather than a
//   mouse-only feature.
const HOVER_INTENT_DELAY_MS = 200;

function supportsHoverPreview(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export interface UseHoverPreviewResult {
  active: boolean;
  handlers: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onFocus: () => void;
    onBlur: () => void;
  };
}

export function useHoverPreview(): UseHoverPreviewResult {
  const [active, setActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Read once on mount rather than on every start() call - matchMedia's
  // result can't change for a given device/session in a way this feature
  // needs to react to.
  const supportsHoverRef = useRef(false);

  useEffect(() => {
    supportsHoverRef.current = supportsHoverPreview();
  }, []);

  const clearPendingTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (!supportsHoverRef.current) return;
    clearPendingTimer();
    timerRef.current = setTimeout(() => setActive(true), HOVER_INTENT_DELAY_MS);
  }, [clearPendingTimer]);

  const stop = useCallback(() => {
    clearPendingTimer();
    setActive(false);
  }, [clearPendingTimer]);

  // Unmount safety net - a card can leave the DOM (e.g. "Load More"'s list
  // re-rendering, or a delete) while a debounce timer is still pending.
  useEffect(() => clearPendingTimer, [clearPendingTimer]);

  return {
    active,
    handlers: { onMouseEnter: start, onMouseLeave: stop, onFocus: start, onBlur: stop },
  };
}
