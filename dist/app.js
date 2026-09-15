const taskPrompts = {
  extract: "Extract line items and totals from messy invoices into strict JSON.",
  triage: "Classify incoming support tickets by category and operational priority.",
  code: "Implement and validate a small, well-specified JavaScript utility.",
};

const app = {
  data: null,
  task: "extract",
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 });
const wholeMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

function estimateRunCost(model) {
  const inputTokens = 1200;
  const outputTokens = 350;
  return (inputTokens * model.inputPerMillion + outputTokens * model.outputPerMillion) / 1_000_000;
}

function taskQuality(model, task) {
  return model.benchmark?.tasks?.[task]?.quality ?? model.benchmark?.quality ?? null;
}

function taskLatency(model, task) {
  return model.benchmark?.tasks?.[task]?.latencyMs ?? model.benchmark?.medianLatencyMs ?? Number.POSITIVE_INFINITY;
}

function rankedModels() {
  const minQuality = Number(document.querySelector("#quality-range").value);
  const priority = document.querySelector('input[name="priority"]:checked').value;
  const measured = app.data.models.map((model) => ({
    ...model,
    taskQuality: taskQuality(model, app.task),
    runCost: estimateRunCost(model),
    latency: taskLatency(model, app.task),
  }));
  const eligible = measured.filter((model) => model.taskQuality === null || model.taskQuality >= minQuality);
  const pool = eligible.length ? eligible : measured;
  const compare = {
    cost: (a, b) => a.runCost - b.runCost || (b.taskQuality ?? 0) - (a.taskQuality ?? 0),
    quality: (a, b) => (b.taskQuality ?? 0) - (a.taskQuality ?? 0) || a.runCost - b.runCost,
    speed: (a, b) => a.latency - b.latency || a.runCost - b.runCost,
  }[priority];
  return { models: pool.sort(compare), metBar: eligible.length > 0 };
}

function formatLatency(ms) {
  if (!Number.isFinite(ms)) return "—";
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function renderRecommendation(explicitModel = null) {
  const { models, metBar } = rankedModels();
  const selected = explicitModel ?? models[0];
  const fallback = models.find((model) => model.id !== selected.id) ?? selected;
  const volume = Number(document.querySelector("#monthly-volume").value);
  const quality = taskQuality(selected, app.task);
  const runCost = estimateRunCost(selected);

  document.querySelector("#result-maker").textContent = selected.maker;
  document.querySelector("#result-title").textContent = selected.name;
  document.querySelector("#model-monogram").textContent = selected.name.slice(0, 1);
  document.querySelector("#model-monogram").style.background = selected.color;
  document.querySelector("#result-quality").textContent = quality === null ? "—" : `${quality}/100`;
  document.querySelector("#result-latency").textContent = formatLatency(taskLatency(selected, app.task));
  document.querySelector("#result-cost").textContent = money.format(runCost);
  document.querySelector("#result-monthly").textContent = wholeMoney.format(runCost * volume);
  document.querySelector("#fallback-name").textContent = fallback.name;
  document.querySelector("#fallback-note").textContent = fallback.benchmark ? `${taskQuality(fallback, app.task)}/100 · ${formatLatency(taskLatency(fallback, app.task))}` : "Next-lowest live price";
  document.querySelector("#confidence").textContent = quality === null ? "Catalog fit" : metBar ? "Clears your bar" : "Best available";
  document.querySelector("#result-reason").textContent = quality === null
    ? `${selected.strengths} The sample quality run is still in progress.`
    : `${selected.strengths} It scored ${quality}/100 on the matching sample task at about ${money.format(runCost)} per run.`;
}

function renderTable() {
  const body = document.querySelector("#model-table");
  body.innerHTML = app.data.models.map((model) => {
    const quality = taskQuality(model, app.task);
    return `<tr tabindex="0" data-model-id="${model.id}">
      <td><div class="table-model"><span class="table-dot" style="--model-color:${model.color}"></span>${model.name}</div></td>
      <td>${model.bestAt}</td>
      <td class="quality-cell">${quality === null ? '<span class="pending">Pending</span>' : `<span class="mono">${quality}/100</span><div class="quality-bar"><i style="width:${quality}%"></i></div>`}</td>
      <td class="mono">${formatLatency(taskLatency(model, app.task))}</td>
      <td class="mono">$${model.inputPerMillion} / $${model.outputPerMillion}</td>
      <td class="mono">${money.format(estimateRunCost(model))}</td>
    </tr>`;
  }).join("");
  body.querySelectorAll("tr").forEach((row) => {
    const select = () => {
      const model = app.data.models.find((item) => item.id === row.dataset.modelId);
      renderRecommendation(model);
      document.querySelector("#decision-title").scrollIntoView({ behavior: "smooth", block: "start" });
    };
    row.addEventListener("click", select);
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        select();
      }
    });
  });
}

