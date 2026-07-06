import { useEffect, useRef, useState } from "react";

/**
 * Count-up animation using requestAnimationFrame.
 * Interpolates from previous value to new value with easeOut.
 */
export function useAnimatedCounter(value: number, duration = 600) {
  const [display, setDisplay] = useState<number>(Number.isFinite(value) ? value : 0);
  const fromRef = useRef<number>(Number.isFinite(value) ? value : 0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => {
    const target = Number.isFinite(value) ? value : 0;
    if (target === fromRef.current) return;
    const from = fromRef.current;
    const delta = target - from;
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    startRef.current = performance.now();

    const tick = (now: number) => {
      const p = Math.min(1, (now - startRef.current) / duration);
      const v = from + delta * easeOut(p);
      setDisplay(v);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return display;
}
