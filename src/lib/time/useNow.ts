import { useEffect, useState } from 'react';

/** The current time, ticking once a second while `active`. A timer is a stored start time and a clock read from it, so
 *  the reading is always right after the app was asleep; this only makes the display move. */
export function useNow(active: boolean, every = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(t);
  }, [active, every]);
  return now;
}
