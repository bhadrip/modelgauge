import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const catalog = JSON.parse(await readFile(new URL("../dist/data/models.json", import.meta.url), "utf8"));

test("every model has a unique, routable, sourced profile", async () => {
  assert.equal(catalog.models.length, 6);
  assert.equal(new Set(catalog.models.map((model) => model.slug)).size, catalog.models.length);

  for (const model of catalog.models) {
    assert.ok(model.summary);
    assert.ok(model.architecture?.type);
    assert.ok(model.architecture?.parameters);
    assert.ok(model.modalities?.input?.length);
    assert.ok(model.capabilities?.length >= 4);
    assert.ok(model.sources?.length >= 2);
    assert.ok(model.sources.every((source) => source.url.startsWith("https://") && source.checkedAt));
    await access(new URL(`../dist/models/${model.slug}/index.html`, import.meta.url));
  }
});

test("open-weight profiles link to first-party Hugging Face pages", () => {
  const openModels = catalog.models.filter((model) => model.weights.availability === "Open weights");
  assert.equal(openModels.length, 2);
  assert.ok(openModels.every((model) => model.weights.huggingFace?.startsWith("https://huggingface.co/")));
});

test("undisclosed proprietary architecture is explicit", () => {
  const proprietary = catalog.models.filter((model) => model.weights.availability === "Proprietary API");
  assert.ok(proprietary.every((model) => model.architecture.parameters === "Not publicly disclosed"));
  assert.ok(proprietary.every((model) => model.weights.huggingFace === null));
});
