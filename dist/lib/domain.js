export const DAY = 86400000;
export function dayNumber(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || ""))
    throw new Error("Use a date in YYYY-MM-DD format.");
  const time = Date.parse(value + "T00:00:00Z");
  if (
    !Number.isFinite(time) ||
    new Date(time).toISOString().slice(0, 10) !== value
  )
    throw new Error("Invalid calendar date.");
  return time / DAY;
}
export const addDays = (date, count) =>
  new Date((dayNumber(date) + count) * DAY).toISOString().slice(0, 10);
export const daysBetween = (a, b) => dayNumber(b) - dayNumber(a);
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function median(values) {
  if (!values.length) return null;
  const a = [...values].sort((x, y) => x - y),
    m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
export function accountSignal(account, orders, interactions, asOf) {
  dayNumber(asOf);
  const history = orders
    .filter((o) => o.accountId === account.id && o.date <= asOf)
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const events = interactions
    .filter((i) => i.accountId === account.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!history.length)
    return {
      ...account,
      history,
      events,
      status: "No history",
      due: false,
      averageCents: 0,
      overdueDays: 0,
      cadence: null,
      nextDate: null,
      lastDate: null,
      confidence: "No data",
      nextFollowUp: null,
    };
  const dates = [...new Set(history.map((o) => o.date))].slice(0, 7).reverse();
  const gaps = dates.slice(1).map((date, i) => daysBetween(dates[i], date));
  const measured = gaps.length >= 2;
  const cadence = measured ? Math.max(1, Math.round(median(gaps))) : 30;
  const lastDate = history[0].date,
    nextDate = addDays(lastDate, cadence);
  const overdueDays = daysBetween(nextDate, asOf);
  const recent = history.slice(0, 6);
  const averageCents = Math.round(
    recent.reduce((s, o) => s + o.totalCents, 0) / recent.length,
  );
  const schedule = events.find((e) => e.nextFollowUp);
  // A purchase after a scheduled follow-up closes that old follow-up cycle.
  const nextFollowUp =
    schedule && schedule.date >= lastDate ? schedule.nextFollowUp : null;
  const deferred = nextFollowUp && nextFollowUp > asOf;
  const explicitlyDue = nextFollowUp && nextFollowUp <= asOf;
  let status =
    overdueDays > 7 ? "Overdue" : overdueDays >= -3 ? "Due soon" : "On track";
  if (explicitlyDue) status = "Follow-up due";
  if (deferred) status = "Scheduled";
  return {
    ...account,
    history,
    events,
    cadence,
    nextDate,
    lastDate,
    overdueDays,
    averageCents,
    status,
    nextFollowUp,
    due: !deferred && (overdueDays >= -3 || Boolean(explicitlyDue)),
    confidence: measured ? "History-based" : "30-day baseline",
    observedGaps: gaps.length,
  };
}
export function signals(dataset) {
  return dataset.accounts
    .map((a) =>
      accountSignal(a, dataset.orders, dataset.interactions, dataset.asOf),
    )
    .sort(
      (a, b) =>
        Number(b.due) - Number(a.due) ||
        b.overdueDays - a.overdueDays ||
        b.averageCents - a.averageCents ||
        a.name.localeCompare(b.name),
    );
}
export function totals(dataset, rows) {
  const due = rows.filter((r) => r.due);
  const recent = dataset.orders.filter(
    (o) =>
      daysBetween(o.date, dataset.asOf) >= 0 &&
      daysBetween(o.date, dataset.asOf) < 30,
  );
  return {
    due: due.length,
    overdue: due.filter((r) => r.overdueDays > 7).length,
    typicalCents: due.reduce((s, r) => s + r.averageCents, 0),
    recentCents: recent.reduce((s, o) => s + o.totalCents, 0),
    recentOrders: recent.length,
  };
}
export function followUpDraft(account) {
  return `Hi ${account.contact || "there"},\n\nI’m checking in with ${account.name} to see how your current stock is moving and whether you’re planning another order. Happy to help with availability and options that fit your next order.\n\nLet me know what would be useful.\n\nBest,\n[Your name]`;
}
