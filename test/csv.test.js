import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCSV,
  importOrders,
  ordersCSV,
  csvCell,
  HEADERS,
} from "../dist/lib/csv.js";
import { demoData } from "../dist/lib/seed.js";
const base =
  "A,Test Retailer,Alex,alex@example.com,Vancouver,O1,2026-08-01,1234.56";
const csv = (row) => HEADERS.join(",") + "\n" + row;
test("quoted commas, escaped quotes, BOM, and multiline fields parse correctly", () => {
  assert.deepEqual(
    parseCSV('\uFEFFa,b\r\n"one, two","said ""hi""\nnext"\r\n'),
    [
      ["a", "b"],
      ["one, two", 'said "hi"\nnext'],
    ],
  );
});
test("money is represented in integer cents", () => {
  const d = importOrders(csv(base), "2026-09-12");
  assert.equal(d.orders[0].totalCents, 123456);
  assert.equal(d.source, "import");
});
test("demo orders survive CSV round trip", () => {
  const d = demoData("2026-09-12");
  const imported = importOrders(ordersCSV(d), d.asOf);
  assert.deepEqual(imported.orders, d.orders);
  assert.deepEqual(imported.accounts, d.accounts);
});
test("duplicate order IDs fail rather than inflating totals", () =>
  assert.throws(
    () => importOrders(csv(base + "\n" + base), "2026-09-12"),
    /duplicate order_id/,
  ));
test("invalid, future, negative, and overly precise order values are rejected", () => {
  for (const row of [
    base.replace("2026-08-01", "2026-02-30"),
    base.replace("2026-08-01", "2026-10-01"),
    base.replace("1234.56", "-1"),
    base.replace("1234.56", "1.001"),
  ])
    assert.throws(() => importOrders(csv(row), "2026-09-12"));
});
test("a conflicting account identity rejects the complete import", () =>
  assert.throws(
    () =>
      importOrders(
        csv(
          base +
            "\n" +
            base
              .replace("Test Retailer", "Different Retailer")
              .replace("O1", "O2"),
        ),
        "2026-09-12",
      ),
    /conflict/,
  ));
test("incomplete headers, malformed quoting and column counts fail clearly", () => {
  assert.throws(
    () => importOrders("account_id\nA", "2026-09-12"),
    /Missing columns/,
  );
  assert.throws(() => parseCSV('a\n"broken'), /not closed/);
  assert.throws(() => parseCSV('a\n"ok"oops'), /Unexpected text/);
  assert.throws(
    () => importOrders(csv(base + ",extra"), "2026-09-12"),
    /columns/,
  );
});
test("export neutralizes spreadsheet formula prefixes and quotes delimiters", () => {
  assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell("+cmd"), "'+cmd");
  assert.equal(csvCell("@SUM(1)"), "'@SUM(1)");
  assert.equal(csvCell("Coast, West"), '"Coast, West"');
});
test("CSV size and row count limits are enforced", () => {
  assert.throws(() => parseCSV("x".repeat(2 * 1024 * 1024 + 1)), /2 MB/);
  assert.throws(() => parseCSV("a\n" + "x\n".repeat(10001)), /10,000/);
});
