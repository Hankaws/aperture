import { useEffect, useState } from "react";

export function useTyped(text: string, active: boolean, reduced: boolean, speed = 18) {
  const [n, setN] = useState(reduced || !active ? (reduced ? text.length : 0) : 0);

  useEffect(() => {
    if (reduced) {
      setN(text.length);
      return;
    }
    if (!active) {
      setN(0);
      return;
    }
    setN(0);
    const id = window.setInterval(() => {
      setN((v) => {
        if (v >= text.length) {
          window.clearInterval(id);
          return v;
        }
        return v + 1;
      });
    }, speed);
    return () => window.clearInterval(id);
  }, [text, active, reduced, speed]);

  return {
    text: text.slice(0, n),
    done: n >= text.length,
    n,
  };
}
