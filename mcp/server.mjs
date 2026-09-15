#!/usr/bin/env node

import readline from "node:readline";
import { compareModels, listBenchmarks, recommendModel } from "../lib/engine.mjs";

const serverInfo = { name: "modelgauge", version: "0.1.0" };
const protocolVersion = "2025-06-18";

const tools = [
  {
    name: "recommend_model",
    title: "Recommend an AI model",
    description: "Choose the least expensive measured model that clears a task-quality bar, or optimize for quality or speed. Returns a primary choice, fallback, cost estimate, and evidence caveat.",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string", enum: ["extract", "triage", "code"], description: "Closest measured task profile." },
        minQuality: { type: "number", minimum: 0, maximum: 100, default: 80 },
        priority: { type: "string", enum: ["cost", "quality", "speed"], default: "cost" },
        monthlyRuns: { type: "number", minimum: 0, default: 10000 },
        inputTokens: { type: "number", minimum: 0, default: 1200 },
        outputTokens: { type: "number", minimum: 0, default: 350 }
      },
      required: ["task"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "compare_models",
    title: "Compare AI models",
    description: "Compare measured quality, wall-clock latency, and estimated token cost for the selected task profile.",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string", enum: ["extract", "triage", "code"] },
        priority: { type: "string", enum: ["cost", "quality", "speed"], default: "cost" },
        modelIds: { type: "array", items: { type: "string" }, uniqueItems: true },
        inputTokens: { type: "number", minimum: 0, default: 1200 },
        outputTokens: { type: "number", minimum: 0, default: 350 }
      },
      required: ["task"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "list_benchmarks",
    title: "List benchmark evidence",
    description: "Describe the small benchmark suite, grading method, run date, and limitations behind ModelGauge recommendations.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }
];

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function success(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function failure(id, code, message, data) {
  send({ jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data ? { data } : {}) } });
}

function toolResult(value) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
    isError: false
  };
}

async function handle(message) {
  const { id, method, params = {} } = message;
  if (message.jsonrpc !== "2.0" || typeof method !== "string") {
    failure(id, -32600, "Invalid Request");
    return;
  }

  if (method === "notifications/initialized" || method === "notifications/cancelled") return;
  if (method === "initialize") {
    success(id, {
      protocolVersion: params.protocolVersion ?? protocolVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo,
      instructions: "Use recommend_model before delegating bounded extraction, triage, or small coding work when cost matters. Treat V1 results as directional evidence."
    });
    return;
  }
  if (method === "ping") {
    success(id, {});
    return;
  }
  if (method === "tools/list") {
    success(id, { tools });
    return;
  }
  if (method === "tools/call") {
    try {
      const args = params.arguments ?? {};
      let result;
      if (params.name === "recommend_model") result = await recommendModel(args);
      else if (params.name === "compare_models") result = await compareModels(args);
      else if (params.name === "list_benchmarks") result = await listBenchmarks();
      else throw new TypeError(`Unknown tool: ${params.name}`);
      success(id, toolResult(result));
    } catch (error) {
      success(id, {
        content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        isError: true
      });
    }
    return;
  }
  failure(id, -32601, "Method not found");
}

const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity, terminal: false });
input.on("line", async (line) => {
  if (!line.trim()) return;
  try {
    await handle(JSON.parse(line));
  } catch (error) {
    failure(null, -32700, "Parse error", error instanceof Error ? error.message : String(error));
  }
});
