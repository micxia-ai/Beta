import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowDownToLine, ArrowRight, Calculator as CalculatorIcon, Check, ChevronDown, Coins, FlaskConical, LoaderCircle, Plus, RotateCcw, ShieldCheck, Trash2, TrendingUp, Wallet } from 'lucide-react';
import type { Row, State } from './types';
import './calculator.css';

type DraftWithdrawal = { key: number; date: string; amount: string };
type Draft = { principal: string; start_date: string; month: string; commission_type: 'trailer' | 'lump_sum'; rate: string; manager_rate: string; include_manager: boolean; withdrawals: DraftWithdrawal[] };
type Result = { month: string; result: Row; schedule: (Row & { month: string })[]; projected_total: number; remaining_after_withdrawals: number };
const money = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
const monthLabel = (month: string) => new Date(month + '-01T12:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const defaultDraft = (month: string): Draft => ({ principal: '120000', start_date: month + '-01', month, commission_type: 'trailer', rate: '1.2', manager_rate: '0.24', include_manager: true, withdrawals: [] });
const payload = (draft: Draft) => ({ ...draft, principal: Number(draft.principal), rate: Number(draft.rate), manager_rate: Number(draft.manager_rate), withdrawals: draft.withdrawals.map(w => ({ date: w.date, amount: Number(w.amount) })) });

export default function Calculator({ state, defaultMonth }: { state: State; defaultMonth: string }) {
  const [draft, setDraft] = useState<Draft>(() => defaultDraft(defaultMonth));
  const [result, setResult] = useState<Result | null>(null);
  const [snapshot, setSnapshot] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState('');
  const requestId = useRef(0);
  const withdrawalKey = useRef(0);
  const stale = result && snapshot !== JSON.stringify(payload(draft));
  function change<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft(previous => ({ ...previous, [key]: value })); }
  async function calculate(value: Draft) {
    const id = ++requestId.current;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/calculate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload(value)) });
      const body = await response.json();
      if (id !== requestId.current) return;
      if (!response.ok) throw new Error(body.error || 'Unable to calculate. Please try again.');
      setResult(body); setSnapshot(JSON.stringify(payload(value)));
    } catch (e) { if (id === requestId.current) setError((e as Error).message); }
    finally { if (id === requestId.current) setBusy(false); }
  }
  useEffect(() => { void calculate(defaultDraft(defaultMonth)); return () => { requestId.current++; }; }, []);
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void calculate(draft); }
  function reset() { const value = defaultDraft(defaultMonth); setDraft(value); setSource(''); void calculate(value); }
  function loadInvestment(id: string) {
    setSource(id);
    if (!id) { reset(); return; }
    const investment = state.investments.find(i => i.id === id);
    if (!investment) return;
    const value: Draft = { principal: String(investment.principal), start_date: investment.start_date, month: defaultMonth, commission_type: investment.commission_type, rate: String(investment.rate), manager_rate: String(investment.manager_rate), include_manager: !!investment.manager_id, withdrawals: state.withdrawals.filter(w => w.investment_id === id).map(w => ({ key: withdrawalKey.current++, date: w.date, amount: String(w.amount) })) };
    setDraft(value); void calculate(value);
  }
  function exportScenario() {
    if (!result || stale) return;
    const rows = [['Month', 'Average daily balance (USD)', 'Closing balance (USD)', 'Agent commission (USD)', 'Manager commission (USD)', 'Total commission (USD)'], ...result.schedule.map(r => [r.month,r.average_balance.toFixed(2),r.closing_balance.toFixed(2),r.agent_commission.toFixed(2),r.manager_commission.toFixed(2),r.total_commission.toFixed(2)])];
    const blob = new Blob([rows.map(row => row.join(',')).join('\r\n')], { type:'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `trailbook-scenario-${result.month}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const trailer = draft.commission_type === 'trailer';
  const calculatedTrailer = result?.result.commission_type === 'trailer';

  return <div className="calculator-workspace">
    <div className="scenario-banner"><span className="scenario-symbol"><FlaskConical size={20} /></span><div><strong>A little room to explore.</strong><p>Try a commission scenario here. Your saved investments stay as they are.</p></div><span className="scenario-badge"><span className="dot" />Scenario only</span></div>
    <div className="calculator-grid">
      <form className="panel calculator-inputs" onSubmit={submit}>
        <div className="calculator-panel-title"><span><CalculatorIcon size={18} />Build your calculation</span><button className="text-button" type="button" onClick={reset}><RotateCcw size={13} />Reset</button></div>
        <div className="calculator-form-body">
          <label className="field source-field">Start from an existing investment <span className="optional">optional</span><select aria-label="Load existing investment" value={source} onChange={e => loadInvestment(e.target.value)}><option value="">New scenario</option>{state.investments.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
          <div className="calculator-section"><div className="calculator-step"><span>01</span><div><h2>Investment details</h2><p>The amount and the month you want to calculate.</p></div></div>
            <label className="field">Investment amount<div className="currency-input"><span>USD</span><input aria-label="Scenario investment amount" type="number" min="0.01" max="1000000000000" step="0.01" value={draft.principal} onChange={e => change('principal',e.target.value)} required /></div></label>
            <div className="form-grid"><label className="field">Investment start date<input aria-label="Scenario start date" type="date" min="1900-01-01" max="9998-12-31" value={draft.start_date} onChange={e => change('start_date',e.target.value)} required /></label><label className="field">Reporting month<input aria-label="Scenario reporting month" type="month" min="1901-01" max="9997-01" value={draft.month} onChange={e => change('month',e.target.value)} required /></label></div>
          </div>
          <div className="calculator-section"><div className="calculator-step"><span>02</span><div><h2>Commission structure</h2><p>Your rates, defined for this investment.</p></div></div>
            <div className="commission-options"><button type="button" aria-pressed={trailer} className={trailer ? 'chosen' : ''} onClick={() => change('commission_type','trailer')}><TrendingUp size={20} /><strong>Trailer</strong><small>Recurring monthly payout</small><span className="radio-dot" /></button><button type="button" aria-pressed={!trailer} className={!trailer ? 'chosen' : ''} onClick={() => change('commission_type','lump_sum')}><Coins size={20} /><strong>Lump-sum</strong><small>One upfront payout</small><span className="radio-dot" /></button></div>
            <label className="field">Agent {trailer ? 'annual' : 'one-time'} commission rate<div className="rate-input"><input aria-label="Scenario agent rate" type="number" min="0" max="100" step="0.0001" value={draft.rate} onChange={e => change('rate',e.target.value)} required /><span>% {trailer ? 'per year' : 'one time'}</span></div></label>
            <div className="manager-toggle"><span><ShieldCheck size={17} /><label htmlFor="include-manager">Include a manager override</label></span><input id="include-manager" type="checkbox" checked={draft.include_manager} onChange={e => change('include_manager',e.target.checked)} /></div>
            {draft.include_manager && <label className="field manager-rate-field">Manager {trailer ? 'annual' : 'one-time'} override rate<div className="rate-input"><input aria-label="Scenario manager rate" type="number" min="0" max="100" step="0.0001" value={draft.manager_rate} onChange={e => change('manager_rate',e.target.value)} required /><span>% {trailer ? 'per year' : 'one time'}</span></div><small>Paid in addition to the agent’s commission.</small></label>}
          </div>
          <div className="calculator-section withdrawal-section"><div className="calculator-step"><span>03</span><div><h2>Withdrawals <small>optional</small></h2><p>Add a date and amount to see the monthly adjustment.</p></div></div>
            {!draft.withdrawals.length && <div className="withdrawal-placeholder">No withdrawals. Calculating on the full invested balance.</div>}
            {draft.withdrawals.map((w,index) => <div className="scenario-withdrawal" key={w.key}><label className="field">Withdrawal date<input aria-label={`Scenario withdrawal date ${index+1}`} type="date" min={draft.start_date} max="9998-12-31" value={w.date} onChange={e => change('withdrawals',draft.withdrawals.map(item => item.key === w.key ? {...item,date:e.target.value} : item))} required /></label><label className="field">Amount (USD)<input aria-label={`Scenario withdrawal amount ${index+1}`} type="number" min="0.01" step="0.01" max={draft.principal} value={w.amount} onChange={e => change('withdrawals',draft.withdrawals.map(item => item.key === w.key ? {...item,amount:e.target.value} : item))} required /></label><button className="icon-button danger" type="button" aria-label={`Remove scenario withdrawal ${index+1}`} onClick={() => change('withdrawals',draft.withdrawals.filter(item => item.key !== w.key))}><Trash2 size={16} /></button></div>)}
            <button type="button" className="button add-scenario-withdrawal" disabled={draft.withdrawals.length >= 100} onClick={() => change('withdrawals',[...draft.withdrawals,{key:withdrawalKey.current++, date: draft.start_date > draft.month+'-15' ? draft.start_date : draft.month+'-15',amount:''}])}><Plus size={15} />Add a withdrawal</button>
          </div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="button primary calculate-button" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin" /> : <CalculatorIcon size={17} />}{busy ? 'Calculating…' : 'Calculate commission'}<ArrowRight size={16} /></button>
          <div className="calculator-safe-note"><Check size={12} />Explore freely. This calculation won’t save or change records.</div>
        </div>
      </form>
      <aside className="calculator-results" aria-label="Calculation results" aria-busy={busy}>
        <section className={'payout-card ' + (stale ? 'stale' : '')} aria-live="polite"><div className="payout-eyebrow"><span>YOUR MONTHLY COMMISSION</span><span className="payout-icon"><Coins size={19} /></span></div><span className="payout-month">{result ? monthLabel(result.month) : 'Calculating your scenario'}</span><strong className="payout-total" data-testid="scenario-total">{result ? money(result.result.total_commission) : '—'}</strong><span className="payout-caption">Total agent earnings + manager override</span>
          {stale && <div className="stale-note" role="status">Inputs changed. Calculate to update these results.</div>}
          <div className="payout-split"><div><span><Wallet size={14} />Agent commission</span><strong data-testid="scenario-agent">{result ? money(result.result.agent_commission) : '—'}</strong></div><div><span><ShieldCheck size={14} />Manager override</span><strong data-testid="scenario-manager">{result ? money(result.result.manager_commission) : '—'}</strong></div></div>
        </section>
        <section className="panel calculation-explained"><div className="panel-heading"><h2>Behind the numbers</h2><span className="subtle-tag">{result ? (calculatedTrailer ? 'Trailer' : 'Lump-sum') : 'Preview'}</span></div>{result && <><dl><div><dt>Average daily balance</dt><dd data-testid="scenario-average">{money(result.result.average_balance)}</dd></div><div><dt>Earning days in month</dt><dd>{result.result.earning_days} / {result.result.days_in_month}</dd></div><div><dt>Month-end balance</dt><dd>{money(result.result.closing_balance)}</dd></div><div><dt>After all withdrawals</dt><dd>{money(result.remaining_after_withdrawals)}</dd></div></dl><div className="scenario-formula"><span>{!calculatedTrailer && result.month !== result.result.start_date.slice(0,7) ? 'LUMP-SUM PAYOUT TIMING' : 'AGENT COMMISSION FORMULA'}</span><p>{calculatedTrailer ? <>{money(result.result.average_balance)} <b>×</b> {result.result.rate}% <b>÷</b> 12</> : result.month === result.result.start_date.slice(0,7) ? <>{money(result.result.principal)} <b>×</b> {result.result.rate}%</> : <>Outside the investment start month</>}</p><strong>= {money(result.result.agent_commission)}</strong>{!calculatedTrailer && result.month !== result.result.start_date.slice(0,7) && <small>Lump-sum payout applies only in the investment start month.</small>}</div></>}</section>
        <div className="calculator-rules"><span className="rules-leaf"><TrendingUp size={18} /></span><div><strong>Every date, accounted for.</strong><p>Start and withdrawal dates both earn commission. Withdrawals reduce the balance from the next day. Trailer rates are annual, divided by 12.</p></div></div>
      </aside>
    </div>
    {result && <section className={'panel scenario-schedule ' + (stale ? 'stale' : '')}><div className="panel-heading"><div><h2>Your monthly breakdown <span className="count-badge">12 months</span></h2><p>Starting {monthLabel(result.month)} · Calculated from this scenario, with no investment growth assumed.{stale && ' Recalculate to reflect your latest changes.'}</p></div><button className="button small-button" disabled={!!stale || busy} onClick={exportScenario}><ArrowDownToLine size={15} />Export scenario</button></div><div className="table-scroll"><table><thead><tr><th>Month</th><th>Average daily balance</th><th>Closing balance</th><th>Agent commission</th><th>Manager override</th><th>Total commission</th></tr></thead><tbody>{result.schedule.map(r => <tr key={r.month} className={r.month === result.month ? 'selected-month' : ''}><td><strong>{monthLabel(r.month)}</strong>{r.month === result.month && <small>Selected month</small>}</td><td>{money(r.average_balance)}</td><td>{money(r.closing_balance)}</td><td>{money(r.agent_commission)}</td><td>{money(r.manager_commission)}</td><td><strong>{money(r.total_commission)}</strong></td></tr>)}</tbody><tfoot><tr><td colSpan={5}>Total over these 12 months</td><td>{money(result.projected_total)}</td></tr></tfoot></table></div></section>}
  </div>;
}
