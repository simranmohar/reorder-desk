import { dayNumber } from "./domain.js";
export const HEADERS = [
  "account_id",
  "account_name",
  "contact_name",
  "email",
  "city",
  "order_id",
  "order_date",
  "order_total",
];
export function parseCSV(text) {
  if (typeof text !== "string" || text.length > 2 * 1024 * 1024)
    throw new Error("Choose a CSV smaller than 2 MB.");
  text = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [],
    field = "",
    quoted = false,
    closed = false;
  const cell = () => {
    row.push(field);
    field = "";
    closed = false;
  };
  const line = () => {
    cell();
    if (row.some((x) => x.trim())) rows.push(row);
    row = [];
    if (rows.length > 10001) throw new Error("The limit is 10,000 orders.");
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += c;
      continue;
    }
    if (c === '"') {
      if (field || closed) throw new Error("Invalid CSV quoting.");
      quoted = true;
    } else if (c === ",") cell();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      line();
    } else {
      if (closed) throw new Error("Unexpected text after a quoted field.");
      field += c;
    }
  }
  if (quoted) throw new Error("A quoted CSV field was not closed.");
  if (field || row.length || closed) line();
  return rows;
}
export function importOrders(text, asOf) {
  dayNumber(asOf);
  const rows = parseCSV(text);
  if (rows.length < 2)
    throw new Error("Include a header row and at least one order.");
  const header = rows[0].map((s) => s.trim().toLowerCase());
  if (new Set(header).size !== header.length)
    throw new Error("CSV headers must be unique.");
  const missing = HEADERS.filter((h) => !header.includes(h));
  if (missing.length)
    throw new Error("Missing columns: " + missing.join(", ") + ".");
  const accounts = new Map(),
    orderIds = new Set(),
    orders = [];
  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    const fail = (m) => {
      throw new Error(`Row ${i + 1}: ${m}`);
    };
    if (values.length !== header.length)
      fail("the number of columns does not match the header.");
    const r = Object.fromEntries(header.map((h, n) => [h, values[n].trim()]));
    for (const h of [
      "account_id",
      "account_name",
      "order_id",
      "order_date",
      "order_total",
    ])
      if (!r[h]) fail(`${h} is required.`);
    for (const h of HEADERS)
      if (r[h].length > 200) fail(`${h} exceeds 200 characters.`);
    try {
      dayNumber(r.order_date);
    } catch {
      fail("order_date must be a valid YYYY-MM-DD date.");
    }
    if (r.order_date > asOf)
      fail("order_date is later than the reporting date.");
    if (
      !/^\d+(\.\d{1,2})?$/.test(r.order_total) ||
      Number(r.order_total) <= 0 ||
      Number(r.order_total) > 10000000
    )
      fail(
        "order_total must be a positive CAD amount with up to two decimals (no $ signs or commas).",
      );
    if (r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email))
      fail("email is not valid.");
    if (orderIds.has(r.order_id))
      fail("duplicate order_id; include one row per order, not line items.");
    orderIds.add(r.order_id);
    const account = {
      id: r.account_id,
      name: r.account_name,
      contact: r.contact_name,
      email: r.email,
      city: r.city,
    };
    if (
      accounts.has(account.id) &&
      JSON.stringify(accounts.get(account.id)) !== JSON.stringify(account)
    )
      fail("account details conflict with an earlier row for this account_id.");
    accounts.set(account.id, account);
    orders.push({
      id: r.order_id,
      accountId: account.id,
      date: r.order_date,
      totalCents: Math.round(Number(r.order_total) * 100),
    });
  }
  return {
    version: 1,
    source: "import",
    asOf,
    accounts: [...accounts.values()],
    orders,
    interactions: [],
  };
}
export function csvCell(value) {
  let s = String(value ?? "");
  // Neutralize spreadsheet formulas in exported user-controlled cells.
  if (/^[\s]*[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
}
export function toCSV(headers, rows) {
  return (
    "\uFEFF" +
    [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") +
    "\r\n"
  );
}
export function ordersCSV(dataset) {
  const accounts = new Map(dataset.accounts.map((a) => [a.id, a]));
  return toCSV(
    HEADERS,
    dataset.orders.map((o) => {
      const a = accounts.get(o.accountId);
      return [
        a.id,
        a.name,
        a.contact,
        a.email,
        a.city,
        o.id,
        o.date,
        (o.totalCents / 100).toFixed(2),
      ];
    }),
  );
}
