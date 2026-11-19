/**
 * A queue to read as it fills: what callbacks push, an async loop takes in
 * order, waiting while it is empty, until it is closed. How a turn that
 * reports through callbacks becomes a stream a server function can yield.
 */
export function channel<T>() {
  const queue: T[] = [];
  let wake: (() => void) | null = null;
  let closed = false;
  const nudge = () => {
    wake?.();
    wake = null;
  };
  return {
    push(value: T) {
      if (closed) return;
      queue.push(value);
      nudge();
    },
    close() {
      closed = true;
      nudge();
    },
    async *[Symbol.asyncIterator](): AsyncGenerator<T> {
      while (true) {
        if (queue.length > 0) {
          yield queue.shift()!;
          continue;
        }
        if (closed) return;
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
    },
  };
}
