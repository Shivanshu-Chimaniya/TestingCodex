import { useEffect, useMemo, useState } from 'react';

export const useRoundTimer = (endsAt?: string) => {
  const endMs = useMemo(() => (endsAt ? new Date(endsAt).getTime() : 0), [endsAt]);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!endMs) {
      setSecondsLeft(0);
      return;
    }

    const tick = () => {
      const ms = Math.max(0, endMs - Date.now());
      setSecondsLeft(Math.ceil(ms / 1000));
    };

    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [endMs]);

  return secondsLeft;
};
