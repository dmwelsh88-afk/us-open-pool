let state = null;
let adminPassword = localStorage.getItem("adminPassword") || "";

const requiredPicks = { 1: 3, 2: 2, 3: 2, 4: 1 };
const tierLabels = {
  1: "Tier 1 - Pick 3",
  2: "Tier 2 - Pick 2",
  3: "Tier 3 - Pick 2",
  4: "Tier 4 - Pick 1"
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function formatScore(value) {
  if (value > 0) return `+${value}`;
  return String(value);
}

function setMessage(selector, text, isError = false) {
  const element = $(selector);
  element.textContent = text;
  element.style.color = isError ? "var(--red)" : "var(--muted)";
}

async function api(path, options = {}) {
  const { headers = {}, ...rest } = options;
  const response = await fetch(path, {
    ...rest,
    headers: { "Content-Type": "application/json", ...headers }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Something went wrong.");
  return body;
}

function adminHeaders() {
  return adminPassword ? { "X-Admin-Password": adminPassword } : {};
}

async function loadState() {
  state = await api("/api/state");
  render();
}

function render() {
  renderHeader();
  renderAdminPassword();
  renderPickForm();
  renderLeaderboard();
  renderScores();
  renderAdminEntries();
}

function renderAdminPassword() {
  $("#adminPassword").value = adminPassword;
}

function renderHeader() {
  $("#entryCount").textContent = state.entries.length;
  $("#potAmount").textContent = `$${state.entries.length * 20}`;
  $("#updatedAt").textContent = `Updated ${new Date(state.updatedAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  })}`;
}

function renderPickForm() {
  const host = $("#pickGroups");
  if (host.dataset.rendered === "true") return;
  host.dataset.rendered = "true";
  const template = $("#pickGroupTemplate");
  Object.entries(state.tiers).forEach(([tier, golfers]) => {
    const clone = template.content.cloneNode(true);
    $("legend", clone).textContent = tierLabels[tier];
    $(".pick-count", clone).textContent = `Choose ${requiredPicks[tier]} golfer${requiredPicks[tier] === 1 ? "" : "s"}.`;
    const list = $(".golfer-list", clone);
    golfers.forEach((golfer) => {
      const label = document.createElement("label");
      label.className = "golfer-option";
      label.innerHTML = `
        <input type="checkbox" name="tier-${tier}" value="${golfer}">
        <span>${golfer}</span>
      `;
      list.append(label);
    });
    host.append(clone);
  });
  host.addEventListener("change", enforcePickLimits);
}

function enforcePickLimits() {
  Object.keys(requiredPicks).forEach((tier) => {
    const boxes = $$(`input[name="tier-${tier}"]`);
    const checked = boxes.filter((box) => box.checked);
    boxes.forEach((box) => {
      box.disabled = !box.checked && checked.length >= requiredPicks[tier];
    });
  });
}

function renderLeaderboard() {
  const host = $("#leaderboardRows");
  host.innerHTML = "";
  if (!state.leaderboard.length) {
    host.innerHTML = `<div class="leaderboard-row"><strong>No entries yet.</strong><div class="subline">Once picks come in, the live standings will show here.</div></div>`;
    return;
  }
  state.leaderboard.forEach((entry) => {
    const row = document.createElement("article");
    row.className = "leaderboard-row";
    const bonusText = entry.bonus ? ` · Bonus ${formatScore(entry.bonus)}` : "";
    row.innerHTML = `
      <div class="leaderboard-main">
        <div class="rank">${entry.rank}</div>
        <div>
          <strong>${entry.name}</strong>
          <div class="subline">Base ${formatScore(entry.baseScore)}${bonusText} · ${entry.paid ? "Paid" : "Unpaid"}</div>
        </div>
        <div class="score">${formatScore(entry.totalScore)}</div>
      </div>
      <div class="picks-line"></div>
    `;
    const picks = $(".picks-line", row);
    entry.golfers.forEach((golfer) => {
      const chip = document.createElement("span");
      chip.className = `chip ${entry.counting.includes(golfer.name) ? "counting" : ""} ${golfer.bonus ? "bonus" : ""}`;
      chip.textContent = `${golfer.name} ${formatScore(golfer.total)}${golfer.bonus ? ` (${formatScore(golfer.bonus)})` : ""}`;
      picks.append(chip);
    });
    host.append(row);
  });
}

function renderScores() {
  const host = $("#scoreEditor");
  const search = $("#scoreSearch").value.trim().toLowerCase();
  host.innerHTML = "";
  Object.entries(state.tiers).forEach(([tier, golfers]) => {
    golfers
      .filter((name) => !search || name.toLowerCase().includes(search))
      .forEach((name) => {
        const score = state.scores[name] || { rounds: [null, null, null, null], status: "active", finish: null };
        const row = document.createElement("div");
        row.className = "score-row";
        row.dataset.name = name;
        row.innerHTML = `
          <div class="score-name">${name}<div class="subline">Tier ${tier}</div></div>
          ${[0, 1, 2, 3]
            .map((index) => `<input inputmode="numeric" aria-label="Round ${index + 1}" data-round="${index}" placeholder="R${index + 1}" value="${score.rounds[index] ?? ""}">`)
            .join("")}
          <select data-status aria-label="Status">
            <option value="active">Active</option>
            <option value="cut">MC</option>
            <option value="wd">WD</option>
          </select>
          <input class="finish" inputmode="numeric" data-finish placeholder="Fin" value="${score.finish ?? ""}">
        `;
        $("[data-status]", row).value = score.status;
        host.append(row);
      });
  });
}

function renderAdminEntries() {
  const host = $("#adminEntries");
  host.innerHTML = "";
  if (!state.entries.length) {
    host.innerHTML = `<p class="muted">No entries yet.</p>`;
    return;
  }
  state.entries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "admin-entry";
    row.innerHTML = `
      <div>
        <strong>${entry.name}</strong>
        <span class="muted">${entry.venmo || "No Venmo"} · ${entry.paid ? "Paid" : "Unpaid"}</span>
      </div>
      <div class="controls">
        <button class="secondary" data-paid="${entry.id}">${entry.paid ? "Unpay" : "Paid"}</button>
        <button class="danger" data-delete="${entry.id}">Delete</button>
      </div>
    `;
    host.append(row);
  });
}

function selectedPicks() {
  const picks = {};
  Object.keys(requiredPicks).forEach((tier) => {
    picks[tier] = $$(`input[name="tier-${tier}"]:checked`).map((box) => box.value);
  });
  return picks;
}

async function submitEntry(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const body = {
    name: form.elements.name.value,
    venmo: form.elements.venmo.value,
    picks: selectedPicks()
  };
  try {
    await api("/api/entries", { method: "POST", body: JSON.stringify(body) });
    form.reset();
    enforcePickLimits();
    setMessage("#entryMessage", "Entry submitted.");
    await loadState();
    activateTab("leaderboard");
  } catch (error) {
    setMessage("#entryMessage", error.message, true);
  }
}

function visibleScoreUpdates() {
  return $$(".score-row").map((row) => ({
    name: row.dataset.name,
    rounds: $$("[data-round]", row).map((input) => input.value),
    status: $("[data-status]", row).value,
    finish: $("[data-finish]", row).value
  }));
}

async function saveVisibleScores() {
  try {
    await api("/api/scores", { method: "POST", headers: adminHeaders(), body: JSON.stringify({ updates: visibleScoreUpdates() }) });
    setMessage("#adminMessage", "Scores saved.");
    await loadState();
  } catch (error) {
    setMessage("#adminMessage", error.message, true);
  }
}

function parseCsv(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, r1, r2, r3, r4, status = "active", finish = ""] = line.split(",").map((cell) => cell.trim());
      return { name, rounds: [r1, r2, r3, r4], status: status.toLowerCase() === "mc" ? "cut" : status.toLowerCase(), finish };
    });
}

