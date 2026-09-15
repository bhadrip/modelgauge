const state = { data: null };

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function matches(model) {
  const query = document.querySelector("#model-search").value.trim().toLowerCase();
  const maker = document.querySelector("#maker-filter").value;
  const access = document.querySelector("#access-filter").value;
  const haystack = [model.name, model.maker, model.summary, model.bestAt, model.architecture.type, ...model.capabilities].join(" ").toLowerCase();
  return (!query || haystack.includes(query))
    && (maker === "all" || model.maker === maker)
    && (access === "all" || (access === "open") === model.weights.availability.startsWith("Open"));
}

function sorted(models) {
  const sort = document.querySelector("#sort-models").value;
  return [...models].sort({
    quality: (a, b) => b.benchmark.quality - a.benchmark.quality || a.inputPerMillion - b.inputPerMillion,
    price: (a, b) => a.inputPerMillion - b.inputPerMillion,
    newest: (a, b) => b.releaseDate.localeCompare(a.releaseDate),
    context: (a, b) => b.contextLength - a.contextLength,
  }[sort]);
}

function card(model) {
  const accessClass = model.weights.availability.startsWith("Open") ? "open" : "closed";
  return `<article class="model-card" style="--model-color:${model.color}">
    <div class="model-card-topline"><span class="maker">${model.maker}</span><span class="access-badge ${accessClass}">${model.weights.availability}</span></div>
    <div class="model-card-heading"><span class="table-dot"></span><h2>${model.name}</h2></div>
    <p>${model.summary}</p>
    <div class="card-metrics">
      <div><span>Our quality</span><strong>${model.benchmark.quality}/100</strong></div>
      <div><span>Context</span><strong>${compact.format(model.contextLength)}</strong></div>
      <div><span>Input / MTok</span><strong>${dollars.format(model.inputPerMillion)}</strong></div>
    </div>
    <div class="capability-row">${model.capabilities.slice(0, 4).map((item) => `<span>${item}</span>`).join("")}</div>
    <div class="card-architecture"><span>Architecture</span><p>${model.architecture.type}</p></div>
    <a class="profile-link" href="./${model.slug}/">Open full profile <span aria-hidden="true">↗</span></a>
  </article>`;
}

function render() {
  const models = sorted(state.data.models.filter(matches));
  document.querySelector("#model-card-grid").innerHTML = models.length
    ? models.map(card).join("")
    : '<div class="empty-state"><strong>No model matches those filters.</strong><span>Try a maker, capability, or architecture term.</span></div>';
  document.querySelector("#result-count").textContent = `${models.length} profile${models.length === 1 ? "" : "s"}`;
}

function registerWebMcp() {
  if (!document.modelContext?.registerTool) return;
  const lifecycle = new AbortController();
  const registration = document.modelContext.registerTool({
    name: "search_model_profiles",
    title: "Search model profiles",
    description: "Search ModelGauge's sourced model profiles by maker, capability, architecture, access type, or free text.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        maker: { type: "string" },
        openWeightsOnly: { type: "boolean" }
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute(input) {
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("input must be an object");
      const allowed = new Set(["query", "maker", "openWeightsOnly"]);
      if (Object.keys(input).some((key) => !allowed.has(key))) throw new TypeError("unknown search field");
      if (input.query !== undefined && typeof input.query !== "string") throw new TypeError("query must be a string");
      if (input.maker !== undefined && typeof input.maker !== "string") throw new TypeError("maker must be a string");
      if (input.openWeightsOnly !== undefined && typeof input.openWeightsOnly !== "boolean") throw new TypeError("openWeightsOnly must be a boolean");
      const query = (input.query || "").toLowerCase();
      return state.data.models.filter((model) => {
        const text = [model.name, model.maker, model.summary, model.architecture.type, ...model.capabilities].join(" ").toLowerCase();
        return (!query || text.includes(query))
          && (!input.maker || model.maker.toLowerCase() === input.maker.toLowerCase())
          && (!input.openWeightsOnly || model.weights.availability.startsWith("Open"));
      }).map((model) => ({
        id: model.id,
        name: model.name,
        url: `${location.origin}/models/${model.slug}/`,
        summary: model.summary,
        quality: model.benchmark.quality,
        inputPerMillionUsd: model.inputPerMillion,
        contextLength: model.contextLength,
        access: model.weights.availability,
        verifiedAt: state.data.meta.profilesVerifiedAt
      }));
    }
  }, { signal: lifecycle.signal });
  Promise.resolve(registration).catch((error) => console.warn("WebMCP registration failed", error));
  window.addEventListener("pagehide", () => lifecycle.abort(), { once: true });
}

const response = await fetch("../data/models.json");
if (!response.ok) throw new Error(`Model catalog failed: ${response.status}`);
state.data = await response.json();

const makers = [...new Set(state.data.models.map((model) => model.maker))].sort();
document.querySelector("#maker-filter").insertAdjacentHTML("beforeend", makers.map((maker) => `<option value="${maker}">${maker}</option>`).join(""));
document.querySelector("#profile-count").textContent = state.data.models.length;
document.querySelector("#source-count").textContent = state.data.models.reduce((sum, model) => sum + model.sources.length, 0);
document.querySelector("#open-count").textContent = state.data.models.filter((model) => model.weights.availability.startsWith("Open")).length;
document.querySelector("#verified-date").textContent = new Date(`${state.data.meta.profilesVerifiedAt}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
document.querySelector("#footer-date").textContent = state.data.meta.catalogDate;

document.querySelectorAll("#model-search, #maker-filter, #access-filter, #sort-models").forEach((control) => control.addEventListener("input", render));
render();
registerWebMcp();
