import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Calculator as CalculatorIcon,
  Coins,
  FlaskConical,
  Database,
  FileText,
  LayoutDashboard,
  Leaf,
  LoaderCircle,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import type {
  Entity,
  Investment,
  Page,
  Person,
  Report,
  Row,
  State,
} from "./types";
import Calculator from "./Calculator";
import InvestmentTermsFields from "./InvestmentTermsFields";
import { formatMoney, termsDraft, termsPayload } from "./finance";
import type { Currency } from "./types";
import "./investments.css";

const today = () => new Date().toISOString().slice(0, 10);
const dateLabel = (value: string, short = false) =>
  new Date(
    value + (value.length === 7 ? "-01" : "") + "T12:00:00Z",
  ).toLocaleDateString("en-US", {
    month: short ? "short" : "long",
    ...(value.length === 10 ? { day: "numeric" } : {}),
    year: "numeric",
    timeZone: "UTC",
  });
const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
const shiftMonth = (month: string, offset: number) => {
  const d = new Date(month + "-01T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + offset);
  return d.toISOString().slice(0, 7);
};
const labels: Record<Page, string> = {
  overview: "Overview",
  calculator: "Calculator",
  investments: "Investments",
  investors: "Investors",
  agents: "Agents",
  managers: "Overriding managers",
  ledger: "Monthly ledger",
};
const singular: Record<Entity, string> = {
  investments: "investment",
  investors: "investor",
  agents: "agent",
  managers: "overriding manager",
};
const navigation = [
  { id: "overview", icon: LayoutDashboard },
  { id: "calculator", icon: CalculatorIcon },
  { id: "investments", icon: BriefcaseBusiness },
  { id: "investors", icon: Users },
  { id: "agents", icon: Wallet },
  { id: "managers", icon: ShieldCheck },
  { id: "ledger", icon: FileText },
] as const;
async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const res = await fetch("/api/" + path, {
    method,
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Unable to complete request.");
  return data;
}
function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  const n = [...name].reduce((s, c) => s + c.charCodeAt(0), 0);
  return (
    <span className={`avatar color-${n % 5} ${small ? "small" : ""}`}>
      {initials(name)}
    </span>
  );
}
function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Database size={24} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
function Modal({
  title,
  subtitle,
  close,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  close: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current
      ?.querySelector<HTMLElement>("input,button,select,textarea")
      ?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const elements = ref.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
        );
        if (!elements?.length) return;
        const first = elements[0],
          last = elements[elements.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = bodyOverflow;
      previous?.focus();
    };
  }, [close]);
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className={`modal ${wide ? "wide" : ""}`}
      >
        <header className="modal-head">
          <div>
            <span className="eyebrow">TRAILBOOK WORKSPACE</span>
            <h2 id="dialog-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={close}
          >
            <X size={21} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>(() => {
    const hash = window.location.hash.slice(1);
    return hash in labels ? (hash as Page) : "overview";
  });
  const [currency, setCurrency] = useState<Currency>(() =>
    localStorage.getItem("trailbook-currency") === "CAD" ? "CAD" : "USD",
  );
  const money = (value: number, compact = false) =>
    formatMoney(value, currency, compact);
  useEffect(
    () => localStorage.setItem("trailbook-currency", currency),
    [currency],
  );
  const [month, setMonth] = useState(today().slice(0, 7));
  const [state, setState] = useState<State | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [editor, setEditor] = useState<{
    entity: Entity;
    record?: Person | Investment;
  } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [help, setHelp] = useState(false);
  const [menu, setMenu] = useState(false);
  const notify = (message: string) => {
    setToast(message);
  };
  const refresh = () => setRevision((r) => r + 1);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError("");
    Promise.all([
      api<State>("state"),
      api<Report>("commissions?month=" + month + "&currency=" + currency),
    ])
      .then(([s, r]) => {
        if (!cancelled) {
          setState(s);
          setReport(r);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month, revision, currency]);
  useEffect(() => {
    setCurrentPage(1);
  }, [query, filter, page]);
  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash.slice(1);
      if (hash in labels) {
        setPage(hash as Page);
        setQuery("");
        setFilter("all");
      }
    };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const navigate = (next: Page) => {
    window.location.hash = next;
    setPage(next);
    setQuery("");
    setFilter("all");
    setMenu(false);
  };
  const remove = async (
    entity: Entity | "withdrawals",
    id: string,
    name: string,
  ) => {
    if (
      !window.confirm(
        `Delete ${name}?${entity === "investments" ? " Its withdrawal history will also be deleted." : ""} This cannot be undone.`,
      )
    )
      return;
    try {
      await api(entity + "/" + id, "DELETE");
      if (entity === "investments") setSelected(null);
      refresh();
      notify("Record deleted.");
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const clearDemo = async () => {
    if (
      !window.confirm(
        "Clear the entire sample portfolio and any records you have added? Export your monthly reports first. This cannot be undone.",
      )
    )
      return;
    try {
      await api("clear-demo", "POST");
      setSelected(null);
      refresh();
      notify("Sample portfolio cleared. Your workspace is ready.");
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const exportReport = () => {
    window.location.assign(
      "/api/export?month=" + month + "&currency=" + currency,
    );
  };
  const rows = (report?.rows || []).filter(
    (r) =>
      (filter === "all" || r.commission_type === filter) &&
      [r.name, r.investor_name, r.agent_name, r.manager_name].some((s) =>
        s.toLowerCase().includes(query.toLowerCase()),
      ),
  );
  const selectedRow = report?.rows.find((r) => r.id === selected);
  const addButton = (entity: Entity, text?: string) => (
    <button className="button primary" onClick={() => setEditor({ entity })}>
      <Plus size={17} />
      {text || `Add ${singular[entity]}`}
    </button>
  );
  const investmentTable = (limit?: number) => {
    const shown = limit
      ? rows.slice(0, limit)
      : rows.slice((currentPage - 1) * 8, currentPage * 8);
    return (
      <>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Investment / investor</th>
                <th>Original / current balance</th>
                <th>Return / distribution</th>
                <th>Commission type</th>
                <th>Agent rate</th>
                <th>Monthly commission</th>
                <th>Status</th>
                <th aria-label="Details"></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr
                  key={r.id}
                  className="clickable"
                  onClick={() => setSelected(r.id)}
                >
                  <td>
                    <div className="investment-cell">
                      <span
                        className={
                          "fund-icon fund-" + (r.name.charCodeAt(0) % 4)
                        }
                      >
                        <Leaf size={18} />
                      </span>
                      <span>
                        <strong>{r.name}</strong>
                        <small>{r.investor_name}</small>
                      </span>
                    </div>
                  </td>
                  <td>
                    <strong className="tabular">
                      {money(r.principal, true)}
                    </strong>
                    <small>
                      Now {money(r.current_balance)} · {r.currency}
                    </small>
                  </td>
                  <td>
                    <strong>{r.return_rate}% annual</strong>
                    <small>
                      {r.distribution_type === "drip"
                        ? "DRIP · monthly compounding"
                        : "Cash dividend payout"}
                    </small>
                  </td>
                  <td>
                    <span
                      className={`type-pill ${r.commission_type === "lump_sum" ? "lump" : ""}`}
                    >
                      <span className="dot" />
                      {r.commission_type === "trailer"
                        ? r.upfront_rate > 0
                          ? "Upfront + trailer"
                          : "Trailer"
                        : "Lump-sum"}
                    </span>
                  </td>
                  <td className="tabular">
                    {r.rate.toFixed(2)}%
                    <small>
                      {r.commission_type === "trailer"
                        ? `per annum · ${r.upfront_rate}% upfront`
                        : "per term"}
                    </small>
                  </td>
                  <td>
                    <strong className="tabular">
                      {money(r.total_commission)}
                    </strong>
                    {r.month_withdrawals.length > 0 && (
                      <small className="orange-text">Withdrawal adjusted</small>
                    )}
                  </td>
                  <td>
                    <span
                      className={
                        "status " +
                        (r.status === "matured"
                          ? "matured"
                          : r.status === "scheduled"
                            ? "future"
                            : r.status === "withdrawn"
                              ? "closed"
                              : "")
                      }
                    >
                      <span className="dot" />
                      {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                    </span>
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`View ${r.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(r.id);
                      }}
                    >
                      <ArrowUpRight size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!shown.length && (
          <Empty title="No investments found">
            {state?.investments.length
              ? "Try another currency, search, or commission type."
              : "Add an investor and agent, then create your first investment."}
          </Empty>
        )}
        {!limit && rows.length > 0 && (
          <div className="table-footer">
            <span>
              Showing {(currentPage - 1) * 8 + 1}–
              {Math.min(currentPage * 8, rows.length)} of {rows.length}{" "}
              investments
            </span>
            <div className="pagination">
              <button
                className="icon-button"
                aria-label="Previous page"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              <span>
                {currentPage} / {Math.max(1, Math.ceil(rows.length / 8))}
              </span>
              <button
                className="icon-button"
                aria-label="Next page"
                disabled={currentPage * 8 >= rows.length}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="app-shell">
      {menu && (
        <div className="sidebar-backdrop" onClick={() => setMenu(false)} />
      )}
      <aside className={"sidebar " + (menu ? "open" : "")}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("overview");
          }}
        >
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          trailbook<span className="brand-period">.</span>
        </a>
        <div className="workspace-select">
          <span className="workspace-icon">
            <BriefcaseBusiness size={17} />
          </span>
          <div>
            <strong>My workspace</strong>
            <small>Commission management</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {navigation.map(({ id, icon: Icon }) => (
            <button
              key={id}
              className={"nav-item " + (page === id ? "active" : "")}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              <span>{labels[id]}</span>
              {id === "investments" && state && (
                <b>{state.investments.length}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-icon">
              <TrendingUp size={19} />
            </span>
            <strong>
              Less admin.
              <br />
              More perspective.
            </strong>
            <p>Your commissions, made clear.</p>
            <button onClick={() => setHelp(true)}>
              How calculations work <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="db-status">
            <span className="dot" />
            <span>SQLite database connected</span>
          </div>
          <div className="user-profile">
            <span className="user-avatar">MW</span>
            <div>
              <strong>My workspace</strong>
              <small>Local administrator</small>
            </div>
            <button
              className="icon-button"
              aria-label="Workspace information"
              onClick={() => setHelp(true)}
            >
              <MoreHorizontal size={19} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{labels[page]}</strong>
          </div>
          <div className="topbar-right">
            <label className="currency-select">
              <span>Report currency</span>
              <select
                aria-label="Report currency"
                value={currency}
                onChange={(e) => {
                  setCurrency(e.target.value as Currency);
                  setReport(null);
                  setSelected(null);
                  setCurrentPage(1);
                }}
              >
                <option value="USD">USD</option>
                <option value="CAD">CAD</option>
              </select>
            </label>
            <span className="topbar-divider" />
            <button
              className="icon-button"
              aria-label="Calculation help"
              onClick={() => setHelp(true)}
            >
              <CircleHelp size={19} />
            </button>
            <span className="user-avatar top-avatar">MW</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR COMMISSIONS, CONNECTED</div>
              <h1>
                {page === "overview" ? "Commission overview" : labels[page]}
              </h1>
              <p>
                {
                  {
                    overview:
                      "A little clarity for every investment. A complete view of every payout.",
                    calculator:
                      "Build a scenario. See the payout. Understand every number.",
                    investments:
                      "Every investment, its people, and the commission it earns.",
                    investors:
                      "The people behind your portfolio. All in one place.",
                    agents:
                      "Manage the agents who grow your investment portfolio.",
                    managers:
                      "Keep your management relationships and override earnings connected.",
                    ledger:
                      "A transparent, month-by-month record of every commission.",
                  }[page]
                }
              </p>
            </div>
            <div className="heading-actions">
              {(page === "overview" || page === "ledger") && (
                <button
                  className="button"
                  onClick={exportReport}
                  disabled={!report || busy}
                >
                  <ArrowDownToLine size={16} />
                  Export report
                </button>
              )}
              {page === "calculator" && (
                <button className="button" onClick={() => setHelp(true)}>
                  <CircleHelp size={16} />
                  Calculation rules
                </button>
              )}
              {page === "overview" && (
                <button
                  className="button"
                  onClick={() => navigate("calculator")}
                >
                  <CalculatorIcon size={16} />
                  Calculator
                </button>
              )}
              {page !== "ledger" &&
                page !== "calculator" &&
                addButton(
                  ["investors", "agents", "managers"].includes(page)
                    ? (page as Entity)
                    : "investments",
                )}
            </div>
          </div>
          {state?.public_demo && (
            <div className="demo-banner public-demo-banner">
              <span>
                <FlaskConical size={15} />
                Public testing workspace. Use sample data only; records are
                shared and may reset.
              </span>
            </div>
          )}
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button onClick={refresh}>Try again</button>
            </div>
          )}
          {state?.demo && page !== "calculator" && (
            <div className="demo-banner">
              <span>
                <span className="sample-dot" />
                You’re exploring a sample portfolio. Changes are saved to this
                workspace.
              </span>
              <button onClick={clearDemo}>
                Start with a clean workspace <ArrowRight size={14} />
              </button>
            </div>
          )}
          {["overview", "investments", "ledger"].includes(page) && (
            <div className="period-row">
              <div className="section-tab">
                <span className="dot" />
                {page === "ledger"
                  ? "Monthly calculation"
                  : "Portfolio snapshot"}
                {busy && <LoaderCircle className="spin" size={14} />}
              </div>
              <div className="month-control">
                <button
                  className="icon-button"
                  aria-label="Previous month"
                  onClick={() => setMonth((m) => shiftMonth(m, -1))}
                >
                  <ChevronLeft size={15} />
                </button>
                <label>
                  <input
                    aria-label="Reporting month"
                    type="month"
                    min="1901-01"
                    max="9997-12"
                    value={month}
                    onChange={(e) => {
                      if (e.target.value) setMonth(e.target.value);
                    }}
                  />
                </label>
                <button
                  className="icon-button"
                  aria-label="Next month"
                  onClick={() => setMonth((m) => shiftMonth(m, 1))}
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
          {!state || !report ? (
            <div className="loading">
              <LoaderCircle className="spin" />
              Loading your workspace…
            </div>
          ) : (
            <>
              {page === "calculator" && (
                <Calculator
                  state={state}
                  defaultMonth={month}
                  defaultCurrency={currency}
                />
              )}
              {page === "overview" && (
                <>
                  <div className="stats-grid">
                    <Stat
                      title="Total commission"
                      value={money(report.summary.total_commission)}
                      sub={`Earned in ${dateLabel(month, true)}`}
                      icon={<Coins size={20} />}
                      dark
                    />
                    <Stat
                      title="Current invested balance"
                      value={money(report.summary.current_balance, true)}
                      sub={`Current balance · ${currency} only`}
                      icon={<BriefcaseBusiness size={20} />}
                    />
                    <Stat
                      title="Agent commission"
                      value={money(report.summary.agent_commission)}
                      sub={`${state.agents.length} agents in your network`}
                      icon={<Wallet size={20} />}
                    />
                    <Stat
                      title="Manager overrides"
                      value={money(report.summary.manager_commission)}
                      sub={`${state.managers.length} overriding managers`}
                      icon={<ShieldCheck size={20} />}
                    />
                  </div>
                  <div className="charts-grid">
                    <section className="panel trend-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>
                            Commission activity{" "}
                            <span className="subtle-tag">6 months</span>
                          </h2>
                          <p>A monthly picture of your portfolio earnings.</p>
                        </div>
                        <div className="chart-legend">
                          <span>
                            <i className="legend-agent" />
                            Agents
                          </span>
                          <span>
                            <i className="legend-manager" />
                            Managers
                          </span>
                        </div>
                      </div>
                      <CommissionChart report={report} />
                      <div className="chart-caption">
                        <span>
                          <TrendingUp size={14} />A clearer picture, month after
                          month.
                        </span>
                        <button
                          className="text-button"
                          onClick={() => navigate("ledger")}
                        >
                          View ledger <ArrowRight size={14} />
                        </button>
                      </div>
                    </section>
                    <section className="panel mix-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Commission mix</h2>
                          <p>By payout structure this month.</p>
                        </div>
                        <span className="icon-soft">
                          <Coins size={17} />
                        </span>
                      </div>
                      <CommissionMix report={report} />
                    </section>
                  </div>
                  <section className="panel investments-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>
                          Investment portfolio{" "}
                          <span className="count-badge">
                            {report.rows.length}
                          </span>
                        </h2>
                        <p>
                          Your investments and their commissions at a glance.
                        </p>
                      </div>
                      <button
                        className="button small-button"
                        onClick={() => navigate("investments")}
                      >
                        View all investments <ArrowUpRight size={15} />
                      </button>
                    </div>
                    {investmentTable(5)}
                    <div className="table-footer">
                      <span>
                        <span className="dot green" />
                        {report.summary.active_investments} active investments
                        this month
                      </span>
                      <span>
                        Monthly commissions include manager overrides{" "}
                        <CircleHelp size={13} />
                      </span>
                    </div>
                  </section>
                </>
              )}
              {["overview", "investments", "ledger"].includes(page) && (
                <div className="return-strip">
                  <div>
                    <span>
                      Investment returns · {dateLabel(month, true)} · {currency}
                    </span>
                    <strong>{money(report.summary.monthly_return)}</strong>
                  </div>
                  <div>
                    <span>DRIP reinvested</span>
                    <strong>{money(report.summary.drip_amount)}</strong>
                  </div>
                  <div>
                    <span>Cash dividends</span>
                    <strong>{money(report.summary.cash_dividend)}</strong>
                  </div>
                </div>
              )}
              {page === "investments" && (
                <section className="panel">
                  <div className="list-toolbar">
                    <div className="tabs">
                      {[
                        ["all", "All investments"],
                        ["trailer", "Trailer"],
                        ["lump_sum", "Lump-sum"],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          className={filter === value ? "selected" : ""}
                          onClick={() => setFilter(value)}
                        >
                          {label}
                          {value === "all" && <span>{report.rows.length}</span>}
                        </button>
                      ))}
                    </div>
                    <SearchBox
                      value={query}
                      onChange={setQuery}
                      placeholder="Search investments…"
                    />
                  </div>
                  {investmentTable()}
                </section>
              )}
              {["investors", "agents", "managers"].includes(page) && (
                <section className="panel">
                  <div className="list-toolbar">
                    <div>
                      <h2>
                        {labels[page]}{" "}
                        <span className="count-badge">
                          {state[page as "investors"].length}
                        </span>
                      </h2>
                      <p className="muted small-text">
                        Contact details and linked investments
                      </p>
                    </div>
                    <SearchBox
                      value={query}
                      onChange={setQuery}
                      placeholder={`Search ${page}…`}
                    />
                  </div>
                  <div className="table-scroll">
                    <table className="people-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Contact details</th>
                          <th>Investments</th>
                          <th>
                            {page === "investors"
                              ? "Invested balance"
                              : `Commission · ${dateLabel(month, true)}`}
                          </th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {state[page as "investors"]
                          .filter((p) =>
                            [p.name, p.email, p.phone].some((s) =>
                              s.toLowerCase().includes(query.toLowerCase()),
                            ),
                          )
                          .map((p) => {
                            const key =
                              page === "investors"
                                ? "investor_id"
                                : page === "agents"
                                  ? "agent_id"
                                  : "manager_id";
                            const linked = report.rows.filter(
                              (r) => r[key] === p.id,
                            );
                            const amount = linked.reduce(
                              (s, r) =>
                                s +
                                (page === "investors"
                                  ? r.closing_balance
                                  : page === "agents"
                                    ? r.agent_commission
                                    : r.manager_commission),
                              0,
                            );
                            return (
                              <tr key={p.id}>
                                <td>
                                  <div className="person-cell">
                                    <Avatar name={p.name} />
                                    <div>
                                      <strong>{p.name}</strong>
                                      <small>
                                        {p.notes ||
                                          `Registered ${singular[page as Entity]}`}
                                      </small>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  {p.email ? (
                                    <a
                                      className="contact-link"
                                      href={"mailto:" + p.email}
                                    >
                                      {p.email}
                                    </a>
                                  ) : (
                                    <span className="muted">
                                      No email added
                                    </span>
                                  )}
                                  <small>{p.phone || "No phone added"}</small>
                                </td>
                                <td>
                                  <span className="neutral-pill">
                                    {linked.length}{" "}
                                    {linked.length === 1
                                      ? "investment"
                                      : "investments"}
                                  </span>
                                </td>
                                <td>
                                  <strong className="tabular">
                                    {money(amount)}
                                  </strong>
                                </td>
                                <td>
                                  <div className="row-actions">
                                    <button
                                      className="icon-button"
                                      aria-label={`Edit ${p.name}`}
                                      onClick={() =>
                                        setEditor({
                                          entity: page as Entity,
                                          record: p,
                                        })
                                      }
                                    >
                                      <Pencil size={16} />
                                    </button>
                                    <button
                                      className="icon-button danger"
                                      aria-label={`Delete ${p.name}`}
                                      onClick={() =>
                                        remove(page as Entity, p.id, p.name)
                                      }
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                  {state[page as "investors"].filter((p) =>
                    [p.name, p.email, p.phone].some((s) =>
                      s.toLowerCase().includes(query.toLowerCase()),
                    ),
                  ).length === 0 && (
                    <Empty
                      title={
                        query
                          ? "No matching records"
                          : `Add your first ${singular[page as Entity]}`
                      }
                      action={!query && addButton(page as Entity)}
                    >
                      {query
                        ? "Try a different name, email, or phone number."
                        : "Build your database, then connect people to an investment."}
                    </Empty>
                  )}
                </section>
              )}
              {page === "ledger" && (
                <>
                  <div className="ledger-summary">
                    <div>
                      <span className="eyebrow">
                        TOTAL PAYABLE · {dateLabel(month).toUpperCase()}
                      </span>
                      <strong>{money(report.summary.total_commission)}</strong>
                    </div>
                    <div>
                      <span>Agent earnings</span>
                      <b>{money(report.summary.agent_commission)}</b>
                    </div>
                    <div>
                      <span>Manager overrides</span>
                      <b>{money(report.summary.manager_commission)}</b>
                    </div>
                    <button className="button" onClick={() => setHelp(true)}>
                      <CircleHelp size={16} />
                      Calculation rules
                    </button>
                  </div>
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Monthly commission ledger</h2>
                        <p>
                          Rates are defined per investment. Trailer rates are
                          annual.
                        </p>
                      </div>
                      <SearchBox
                        value={query}
                        onChange={setQuery}
                        placeholder="Search ledger…"
                      />
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Investment</th>
                            <th>Average balance</th>
                            <th>Investment return</th>
                            <th>Agent / commission</th>
                            <th>Manager / override</th>
                            <th>Total payable</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r) => (
                            <tr
                              key={r.id}
                              className="clickable"
                              onClick={() => setSelected(r.id)}
                            >
                              <td>
                                <strong>{r.name}</strong>
                                <small>
                                  {r.commission_type === "trailer"
                                    ? `${r.earning_days} of ${r.days_in_month} earning days`
                                    : "Upfront · start & renewal months"}
                                </small>
                              </td>
                              <td>
                                {money(r.average_balance)}
                                <small>
                                  {r.month_withdrawals.length
                                    ? "Adjusted for withdrawals"
                                    : "Daily weighted balance"}
                                </small>
                              </td>
                              <td>
                                <strong>{money(r.monthly_return)}</strong>
                                <small>
                                  DRIP {money(r.drip_amount)} · cash{" "}
                                  {money(r.cash_dividend)}
                                </small>
                              </td>
                              <td>
                                <strong>{money(r.agent_commission)}</strong>
                                <small>
                                  {r.agent_name} · {r.rate}%
                                </small>
                              </td>
                              <td>
                                <strong>{money(r.manager_commission)}</strong>
                                <small>
                                  {r.manager_name || "Unassigned"}
                                  {r.manager_id ? ` · ${r.manager_rate}%` : ""}
                                </small>
                              </td>
                              <td>
                                <strong>{money(r.total_commission)}</strong>
                              </td>
                              <td>
                                <ArrowUpRight size={16} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={3}>
                              Total commission · {dateLabel(month)} · {currency}
                            </td>
                            <td>
                              {money(
                                rows.reduce(
                                  (s, r) => s + r.agent_commission,
                                  0,
                                ),
                              )}
                            </td>
                            <td>
                              {money(
                                rows.reduce(
                                  (s, r) => s + r.manager_commission,
                                  0,
                                ),
                              )}
                            </td>
                            <td>
                              {money(
                                rows.reduce(
                                  (s, r) => s + r.total_commission,
                                  0,
                                ),
                              )}
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    {!rows.length && (
                      <Empty title="No commission records">
                        Add an investment or change your search to see its
                        monthly calculation.
                      </Empty>
                    )}
                  </section>
                </>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>
              <span className="mini-brand">▥</span> Thoughtfully tracked.
              Clearly calculated.
            </span>
            <button onClick={() => setHelp(true)}>
              Calculation methodology <ArrowUpRight size={13} />
            </button>
          </footer>
        </main>
      </div>
      {editor && state && (
        <RecordEditor
          key={editor.record?.id || editor.entity}
          defaultCurrency={currency}
          entity={editor.entity}
          record={editor.record}
          state={state}
          close={() => setEditor(null)}
          saved={(savedCurrency) => {
            if (savedCurrency && savedCurrency !== currency) {
              setCurrency(savedCurrency);
              setReport(null);
            }
            setEditor(null);
            refresh();
            notify("Record saved successfully.");
          }}
        />
      )}
      {selectedRow && state && !editor && (
        <InvestmentDetail
          row={selectedRow}
          state={state}
          month={month}
          close={() => setSelected(null)}
          edit={() => setEditor({ entity: "investments", record: selectedRow })}
          remove={() => remove("investments", selectedRow.id, selectedRow.name)}
          removeWithdrawal={(id) =>
            remove("withdrawals", id, "this withdrawal")
          }
          saved={() => {
            refresh();
            notify("Withdrawal recorded. Monthly commission recalculated.");
          }}
        />
      )}
      {help && (
        <Modal
          title="A clear calculation, every month."
          subtitle="The rules behind your commission ledger."
          close={() => setHelp(false)}
        >
          <div className="help-content">
            <div>
              <span className="help-number">01</span>
              <h3>Trailer commissions</h3>
              <p>
                Monthly trailer = average daily current invested balance ×
                annual rate ÷ 12. DRIP returns post at month-end and increase
                the next month’s balance. Cash dividends are paid without
                reinvestment. Returns use the annual return rate ÷ 12 and the
                same daily proration. No further return or trailer accrues after
                maturity unless renewal is enabled.
              </p>
            </div>
            <div>
              <span className="help-number">02</span>
              <h3>Every date counts</h3>
              <p>
                Investments earn from the start date, including that day.
                Withdrawals take effect the following day, so the withdrawal
                date also earns commission. The daily balances are averaged over
                every calendar day in the month, including zero-balance days.
              </p>
            </div>
            <div>
              <span className="help-number">03</span>
              <h3>Partial withdrawals, recalculated</h3>
              <p>
                Record the amount and effective date. The reduced balance is
                automatically used for the remaining days and future months. A
                full withdrawal ends trailer earnings after that date.
              </p>
            </div>
            <div>
              <span className="help-number">04</span>
              <h3>Lump-sum commissions</h3>
              <p>
                Each term’s starting balance × the one-time rate is payable at
                start or renewal. Trailer investments can also pay separate
                upfront rates. Renewals start the day after maturity and repay
                upfront commission on the renewed balance. Overrides are
                additional to agent earnings.
              </p>
            </div>
            <p className="method-note">
              Amounts are tracked separately in USD and CAD, with no FX
              conversion. Agent and manager payouts are rounded separately to
              two decimals per investment, then summed. Records are saved in
              this server’s SQLite database. This workspace is for a trusted
              single user; it has no sign-in or access controls.
            </p>
            <button className="button primary" onClick={() => setHelp(false)}>
              Got it <Check size={16} />
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{toast}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({
  title,
  value,
  sub,
  icon,
  dark = false,
}: {
  title: string;
  value: string;
  sub: string;
  icon: ReactNode;
  dark?: boolean;
}) {
  return (
    <section className={"stat-card " + (dark ? "dark" : "")}>
      <div className="stat-title">
        <span>{title}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong className="stat-value">{value}</strong>
      <div className="stat-sub">
        {dark && <span className="tiny-plus">↗</span>}
        {sub}
      </div>
    </section>
  );
}
function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="searchbox">
      <Search size={16} />
      <input
        aria-label={placeholder.replace("…", "")}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button aria-label="Clear search" onClick={() => onChange("")}>
          <X size={14} />
        </button>
      )}
    </label>
  );
}
function CommissionChart({ report }: { report: Report }) {
  const money = (v: number, compact = false) =>
    formatMoney(v, report.currency, compact);
  const max = Math.max(...report.trend.map((t) => t.total_commission), 1);
  const ceiling = Math.ceil(max / 4 / 100) * 100 * 4;
  return (
    <div className="bar-chart">
      <div className="y-axis">
        {[1, 0.75, 0.5, 0.25, 0].map((t) => (
          <span key={t}>
            {ceiling * t >= 1000
              ? "$" + ((ceiling * t) / 1000).toFixed(1) + "k"
              : money(ceiling * t, true)}
          </span>
        ))}
      </div>
      <div className="plot">
        <div className="gridlines">
          {[0, 1, 2, 3, 4].map((n) => (
            <i key={n} />
          ))}
        </div>
        <div className="bars">
          {report.trend.map((t, i) => (
            <div
              key={t.month}
              className={"bar-column " + (i === 5 ? "current" : "")}
            >
              <div className="bar-tooltip">
                {dateLabel(t.month, true)}
                <strong>{money(t.total_commission)}</strong>
              </div>
              <div
                className="bar-track"
                aria-label={`${dateLabel(t.month)}: ${money(t.total_commission)}`}
              >
                <div
                  className="bar-manager"
                  style={{
                    height: `${(t.manager_commission / ceiling) * 100}%`,
                  }}
                />
                <div
                  className="bar-agent"
                  style={{ height: `${(t.agent_commission / ceiling) * 100}%` }}
                />
              </div>
              <span>
                {new Date(t.month + "-01T12:00:00Z").toLocaleDateString(
                  "en-US",
                  { month: "short", timeZone: "UTC" },
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function CommissionMix({ report }: { report: Report }) {
  const money = (v: number, compact = false) =>
    formatMoney(v, report.currency, compact);
  const trailer = report.rows
    .filter((r) => r.commission_type === "trailer")
    .reduce((s, r) => s + r.total_commission, 0);
  const lump = report.summary.total_commission - trailer;
  const percent = report.summary.total_commission
    ? (trailer / report.summary.total_commission) * 100
    : 0;
  return (
    <>
      <div className="donut-wrap">
        <svg
          viewBox="0 0 180 180"
          className="donut"
          aria-label={`Trailer ${percent.toFixed(0)} percent, lump-sum ${(100 - percent).toFixed(0)} percent`}
        >
          <circle
            cx="90"
            cy="90"
            r="68"
            fill="none"
            stroke="#f1eee8"
            strokeWidth="18"
          />
          <circle
            cx="90"
            cy="90"
            r="68"
            fill="none"
            stroke="#edb894"
            strokeWidth="18"
            strokeDasharray={`${report.summary.total_commission ? 427.25 : 0} 427.25`}
            transform="rotate(-90 90 90)"
          />
          <circle
            cx="90"
            cy="90"
            r="68"
            fill="none"
            stroke="#d67954"
            strokeWidth="18"
            strokeDasharray={`${(percent / 100) * 427.25} 427.25`}
            transform="rotate(-90 90 90)"
          />
        </svg>
        <div className="donut-center">
          <span>Total earned</span>
          <strong>{money(report.summary.total_commission, true)}</strong>
          <small>{dateLabel(report.month, true)}</small>
        </div>
      </div>
      <div className="mix-legend">
        <div>
          <span>
            <i className="legend-agent" />
            Trailer <small>{percent.toFixed(0)}%</small>
          </span>
          <strong>{money(trailer)}</strong>
        </div>
        <div>
          <span>
            <i className="legend-manager" />
            Lump-sum{" "}
            <small>
              {report.summary.total_commission ? (100 - percent).toFixed(0) : 0}
              %
            </small>
          </span>
          <strong>{money(lump)}</strong>
        </div>
      </div>
    </>
  );
}

function RecordEditor({
  entity,
  record,
  state,
  close,
  saved,
  defaultCurrency,
}: {
  entity: Entity;
  record?: Person | Investment;
  state: State;
  close: () => void;
  saved: (currency?: Currency) => void;
  defaultCurrency: Currency;
}) {
  const investment = record as Investment | undefined;
  const [type, setType] = useState(investment?.commission_type || "trailer");
  const [terms, setTerms] = useState(() =>
    termsDraft(investment || { currency: defaultCurrency }),
  );
  const [startDate, setStartDate] = useState(investment?.start_date || today());
  const [manager, setManager] = useState(investment?.manager_id || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const body =
      entity === "investments"
        ? {
            ...data,
            ...termsPayload(terms),
            principal: Number(data.principal),
            rate: Number(data.rate),
            manager_rate: manager ? Number(data.manager_rate) : 0,
            manager_id: manager,
            commission_type: type,
          }
        : data;
    try {
      await api(
        entity + (record ? "/" + record.id : ""),
        record ? "PUT" : "POST",
        body,
      );
      saved(entity === "investments" ? terms.currency : undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const unavailable =
    entity === "investments" &&
    (!state.investors.length || !state.agents.length);
  return (
    <Modal
      title={`${record ? "Edit" : "New"} ${singular[entity]}`}
      subtitle={
        entity === "investments"
          ? "Connect an investment to the people who make it happen."
          : "A new connection for your investment workspace."
      }
      close={close}
      wide={entity === "investments"}
    >
      <form className="record-form" onSubmit={submit}>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {unavailable && (
          <div className="form-notice">
            First add at least one investor and one agent using the sidebar.
            Then return here to create your investment.
          </div>
        )}
        <label className="field">
          {entity === "investments" ? "Investment name" : "Full name"}
          <input
            name="name"
            placeholder={
              entity === "investments"
                ? "e.g. Evergreen Growth Fund"
                : "e.g. Alex Morgan"
            }
            defaultValue={record?.name}
            maxLength={160}
            required
          />
        </label>
        {entity === "investments" ? (
          <>
            <div className="form-grid">
              <label className="field">
                Investor
                <select
                  name="investor_id"
                  defaultValue={investment?.investor_id || ""}
                  required
                >
                  <option value="" disabled>
                    Select an investor
                  </option>
                  {state.investors.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Investment amount ({terms.currency})
                <input
                  name="principal"
                  type="number"
                  min="0.01"
                  max="1000000000000"
                  step="0.01"
                  placeholder="0.00"
                  defaultValue={investment?.principal}
                  required
                />
              </label>
              <label className="field">
                Start date
                <input
                  name="start_date"
                  type="date"
                  min="1900-01-01"
                  max="9998-12-31"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setTerms((t) => ({ ...t, maturity_date: "" }));
                  }}
                  required
                />
              </label>
              <label className="field">
                Agent
                <select
                  name="agent_id"
                  defaultValue={investment?.agent_id || ""}
                  required
                >
                  <option value="" disabled>
                    Select an agent
                  </option>
                  {state.agents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-section-heading">COMMISSION STRUCTURE</div>
            <div className="commission-options">
              <button
                type="button"
                className={type === "trailer" ? "chosen" : ""}
                onClick={() => setType("trailer")}
              >
                <TrendingUp size={20} />
                <strong>Trailer</strong>
                <small>Recurring monthly earnings</small>
                <span className="radio-dot" />
              </button>
              <button
                type="button"
                className={type === "lump_sum" ? "chosen" : ""}
                onClick={() => setType("lump_sum")}
              >
                <Coins size={20} />
                <strong>Lump-sum</strong>
                <small>A single upfront payment</small>
                <span className="radio-dot" />
              </button>
            </div>
            <div className="form-grid">
              <label className="field">
                Agent {type === "trailer" ? "annual" : "one-time"} rate (%)
                <input
                  name="rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.0001"
                  defaultValue={investment?.rate ?? 1.2}
                  required
                />
                <small>
                  {type === "trailer"
                    ? "Annual rate ÷ 12, prorated by daily balance."
                    : "Applied to the balance at start and each renewal."}
                </small>
              </label>
              <label className="field">
                Overriding manager
                <select
                  name="manager_id"
                  value={manager}
                  onChange={(e) => setManager(e.target.value)}
                >
                  <option value="">No manager</option>
                  {state.managers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              {manager && (
                <label className="field">
                  Manager {type === "trailer" ? "annual" : "one-time"} override
                  (%)
                  <input
                    name="manager_rate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.0001"
                    defaultValue={investment?.manager_rate ?? 0.2}
                    required
                  />
                  <small>
                    Additional commission, paid separately to the manager.
                  </small>
                </label>
              )}
            </div>
          </>
        ) : (
          <div className="form-grid">
            <label className="field">
              Email address
              <input
                name="email"
                type="email"
                placeholder="name@example.com"
                defaultValue={(record as Person)?.email}
              />
            </label>
            <label className="field">
              Phone number
              <input
                name="phone"
                type="tel"
                placeholder="+1 (555) 000-0000"
                defaultValue={(record as Person)?.phone}
              />
            </label>
          </div>
        )}
        <>
          {entity === "investments" && (
            <>
              <InvestmentTermsFields
                value={terms}
                onChange={setTerms}
                startDate={startDate}
                trailer={type === "trailer"}
                hasManager={!!manager}
              />
              {investment?.current_balance !== undefined && (
                <div className="readonly-balance">
                  Current calculated balance:{" "}
                  <strong>
                    {formatMoney(
                      investment.current_balance,
                      investment.currency,
                    )}
                  </strong>{" "}
                  as of {dateLabel(investment.current_balance_date, true)}.
                  Balance includes posted DRIP and withdrawals.
                </div>
              )}
            </>
          )}
        </>
        <label className="field">
          Notes <span className="optional">optional</span>
          <textarea
            name="notes"
            placeholder="Anything worth keeping in mind…"
            rows={2}
            defaultValue={record?.notes}
            maxLength={4000}
          />
        </label>
        <div className="form-footer">
          <button type="button" className="button" onClick={close}>
            Cancel
          </button>
          <button className="button primary" disabled={saving || unavailable}>
            {saving ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Check size={16} />
            )}
            {saving
              ? "Saving…"
              : record
                ? "Save changes"
                : `Create ${singular[entity]}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function InvestmentDetail({
  row,
  state,
  month,
  close,
  edit,
  remove,
  removeWithdrawal,
  saved,
}: {
  row: Row;
  state: State;
  month: string;
  close: () => void;
  edit: () => void;
  remove: () => void;
  removeWithdrawal: (id: string) => void;
  saved: () => void;
}) {
  const [withdrawing, setWithdrawing] = useState(false),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const withdrawals = state.withdrawals.filter(
    (w) => w.investment_id === row.id,
  );
  const money = (value: number, compact = false) =>
    formatMoney(value, row.currency, compact);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api("withdrawals", "POST", {
        ...data,
        investment_id: row.id,
        amount: Number(data.amount),
      });
      setWithdrawing(false);
      saved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      title={row.name}
      subtitle={`${row.investor_name} · ${row.currency} investment`}
      close={close}
      wide
    >
      <div className="detail-content">
        <div className="detail-hero">
          <div>
            <span>Original investment · {row.currency}</span>
            <strong>{money(row.principal)}</strong>
          </div>
          <span
            className={`type-pill ${row.commission_type === "lump_sum" ? "lump" : ""}`}
          >
            <span className="dot" />
            {row.commission_type === "trailer"
              ? "Upfront + trailer"
              : "Lump-sum per term"}
          </span>
        </div>
        <div className="investment-detail-summary">
          <div>
            <span>Current investment balance</span>
            <strong data-testid="current-investment-balance">
              {money(row.current_balance)}
            </strong>
            <small>As of {dateLabel(row.current_balance_date, true)}</small>
          </div>
          <div>
            <span>Return · {row.return_rate}% annual</span>
            <strong>
              {row.distribution_type === "drip" ? "DRIP" : "Cash dividend"}
            </strong>
            <small>
              {row.distribution_type === "drip"
                ? "Monthly compounding"
                : "Monthly cash payout"}
            </small>
          </div>
          <div>
            <span>Month-end balance</span>
            <strong>{money(row.closing_balance)}</strong>
            <small>{dateLabel(month, true)} · includes posted DRIP</small>
          </div>
        </div>
        <div className="detail-grid">
          <div>
            <span>Start date</span>
            <strong>{dateLabel(row.start_date, true)}</strong>
          </div>
          <div>
            <span>Term & maturity · selected month</span>
            <strong>
              {row.term_months ? `${row.term_months} months` : "Open-ended"}
              {row.current_maturity_date
                ? ` · ${dateLabel(row.current_maturity_date, true)}`
                : ""}
            </strong>
          </div>
          <div>
            <span>
              Agent · {row.rate}%{" "}
              {row.commission_type === "trailer"
                ? "annual trailer"
                : "per term"}
            </span>
            <strong>{row.agent_name}</strong>
          </div>
          <div>
            <span>
              Manager · {row.manager_rate}%{" "}
              {row.commission_type === "trailer"
                ? "annual trailer"
                : "per term"}
            </span>
            <strong>{row.manager_name || "No manager assigned"}</strong>
          </div>
          <div>
            <span>Renewal setting</span>
            <strong>
              {row.auto_renew ? "Auto-renew & repay upfront" : "Do not renew"} ·{" "}
              {row.renewal_count} renewals through this month
            </strong>
          </div>
          <div>
            <span>Upfront rates</span>
            <strong>
              Agent{" "}
              {row.commission_type === "trailer" ? row.upfront_rate : row.rate}%
              · Manager{" "}
              {row.commission_type === "trailer"
                ? row.manager_upfront_rate
                : row.manager_rate}
              %
            </strong>
          </div>
        </div>
        <div className="calculation-box">
          <div className="calculation-title">
            <span>
              <Coins size={17} />
              {dateLabel(month)} calculation
            </span>
            <strong>{money(row.total_commission)}</strong>
          </div>
          {row.commission_type === "trailer" ? (
            <p>
              {money(row.average_balance)} average daily balance × {row.rate}% ÷
              12 = <b>{money(row.agent_trailer_commission)}</b> agent trailer.
              <br />
              {row.manager_id
                ? `${money(row.average_balance)} × ${row.manager_rate}% ÷ 12 = ${money(row.manager_trailer_commission)} manager trailer.`
                : "No manager override."}
              <br />
              <span>
                {row.earning_days} earning days out of {row.days_in_month}.
                Withdrawals reduce balances from the following day.
              </span>
            </p>
          ) : (
            <p>
              Upfront commission is paid at investment start and each renewal,
              on that term’s invested balance. No additional trailer applies.
            </p>
          )}
          <div className="commission-breakdown">
            <div>
              <span>Agent upfront / trailer</span>
              <strong>
                {money(row.agent_upfront_commission)} /{" "}
                {money(row.agent_trailer_commission)}
              </strong>
            </div>
            <div>
              <span>Manager upfront / trailer</span>
              <strong>
                {money(row.manager_upfront_commission)} /{" "}
                {money(row.manager_trailer_commission)}
              </strong>
            </div>
            <div>
              <span>Investment return this month</span>
              <strong>{money(row.monthly_return)}</strong>
            </div>
            <div>
              <span>DRIP credited / cash paid</span>
              <strong>
                {money(row.drip_amount)} / {money(row.cash_dividend)}
              </strong>
            </div>
          </div>
          {!!row.commission_events.length && (
            <div className="renewal-events">
              {row.commission_events.map((event) => (
                <div key={event.date}>
                  <span>
                    {event.type === "renewal" ? "Renewal" : "Initial term"} ·{" "}
                    {dateLabel(event.date, true)}
                  </span>
                  <strong>Commission base {money(event.base)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
        {row.notes && <p className="detail-notes">{row.notes}</p>}
        <div className="withdrawal-heading">
          <div>
            <h3>
              Withdrawal history{" "}
              <span className="count-badge">{withdrawals.length}</span>
            </h3>
            <p>Available capital includes previously posted DRIP returns.</p>
          </div>
          <button
            className="button small-button"
            onClick={() => {
              setWithdrawing(!withdrawing);
              setError("");
            }}
          >
            <ArrowDownLeft size={15} />
            {withdrawing ? "Cancel" : "Record withdrawal"}
          </button>
        </div>
        {withdrawing && (
          <form className="withdrawal-form" onSubmit={submit}>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <div className="form-grid">
              <label className="field">
                Withdrawal date
                <input
                  aria-label="Withdrawal date"
                  type="date"
                  name="date"
                  min={row.start_date}
                  max="9998-12-31"
                  defaultValue={
                    today() < row.start_date ? row.start_date : today()
                  }
                  required
                />
              </label>
              <label className="field">
                Amount ({row.currency})
                <input
                  aria-label="Withdrawal amount"
                  type="number"
                  name="amount"
                  step="0.01"
                  min="0.01"
                  max="1000000000000"
                  placeholder="0.00"
                  required
                />
              </label>
            </div>
            <label className="field">
              Notes
              <input
                name="notes"
                placeholder="Optional reason for withdrawal"
              />
            </label>
            <p className="terms-note">
              The amount is checked against available capital on the chosen
              date. Unposted monthly returns cannot be withdrawn. Future dates
              are projections.
            </p>
            <button className="button primary" disabled={saving}>
              {saving ? "Recalculating…" : "Save & recalculate"}
              <Check size={15} />
            </button>
          </form>
        )}
        {withdrawals.length ? (
          <div className="withdrawal-list">
            {withdrawals.map((w) => (
              <div key={w.id}>
                <span className="withdrawal-icon">
                  <ArrowDownLeft size={17} />
                </span>
                <div>
                  <strong>{dateLabel(w.date, true)}</strong>
                  <small>{w.notes || "Investment withdrawal"}</small>
                </div>
                <strong className="tabular">−{money(w.amount)}</strong>
                <button
                  className="icon-button danger"
                  aria-label={`Delete withdrawal on ${w.date}`}
                  onClick={() => removeWithdrawal(w.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="no-withdrawals">No withdrawals recorded.</p>
        )}
        <section className="monthly-distributions">
          <div className="panel-heading">
            <div>
              <h3>Monthly returns & distributions</h3>
              <p>
                Last 12 months through {dateLabel(month)} · {row.currency}.
                Future periods are projections.
              </p>
            </div>
          </div>
          <div className="table-scroll">
            <table aria-label="Monthly returns and distributions">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Return earned</th>
                  <th>DRIP credited</th>
                  <th>Cash dividend</th>
                  <th>Closing balance</th>
                  <th>Commission</th>
                </tr>
              </thead>
              <tbody>
                {row.distribution_history.map((r) => (
                  <tr key={r.month}>
                    <td>{dateLabel(r.month, true)}</td>
                    <td>{money(r.monthly_return)}</td>
                    <td>{money(r.drip_amount)}</td>
                    <td>{money(r.cash_dividend)}</td>
                    <td>
                      <strong>{money(r.closing_balance)}</strong>
                    </td>
                    <td>{money(r.total_commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!row.distribution_history.length && (
            <p className="no-withdrawals">
              The investment has not started in this reporting period.
            </p>
          )}
        </section>
        <div className="detail-actions">
          <button className="button danger-text" onClick={remove}>
            <Trash2 size={15} />
            Delete investment
          </button>
          <button className="button" onClick={edit}>
            <Pencil size={15} />
            Edit investment
          </button>
        </div>
      </div>
    </Modal>
  );
}
