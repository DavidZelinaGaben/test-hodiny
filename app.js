const LIMIT_HODIN = 20;
const CSV_URL = "hodiny.csv";
const STORAGE_KEY = "test-hodiny-records-v1";
const TOKEN_KEY = "test-hodiny-github-token";
const REPO_OWNER = "DavidZelinaGaben";
const REPO_NAME = "test-hodiny";
const REPO_BRANCH = "main";
const CSV_PATH = "hodiny.csv";
const GITHUB_CONTENTS_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${CSV_PATH}`;

const page = document.body.dataset.page;
let records = [];
let totals = new Map();
let saveQueue = Promise.resolve();
let pendingSaves = 0;

function byId(id) {
  return document.getElementById(id);
}

function splitCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += char;
    }
  }

  values.push(value);
  return values;
}

function parseCsv(text) {
  const rows = text.trim().split(/\r?\n/).filter(Boolean);
  const header = splitCsvLine(rows.shift() || "");

  return rows.map((row) => {
    const values = splitCsvLine(row);
    const item = Object.fromEntries(header.map((key, index) => [key, values[index] || ""]));
    return normalizeRecord(item);
  });
}

function normalizeRecord(item) {
  return {
    datum: String(item.datum || "").trim(),
    zakaznik: String(item.zakaznik || "CEBES").trim(),
    popis: String(item.popis || "").trim(),
    typ: String(item.typ || "jine").trim(),
    hodiny: Number(String(item.hodiny || "0").replace(",", ".")),
  };
}

function escapeCsv(value) {
  const text = String(value ?? "");

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function recordsToCsv() {
  const header = ["datum", "zakaznik", "popis", "typ", "hodiny"];
  const rows = records.map((record) => header.map((key) => escapeCsv(record[key])).join(","));
  return `${header.join(",")}\n${rows.join("\n")}\n`;
}

function saveLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function loadLocal() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored).map(normalizeRecord) : null;
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function setMessage(text) {
  const message = byId("message");
  if (message) {
    message.textContent = text;
    message.classList.remove("hidden");
  }
}

function setSaveStatus(text) {
  const saveStatus = byId("saveStatus");
  if (saveStatus) {
    saveStatus.textContent = text;
  } else {
    setMessage(text);
  }
}

function updateTokenUi() {
  const tokenInput = byId("tokenInput");
  if (tokenInput) {
    tokenInput.value = "";
  }
  setSaveStatus(getToken() ? "Token ulozeny" : "Token neni nastaveny");
}

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function fromBase64(text) {
  const binary = atob(text.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new TextDecoder().decode(bytes);
}

async function githubRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${getToken()}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`GitHub chyba ${response.status}: ${text}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

async function commitToGithub(reason) {
  if (!getToken()) {
    setSaveStatus("Neulozeno do GitHubu - chybi token");
    return;
  }

  setSaveStatus("Ukladam do GitHubu...");
  const content = toBase64(recordsToCsv());

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const currentFile = await githubRequest(`${GITHUB_CONTENTS_URL}?ref=${REPO_BRANCH}&t=${Date.now()}`);

    try {
      await githubRequest(GITHUB_CONTENTS_URL, {
        method: "PUT",
        body: JSON.stringify({
          branch: REPO_BRANCH,
          message: reason,
          content,
          sha: currentFile.sha,
        }),
      });
      saveLocal();
      setSaveStatus(`Ulozeno do GitHubu ${new Date().toLocaleTimeString("cs-CZ")}`);
      return;
    } catch (error) {
      if (error.status !== 409 || attempt === 2) {
        throw error;
      }
      setSaveStatus("Soubor se mezitim zmenil, zkousim ulozit znovu...");
    }
  }
}

function updateSavingUi() {
  document.body.classList.toggle("is-saving", pendingSaves > 0);
}

function persistChange(reason) {
  saveLocal();
  render();

  if (!getToken()) {
    setSaveStatus("Zmena je jen v prohlizeci - pro GitHub nastav token");
    return;
  }

  pendingSaves += 1;
  updateSavingUi();
  saveQueue = saveQueue
    .then(() => commitToGithub(reason))
    .catch((error) => setSaveStatus(error.message))
    .finally(() => {
      pendingSaves = Math.max(0, pendingSaves - 1);
      updateSavingUi();
    });
}

function formatHours(value) {
  return `${Number(value.toFixed(2)).toString()} h`;
}

function getMonth(record) {
  return record.datum.slice(0, 7);
}

function calculateTotals() {
  totals = new Map();

  for (const record of records) {
    const month = getMonth(record);
    totals.set(month, (totals.get(month) || 0) + record.hodiny);
  }

  totals = new Map([...totals.entries()].sort((a, b) => b[0].localeCompare(a[0])));
}

