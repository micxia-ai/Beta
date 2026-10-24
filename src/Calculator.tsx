import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Calculator as CalculatorIcon,
  Check,
  ChevronDown,
  Coins,
  FlaskConical,
  LoaderCircle,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { Row, State, Currency } from "./types";
import InvestmentTermsFields from "./InvestmentTermsFields";
import {
  formatMoney,
  termsDraft,
  termsPayload,
  type TermsDraft,
} from "./finance";
import "./calculator.css";

type DraftWithdrawal = { key: number; date: string; amount: string };
type Draft = TermsDraft & {
  principal: string;
  start_date: string;
  month: string;
  commission_type: "trailer" | "lump_sum";
  rate: string;
  manager_rate: string;
  include_manager: boolean;
  withdrawals: DraftWithdrawal[];
};
type Result = {
  month: string;
  result: Row;
  schedule: (Row & { month: string })[];
  projected_total: number;
  remaining_after_withdrawals: number;
};
const monthLabel = (month: string) =>
  new Date(month + "-01T12:00:00Z").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
const defaultDraft = (month: string, currency: Currency = "USD"): Draft => ({
  ...termsDraft({ currency }),
  principal: "120000",
  start_date: month + "-01",
  month,
  commission_type: "trailer",
  rate: "1.2",
  manager_rate: "0.24",
  include_manager: true,
  withdrawals: [],
});
const payload = (draft: Draft) => ({
  ...draft,
  ...termsPayload(draft),
  principal: Number(draft.principal),
  rate: Number(draft.rate),
  manager_rate: Number(draft.manager_rate),
  withdrawals: draft.withdrawals.map((w) => ({
    date: w.date,
    amount: Number(w.amount),
  })),
});

