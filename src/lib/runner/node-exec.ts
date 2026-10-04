/**
 * Runs a test bundle (bundle.ts) under Node the way the browser's worker runs
 * it: its own globals, one report channel. For tests and the benchmark; the
 * editor itself runs bundles in a sandboxed Worker (browser.ts).
 */
import vm from "node:vm";

export type NodeRunDone = {
  type: "done";
  passed: boolean;
  exitCode: number;
  pass: number;
  fail: number;
  firstFailure: string | null;
  failures: string[];
  /** Set when the tests reached code the browser cannot run, such as a package that is not installed. */
  unsupported?: string | null;
  output: string;
};

/**
 * The context's globals, with timers that throw as a browser's do when called
 * on another object ("Illegal invocation"), which Node's own do not.
 */
function browserLikeGlobals(host: unknown): Record<string, unknown> {
  // The Web APIs a Worker has and a bare vm context lacks.
  const context: Record<string, unknown> = {
    __host: host,
    queueMicrotask,
    performance,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    AbortController,
    structuredClone,
    atob,
    btoa,
  };
  const strict = <F extends (...args: never[]) => unknown>(f: F) =>
    function (this: unknown, ...args: Parameters<F>) {
      // Inside the vm, the global object is the context's proxy: it carries __host.
      if (this !== undefined && (this as { __host?: unknown } | null)?.__host !== host) throw new TypeError("Illegal invocation");
      return f(...args);
    };
  context.setTimeout = strict(setTimeout);
  context.clearTimeout = strict(clearTimeout);
  context.setInterval = strict(setInterval);
  context.clearInterval = strict(clearInterval);
  return context;
}

/** Runs a bundle the way the worker does: its own globals, one report channel. */
export function executeBundle(code: string, timeoutMs = 3000): Promise<NodeRunDone> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("bundle did not report done")), timeoutMs);
    const host = {
      report(message: { type: string }) {
        if (message.type === "done") {
          clearTimeout(timer);
          resolve(message as NodeRunDone);
        }
      },
    };
    vm.runInNewContext(code, browserLikeGlobals(host));
  });
}

