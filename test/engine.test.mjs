import assert from "node:assert/strict";
import test from "node:test";
import { compareFromCatalog, estimateRunCost, recommendFromCatalog } from "../lib/engine.mjs";

const catalog = {
  meta: { measuredAt: "2026-09-14T00:00:00Z", taskRuns: 6, note: "sample" },
  models: [
    { id: "cheap", name: "Cheap", maker: "A", bestAt: "volume", inputPerMillion: 0.1, outputPerMillion: 0.2, benchmark: { medianLatencyMs: 900, quality: 75, tasks: { extract: { quality: 75 } } } },
    { id: "balanced", name: "Balanced", maker: "B", bestAt: "balance", inputPerMillion: 1, outputPerMillion: 2, benchmark: { medianLatencyMs: 500, quality: 90, tasks: { extract: { quality: 90 } } } },
    { id: "premium", name: "Premium", maker: "C", bestAt: "quality", inputPerMillion: 10, outputPerMillion: 20, benchmark: { medianLatencyMs: 200, quality: 100, tasks: { extract: { quality: 100 } } } }
  ]
};

test("estimates blended token cost", () => {
  assert.equal(estimateRunCost(catalog.models[1], 1000, 500), 0.002);
});

test("chooses cheapest model that clears the quality bar", () => {
  const result = recommendFromCatalog(catalog, { task: "extract", minQuality: 80, priority: "cost" });
  assert.equal(result.status, "recommended");
  assert.equal(result.recommendation.id, "balanced");
  assert.equal(result.fallback.id, "premium");
});

test("returns strongest available option when no model clears the bar", () => {
  const result = recommendFromCatalog(catalog, { task: "extract", minQuality: 100, priority: "speed" });
  assert.equal(result.recommendation.id, "premium");
});

test("compares only requested model ids", () => {
  const result = compareFromCatalog(catalog, { task: "extract", priority: "quality", modelIds: ["cheap", "premium"] });
  assert.deepEqual(result.models.map((model) => model.id), ["premium", "cheap"]);
});

test("rejects unknown task profiles", () => {
  assert.throws(() => recommendFromCatalog(catalog, { task: "legal" }), /task must be one of/);
});
