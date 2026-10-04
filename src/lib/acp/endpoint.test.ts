import assert from "node:assert/strict";
import test from "node:test";
import { acpEndpointError } from "./endpoint.ts";

test("a hosted agent cannot point at the server's own network", () => {
  assert.equal(acpEndpointError("https://agent.example/hook", false), null);
  assert.match(acpEndpointError("http://169.254.169.254/", false) ?? "", /not allowed/);
  assert.match(acpEndpointError("http://10.0.0.1/", false) ?? "", /not allowed/);
  assert.match(acpEndpointError("http://metadata.google.internal/", false) ?? "", /not allowed/);
  assert.match(acpEndpointError("https://[::ffff:a9fe:a9fe]/", false) ?? "", /not allowed/);
  assert.match(acpEndpointError("http://agent.example/hook", false) ?? "", /https/);
  assert.match(acpEndpointError("https://user:pass@agent.example/", false) ?? "", /token/);
});

test("metadata stays blocked even when local endpoints are allowed", () => {
  assert.equal(acpEndpointError("http://10.1.2.3:8080/hook", true), null);
  assert.match(acpEndpointError("http://169.254.169.254/latest/", true) ?? "", /not allowed/);
  assert.match(acpEndpointError("http://metadata.google.internal/", true) ?? "", /not allowed/);
});
