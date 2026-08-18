import { probes, stageAt, stages } from "./evidence.mjs";

const stageNav = document.querySelector("#stage-nav");
const stagePanel = document.querySelector("#stage-panel");
const probeBody = document.querySelector("#probe-body");

function statusClass(status) {
  return `status status-${status}`;
}

function renderStage(index) {
  const stage = stageAt(index);
  for (const [buttonIndex, button] of [...stageNav.querySelectorAll("button")].entries()) {
    button.classList.toggle("is-active", buttonIndex === index);
    if (buttonIndex === index) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  }

  const command = stage.command
    ? `<div class="command-block"><div class="block-head"><span>RECORDED COMMAND</span><span>PowerShell / Node.js</span></div><pre><code>${escapeHtml(stage.command)}</code></pre></div>`
    : "";
  const output = stage.output.map((line) => `<code>${escapeHtml(line)}</code>`).join("");
  stagePanel.innerHTML = `<div class="panel-meta"><span>${stage.kicker}</span><span class="${statusClass(stage.status)}">${stage.label}</span></div><h3>${stage.title}</h3><p>${stage.summary}</p>${command}<div class="output-block"><div class="block-head"><span>EXECUTED EVIDENCE</span><span>deterministic</span></div>${output}</div>`;
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

for (const [index, stage] of stages.entries()) {
  const button = document.createElement("button");
  button.className = "stage-button";
  button.innerHTML = `<span class="stage-number">${String(index + 1).padStart(2, "0")}</span><span class="stage-name">${stage.kicker.split(" / ")[1]}</span><span class="${statusClass(stage.status)}">${stage.label}</span>`;
  button.addEventListener("click", () => renderStage(index));
  stageNav.append(button);
}

for (const probe of probes) {
  const row = document.createElement("div");
  row.className = "table-row";
  row.setAttribute("role", "row");
  row.innerHTML = `<span role="cell" data-label="Separator"><code>${probe.separator}</code></span><span role="cell" data-label="Raw query"><code>${probe.raw}</code></span><span role="cell" data-label="Expected"><code>${probe.expected}</code></span><span class="cell-fail" role="cell" data-label="Frozen baseline"><code>${probe.baseline}</code><em>FAIL</em></span><span class="cell-pass" role="cell" data-label="GDN final"><code>${probe.gdn}</code><em>PASS</em></span>`;
  probeBody.append(row);
}

renderStage(2);
