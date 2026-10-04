import assert from "node:assert/strict";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { customAddressAllowed } from "../agent/custom-endpoint.ts";
import { customEndpointFetch } from "../agent/custom-endpoint.server.ts";
import { pinnedFetch } from "./pinned-fetch.server.ts";

/** A local server that records what reached it. `/hop` redirects. */
async function server() {
  const seen: IncomingMessage[] = [];
  const srv = createServer((req, res) => {
    seen.push(req);
    if (req.url === "/hop") {
      res.writeHead(302, { Location: "http://169.254.169.254/latest/meta-data" });
      res.end();
      return;
    }
    res.end(`host=${req.headers.host}`);
  });
  await new Promise<void>((resolve) => srv.listen(0, "127.0.0.1", resolve));
  const port = (srv.address() as AddressInfo).port;
  return { port, seen, close: () => new Promise<void>((resolve) => srv.close(() => resolve())) };
}

const loopback = (address: string) => address === "127.0.0.1";

test("connects to the address that was checked, under the name it was given", async () => {
  const s = await server();
  let lookups = 0;
  const resolve = async () => {
    lookups += 1;
    return ["127.0.0.1"];
  };
  const { response, close } = await pinnedFetch(
    `http://models.example:${s.port}/v1`,
    {},
    loopback,
    resolve,
  );
  assert.equal(await response.text(), `host=models.example:${s.port}`);
  await close();
  await s.close();
  // One lookup: the connection reuses the checked answer instead of asking again.
  assert.equal(lookups, 1);
});

test("refuses before connecting when any resolved address is not allowed", async () => {
  const s = await server();
  const resolve = async () => ["127.0.0.1", "10.0.0.7"];
  await assert.rejects(
    pinnedFetch(`http://models.example:${s.port}/`, {}, loopback, resolve),
    /not allowed/,
  );
  await assert.rejects(
    pinnedFetch(`http://models.example:${s.port}/`, {}, loopback, async () => []),
    /not allowed/,
  );
  await s.close();
  assert.equal(s.seen.length, 0);
});

test("never follows a redirect", async () => {
  const s = await server();
  const { response, close } = await pinnedFetch(
    `http://models.example:${s.port}/hop`,
    {},
    loopback,
    async () => ["127.0.0.1"],
  );
  assert.equal(response.status, 302);
  await close();
  await s.close();
  assert.equal(s.seen.length, 1);
});

test("a loopback custom endpoint stays on loopback; any other host must resolve public", () => {
  assert.equal(customAddressAllowed("127.0.0.1", "127.0.0.1"), true);
  assert.equal(customAddressAllowed("localhost", "::1"), true);
  assert.equal(customAddressAllowed("localhost", "10.0.0.7"), false);
  assert.equal(customAddressAllowed("openrouter.ai", "104.18.2.1"), true);
  assert.equal(customAddressAllowed("openrouter.ai", "127.0.0.1"), false);
  assert.equal(customAddressAllowed("openrouter.ai", "169.254.169.254"), false);
  assert.equal(customAddressAllowed("openrouter.ai", "::ffff:10.0.0.7"), false);
});

test("a custom endpoint call goes through the pinned connection", async () => {
  const s = await server();
  const dev = { NODE_ENV: "development" };
  const base = `http://localhost:${s.port}/v1`;
  const { response, close } = await customEndpointFetch(
    base,
    "/chat/completions",
    {},
    dev,
    async () => ["127.0.0.1"],
  );
  assert.equal(response.status, 200);
  await close();
  // localhost that resolves off the machine is refused, not followed.
  await assert.rejects(
    customEndpointFetch(base, "/chat/completions", {}, dev, async () => ["10.0.0.7"]),
    /not allowed/,
  );
  // Deployed, loopback is the server itself: refused before any lookup.
  await assert.rejects(
    customEndpointFetch(base, "/chat/completions", {}, { VERCEL: "1" }),
    /your own machine/,
  );
  await s.close();
  assert.equal(s.seen.length, 1);
  assert.equal(s.seen[0]!.url, "/v1/chat/completions");
});
