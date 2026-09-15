const slug = document.body.dataset.modelSlug;
const taskNames = { extract: "Invoice extraction", triage: "Support triage", code: "JavaScript utility" };
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 6 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });

if (!document.querySelector("#profile-name")) {
  const shellResponse = await fetch("../profile-template.html");
  if (!shellResponse.ok) throw new Error(`Profile shell failed: ${shellResponse.status}`);
  document.body.insertAdjacentHTML("afterbegin", await shellResponse.text());
}

const response = await fetch("../../data/models.json");
if (!response.ok) throw new Error(`Model catalog failed: ${response.status}`);
const catalog = await response.json();
const model = catalog.models.find((item) => item.slug === slug);
if (!model) throw new Error(`Unknown model profile: ${slug}`);

const latency = (ms) => ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
const link = (item) => `<a class="resource-link" href="${item.url}" target="_blank" rel="noreferrer"><div><span>${item.kind}</span><strong>${item.label}</strong></div><b aria-hidden="true">↗</b></a>`;

document.documentElement.style.setProperty("--model-color", model.color);
document.querySelectorAll("[data-profile-maker]").forEach((item) => { item.textContent = model.maker; });
document.querySelector("#profile-name").textContent = model.name;
document.querySelector("#profile-monogram").textContent = model.name[0];
document.querySelector("#profile-summary").textContent = model.summary;
document.querySelector("#profile-status").textContent = model.status;
document.querySelector("#profile-api-id").textContent = model.apiId;
document.querySelector("#profile-release").textContent = new Date(`${model.releaseDate}T12:00:00`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
document.querySelector("#profile-access").textContent = model.weights.availability;
document.querySelector("#profile-actions").innerHTML = model.links.slice(0, 3).map((item) => `<a href="${item.url}" target="_blank" rel="noreferrer">${item.label} ↗</a>`).join("");

document.querySelector("#context-value").textContent = compact.format(model.contextLength);
document.querySelector("#output-value").textContent = compact.format(model.maxOutputTokens);
document.querySelector("#pricing-value").textContent = `$${model.inputPerMillion} / $${model.outputPerMillion}`;
document.querySelector("#quality-value").textContent = `${model.benchmark.quality}/100`;

document.querySelector("#eval-grid").innerHTML = Object.entries(model.benchmark.tasks).map(([task, result]) => `<article class="eval-card">
  <div class="eval-titleline"><h3>${taskNames[task]}</h3><span class="eval-score">${result.quality}/100</span></div>
  <div class="eval-meter"><i style="width:${result.quality}%"></i></div>
  <div class="eval-facts"><div><span>Latency</span><strong>${latency(result.latencyMs)}</strong></div><div><span>Actual cost</span><strong>${money.format(result.costUsd)}</strong></div><div><span>Provider</span><strong>${result.provider}</strong></div></div>
  <p class="eval-note">${result.finishReason === "length" ? `Hit the output cap after ${result.reasoningTokens.toLocaleString()} reasoning tokens; no gradeable answer.` : `${result.reasoningTokens.toLocaleString()} reasoning tokens · finish: ${result.finishReason}`}</p>
</article>`).join("");

document.querySelector("#architecture-title").textContent = model.architecture.type;
document.querySelector("#architecture-details").textContent = model.architecture.details;
document.querySelector("#architecture-specs").innerHTML = [
  ["Parameters", model.architecture.parameters],
  ["Active parameters", model.architecture.activeParameters],
  ["Layers", model.architecture.layers],
  ["Input", model.modalities.input.join(", ")],
  ["Output", model.modalities.output.join(", ")],
  ["Knowledge cutoff", model.knowledgeCutoff]
].map(([label, value]) => `<li><span>${label}</span><strong>${value}</strong></li>`).join("");
document.querySelector("#disclosure-note").textContent = model.architecture.disclosure;
document.querySelector("#weight-title").textContent = model.weights.availability;
document.querySelector("#weight-specs").innerHTML = [["License", model.weights.license], ["Format", model.weights.format]].map(([label, value]) => `<li><span>${label}</span><strong>${value}</strong></li>`).join("");
document.querySelector("#weight-link").outerHTML = model.weights.huggingFace
  ? `<a class="weights-cta" href="${model.weights.huggingFace}" target="_blank" rel="noreferrer">Open Hugging Face weights ↗</a>`
  : '<p class="disclosure-note">No official downloadable weights or Hugging Face model card.</p>';

document.querySelector("#capability-wall").innerHTML = model.capabilities.map((item) => `<span>${item}</span>`).join("");
document.querySelector("#vendor-benchmarks").innerHTML = model.vendorBenchmarks.length
  ? model.vendorBenchmarks.map((item) => `<article class="benchmark-card"><span>${item.category}</span><strong>${item.score}</strong><h3>${item.name}</h3><small>Vendor-reported · ${item.source}</small></article>`).join("")
  : '<p class="no-vendor-evals">No vendor-reported benchmark rows are imported into this profile yet. ModelGauge measurements above remain available and are clearly separated.</p>';

document.querySelector("#price-input").textContent = `$${model.inputPerMillion}`;
document.querySelector("#price-output").textContent = `$${model.outputPerMillion}`;
document.querySelector("#pricing-note").textContent = model.pricingNote;
document.querySelector("#caveat-list").innerHTML = model.caveats.map((item) => `<div>${item}</div>`).join("");
document.querySelector("#link-grid").innerHTML = model.links.map(link).join("");
document.querySelector("#source-ledger").innerHTML = model.sources.map((source) => `<div class="source-row"><a href="${source.url}" target="_blank" rel="noreferrer">${source.label} ↗</a><span>${source.scope}</span><time datetime="${source.checkedAt}">Checked ${source.checkedAt}</time></div>`).join("");
document.querySelector("#verified-date").textContent = catalog.meta.profilesVerifiedAt;
document.querySelector("#footer-date").textContent = catalog.meta.catalogDate;

function calculate() {
  const input = Number(document.querySelector("#calc-input").value) || 0;
  const output = Number(document.querySelector("#calc-output").value) || 0;
  const runs = Number(document.querySelector("#calc-runs").value) || 0;
  const total = ((input * model.inputPerMillion + output * model.outputPerMillion) / 1_000_000) * runs;
  document.querySelector("#calc-total").textContent = money.format(total);
  document.querySelector("#calc-caption").textContent = `${runs.toLocaleString()} runs · ${(input + output).toLocaleString()} tokens each · cache and tool fees excluded`;
}
document.querySelectorAll("#calc-input, #calc-output, #calc-runs").forEach((input) => input.addEventListener("input", calculate));
calculate();

function registerWebMcp() {
  if (!document.modelContext?.registerTool) return;
  const lifecycle = new AbortController();
  const registration = document.modelContext.registerTool({
    name: "get_model_facts",
    title: `Get facts for ${model.name}`,
    description: `Return the sourced ModelGauge profile for ${model.name}, including specs, pricing, architecture disclosure, measured evals, weights, and original sources.`,
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute(input) {
      if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length) {
        throw new TypeError("get_model_facts accepts an empty object only");
      }
      return {
        id: model.id,
        name: model.name,
        maker: model.maker,
        summary: model.summary,
        status: model.status,
        releaseDate: model.releaseDate,
        contextLength: model.contextLength,
        maxOutputTokens: model.maxOutputTokens,
        pricingPerMillionUsd: { input: model.inputPerMillion, output: model.outputPerMillion, note: model.pricingNote },
        modalities: model.modalities,
        capabilities: model.capabilities,
        architecture: model.architecture,
        weights: model.weights,
        measuredBenchmark: model.benchmark,
        vendorBenchmarks: model.vendorBenchmarks,
        caveats: model.caveats,
        sources: model.sources,
        verifiedAt: catalog.meta.profilesVerifiedAt
      };
    }
  }, { signal: lifecycle.signal });
  Promise.resolve(registration).catch((error) => console.warn("WebMCP registration failed", error));
  window.addEventListener("pagehide", () => lifecycle.abort(), { once: true });
}
registerWebMcp();