async function importCsv() {
  try {
    const updates = parseCsv($("#csvImport").value);
    await api("/api/scores", { method: "POST", headers: adminHeaders(), body: JSON.stringify({ updates }) });
    $("#csvImport").value = "";
    setMessage("#adminMessage", `Imported ${updates.length} score rows.`);
    await loadState();
  } catch (error) {
    setMessage("#adminMessage", error.message, true);
  }
}

async function handleAdminClick(event) {
  const paidId = event.target.dataset.paid;
  const deleteId = event.target.dataset.delete;
  try {
    if (paidId) {
      const entry = state.entries.find((item) => item.id === paidId);
      await api(`/api/entries/${paidId}`, { method: "PATCH", headers: adminHeaders(), body: JSON.stringify({ paid: !entry.paid }) });
    }
    if (deleteId) {
      await api(`/api/entries/${deleteId}`, { method: "DELETE", headers: adminHeaders() });
    }
    await loadState();
  } catch (error) {
    setMessage("#adminMessage", error.message, true);
  }
}

function saveAdminPassword() {
  adminPassword = $("#adminPassword").value;
  localStorage.setItem("adminPassword", adminPassword);
  setMessage("#adminMessage", adminPassword ? "Admin unlocked for this browser." : "Enter the admin password first.", !adminPassword);
}

function clearAdminPassword() {
  adminPassword = "";
  localStorage.removeItem("adminPassword");
  renderAdminPassword();
  setMessage("#adminMessage", "Admin password cleared.");
}

function activateTab(tabId) {
  $$(".tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.tab === tabId));
  $$(".panel").forEach((panel) => panel.classList.toggle("is-active", panel.id === tabId));
}

function connectLiveUpdates() {
  const events = new EventSource("/api/events");
  events.onopen = () => $("#connectionDot").classList.add("is-live");
  events.onerror = () => $("#connectionDot").classList.remove("is-live");
  events.onmessage = () => loadState().catch(() => {});
}

$$(".tab").forEach((tab) => tab.addEventListener("click", () => activateTab(tab.dataset.tab)));
$("#entryForm").addEventListener("submit", submitEntry);
$("#scoreSearch").addEventListener("input", renderScores);
$("#saveVisibleScores").addEventListener("click", saveVisibleScores);
$("#importCsv").addEventListener("click", importCsv);
$("#adminEntries").addEventListener("click", handleAdminClick);
$("#saveAdminPassword").addEventListener("click", saveAdminPassword);
$("#clearAdminPassword").addEventListener("click", clearAdminPassword);

loadState().then(connectLiveUpdates).catch((error) => {
  $("#updatedAt").textContent = error.message;
});
