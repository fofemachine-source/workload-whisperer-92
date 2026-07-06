import { useEffect, useRef, useState } from "react";

/**
 * Countdown from `from` to 0 in seconds. Resets whenever `resetKey` changes
 * (use the react-query `dataUpdatedAt` timestamp as reset key).
 */
export function useCountdown(from: number, resetKey: number) {
  const [n, setN] = useState<number>(from);
  const iRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setN(from);
    if (iRef.current) clearInterval(iRef.current);
    iRef.current = setInterval(() => {
      setN((v) => (v > 0 ? v - 1 : 0));
    }, 1000);
    return () => {
      if (iRef.current) clearInterval(iRef.current);
    };
  }, [from, resetKey]);

  return n;
}