function renderMeta() {
  const { meta } = app.data;
  document.querySelector("#models-tested").textContent = app.data.models.length;
  document.querySelector("#tasks-run").textContent = meta.taskRuns || "—";
  document.querySelector("#experiment-spend").textContent = meta.accountedSpendUsd === null ? "Running" : money.format(meta.accountedSpendUsd);
  document.querySelector("#catalog-date").textContent = new Date(`${meta.catalogDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  document.querySelector("#footer-date").textContent = meta.catalogDate;
  document.querySelector("#evidence-note").textContent = meta.method;
}

function registerWebMcp() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  const registration = context.registerTool(
    {
      name: "recommend_model",
      title: "Recommend a model",
      description: "Update the ModelGauge decision console and return the lowest-cost measured model that clears the requested task-quality bar.",
      inputSchema: {
        type: "object",
        properties: {
          task: { type: "string", enum: ["extract", "triage", "code"] },
          minQuality: { type: "number", minimum: 50, maximum: 100 },
          priority: { type: "string", enum: ["cost", "quality", "speed"] },
          monthlyRuns: { type: "number", enum: [1000, 10000, 100000, 1000000] }
        },
        required: ["task"],
        additionalProperties: false
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!taskPrompts[input.task]) throw new TypeError("Unknown task profile");
        app.task = input.task;
        document.querySelectorAll(".preset").forEach((button) => button.classList.toggle("active", button.dataset.task === app.task));
        document.querySelector("#task-input").value = taskPrompts[app.task];
        if (input.minQuality !== undefined) {
          document.querySelector("#quality-range").value = String(input.minQuality);
          document.querySelector("#quality-output").textContent = String(input.minQuality);
        }
        if (input.priority !== undefined) document.querySelector(`input[name="priority"][value="${input.priority}"]`).checked = true;
        if (input.monthlyRuns !== undefined) document.querySelector("#monthly-volume").value = String(input.monthlyRuns);
        renderTable();
        renderRecommendation();
        const ranked = rankedModels();
        const selected = ranked.models[0];
        return {
          status: ranked.metBar ? "recommended" : "no_model_cleared_bar",
          task: app.task,
          model: selected.id,
          name: selected.name,
          quality: selected.taskQuality,
          estimatedCostPerRunUsd: Number(selected.runCost.toFixed(8)),
          fallback: ranked.models[1]?.id ?? null
        };
      }
    },
    { signal: lifecycle.signal }
  );
  Promise.resolve(registration).catch((error) => console.warn("WebMCP registration failed", error));
  window.addEventListener("pagehide", () => lifecycle.abort(), { once: true });
}

document.querySelectorAll(".preset").forEach((button) => {
  button.addEventListener("click", () => {
    app.task = button.dataset.task;
    document.querySelectorAll(".preset").forEach((item) => item.classList.toggle("active", item === button));
    document.querySelector("#task-input").value = taskPrompts[app.task];
    renderTable();
    renderRecommendation();
  });
});

document.querySelector("#quality-range").addEventListener("input", (event) => {
  document.querySelector("#quality-output").textContent = event.target.value;
});

document.querySelector("#recommend-form").addEventListener("submit", (event) => {
  event.preventDefault();
  renderRecommendation();
});

document.querySelectorAll('input[name="priority"], #monthly-volume').forEach((input) => input.addEventListener("change", () => renderRecommendation()));

try {
  const response = await fetch("./data/models.json");
  if (!response.ok) throw new Error(`Data request failed: ${response.status}`);
  app.data = await response.json();
  renderMeta();
  renderTable();
  renderRecommendation();
  registerWebMcp();
} catch (error) {
  document.querySelector("#evidence-note").textContent = "Model data could not be loaded.";
  console.error(error);
}
