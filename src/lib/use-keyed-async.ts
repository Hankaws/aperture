import { useEffect, useRef } from "react";

/**
 * Schedules `run` after `delayMs` and returns a cancel function that clears the
 * timer and aborts the signal. A run that throws after it was cancelled was
 * superseded, so its error is dropped; `onError` sees any other failure.
 */
export function scheduleKeyedRun(
  run: (signal: AbortSignal) => Promise<void>,
  delayMs: number,
  onError: (error: unknown) => void = () => {},
): () => void {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    run(controller.signal).catch((error: unknown) => {
      if (!controller.signal.aborted) onError(error);
    });
  }, delayMs);
  return () => {
    clearTimeout(timer);
    controller.abort();
  };
}

/** A ref that always holds the value from the latest render. */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

/**
 * Runs `run` once per `key`, debounced, aborting the previous run when the key
 * changes or the component unmounts. `null` means nothing to run. `run` is read
 * from the latest render, so it may close over anything without restarting.
 */
export function useKeyedAsync(
  key: string | null,
  run: (signal: AbortSignal) => Promise<void>,
  delayMs = 300,
) {
  const runRef = useLatest(run);
  useEffect(() => {
    if (key === null) return;
    return scheduleKeyedRun((signal) => runRef.current(signal), delayMs);
  }, [key, delayMs, runRef]);
}
