import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { openDatabase, readState } from "./database.mjs";
import {
  report,
  validDate,
  validMonth,
  addMonths,
  normalizeTerms,
  validateWithdrawals,
  termMaturity,
  investmentPosition,
} from "./commissions.mjs";
import { calculateScenario } from "./scenario.mjs";
const root = fileURLToPath(new URL("..", import.meta.url));
const people = ["investors", "agents", "managers"];
const tables = [...people, "investments", "withdrawals"];
function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
function text(value, name, required = false) {
  if (
    typeof value !== "string" ||
    value.length > 4000 ||
    (required && !value.trim())
  )
    fail(`${name} is required and must be valid text.`);
  return value.trim();
}
function money(value, name, allowZero = false, max = 1e12) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < (allowZero ? 0 : 0.01) ||
    value > max
  )
    fail(
      `${name} must be ${allowZero ? "zero or " : ""}a positive number up to ${max}.`,
    );
  return value;
}
function calendar(value) {
  if (!validDate(value) || value < "1900-01-01" || value > "9998-12-31")
    fail("Enter a valid date between 1900 and 9998.");
  return value;
}
function validate(db, table, body, id) {
  const name =
    table === "withdrawals" ? undefined : text(body.name, "Name", true);
  if (people.includes(table)) {
    const email = text(body.email ?? "", "Email");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      fail("Enter a valid email address.");
    return {
      name,
      email,
      phone: text(body.phone ?? "", "Phone"),
      notes: text(body.notes ?? "", "Notes"),
    };
  }
  if (table === "investments") {
    for (const [key, target] of [
      ["investor_id", "investors"],
      ["agent_id", "agents"],
      ["manager_id", "managers"],
    ]) {
      if (key === "manager_id" && !body[key]) continue;
      if (
        !db.prepare(`SELECT id FROM ${target} WHERE id=?`).get(body[key] ?? "")
      )
        fail(`Choose a valid ${target.slice(0, -1)}.`);
    }
    if (!["trailer", "lump_sum"].includes(body.commission_type))
      fail("Choose trailer or lump-sum commission.");
    const principal = money(body.principal, "Investment amount");
    if (Math.abs(principal * 100 - Math.round(principal * 100)) > 0.0001)
      fail("Investment amounts support up to two decimal places.");
    const start_date = calendar(body.start_date);
    const terms = normalizeTerms({ ...body, start_date });
    const record = {
      name,
      investor_id: body.investor_id,
      agent_id: body.agent_id,
      manager_id: body.manager_id || null,
      principal,
      start_date,
      commission_type: body.commission_type,
      rate: money(body.rate, "Commission rate", true, 100),
      manager_rate: body.manager_id
        ? money(body.manager_rate ?? 0, "Manager rate", true, 100)
        : 0,
      notes: text(body.notes ?? "", "Notes"),
      ...terms,
      manager_upfront_rate: body.manager_id ? terms.manager_upfront_rate : 0,
    };
    if (id) {
      const withdrawals = db
        .prepare("SELECT * FROM withdrawals WHERE investment_id=?")
        .all(id);
      if (withdrawals.some((w) => w.date < start_date))
        fail("Start date cannot follow an existing withdrawal.");
      validateWithdrawals({ ...record, id }, withdrawals);
      investmentPosition({ ...record, id }, withdrawals);
    } else investmentPosition({ ...record, id: "new-investment" }, []);
    return record;
  }
  const investment = db
    .prepare("SELECT * FROM investments WHERE id=?")
    .get(body.investment_id ?? "");
  if (!investment) fail("Choose a valid investment.");
  const date = calendar(body.date);
  if (date < investment.start_date)
    fail("Withdrawal date cannot precede the investment start date.");
  const amount = money(body.amount, "Withdrawal amount");
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 0.0001)
    fail("Withdrawal amounts support up to two decimal places.");
  const existing = db
    .prepare("SELECT * FROM withdrawals WHERE investment_id=? AND id!=?")
    .all(investment.id, id ?? "");
  validateWithdrawals(investment, [
    ...existing,
    { investment_id: investment.id, date, amount },
  ]);
  return {
    investment_id: investment.id,
    date,
    amount,
    notes: text(body.notes ?? "", "Notes"),
  };
}
async function readBody(req) {
  let data = "";
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 65536) fail("Request is too large.", 413);
  }
  try {
    const body = JSON.parse(data);
    if (!body || typeof body !== "object" || Array.isArray(body))
      fail("Expected a JSON object.");
    return body;
  } catch {
    fail("Expected a valid JSON object.");
  }
}
function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(body));
}
export function createApp({
  databasePath = process.env.DATABASE_PATH ||
    resolve(root, "data/trailbook.sqlite"),
} = {}) {
  const db = openDatabase(databasePath);
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      const path = url.pathname;
      if (path.startsWith("/api/")) {
        if (
          !["GET", "HEAD"].includes(req.method) &&
          req.headers.origin &&
          new URL(req.headers.origin).host !== req.headers.host
        )
          fail("Cross-origin writes are not allowed.", 403);
        if (req.method === "GET" && path === "/api/health")
          return send(res, 200, { status: "ok" });
        if (req.method === "GET" && path === "/api/state")
          return send(res, 200, readState(db));
        if (req.method === "POST" && path === "/api/calculate")
          return send(res, 200, calculateScenario(await readBody(req)));
        if (
          req.method === "GET" &&
          (path === "/api/commissions" || path === "/api/export")
        ) {
          const month = url.searchParams.get("month");
          if (!validMonth(month) || month < "1901-01" || month > "9997-12")
            fail("Choose a valid reporting month between 1901 and 9997.");
          const currency = url.searchParams.get("currency") || "USD";
          if (!["USD", "CAD"].includes(currency)) fail("Choose USD or CAD.");
          const state = readState(db);
          const current = report(state, month, currency);
          if (path === "/api/export") {
            const csv = [
              [
                "Month",
                "Currency",
                "Investment",
                "Investor",
                "Agent",
                "Overriding manager",
                "Commission type",
                "Original investment",
                "Current balance",
                "Average monthly balance",
                "Closing balance",
                "Annual return rate (%)",
                "Distribution type",
                "Monthly return",
                "DRIP credited",
                "Cash dividend",
                "Term (months)",
                "Initial maturity date",
                "Current term maturity date",
                "Renewals through reporting month",
                "Auto-renew",
                "Agent trailer/one-time rate (%)",
                "Manager trailer/one-time rate (%)",
                "Agent upfront rate (%)",
                "Manager upfront rate (%)",
                "Agent upfront commission",
                "Agent trailer commission",
                "Manager upfront commission",
                "Manager trailer commission",
                "Agent commission",
                "Manager commission",
                "Total commission",
              ],
              ...current.rows.map((r) => [
                month,
                r.currency,
                r.name,
                r.investor_name,
                r.agent_name,
                r.manager_name,
                r.commission_type,
                r.principal.toFixed(2),
                r.current_balance.toFixed(2),
                r.average_balance.toFixed(2),
                r.closing_balance.toFixed(2),
                r.return_rate,
                r.distribution_type,
                r.monthly_return.toFixed(2),
                r.drip_amount.toFixed(2),
                r.cash_dividend.toFixed(2),
                r.term_months,
                r.maturity_date ||
                  termMaturity(r.start_date, r.term_months) ||
                  "",
                r.current_maturity_date || "",
                r.renewal_count,
                r.auto_renew ? "Yes" : "No",
                r.rate,
                r.manager_rate,
                r.upfront_rate,
                r.manager_upfront_rate,
                r.agent_upfront_commission.toFixed(2),
                r.agent_trailer_commission.toFixed(2),
                r.manager_upfront_commission.toFixed(2),
                r.manager_trailer_commission.toFixed(2),
                r.agent_commission.toFixed(2),
                r.manager_commission.toFixed(2),
                r.total_commission.toFixed(2),
              ]),
            ]
              .map((row) =>
                row
                  .map((v) => {
                    let s = String(v);
                    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
                    return '"' + s.replaceAll('"', '""') + '"';
                  })
                  .join(","),
              )
              .join("\r\n");
            res.writeHead(200, {
              "Content-Type": "text/csv; charset=utf-8",
              "Content-Disposition": `attachment; filename="trailbook-${month}.csv"`,
              "Cache-Control": "no-store",
            });
            return res.end(csv);
          }
          const trend = Array.from({ length: 6 }, (_, i) => {
            const m = addMonths(month, i - 5);
            return { month: m, ...report(state, m, currency).summary };
          });
          return send(res, 200, { ...current, trend });
        }
        if (req.method === "POST" && path === "/api/clear-demo") {
          if (readState(db).demo !== true)
            fail("Sample data has already been cleared.");
          db.exec("BEGIN");
          try {
            for (const table of ["withdrawals", "investments", ...people])
              db.exec(`DELETE FROM ${table}`);
            db.prepare(
              "UPDATE metadata SET value='false' WHERE key='demo'",
            ).run();
            db.exec("COMMIT");
          } catch (e) {
            db.exec("ROLLBACK");
            throw e;
          }
          return send(res, 200, { ok: true });
        }
        const match = path.match(
          /^\/api\/(investors|agents|managers|investments|withdrawals)(?:\/([a-zA-Z0-9-]+))?$/,
        );
        if (match) {
          const [, table, id] = match;
          if (id && !db.prepare(`SELECT id FROM ${table} WHERE id=?`).get(id))
            fail("Record not found.", 404);
          if ((req.method === "POST" && !id) || (req.method === "PUT" && id)) {
            const body = await readBody(req);
            const record = validate(db, table, body, id);
            const keys = Object.keys(record);
            const recordId = id || randomUUID();
            const values = Object.values(record).map((v) =>
              typeof v === "boolean" ? Number(v) : v,
            );
            if (id)
              db.prepare(
                `UPDATE ${table} SET ${keys.map((k) => k + "=?").join(",")} WHERE id=?`,
              ).run(...values, id);
            else
              db.prepare(
                `INSERT INTO ${table}(id,${keys.join(",")}) VALUES(?,${keys.map(() => "?").join(",")})`,
              ).run(recordId, ...values);
            return send(res, id ? 200 : 201, { id: recordId, ...record });
          }
          if (req.method === "DELETE" && id) {
            if (people.includes(table)) {
              const key = {
                investors: "investor_id",
                agents: "agent_id",
                managers: "manager_id",
              }[table];
              if (
                db.prepare(`SELECT id FROM investments WHERE ${key}=?`).get(id)
              )
                fail(
                  "This record is linked to an investment. Reassign or delete the investment first.",
                  409,
                );
            }
            db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id);
            return send(res, 200, { ok: true });
          }
        }
        return send(res, 404, { error: "Endpoint not found." });
      }
      if (!["GET", "HEAD"].includes(req.method))
        return send(res, 405, { error: "Method not allowed." });
      const dist = resolve(root, "dist");
      const file = resolve(
        dist,
        "." + decodeURIComponent(path === "/" ? "/index.html" : path),
      );
      if (!file.startsWith(dist + "/"))
        return send(res, 403, { error: "Forbidden" });
      let content,
        filename = file;
      try {
        content = await readFile(file);
      } catch {
        filename = resolve(dist, "index.html");
        try {
          content = await readFile(filename);
        } catch {
          return send(res, 404, {
            error:
              "Run npm run dev for development or npm run build before production startup.",
          });
        }
      }
      const types = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".png": "image/png",
      };
      res.writeHead(200, {
        "Content-Type":
          (types[extname(filename)] || "application/octet-stream") +
          "; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": filename.endsWith("index.html")
          ? "no-cache"
          : "public, max-age=3600",
      });
      res.end(req.method === "HEAD" ? undefined : content);
    } catch (error) {
      if (!error.status) console.error(error);
      send(res, error.status || 500, {
        error: error.status
          ? error.message
          : "An unexpected server error occurred.",
      });
    }
  });
  server.on("close", () => db.close());
  return server;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const server = createApp();
  const port = Number(process.env.PORT || 3001);
  server.listen(port, "0.0.0.0", () =>
    console.log(`Trailbook listening on port ${port}`),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => server.close(() => process.exit(0)));
}