function updateMonthSelect(previousMonth) {
  const monthSelect = byId("monthSelect");
  if (!monthSelect) {
    return;
  }

  monthSelect.innerHTML = "";

  for (const month of totals.keys()) {
    const option = document.createElement("option");
    option.value = month;
    option.textContent = month;
    monthSelect.append(option);
  }

  if (previousMonth && totals.has(previousMonth)) {
    monthSelect.value = previousMonth;
  }
}

function selectedMonth() {
  const monthSelect = byId("monthSelect");
  return monthSelect ? monthSelect.value : "";
}

function renderSummary() {
  const summary = byId("summary");
  if (!summary) {
    return;
  }

  const month = selectedMonth();
  const used = totals.get(month) || 0;
  const balance = LIMIT_HODIN - used;
  const overLimit = balance < 0;

  byId("limitValue").textContent = formatHours(LIMIT_HODIN);
  byId("usedValue").textContent = formatHours(used);
  byId("balanceValue").textContent = overLimit
    ? `Prekroceno ${formatHours(Math.abs(balance))}`
    : formatHours(balance);
  byId("statusValue").textContent = overLimit ? "Poslat nabidku" : "OK";

  byId("statusMetric").classList.toggle("status-ok", !overLimit);
  byId("statusMetric").classList.toggle("status-warn", overLimit);
  summary.classList.remove("hidden");
}

