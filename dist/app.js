import {
  addDays,
  today,
  signals,
  totals,
  followUpDraft,
} from "./lib/domain.js";
import { demoData } from "./lib/seed.js";
import { importOrders, ordersCSV, toCSV } from "./lib/csv.js";

const STORAGE = "reorder-desk.v1";
const $ = (s) => document.querySelector(s);
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (cents) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
const date = (d) =>
  d
    ? new Intl.DateTimeFormat("en-CA", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(new Date(d + "T00:00:00Z"))
    : "—";
const icon = (name, size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${{ queue: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 16h7m-7 4h5"/>', accounts: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1m4 0h1m-6 4h1m4 0h1m-4 8v-4h4v4"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>', down: '<path d="M12 3v12m-4-4 4 4 4-4M5 15v5h14v-5"/>', up: '<path d="M12 16V4m-4 4 4-4 4 4M5 15v5h14v-5"/>', search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>', chevron: '<path d="m9 5 7 7-7 7"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>', check: '<path d="m5 12 4 4L19 6"/>', reset: '<path d="M3 11a9 9 0 1 1 2.5 7M3 5v6h6"/>', copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>', note: '<path d="M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 12h8m-8 4h6"/>' }[name] || ""}</svg>`;
let dataset = demoData();
let storageWarning = "";
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE) || "null");
  if (
    saved?.version === 1 &&
    Array.isArray(saved.accounts) &&
    Array.isArray(saved.orders) &&
    Array.isArray(saved.interactions)
  ) {
    signals(saved);
    dataset = saved;
  }
} catch {
  storageWarning = "Saved data could not be loaded. A fresh demo is displayed.";
}
let view = "queue",
  filter = "due",
  search = "",
  city = "all",
  activeId = null;
let rows = signals(dataset);
function persist() {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(dataset));
    return true;
  } catch {
    storageWarning =
      "Browser storage is unavailable. Changes will last only until this page closes.";
    return false;
  }
}
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("visible"), 4500);
}
const statusClass = (s) =>
  ({
    Overdue: "overdue",
    "Due soon": "due",
    "Follow-up due": "due",
    Scheduled: "scheduled",
    "On track": "track",
    "No history": "neutral",
  })[s];
