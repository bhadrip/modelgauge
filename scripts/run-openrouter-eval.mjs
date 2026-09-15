#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";

const OPENROUTER_URL = "https://openrouter.ai/api/v1";
const BUDGET_USD = 4.5;

const candidateIds = [
  "qwen/qwen3.8-flash",
  "deepseek/deepseek-v4.1-flash",
  "openai/gpt-5.6-luna",
  "google/gemini-3.8-flash",
  "anthropic/claude-sonnet-5",
  "openai/gpt-6-astra",
];

const tasks = [
  {
    id: "extract",
    label: "Invoice extraction",
    maxTokens: 900,
    system: "Return only valid JSON. Do not use Markdown fences or commentary.",
    prompt: `Extract this invoice into JSON with exactly these keys: vendor, invoice_number, date (YYYY-MM-DD), subtotal, shipping, discount, tax, total. All money values must be JSON numbers rounded to 2 decimals.\n\nVendor: Northstar Office Supply\nInvoice # NS-1048\nDate 2026/08/21\n12 gel pen packs @ $3.25\n3 grid notebooks @ $7.40\nShipping: $8.95\nDiscount: -$5.00\nTax: 7.5% of the post-discount amount including shipping.`,
    grade(raw) {
      const expected = {
        vendor: "Northstar Office Supply",
        invoice_number: "NS-1048",
        date: "2026-08-21",
        subtotal: 61.2,
        shipping: 8.95,
        discount: -5,
        tax: 4.89,
        total: 70.04,
      };
      const value = parseJson(raw);
      if (!value || Array.isArray(value)) return 0;
      const keys = Object.keys(expected);
      const correct = keys.filter((key) => {
        if (typeof expected[key] === "number") {
          return Math.abs(Number(value[key]) - expected[key]) < 0.011;
        }
        return value[key] === expected[key];
      }).length;
      return Math.round((correct / keys.length) * 100);
    },
  },
  {
    id: "triage",
    label: "Support triage",
    maxTokens: 900,
    system: "Return only valid JSON. Do not use Markdown fences or commentary.",
    prompt: `Classify each support ticket. Return {"tickets":[{"id":"...","category":"...","priority":"..."}]} in the input order. Categories must be one of account_access, billing, outage, feature_request. Priorities follow this policy: critical = all customers blocked; urgent = duplicate charge or immediate financial loss; normal = one user blocked; low = non-blocking suggestion.\n\nT-17: I forgot my password and the reset email has not arrived after ten minutes.\nT-18: Our company card was charged four times for the same $799 annual renewal.\nT-19: Every production request to the API returns HTTP 500 for all users. We cannot serve customers.\nT-20: Could you add a dark mode sometime?`,
    grade(raw) {
      const expected = [
        ["T-17", "account_access", "normal"],
        ["T-18", "billing", "urgent"],
        ["T-19", "outage", "critical"],
        ["T-20", "feature_request", "low"],
      ];
      const value = parseJson(raw);
      const tickets = Array.isArray(value?.tickets) ? value.tickets : [];
      let correct = 0;
      for (const [id, category, priority] of expected) {
        const ticket = tickets.find((item) => item?.id === id);
        if (ticket?.category === category) correct += 1;
        if (ticket?.priority === priority) correct += 1;
      }
      return Math.round((correct / (expected.length * 2)) * 100);
    },
  },
  {
    id: "code",
    label: "Small coding task",
    maxTokens: 1800,
    system: "Return only valid JSON. Do not use Markdown fences or commentary.",
    prompt: `Return {"code":"..."} where code defines a JavaScript function named allocate(total, weights). It must distribute non-negative integer total across positive numeric weights using the largest-remainder method: floor every exact share, then give remaining units to the largest fractional remainders; ties go to the lower index. Return an array of integers. Throw for invalid total or weights. Do not include tests or prose.`,
    grade(raw) {
      try {
        const parsed = parseJson(raw);
        if (typeof parsed?.code !== "string") return 0;
        const context = vm.createContext(Object.create(null));
        const fn = new vm.Script(`${parsed.code}\n;allocate`, { timeout: 100 }).runInContext(context, { timeout: 100 });
        if (typeof fn !== "function") return 0;
        const cases = [
          [fn(10, [1, 1, 1]), [4, 3, 3]],
          [fn(7, [5, 3, 2]), [4, 2, 1]],
          [fn(2, [1, 1, 1, 1]), [1, 1, 0, 0]],
          [fn(0, [2, 3]), [0, 0]],
        ];
        let points = cases.filter(([actual, expected]) => JSON.stringify(Array.from(actual)) === JSON.stringify(expected)).length;
        for (const args of [[-1, [1]], [2.5, [1]], [3, []], [3, [1, 0]]]) {
          try {
            fn(...args);
          } catch {
            points += 0.5;
          }
        }
        return Math.round((points / 6) * 100);
      } catch {
        return 0;
      }
    },
  },
];

function parseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function approximateTokens(text) {
  return Math.ceil(text.length / 3.2);
}

function percentile(values, p) {
  const ordered = [...values].sort((a, b) => a - b);
  const index = Math.min(ordered.length - 1, Math.floor(ordered.length * p));
  return ordered[index];
}

async function loadKey() {
  if (process.env.OPENROUTER_API_KEY?.trim()) return process.env.OPENROUTER_API_KEY.trim();
  const keyPath = process.env.OPENROUTER_KEY_FILE || join(homedir(), ".openrouter.key");
  const raw = (await readFile(keyPath, "utf8")).trim();
  const match = raw.match(/(?:OPENROUTER_API_KEY\s*=\s*)?['\"]?([^'\"\s]+)['\"]?/);
  if (!match?.[1]) throw new Error("No OpenRouter key found");
  return match[1];
}

async function request(path, init = {}, key) {
  const response = await fetch(`${OPENROUTER_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": "https://modelgauge.local",
      "X-Title": "ModelGauge benchmark",
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} ${body.slice(0, 300)}`);
  }
  return response.json();
}

const key = await loadKey();
const catalog = await request("/models", {}, key);
const catalogById = new Map(catalog.data.map((model) => [model.id, model]));

const missing = candidateIds.filter((id) => !catalogById.has(id));
if (missing.length) throw new Error(`Models unavailable: ${missing.join(", ")}`);

let accountedSpend = 0;
const results = [];

for (const modelId of candidateIds) {
  const model = catalogById.get(modelId);
  const promptPrice = Number(model.pricing.prompt);
  const completionPrice = Number(model.pricing.completion);
  const taskResults = [];

  for (const task of tasks) {
    const inputTokens = approximateTokens(task.system + task.prompt);
    const conservativeMaximum = (inputTokens * promptPrice + task.maxTokens * completionPrice) * 1.25;
    if (accountedSpend + conservativeMaximum > BUDGET_USD) {
      throw new Error(`Spend guard stopped before ${modelId}/${task.id}. Accounted: $${accountedSpend.toFixed(4)}`);
    }

    const started = performance.now();
    const response = await request(
      "/chat/completions",
      {
        method: "POST",
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: "system", content: task.system },
            { role: "user", content: task.prompt },
          ],
          temperature: 0,
          max_tokens: task.maxTokens,
          reasoning: { effort: "minimal", exclude: true },
          provider: { sort: "price", allow_fallbacks: true },
        }),
      },
      key,
    );
    const latencyMs = Math.round(performance.now() - started);
    const content = response.choices?.[0]?.message?.content ?? "";
    const estimatedCost =
      Number(response.usage?.prompt_tokens ?? inputTokens) * promptPrice +
      Number(response.usage?.completion_tokens ?? task.maxTokens) * completionPrice;
    const cost = Number(response.usage?.cost ?? estimatedCost);
    accountedSpend += Number.isFinite(cost) ? cost : conservativeMaximum;

    taskResults.push({
      id: task.id,
      label: task.label,
      quality: task.grade(content),
      latencyMs,
      costUsd: Number((Number.isFinite(cost) ? cost : estimatedCost).toFixed(6)),
      promptTokens: response.usage?.prompt_tokens ?? null,
      completionTokens: response.usage?.completion_tokens ?? null,
      reasoningTokens: response.usage?.completion_tokens_details?.reasoning_tokens ?? null,
      provider: response.provider ?? null,
      finishReason: response.choices?.[0]?.finish_reason ?? null,
    });
  }

  results.push({
    id: model.id,
    name: model.name.replace(/^[^:]+:\s*/, ""),
    contextLength: model.context_length,
    inputPerMillion: Number((promptPrice * 1_000_000).toFixed(6)),
    outputPerMillion: Number((completionPrice * 1_000_000).toFixed(6)),
    quality: Math.round(taskResults.reduce((sum, task) => sum + task.quality, 0) / taskResults.length),
    medianLatencyMs: percentile(taskResults.map((task) => task.latencyMs), 0.5),
    averageCostUsd: Number((taskResults.reduce((sum, task) => sum + task.costUsd, 0) / taskResults.length).toFixed(6)),
    tasks: taskResults,
  });
}

console.log(
  JSON.stringify(
    {
      run: {
        id: `openrouter-${new Date().toISOString().slice(0, 10)}`,
        measuredAt: new Date().toISOString(),
        taskCount: tasks.length,
        modelsTested: results.length,
        accountedSpendUsd: Number(accountedSpend.toFixed(6)),
        budgetGuardUsd: BUDGET_USD,
        note: "One deterministic pass per task; directional evidence, not a general leaderboard.",
      },
      models: results,
    },
    null,
    2,
  ),
);