function renderMonths() {
  const monthsBody = byId("monthsBody");
  if (!monthsBody) {
    return;
  }

  monthsBody.innerHTML = "";

  for (const [month, used] of totals.entries()) {
    const balance = LIMIT_HODIN - used;
    const overLimit = balance < 0;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${month}</td>
      <td class="number">${formatHours(used)}</td>
      <td class="number">${overLimit ? `-${formatHours(Math.abs(balance))}` : formatHours(balance)}</td>
      <td><span class="badge ${overLimit ? "warn" : "ok"}">${overLimit ? "Nabidka" : "OK"}</span></td>
    `;
    monthsBody.append(row);
  }
}

function createTextCell(text, className = "") {
  const cell = document.createElement("td");
  cell.textContent = text;
  if (className) {
    cell.className = className;
  }
  return cell;
}

function renderReadonlyRecords() {
  const recordsBody = byId("recordsBody");
  recordsBody.innerHTML = "";

  records
    .filter((record) => getMonth(record) === selectedMonth())
    .sort((a, b) => b.datum.localeCompare(a.datum))
    .forEach((record) => {
      const row = document.createElement("tr");
      row.append(createTextCell(record.datum));
      row.append(createTextCell(record.zakaznik));
      row.append(createTextCell(record.popis));
      row.append(createTextCell(record.typ));
      row.append(createTextCell(formatHours(record.hodiny), "number"));
      recordsBody.append(row);
    });
}

function createEditableCell(record, key, draft, type = "text") {
  const cell = document.createElement("td");
  const input = document.createElement("input");
  input.type = type;
  input.value = record[key];

  if (type === "number") {
    input.min = "0.25";
    input.step = "0.25";
  }

  input.addEventListener("input", () => {
    draft[key] = key === "hodiny" ? Number(input.value) : input.value.trim();
  });

  cell.append(input);
  return cell;
}

function createTypeCell(record, draft) {
  const cell = document.createElement("td");
  const select = document.createElement("select");

  for (const value of ["SW", "konzultace", "jine"]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  }

  select.value = record.typ;
  select.addEventListener("change", () => {
    draft.typ = select.value;
  });

  cell.append(select);
  return cell;
}

function renderEditableRecords() {
  const recordsBody = byId("recordsBody");
  recordsBody.innerHTML = "";

  records
    .map((record, index) => ({ record, index }))
    .filter(({ record }) => getMonth(record) === selectedMonth())
    .sort((a, b) => b.record.datum.localeCompare(a.record.datum))
    .forEach(({ record, index }) => {
      const draft = { ...record };
      const row = document.createElement("tr");
      row.append(createEditableCell(record, "datum", draft, "date"));
      row.append(createEditableCell(record, "zakaznik", draft));
      row.append(createEditableCell(record, "popis", draft));
      row.append(createTypeCell(record, draft));
      row.append(createEditableCell(record, "hodiny", draft, "number"));

      const actionCell = document.createElement("td");
      actionCell.className = "actions-cell";
      const saveButton = document.createElement("button");
      saveButton.type = "button";
      saveButton.textContent = "Ulozit";
      saveButton.addEventListener("click", () => {
        records[index] = normalizeRecord(draft);
        persistChange("Update hours record");
      });

      const deleteButton = document.createElement("button");
      deleteButton.className = "danger";
      deleteButton.type = "button";
      deleteButton.textContent = "Smazat";
      deleteButton.addEventListener("click", () => {
        records.splice(index, 1);
        persistChange("Delete hours record");
      });
      actionCell.append(saveButton);
      actionCell.append(deleteButton);
      row.append(actionCell);
      recordsBody.append(row);
    });
}

function render() {
  const previousMonth = selectedMonth();
  calculateTotals();

  if (records.length === 0 || totals.size === 0) {
    setMessage("Zatim nejsou zadne hodiny.");
    const summary = byId("summary");
    if (summary) {
      summary.classList.add("hidden");
    }
    const recordsBody = byId("recordsBody");
    if (recordsBody) {
      recordsBody.innerHTML = "";
    }
    return;
  }

  setMessage(getToken()
    ? "Automaticke ukladani do GitHubu je zapnute."
    : "Pro automaticke ukladani nastav token v Nastaveni.");
  updateMonthSelect(previousMonth);
  renderSummary();
  renderMonths();

  if (page === "settings") {
    renderEditableRecords();
  } else {
    renderReadonlyRecords();
  }
}

async function loadFromGithub() {
  if (getToken()) {
    const currentFile = await githubRequest(`${GITHUB_CONTENTS_URL}?ref=${REPO_BRANCH}&t=${Date.now()}`);
    records = parseCsv(fromBase64(currentFile.content));
    return;
  }

  const response = await fetch(`${CSV_URL}?t=${Date.now()}`);

  if (!response.ok) {
    throw new Error("Nepodarilo se nacist hodiny.csv.");
  }

  records = parseCsv(await response.text());
}

async function start() {
  try {
    await loadFromGithub();
    saveLocal();
  } catch (error) {
    const localRecords = loadLocal();
    if (!localRecords) {
      throw error;
    }
    records = localRecords;
  }

  render();
}

async function refreshFromGithub() {
  try {
    await loadFromGithub();
    saveLocal();
    render();
  } catch (error) {
    setMessage(error.message);
  }
}

function bindMainPage() {
  const datumInput = byId("datumInput");
  const zakaznikInput = byId("zakaznikInput");
  const typInput = byId("typInput");
  const popisInput = byId("popisInput");
  const hodinyInput = byId("hodinyInput");

  datumInput.value = new Date().toISOString().slice(0, 10);

  byId("addForm").addEventListener("submit", (event) => {
    event.preventDefault();
    records.push(normalizeRecord({
      datum: datumInput.value,
      zakaznik: zakaznikInput.value,
      popis: popisInput.value,
      typ: typInput.value,
      hodiny: hodinyInput.value,
    }));
    popisInput.value = "";
    hodinyInput.value = "";
    persistChange("Add hours record");
  });
}

function bindSettingsPage() {
  byId("backButton").addEventListener("click", async () => {
    if (pendingSaves > 0) {
      setSaveStatus("Cekam na ulozeni do GitHubu...");
      await saveQueue;
    }

    window.location.href = "./";
  });

  byId("saveTokenButton").addEventListener("click", () => {
    const token = byId("tokenInput").value.trim();

    if (!token) {
      setSaveStatus("Token je prazdny");
      return;
    }

    localStorage.setItem(TOKEN_KEY, token);
    updateTokenUi();
    render();
  });

  byId("clearTokenButton").addEventListener("click", () => {
    localStorage.removeItem(TOKEN_KEY);
    updateTokenUi();
    render();
  });

  byId("downloadButton").addEventListener("click", () => {
    const blob = new Blob([recordsToCsv()], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "hodiny.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  });

  byId("resetButton").addEventListener("click", async () => {
    localStorage.removeItem(STORAGE_KEY);
    setSaveStatus("Nacitam z GitHubu...");
    await loadFromGithub();
    saveLocal();
    render();
  });
}

if (page === "main") {
  bindMainPage();
} else if (page === "settings") {
  bindSettingsPage();
}

const monthSelect = byId("monthSelect");
if (monthSelect) {
  monthSelect.addEventListener("change", () => {
    renderSummary();
    if (page === "settings") {
      renderEditableRecords();
    } else {
      renderReadonlyRecords();
    }
  });
}

updateTokenUi();
start().catch((error) => setMessage(error.message));

window.addEventListener("beforeunload", (event) => {
  if (pendingSaves > 0) {
    event.preventDefault();
    event.returnValue = "";
  }
});

window.addEventListener("pageshow", (event) => {
  if (event.persisted && page === "main") {
    refreshFromGithub();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && page === "main") {
    refreshFromGithub();
  }
});
