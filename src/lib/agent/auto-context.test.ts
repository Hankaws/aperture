import assert from "node:assert/strict";
import { test } from "node:test";
import { autoContextPaths, formatAutoContext } from "./auto-context.ts";

test("autoContextPaths prefers active, recent, then tabs, and skips @ mentions", () => {
  const paths = autoContextPaths({
    activePath: "src/store.ts",
    recentPaths: ["src/index.ts", "preview.html", "src/store.ts"],
    openTabs: ["src/store.ts", "README.md", "src/types.ts"],
    mentioned: ["README.md"],
    extra: ["preview.css"],
  });
  assert.deepEqual(paths, ["src/store.ts", "src/index.ts", "preview.html", "src/types.ts", "preview.css"]);
});

test("formatAutoContext clips attached files", () => {
  const text = formatAutoContext(["a.ts"], { "a.ts": "hello" });
  assert.match(text, /Auto-context/);
  assert.match(text, /### a\.ts/);
  assert.match(text, /hello/);
});
