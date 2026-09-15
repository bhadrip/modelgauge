import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";

function startServer() {
  const child = spawn(process.execPath, ["mcp/server.mjs"], { cwd: new URL("..", import.meta.url), stdio: ["pipe", "pipe", "pipe"] });
  const responses = [];
  let buffer = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines.filter(Boolean)) responses.push(JSON.parse(line));
  });
  return { child, responses };
}

async function waitFor(responses, count) {
  const deadline = Date.now() + 3000;
  while (responses.length < count && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(responses.length >= count, `expected ${count} MCP responses`);
}

test("lists and calls ModelGauge tools over stdio", async (t) => {
  const { child, responses } = startServer();
  t.after(() => child.kill());
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } } })}\n`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })}\n`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "recommend_model", arguments: { task: "extract", minQuality: 0, priority: "cost" } } })}\n`);
  await waitFor(responses, 3);
  assert.equal(responses[0].result.serverInfo.name, "modelgauge");
  assert.deepEqual(responses[1].result.tools.map((tool) => tool.name), ["recommend_model", "compare_models", "list_benchmarks"]);
  assert.equal(responses[2].result.isError, false);
  assert.ok(responses[2].result.structuredContent.recommendation.id);
});