const initials = (name) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("");
function visibleRows() {
  return rows.filter(
    (r) =>
      (filter === "all" ||
        (filter === "scheduled" && r.status === "Scheduled") ||
        (filter === "due" && r.due)) &&
      (city === "all" || r.city === city) &&
      `${r.name} ${r.contact} ${r.city}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
}
function render() {
  rows = signals(dataset);
  const t = totals(dataset, rows),
    due = rows.filter((r) => r.due),
    lead = due[0];
  $("#app").innerHTML =
    `<aside class="sidebar"><a class="brand" href="#" data-action="nav" data-view="queue"><span class="brand-symbol">${icon("reset", 25)}</span><span>Reorder<span class="brand-light">Desk</span></span></a><p class="sidebar-label">SALES WORKSPACE</p><nav aria-label="Main navigation"><button class="nav-item ${view === "queue" ? "active" : ""}" data-action="nav" data-view="queue">${icon("queue")} Follow-up queue <span class="nav-count">${t.due}</span></button><button class="nav-item ${view === "accounts" ? "active" : ""}" data-action="nav" data-view="accounts">${icon("accounts")} Accounts <span class="nav-count subtle">${rows.length}</span></button><button class="nav-item ${view === "activity" ? "active" : ""}" data-action="nav" data-view="activity">${icon("clock")} Activity</button></nav><div class="sidebar-bottom"><div class="dataset-label"><span class="tiny-square"></span> ${dataset.source === "demo" ? "Sample workspace" : "Imported workspace"}</div><p>Saved in this browser.<br>Account data stays on this device.</p><button data-action="methods" class="side-link">${icon("info", 17)} How signals work</button><button data-action="reset" class="side-link">${icon("reset", 17)} Reset demo</button><div class="creator"><span class="avatar creator-avatar">SM</span><div><strong>Simran Mohar</strong><span>Portfolio project</span></div></div></div></aside>
 <div class="workspace"><div class="demo-bar"><span><strong>${dataset.source === "demo" ? "LIVE DEMO" : "LOCAL WORKSPACE"}</strong> ${dataset.source === "demo" ? "Fictional retailers and orders" : "Your imported order history"}</span><span>As of ${esc(date(dataset.asOf))}, ${dataset.asOf.slice(0, 4)}</span></div><main id="main"><header class="page-header"><div><p class="eyebrow">WHOLESALE OPERATIONS</p><h1 tabindex="-1">${view === "activity" ? "Account activity" : view === "accounts" ? "Your accounts" : "Account follow-up"}</h1><p class="subtitle">${view === "activity" ? "A record of conversations and next steps." : view === "accounts" ? "Order patterns and context for every retailer." : "Know who to contact next, and why."}</p></div><div class="header-actions"><button class="button secondary" data-action="import">${icon("up", 17)} Import orders</button><button class="button primary" data-action="export">${icon("down", 17)} Export queue</button></div></header>
 ${storageWarning ? `<p class="warning" role="alert">${esc(storageWarning)}</p>` : ""}
 ${
   view === "activity"
     ? renderActivity()
     : `<section class="metrics" aria-label="Account summary"><article class="metric"><div class="metric-label">Accounts to follow up ${icon("clock", 18)}</div><div class="metric-value">${t.due}<span class="metric-unit"> / ${rows.length}</span></div><div class="metric-foot"><span class="tag overdue">${t.overdue} overdue</span><span>Prioritized by timing</span></div></article><article class="metric"><div class="metric-label">Typical order value in queue <button class="icon-button info-button" data-action="methods" aria-label="Explain typical order value">${icon("info", 18)}</button></div><div class="metric-value">${money(t.typicalCents)}<span class="currency">CAD</span></div><div class="metric-foot">Based on past orders · not a sales forecast</div></article><article class="metric"><div class="metric-label">Orders in the last 30 days ${icon("accounts", 18)}</div><div class="metric-value">${money(t.recentCents)}<span class="currency">CAD</span></div><div class="metric-foot"><strong>${t.recentOrders} orders</strong><span>Across all accounts</span></div></article></section>
 ${view === "queue" && lead ? `<section class="focus-strip"><span class="focus-icon">${icon("arrow", 23)}</span><div><p class="focus-label">FIRST IN YOUR QUEUE</p><h2>${esc(lead.name)} <span>· ${lead.overdueDays > 0 ? lead.overdueDays + " days past its usual reorder date" : "approaching its usual reorder date"}</span></h2></div><button class="button light" data-action="account" data-id="${esc(lead.id)}">Review account ${icon("arrow", 17)}</button></section>` : ""}
 <section class="queue-section" aria-labelledby="queue-heading"><div class="queue-top"><div><h2 id="queue-heading">${view === "accounts" ? "Account directory" : "Your follow-up queue"}</h2><p>${view === "accounts" ? "Select an account to see its order history." : "Later reorder dates and scheduled follow-ups stay out of the way."}</p></div><span class="small-note">All amounts in CAD</span></div><div class="toolbar"><div class="filters" role="group" aria-label="Account filters"><button data-action="filter" data-filter="due" class="filter ${filter === "due" ? "selected" : ""}" aria-pressed="${filter === "due"}">Needs attention <span>${t.due}</span></button><button data-action="filter" data-filter="all" class="filter ${filter === "all" ? "selected" : ""}" aria-pressed="${filter === "all"}">All accounts <span>${rows.length}</span></button><button data-action="filter" data-filter="scheduled" class="filter ${filter === "scheduled" ? "selected" : ""}" aria-pressed="${filter === "scheduled"}">Scheduled <span>${rows.filter((r) => r.status === "Scheduled").length}</span></button></div><div class="search-controls"><label class="search-field">${icon("search", 17)}<input id="search" type="search" placeholder="Search accounts" aria-label="Search accounts" value="${esc(search)}"></label><select id="city" aria-label="Filter by city"><option value="all">All cities</option>${[
   ...new Set(rows.map((r) => r.city).filter(Boolean)),
 ]
   .sort()
   .map((c) => `<option ${city === c ? "selected" : ""}>${esc(c)}</option>`)
   .join(
     "",
   )}</select></div></div><div id="queue-table">${renderTable()}</div></section>`
 }
 <footer class="page-footer"><span>Independent portfolio project · Not affiliated with Herbal Dispatch</span><span class="footer-actions"><button data-action="reset">Reset demo</button><button data-action="methods">How this works ${icon("arrow", 14)}</button></span></footer></main></div>`;
}
function renderTable() {
  const visible = visibleRows();
  return visible.length
    ? `<div class="table-scroll"><table><thead><tr><th scope="col">Retailer</th><th scope="col">Reorder signal</th><th scope="col">Last order</th><th scope="col">Usual interval</th><th scope="col" class="amount">Typical order</th><th scope="col"><span class="sr-only">Open account</span></th></tr></thead><tbody>${visible.map((r) => `<tr><td><button class="account-link" data-action="account" data-id="${esc(r.id)}"><span class="avatar tint-${r.id.length % 3}">${esc(initials(r.name))}</span><span><strong>${esc(r.name)}</strong><small>${esc(r.city || "No city")} · ${esc(r.contact || "No contact")}</small></span></button></td><td><span class="tag ${statusClass(r.status)}">${esc(r.status)}</span><span class="cell-sub">${r.status === "Scheduled" ? "Follow up " + date(r.nextFollowUp) : r.status === "Follow-up due" ? "Follow-up " + date(r.nextFollowUp) : r.overdueDays > 0 ? r.overdueDays + " days past usual date" : r.nextDate ? "Expected " + date(r.nextDate) : "Import order history"}</span></td><td>${date(r.lastDate)}<span class="cell-sub">${r.history.length} orders recorded</span></td><td>${r.cadence ? r.cadence + " days" : "—"}<span class="cell-sub">${esc(r.confidence)}</span></td><td class="amount"><strong>${money(r.averageCents)}</strong></td><td><button class="icon-button" data-action="account" data-id="${esc(r.id)}" aria-label="Review ${esc(r.name)}">${icon("chevron", 18)}</button></td></tr>`).join("")}</tbody></table></div><div class="table-footer">${visible.length} ${visible.length === 1 ? "account" : "accounts"} shown <span>Timing first, then typical order value</span></div>`
    : `<div class="empty-state">${icon("check", 32)}<h3>${search || city !== "all" ? "No matching accounts" : "You’re clear for now"}</h3><p>${search || city !== "all" ? "Try another search or city." : "No accounts match this view. Check all accounts or import more order history."}</p><button class="button secondary" data-action="clear-filters">Show all accounts</button></div>`;
}
function renderActivity() {
  const events = [...dataset.interactions].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  return `<section class="activity-section"><div class="queue-top"><div><h2>Recent conversations</h2><p>Notes and scheduled follow-ups saved in this workspace.</p></div><span class="small-note">${events.length} activities</span></div>${
    events.length
      ? events
          .map((e) => {
            const a = dataset.accounts.find((a) => a.id === e.accountId);
            return `<article class="activity-card"><span class="activity-icon">${icon("note")}</span><div><button class="text-button" data-action="account" data-id="${esc(e.accountId)}">${esc(a?.name || e.accountId)}</button><p>${esc(e.note)}</p><div class="activity-meta">${esc(e.type)} · ${date(e.date)}${e.nextFollowUp ? " · Next follow-up " + date(e.nextFollowUp) : ""}</div></div></article>`;
          })
          .join("")
      : `<div class="empty-state"><h3>No activity yet</h3><p>Open an account and log a conversation to start its history.</p></div>`
  }</section>`;
}
let focusBeforeDialog = null,
  pendingImport = null;
function closeDialog() {
  const dialog = $("dialog");
  if (dialog) {
    dialog.close();
    dialog.remove();
  }
  activeId = null;
  pendingImport = null;
  if (focusBeforeDialog?.isConnected) focusBeforeDialog.focus();
  else $("#main h1")?.focus();
}
function showDialog(content, kind = "modal") {
  const previous = $("dialog");
  if (previous) previous.remove();
  else focusBeforeDialog = document.activeElement;
  $("#overlay").innerHTML =
    `<dialog class="${kind}" aria-labelledby="dialog-title">${content}</dialog>`;
  const dialog = $("dialog");
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeDialog();
  });
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        closeDialog();
    }
  });
  dialog.showModal();
}
const dialogHeader = (eyebrow, title) =>
  `<header class="dialog-header"><div><p class="eyebrow">${eyebrow}</p><h2 id="dialog-title">${esc(title)}</h2></div><button class="icon-button" data-action="close" aria-label="Close dialog">${icon("close", 22)}</button></header>`;
function openAccount(id) {
  const a = rows.find((r) => r.id === id);
  if (!a) return;
  activeId = id;
  const maxOrder = Math.max(...a.history.map((o) => o.totalCents), 1);
  showDialog(
    `${dialogHeader("ACCOUNT DETAILS", a.name)}<div class="drawer-content"><div class="account-contact"><span class="avatar large">${esc(initials(a.name))}</span><div><strong>${esc(a.contact || "No contact name")}</strong><span>${esc(a.city || "No city")} · ${esc(a.email || "No email address")}</span></div><span class="tag ${statusClass(a.status)}">${a.status}</span></div><section class="signal-card"><div class="section-heading"><h3>Why this account is here</h3>${icon("info", 17)}</div><p>${a.status === "Scheduled" ? `A follow-up is scheduled for <strong>${date(a.nextFollowUp)}</strong>. This account is kept out of the active queue until then.` : a.status === "Follow-up due" ? `Its scheduled follow-up is due on <strong>${date(a.nextFollowUp)}</strong>.` : `The last order was <strong>${date(a.lastDate)}</strong>. ${a.confidence === "History-based" ? `Its recent order pattern suggests an interval of <strong>${a.cadence} days</strong>.` : "There is not enough repeat history yet, so a clearly labelled 30-day baseline is used."} The estimated next order date is <strong>${date(a.nextDate)}</strong>.`}</p><div class="signal-facts"><div><span>Usual order</span><strong>${money(a.averageCents)} CAD</strong></div><div><span>Reorder interval</span><strong>${a.cadence || "—"} days</strong></div><div><span>Basis</span><strong>${a.confidence}</strong></div></div></section><section class="drawer-section"><div class="section-heading"><h3>Order history</h3><span class="small-note">Most recent 6</span></div><div class="order-chart" aria-label="Recent order amounts">${a.history
      .slice(0, 6)
      .reverse()
      .map(
        (o) =>
          `<div class="chart-column"><span>${money(o.totalCents)}</span><div class="bar-track"><div class="bar" style="height:${Math.max(4, (o.totalCents / maxOrder) * 100)}%"></div></div><small>${date(o.date)}</small></div>`,
      )
      .join(
        "",
      )}</div><details><summary>View order records</summary><div class="order-records">${a.history.map((o) => `<div><span>${esc(o.id)} · ${date(o.date)}</span><strong>${money(o.totalCents)}</strong></div>`).join("")}</div></details></section><section class="drawer-section"><div class="section-heading"><h3>Log a conversation</h3><span class="small-note">Updates the account’s next step</span></div><form id="activity-form"><div class="form-row"><label>Type<select name="type"><option>Call</option><option>Email</option><option>Meeting</option><option>Note</option></select></label><label>Next follow-up<input type="date" name="nextFollowUp" value="${addDays(dataset.asOf, 3)}" min="${dataset.asOf}" required></label></div><label>Conversation notes<textarea name="note" rows="3" maxlength="2000" required placeholder="What happened, and what should happen next?"></textarea></label><p class="field-help">Saving schedules the next follow-up and removes this account from today’s queue until that date.</p><div id="activity-error" role="alert" class="form-error"></div><button class="button primary full" type="submit">${icon("check", 17)} Save activity & follow-up</button></form></section><section class="drawer-section"><div class="section-heading"><h3>Suggested check-in</h3><button class="text-button small" data-action="copy-draft">${icon("copy", 15)} Copy draft</button></div><p class="draft-text">${esc(followUpDraft(a))}</p><p class="field-help">A starting point to review and personalize. Nothing is sent from this demo.</p></section><section class="drawer-section"><div class="section-heading"><h3>Activity history</h3><span class="small-note">${a.events.length} entries</span></div>${a.events.length ? a.events.map((e) => `<article class="timeline-entry"><div class="timeline-meta">${esc(e.type)} · ${date(e.date)}${e.nextFollowUp ? " · Next follow-up " + date(e.nextFollowUp) : ""}</div><p>${esc(e.note)}</p></article>`).join("") : '<p class="field-help">No conversations logged yet.</p>'}</section></div>`,
    "drawer",
  );
}
function methods() {
  showDialog(
    `${dialogHeader("THE LOGIC", "Simple signals. Visible reasoning.")}<div class="modal-content prose"><p>Reorder Desk is a small CRM for wholesale account follow-up. It turns order history into a practical daily contact list.</p><h3>1. Learn an account’s rhythm</h3><p>The typical interval is the rounded median of the latest six gaps between distinct order dates. At least three order dates are required; otherwise the demo uses a labelled 30-day baseline.</p><h3>2. Estimate the next reorder date</h3><p>Last order date + typical interval. Accounts enter the queue three days before that date. More than seven days after the date is marked overdue.</p><h3>3. Respect the next agreed step</h3><p>A future follow-up keeps an account out of the queue until that date. A new purchase after the conversation starts a new cycle. The queue sorts by days past the usual date, then typical order value.</p><h3>What the amounts mean</h3><p>Typical order value is the average of an account’s latest six orders. The queue total adds those averages. It is historical context, not predicted revenue, profit, or guaranteed recovered sales. Figures are in CAD.</p><h3>About this demo</h3><p>An independent portfolio project by Simran Mohar, inspired by wholesale sales workflows. Sample retailers, contacts, orders, and outcomes are fictional. It is not affiliated with Herbal Dispatch and does not use its customer data.</p><p>Data is saved in this browser only. There is no shared database, automatic email sending, or connection to a company’s CRM. Browser data can be lost when site data is cleared. Use sample or non-sensitive data.</p><p class="field-help">The reporting date stays fixed with each dataset so results are reproducible. Reset demo generates a fresh dataset dated today.</p></div><div class="modal-actions"><button class="button primary" data-action="close">Got it</button></div>`,
  );
}
function showImport() {
  pendingImport = null;
  showDialog(
    `${dialogHeader("BRING ORDER HISTORY", "Import wholesale orders")}<div class="modal-content"><p class="modal-intro">Use one row per completed order, with totals in CAD. A valid import replaces this workspace and its activity history.</p><div class="import-options"><button class="button secondary" data-action="sample">${icon("down", 17)} Download sample CSV</button><label class="button secondary file-label">${icon("up", 17)} Choose CSV<input type="file" id="csv-file" accept=".csv,text/csv" class="sr-only"></label></div><p class="field-help">Up to 10,000 orders / 2 MB. File contents stay on this device.</p><label class="paste-label">Or paste CSV content<textarea id="csv-text" rows="7" spellcheck="false" placeholder="account_id,account_name,contact_name,email,city,order_id,order_date,order_total"></textarea></label><div id="import-result" role="status"></div></div><div class="modal-actions"><button class="button secondary" data-action="close">Cancel</button><button class="button primary" data-action="validate-import">Validate CSV</button></div>`,
  );
}
function download(name, content) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function exportQueue() {
  const queue = rows.filter((r) => r.due);
  download(
    `reorder-desk-follow-ups-${dataset.asOf}.csv`,
    toCSV(
      [
        "account",
        "contact",
        "email",
        "city",
        "status",
        "last_order",
        "estimated_reorder",
        "next_follow_up",
        "typical_order_cad",
        "basis",
      ],
      queue.map((r) => [
        r.name,
        r.contact,
        r.email,
        r.city,
        r.status,
        r.lastDate,
        r.nextDate,
        r.nextFollowUp,
        (r.averageCents / 100).toFixed(2),
        r.confidence,
      ]),
    ),
  );
  toast(`Exported ${queue.length} accounts from the full follow-up queue.`);
}
function logActivity(accountId, { type, note, nextFollowUp }) {
  if (!dataset.accounts.some((a) => a.id === accountId))
    throw new Error("Account not found.");
  if (
    !["Call", "Email", "Meeting", "Note"].includes(type) ||
    !note?.trim() ||
    note.length > 2000
  )
    throw new Error("Add conversation notes (up to 2,000 characters).");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nextFollowUp || ""))
    throw new Error("Choose a valid next follow-up date.");
  addDays(nextFollowUp, 0);
  if (nextFollowUp < dataset.asOf)
    throw new Error("The next follow-up cannot be before the reporting date.");
  const item = {
    id: crypto.randomUUID(),
    accountId,
    type,
    note: note.trim(),
    nextFollowUp,
    date: dataset.asOf,
    createdAt: new Date().toISOString(),
  };
  dataset.interactions.push(item);
  const saved = persist();
  render();
  return { id: item.id, saved, accountId, nextFollowUp };
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const action = b.dataset.action;
  if (action === "nav") {
    e.preventDefault();
    view = b.dataset.view;
    filter = view === "accounts" ? "all" : "due";
    search = "";
    city = "all";
    render();
  }
  if (action === "filter") {
    filter = b.dataset.filter;
    render();
  }
  if (action === "clear-filters") {
    filter = "all";
    search = "";
    city = "all";
    render();
  }
  if (action === "account") openAccount(b.dataset.id);
  if (action === "close") closeDialog();
  if (action === "methods") methods();
  if (action === "import") showImport();
  if (action === "export") exportQueue();
  if (action === "sample") {
    download(
      "reorder-desk-sample-orders.csv",
      ordersCSV(demoData(dataset.asOf)),
    );
    toast("Sample CSV downloaded.");
  }
  if (action === "validate-import") {
    try {
      pendingImport = importOrders($("#csv-text").value, dataset.asOf);
      const preview = totals(pendingImport, signals(pendingImport));
      $("#import-result").innerHTML =
        `<div class="import-success">${icon("check", 20)}<div><strong>Ready: ${pendingImport.orders.length} orders across ${pendingImport.accounts.length} ${pendingImport.accounts.length === 1 ? "account" : "accounts"}</strong><p>${preview.due} ${preview.due === 1 ? "account would" : "accounts would"} enter the follow-up queue. Your current dataset and ${dataset.interactions.length} activity entries will be replaced.</p><button class="button primary" data-action="confirm-import">Replace workspace with these orders</button></div></div>`;
    } catch (error) {
      pendingImport = null;
      $("#import-result").innerHTML =
        `<p class="form-error" role="alert">${esc(error.message)}</p>`;
    }
  }
  if (action === "confirm-import" && pendingImport) {
    dataset = pendingImport;
    const saved = persist();
    closeDialog();
    view = "queue";
    filter = "due";
    search = "";
    city = "all";
    render();
    toast(
      saved
        ? "Orders imported and saved in this browser."
        : "Orders imported for this session. Browser storage is unavailable.",
    );
  }
  if (action === "copy-draft") {
    const a = rows.find((r) => r.id === activeId);
    if (a)
      navigator.clipboard
        .writeText(followUpDraft(a))
        .then(() =>
          toast("Draft copied. Review and personalize it before sending."),
        )
        .catch(() =>
          toast("Copy unavailable. Select and copy the draft text below."),
        );
  }
  if (action === "reset")
    showDialog(
      `${dialogHeader("RESET WORKSPACE", "Start fresh with sample data?")}<div class="modal-content"><p>This replaces the current dataset and all ${dataset.interactions.length} saved activities with fictional accounts and orders dated today.</p></div><div class="modal-actions"><button class="button secondary" data-action="close">Keep my workspace</button><button class="button primary" data-action="confirm-reset">Reset to demo data</button></div>`,
    );
  if (action === "confirm-reset") {
    dataset = demoData();
    persist();
    view = "queue";
    filter = "due";
    search = "";
    city = "all";
    closeDialog();
    render();
    toast("Fresh demo loaded.");
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "search") {
    search = e.target.value;
    $("#queue-table").innerHTML = renderTable();
  }
  if (e.target.id === "csv-text") {
    pendingImport = null;
    $("#import-result").innerHTML = "";
  }
});
document.addEventListener("change", async (e) => {
  if (e.target.id === "city") {
    city = e.target.value;
    $("#queue-table").innerHTML = renderTable();
  }
  if (e.target.id === "csv-file") {
    const file = e.target.files[0];
    if (!file) return;
    pendingImport = null;
    $("#import-result").innerHTML = "";
    if (file.size > 2 * 1024 * 1024) {
      $("#import-result").innerHTML =
        '<p class="form-error" role="alert">Choose a CSV smaller than 2 MB.</p>';
      return;
    }
    try {
      $("#csv-text").value = await file.text();
    } catch {
      $("#import-result").innerHTML =
        '<p class="form-error" role="alert">This file could not be read. Try pasting its CSV content.</p>';
    }
  }
});
document.addEventListener("submit", (e) => {
  if (e.target.id === "activity-form") {
    e.preventDefault();
    try {
      const id = activeId,
        result = logActivity(id, Object.fromEntries(new FormData(e.target)));
      openAccount(id);
      toast(
        result.saved
          ? "Activity saved. Follow-up scheduled."
          : "Activity saved for this session only.",
      );
    } catch (error) {
      $("#activity-error").textContent = error.message;
    }
  }
});
render();
// Feature-detected agent interface; uses the same state and account view as the UI.
const context = document.modelContext;
if (context?.registerTool) {
  const lifetime = new AbortController();
  const tool = {
    name: "view_reorder_queue",
    title: "View reorder queue",
    description:
      "Read the current local follow-up queue. Optionally open an account in the visible workspace. Does not contact anyone or change stored data.",
    inputSchema: {
      type: "object",
      properties: { accountId: { type: "string" } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute(input) {
      if (
        !input ||
        typeof input !== "object" ||
        Array.isArray(input) ||
        Object.keys(input).some((k) => k !== "accountId") ||
        (input.accountId !== undefined && typeof input.accountId !== "string")
      )
        throw new Error("Use an object with an optional accountId string.");
      if (input.accountId) {
        if (!rows.some((r) => r.id === input.accountId))
          throw new Error("Account not found.");
        openAccount(input.accountId);
      }
      return {
        asOf: dataset.asOf,
        source: dataset.source,
        accounts: rows
          .filter((r) => r.due)
          .map((r) => ({
            id: r.id,
            name: r.name,
            status: r.status,
            estimatedReorder: r.nextDate,
            typicalOrderCAD: r.averageCents / 100,
            basis: r.confidence,
          })),
      };
    },
  };
  try {
    Promise.resolve(
      context.registerTool(tool, { signal: lifetime.signal }),
    ).catch(() => {});
  } catch {}
  window.addEventListener("pagehide", () => lifetime.abort(), { once: true });
}