export default function Calculator({
  state,
  defaultMonth,
  defaultCurrency,
}: {
  state: State;
  defaultMonth: string;
  defaultCurrency: Currency;
}) {
  const [draft, setDraft] = useState<Draft>(() =>
    defaultDraft(defaultMonth, defaultCurrency),
  );
  const [result, setResult] = useState<Result | null>(null);
  const money = (amount: number) =>
    formatMoney(amount, result?.result.currency || draft.currency);
  const [snapshot, setSnapshot] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState("");
  const requestId = useRef(0);
  const withdrawalKey = useRef(0);
  const stale = result && snapshot !== JSON.stringify(payload(draft));
  function change<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }
  async function calculate(value: Draft) {
    const id = ++requestId.current;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload(value)),
      });
      const body = await response.json();
      if (id !== requestId.current) return;
      if (!response.ok)
        throw new Error(body.error || "Unable to calculate. Please try again.");
      setResult(body);
      setSnapshot(JSON.stringify(payload(value)));
    } catch (e) {
      if (id === requestId.current) setError((e as Error).message);
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }
  useEffect(() => {
    void calculate(defaultDraft(defaultMonth, defaultCurrency));
    return () => {
      requestId.current++;
    };
  }, []);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void calculate(draft);
  }
  function reset() {
    const value = defaultDraft(defaultMonth, defaultCurrency);
    setDraft(value);
    setSource("");
    void calculate(value);
  }
  function loadInvestment(id: string) {
    setSource(id);
    if (!id) {
      reset();
      return;
    }
    const investment = state.investments.find((i) => i.id === id);
    if (!investment) return;
    const value: Draft = {
      ...termsDraft(investment),
      principal: String(investment.principal),
      start_date: investment.start_date,
      month: defaultMonth,
      commission_type: investment.commission_type,
      rate: String(investment.rate),
      manager_rate: String(investment.manager_rate),
      include_manager: !!investment.manager_id,
      withdrawals: state.withdrawals
        .filter((w) => w.investment_id === id)
        .map((w) => ({
          key: withdrawalKey.current++,
          date: w.date,
          amount: String(w.amount),
        })),
    };
    setDraft(value);
    void calculate(value);
  }
  function exportScenario() {
    if (!result || stale) return;
    const rows = [
      [
        "Month",
        "Currency",
        "Average daily balance",
        "Closing balance",
        "Return earned",
        "DRIP credited",
        "Cash dividend",
        "Agent upfront",
        "Agent trailer",
        "Manager upfront",
        "Manager trailer",
        "Total commission",
      ],
      ...result.schedule.map((r) => [
        r.month,
        r.currency,
        r.average_balance.toFixed(2),
        r.closing_balance.toFixed(2),
        r.monthly_return.toFixed(2),
        r.drip_amount.toFixed(2),
        r.cash_dividend.toFixed(2),
        r.agent_upfront_commission.toFixed(2),
        r.agent_trailer_commission.toFixed(2),
        r.manager_upfront_commission.toFixed(2),
        r.manager_trailer_commission.toFixed(2),
        r.total_commission.toFixed(2),
      ]),
    ];
    const blob = new Blob([rows.map((row) => row.join(",")).join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `trailbook-scenario-${result.month}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const trailer = draft.commission_type === "trailer";
  const calculatedTrailer = result?.result.commission_type === "trailer";

  return (
    <div className="calculator-workspace">
      <div className="scenario-banner">
        <span className="scenario-symbol">
          <FlaskConical size={20} />
        </span>
        <div>
          <strong>A little room to explore.</strong>
          <p>
            Try a commission scenario here. Your saved investments stay as they
            are.
          </p>
        </div>
        <span className="scenario-badge">
          <span className="dot" />
          Scenario only
        </span>
      </div>
      <div className="calculator-grid">
        <form className="panel calculator-inputs" onSubmit={submit}>
          <div className="calculator-panel-title">
            <span>
              <CalculatorIcon size={18} />
              Build your calculation
            </span>
            <button className="text-button" type="button" onClick={reset}>
              <RotateCcw size={13} />
              Reset
            </button>
          </div>
          <div className="calculator-form-body">
            <label className="field source-field">
              Start from an existing investment{" "}
              <span className="optional">optional</span>
              <select
                aria-label="Load existing investment"
                value={source}
                onChange={(e) => loadInvestment(e.target.value)}
              >
                <option value="">New scenario</option>
                {state.investments.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="calculator-section">
              <div className="calculator-step">
                <span>01</span>
                <div>
                  <h2>Investment details</h2>
                  <p>The amount and the month you want to calculate.</p>
                </div>
              </div>
              <label className="field">
                Investment amount
                <div className="currency-input">
                  <span>{draft.currency}</span>
                  <input
                    aria-label="Scenario investment amount"
                    type="number"
                    min="0.01"
                    max="1000000000000"
                    step="0.01"
                    value={draft.principal}
                    onChange={(e) => change("principal", e.target.value)}
                    required
                  />
                </div>
              </label>
              <div className="form-grid">
                <label className="field">
                  Investment start date
                  <input
                    aria-label="Scenario start date"
                    type="date"
                    min="1900-01-01"
                    max="9998-12-31"
                    value={draft.start_date}
                    onChange={(e) =>
                      setDraft((previous) => ({
                        ...previous,
                        start_date: e.target.value,
                        maturity_date: "",
                      }))
                    }
                    required
                  />
                </label>
                <label className="field">
                  Reporting month
                  <input
                    aria-label="Scenario reporting month"
                    type="month"
                    min="1901-01"
                    max="9997-01"
                    value={draft.month}
                    onChange={(e) => change("month", e.target.value)}
                    required
                  />
                </label>
              </div>
            </div>
            <div className="calculator-section">
              <div className="calculator-step">
                <span>02</span>
                <div>
                  <h2>Commission structure</h2>
                  <p>Your rates, defined for this investment.</p>
                </div>
              </div>
              <div className="commission-options">
                <button
                  type="button"
                  aria-pressed={trailer}
                  className={trailer ? "chosen" : ""}
                  onClick={() => change("commission_type", "trailer")}
                >
                  <TrendingUp size={20} />
                  <strong>Trailer</strong>
                  <small>Recurring monthly payout</small>
                  <span className="radio-dot" />
                </button>
                <button
                  type="button"
                  aria-pressed={!trailer}
                  className={!trailer ? "chosen" : ""}
                  onClick={() => change("commission_type", "lump_sum")}
                >
                  <Coins size={20} />
                  <strong>Lump-sum</strong>
                  <small>One upfront payout</small>
                  <span className="radio-dot" />
                </button>
              </div>
              <label className="field">
                Agent {trailer ? "annual" : "one-time"} commission rate
                <div className="rate-input">
                  <input
                    aria-label="Scenario agent rate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.0001"
                    value={draft.rate}
                    onChange={(e) => change("rate", e.target.value)}
                    required
                  />
                  <span>% {trailer ? "per year" : "one time"}</span>
                </div>
              </label>
              <div className="manager-toggle">
                <span>
                  <ShieldCheck size={17} />
                  <label htmlFor="include-manager">
                    Include a manager override
                  </label>
                </span>
                <input
                  id="include-manager"
                  type="checkbox"
                  checked={draft.include_manager}
                  onChange={(e) => change("include_manager", e.target.checked)}
                />
              </div>
              {draft.include_manager && (
                <label className="field manager-rate-field">
                  Manager {trailer ? "annual" : "one-time"} override rate
                  <div className="rate-input">
                    <input
                      aria-label="Scenario manager rate"
                      type="number"
                      min="0"
                      max="100"
                      step="0.0001"
                      value={draft.manager_rate}
                      onChange={(e) => change("manager_rate", e.target.value)}
                      required
                    />
                    <span>% {trailer ? "per year" : "one time"}</span>
                  </div>
                  <small>Paid in addition to the agent’s commission.</small>
                </label>
              )}
            </div>
            <div className="calculator-section">
              <div className="calculator-step">
                <span>03</span>
                <div>
                  <h2>Returns, term & renewal</h2>
                  <p>
                    Model compounding, cash payouts, and the next investment
                    term.
                  </p>
                </div>
              </div>
              <InvestmentTermsFields
                value={draft}
                onChange={(value) =>
                  setDraft((previous) => ({ ...previous, ...value }))
                }
                startDate={draft.start_date}
                trailer={trailer}
                hasManager={draft.include_manager}
              />
            </div>
            <div className="calculator-section withdrawal-section">
              <div className="calculator-step">
                <span>04</span>
                <div>
                  <h2>
                    Withdrawals <small>optional</small>
                  </h2>
                  <p>Add a date and amount to see the monthly adjustment.</p>
                </div>
              </div>
              {!draft.withdrawals.length && (
                <div className="withdrawal-placeholder">
                  No withdrawals. Calculating on the full invested balance.
                </div>
              )}
              {draft.withdrawals.map((w, index) => (
                <div className="scenario-withdrawal" key={w.key}>
                  <label className="field">
                    Withdrawal date
                    <input
                      aria-label={`Scenario withdrawal date ${index + 1}`}
                      type="date"
                      min={draft.start_date}
                      max="9998-12-31"
                      value={w.date}
                      onChange={(e) =>
                        change(
                          "withdrawals",
                          draft.withdrawals.map((item) =>
                            item.key === w.key
                              ? { ...item, date: e.target.value }
                              : item,
                          ),
                        )
                      }
                      required
                    />
                  </label>
                  <label className="field">
                    Amount ({draft.currency})
                    <input
                      aria-label={`Scenario withdrawal amount ${index + 1}`}
                      type="number"
                      min="0.01"
                      step="0.01"
                      max="1000000000000"
                      value={w.amount}
                      onChange={(e) =>
                        change(
                          "withdrawals",
                          draft.withdrawals.map((item) =>
                            item.key === w.key
                              ? { ...item, amount: e.target.value }
                              : item,
                          ),
                        )
                      }
                      required
                    />
                  </label>
                  <button
                    className="icon-button danger"
                    type="button"
                    aria-label={`Remove scenario withdrawal ${index + 1}`}
                    onClick={() =>
                      change(
                        "withdrawals",
                        draft.withdrawals.filter((item) => item.key !== w.key),
                      )
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="button add-scenario-withdrawal"
                disabled={draft.withdrawals.length >= 100}
                onClick={() =>
                  change("withdrawals", [
                    ...draft.withdrawals,
                    {
                      key: withdrawalKey.current++,
                      date:
                        draft.start_date > draft.month + "-15"
                          ? draft.start_date
                          : draft.month + "-15",
                      amount: "",
                    },
                  ])
                }
              >
                <Plus size={15} />
                Add a withdrawal
              </button>
            </div>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <button className="button primary calculate-button" disabled={busy}>
              {busy ? (
                <LoaderCircle size={17} className="spin" />
              ) : (
                <CalculatorIcon size={17} />
              )}
              {busy ? "Calculating…" : "Calculate commission"}
              <ArrowRight size={16} />
            </button>
            <div className="calculator-safe-note">
              <Check size={12} />
              Explore freely. This calculation won’t save or change records.
            </div>
          </div>
        </form>
        <aside
          className="calculator-results"
          aria-label="Calculation results"
          aria-busy={busy}
        >
          <section
            className={"payout-card " + (stale ? "stale" : "")}
            aria-live="polite"
          >
            <div className="payout-eyebrow">
              <span>YOUR MONTHLY COMMISSION</span>
              <span className="payout-icon">
                <Coins size={19} />
              </span>
            </div>
            <span className="payout-month">
              {result ? monthLabel(result.month) : "Calculating your scenario"}
            </span>
            <strong className="payout-total" data-testid="scenario-total">
              {result ? money(result.result.total_commission) : "—"}
            </strong>
            <span className="payout-caption">
              Total agent earnings + manager override
            </span>
            {stale && (
              <div className="stale-note" role="status">
                Inputs changed. Calculate to update these results.
              </div>
            )}
            <div className="payout-split">
              <div>
                <span>
                  <Wallet size={14} />
                  Agent commission
                </span>
                <strong data-testid="scenario-agent">
                  {result ? money(result.result.agent_commission) : "—"}
                </strong>
              </div>
              <div>
                <span>
                  <ShieldCheck size={14} />
                  Manager override
                </span>
                <strong data-testid="scenario-manager">
                  {result ? money(result.result.manager_commission) : "—"}
                </strong>
              </div>
            </div>
          </section>
          <section className="panel calculation-explained">
            <div className="panel-heading">
              <h2>Behind the numbers</h2>
              <span className="subtle-tag">
                {result
                  ? calculatedTrailer
                    ? "Trailer"
                    : "Lump-sum"
                  : "Preview"}
              </span>
            </div>
            {result && (
              <>
                <dl>
                  <div>
                    <dt>Average daily balance</dt>
                    <dd data-testid="scenario-average">
                      {money(result.result.average_balance)}
                    </dd>
                  </div>
                  <div>
                    <dt>Earning days in month</dt>
                    <dd>
                      {result.result.earning_days} /{" "}
                      {result.result.days_in_month}
                    </dd>
                  </div>
                  <div>
                    <dt>Month-end balance</dt>
                    <dd>{money(result.result.closing_balance)}</dd>
                  </div>
                  <div>
                    <dt>Return earned this month</dt>
                    <dd>{money(result.result.monthly_return)}</dd>
                  </div>
                </dl>
                <div className="scenario-formula">
                  <span>
                    {!calculatedTrailer &&
                    result.result.commission_events.length === 0
                      ? "LUMP-SUM PAYOUT TIMING"
                      : "AGENT COMMISSION FORMULA"}
                  </span>
                  <p>
                    {calculatedTrailer ? (
                      <>
                        {money(result.result.average_balance)} <b>×</b>{" "}
                        {result.result.rate}% <b>÷</b> 12
                      </>
                    ) : result.result.commission_events.length > 0 ? (
                      <>
                        {money(
                          result.result.commission_events.reduce(
                            (sum, event) => sum + event.base,
                            0,
                          ),
                        )}{" "}
                        <b>×</b> {result.result.rate}%
                      </>
                    ) : (
                      <>No term starts in this month</>
                    )}
                  </p>
                  <strong>
                    ={" "}
                    {money(
                      calculatedTrailer
                        ? result.result.agent_trailer_commission
                        : result.result.agent_upfront_commission,
                    )}
                  </strong>
                  <small>
                    Agent upfront{" "}
                    {money(result.result.agent_upfront_commission)} + trailer{" "}
                    {money(result.result.agent_trailer_commission)}. Manager
                    upfront {money(result.result.manager_upfront_commission)} +
                    trailer {money(result.result.manager_trailer_commission)}.
                  </small>
                  <small>
                    DRIP reinvested {money(result.result.drip_amount)} · cash
                    dividend {money(result.result.cash_dividend)}
                  </small>
                  {result.result.current_maturity_date && (
                    <small>
                      Maturity {result.result.current_maturity_date} ·{" "}
                      {result.result.renewal_count} renewals through this month.
                    </small>
                  )}
                  {!calculatedTrailer &&
                    result.result.commission_events.length === 0 && (
                      <small>
                        Lump-sum payout applies only in the investment start
                        month or a renewal month.
                      </small>
                    )}
                </div>
              </>
            )}
          </section>
          <div className="calculator-rules">
            <span className="rules-leaf">
              <TrendingUp size={18} />
            </span>
            <div>
              <strong>Every date, accounted for.</strong>
              <p>
                Start and withdrawal dates both earn commission. DRIP posts at
                month-end; cash dividends do not compound. Renewal starts after
                maturity and repays upfront commission on the renewed balance.
                Annual rates are divided by 12.
              </p>
            </div>
          </div>
        </aside>
      </div>
      {result && (
        <section
          className={"panel scenario-schedule " + (stale ? "stale" : "")}
        >
          <div className="panel-heading">
            <div>
              <h2>
                Your monthly breakdown{" "}
                <span className="count-badge">12 months</span>
              </h2>
              <p>
                Starting {monthLabel(result.month)} · Includes modeled returns,
                withdrawals, and term renewals. All amounts are in{" "}
                {result.result.currency}.
                {stale && " Recalculate to reflect your latest changes."}
              </p>
            </div>
            <button
              className="button small-button"
              disabled={!!stale || busy}
              onClick={exportScenario}
            >
              <ArrowDownToLine size={15} />
              Export scenario
            </button>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Average daily balance</th>
                  <th>Closing balance</th>
                  <th>Return earned</th>
                  <th>DRIP / cash dividend</th>
                  <th>Upfront / trailer</th>
                  <th>Agent commission</th>
                  <th>Manager override</th>
                  <th>Total commission</th>
                </tr>
              </thead>
              <tbody>
                {result.schedule.map((r) => (
                  <tr
                    key={r.month}
                    className={r.month === result.month ? "selected-month" : ""}
                  >
                    <td>
                      <strong>{monthLabel(r.month)}</strong>
                      {r.month === result.month && (
                        <small>Selected month</small>
                      )}
                    </td>
                    <td>{money(r.average_balance)}</td>
                    <td>{money(r.closing_balance)}</td>
                    <td>{money(r.monthly_return)}</td>
                    <td>
                      {money(r.drip_amount)} / {money(r.cash_dividend)}
                    </td>
                    <td>
                      {money(
                        r.agent_upfront_commission +
                          r.manager_upfront_commission,
                      )}{" "}
                      /{" "}
                      {money(
                        r.agent_trailer_commission +
                          r.manager_trailer_commission,
                      )}
                    </td>
                    <td>{money(r.agent_commission)}</td>
                    <td>{money(r.manager_commission)}</td>
                    <td>
                      <strong>{money(r.total_commission)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={8}>Total over these 12 months</td>
                  <td>{money(result.projected_total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
