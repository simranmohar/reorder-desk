import test from "node:test";
import assert from "node:assert/strict";
import {
  dayNumber,
  addDays,
  daysBetween,
  median,
  accountSignal,
  signals,
  totals,
} from "../dist/lib/domain.js";
import { demoData } from "../dist/lib/seed.js";
const asOf = "2026-09-12";
const account = { id: "A", name: "Test retailer" };
const order = (date, totalCents = 10000, id = date) => ({
  accountId: "A",
  date,
  totalCents,
  id,
});
const history = [
  order("2026-07-01"),
  order("2026-07-15"),
  order("2026-07-29"),
  order("2026-08-12"),
  order("2026-08-26"),
];
test("calendar arithmetic is timezone-independent and rejects impossible dates", () => {
  assert.equal(addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(daysBetween("2026-03-07", "2026-03-10"), 3);
  assert.throws(() => dayNumber("2026-02-30"));
  assert.throws(() => dayNumber("9/12/26"));
});
test("median is resilient to an unusually long gap", () => {
  assert.equal(median([14, 14, 70, 14, 15]), 14);
  assert.equal(median([10, 20]), 15);
});
test("five fortnightly orders yield an explainable September 9 reorder", () => {
  const r = accountSignal(account, history, [], asOf);
  assert.equal(r.cadence, 14);
  assert.equal(r.nextDate, "2026-09-09");
  assert.equal(r.overdueDays, 3);
  assert.equal(r.due, true);
  assert.equal(r.confidence, "History-based");
});
test("due window begins three days before expected date; overdue starts after seven days", () => {
  assert.equal(accountSignal(account, history, [], "2026-09-05").due, false);
  assert.equal(accountSignal(account, history, [], "2026-09-06").due, true);
  assert.equal(
    accountSignal(account, history, [], "2026-09-16").status,
    "Due soon",
  );
  assert.equal(
    accountSignal(account, history, [], "2026-09-17").status,
    "Overdue",
  );
});
test("multiple orders on the same day do not create a zero-day cadence", () => {
  const r = accountSignal(
    account,
    [...history, order("2026-08-26", 22000, "second-order")],
    [],
    asOf,
  );
  assert.equal(r.cadence, 14);
  assert.equal(r.averageCents, 12000);
});
test("sparse history clearly labels the 30-day assumption", () => {
  const r = accountSignal(account, [order("2026-08-01")], [], asOf);
  assert.equal(r.cadence, 30);
  assert.equal(r.confidence, "30-day baseline");
});
test("scheduled follow-up removes an account until its agreed date", () => {
  const events = [
    {
      accountId: "A",
      date: asOf,
      createdAt: asOf + "T12:00:00Z",
      nextFollowUp: "2026-09-15",
    },
  ];
  assert.equal(accountSignal(account, history, events, asOf).due, false);
  assert.equal(
    accountSignal(account, history, events, asOf).status,
    "Scheduled",
  );
  assert.equal(
    accountSignal(account, history, events, "2026-09-15").status,
    "Follow-up due",
  );
});
test("a new purchase closes a previously scheduled follow-up cycle", () => {
  const events = [
    {
      accountId: "A",
      date: "2026-08-24",
      createdAt: "2026-08-24T12:00:00Z",
      nextFollowUp: "2026-09-15",
    },
  ];
  const r = accountSignal(account, history, events, asOf);
  assert.equal(r.nextFollowUp, null);
  assert.equal(r.due, true);
});
test("a later plain note does not erase a scheduled next step", () => {
  const events = [
    {
      accountId: "A",
      date: asOf,
      createdAt: asOf + "T12:00:00Z",
      nextFollowUp: "2026-09-15",
    },
    {
      accountId: "A",
      date: asOf,
      createdAt: asOf + "T13:00:00Z",
      nextFollowUp: null,
    },
  ];
  assert.equal(
    accountSignal(account, history, events, asOf).status,
    "Scheduled",
  );
});
test("future orders are excluded and empty history stays out of the queue", () => {
  const r = accountSignal(account, [order("2026-09-30")], [], asOf);
  assert.equal(r.status, "No history");
  assert.equal(r.due, false);
});
test("sample queue and totals derive from underlying orders", () => {
  const data = demoData(asOf),
    r = signals(data),
    t = totals(data, r);
  assert.equal(data.orders.length, 96);
  assert.equal(r.length, 16);
  assert.equal(t.due, 7);
  assert.equal(t.overdue, 3);
  assert.equal(
    t.typicalCents,
    r.filter((x) => x.due).reduce((s, x) => s + x.averageCents, 0),
  );
  assert.equal(r[0].name, "Coastal Grove");
  assert.equal(r.find((a) => a.name === "Cedar & Coast").status, "Scheduled");
});
