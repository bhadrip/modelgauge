import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const catalogUrl = new URL("../dist/data/models.json", import.meta.url);
const allowedTasks = new Set(["extract", "triage", "code"]);
const allowedPriorities = new Set(["cost", "quality", "speed"]);

export async function loadCatalog() {
  return JSON.parse(await readFile(fileURLToPath(catalogUrl), "utf8"));
}

export function estimateRunCost(model, inputTokens = 1200, outputTokens = 350) {
  return (inputTokens * model.inputPerMillion + outputTokens * model.outputPerMillion) / 1_000_000;
}

function qualityFor(model, task) {
  return model.benchmark?.tasks?.[task]?.quality ?? model.benchmark?.quality ?? null;
}

function latencyFor(model, task) {
  return model.benchmark?.tasks?.[task]?.latencyMs ?? model.benchmark?.medianLatencyMs ?? null;
}

function normalizeOptions(options = {}) {
  const task = options.task ?? "extract";
  const priority = options.priority ?? "cost";
  const minQuality = Number(options.minQuality ?? 80);
  const monthlyRuns = Number(options.monthlyRuns ?? 10_000);
  const inputTokens = Number(options.inputTokens ?? 1200);
  const outputTokens = Number(options.outputTokens ?? 350);

  if (!allowedTasks.has(task)) throw new TypeError(`task must be one of: ${[...allowedTasks].join(", ")}`);
  if (!allowedPriorities.has(priority)) throw new TypeError(`priority must be one of: ${[...allowedPriorities].join(", ")}`);
  for (const [name, value] of Object.entries({ minQuality, monthlyRuns, inputTokens, outputTokens })) {
    if (!Number.isFinite(value) || value < 0) throw new TypeError(`${name} must be a non-negative number`);
  }
  if (minQuality > 100) throw new TypeError("minQuality cannot exceed 100");
  return { task, priority, minQuality, monthlyRuns, inputTokens, outputTokens };
}

function publicModel(model, options) {
  const quality = qualityFor(model, options.task);
  const estimatedCostPerRunUsd = estimateRunCost(model, options.inputTokens, options.outputTokens);
  return {
    id: model.id,
    name: model.name,
    maker: model.maker,
    bestAt: model.bestAt,
    quality,
    measuredLatencyMs: latencyFor(model, options.task),
    estimatedCostPerRunUsd: Number(estimatedCostPerRunUsd.toFixed(8)),
    estimatedMonthlyCostUsd: Number((estimatedCostPerRunUsd * options.monthlyRuns).toFixed(2)),
    inputPerMillion: model.inputPerMillion,
    outputPerMillion: model.outputPerMillion,
  };
}

function compareBy(priority) {
  if (priority === "quality") {
    return (a, b) => (b.quality ?? -1) - (a.quality ?? -1) || a.estimatedCostPerRunUsd - b.estimatedCostPerRunUsd;
  }
  if (priority === "speed") {
    return (a, b) => (a.measuredLatencyMs ?? Infinity) - (b.measuredLatencyMs ?? Infinity) || a.estimatedCostPerRunUsd - b.estimatedCostPerRunUsd;
  }
  return (a, b) => a.estimatedCostPerRunUsd - b.estimatedCostPerRunUsd || (b.quality ?? -1) - (a.quality ?? -1);
}

export function recommendFromCatalog(catalog, rawOptions = {}) {
  const options = normalizeOptions(rawOptions);
  const ranked = catalog.models.map((model) => publicModel(model, options));
  const eligible = ranked.filter((model) => model.quality !== null && model.quality >= options.minQuality);
  const usedFallbackPool = eligible.length === 0;
  const pool = (usedFallbackPool ? ranked : eligible).sort(compareBy(options.priority));
  const primary = pool[0];
  const fallback = pool.find((model) => model.id !== primary.id) ?? null;

  return {
    task: options.task,
    priority: options.priority,
    minimumQuality: options.minQuality,
    status: usedFallbackPool ? "no_model_cleared_bar" : "recommended",
    recommendation: primary,
    fallback,
    rationale: usedFallbackPool
      ? `No measured model cleared ${options.minQuality}/100, so this is the strongest available ${options.priority}-first option.`
      : `${primary.name} clears ${options.minQuality}/100 and ranks first when optimizing for ${options.priority}.`,
    evidence: {
      measuredAt: catalog.meta.measuredAt,
      taskRuns: catalog.meta.taskRuns,
      caveat: catalog.meta.note,
    },
  };
}

export async function recommendModel(options) {
  return recommendFromCatalog(await loadCatalog(), options);
}

export function compareFromCatalog(catalog, rawOptions = {}) {
  const options = normalizeOptions(rawOptions);
  const requestedIds = Array.isArray(rawOptions.modelIds) ? new Set(rawOptions.modelIds) : null;
  const models = catalog.models
    .filter((model) => !requestedIds || requestedIds.has(model.id))
    .map((model) => publicModel(model, options))
    .sort(compareBy(options.priority));
  if (!models.length) throw new TypeError("No matching models found");
  return { task: options.task, priority: options.priority, models, measuredAt: catalog.meta.measuredAt };
}

export async function compareModels(options) {
  return compareFromCatalog(await loadCatalog(), options);
}

export async function listBenchmarks() {
  const catalog = await loadCatalog();
  return {
    measuredAt: catalog.meta.measuredAt,
    method: catalog.meta.method,
    note: catalog.meta.note,
    totalSpendUsd: catalog.meta.accountedSpendUsd,
    tasks: [
      { id: "extract", label: "Invoice extraction", grader: "8 exact fields" },
      { id: "triage", label: "Support triage", grader: "8 exact category/priority labels" },
      { id: "code", label: "Small coding task", grader: "4 behavior and 4 validation cases" },
    ],
  };
}
