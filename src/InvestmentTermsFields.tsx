import { RefreshCw, Sprout, Wallet } from "lucide-react";
import { computedMaturity, type TermsDraft } from "./finance";
type Props = {
  value: TermsDraft;
  onChange: (value: TermsDraft) => void;
  startDate: string;
  trailer: boolean;
  hasManager: boolean;
  showCurrency?: boolean;
};
export default function InvestmentTermsFields({
  value,
  onChange,
  startDate,
  trailer,
  hasManager,
  showCurrency = true,
}: Props) {
  const change = <K extends keyof TermsDraft>(key: K, next: TermsDraft[K]) =>
    onChange({ ...value, [key]: next });
  const maturity =
    value.maturity_date || computedMaturity(startDate, value.term_months);
  return (
    <div className="investment-terms-fields">
      <div className="form-section-heading">CURRENCY & INVESTMENT RETURNS</div>
      <div className="form-grid">
        {showCurrency && (
          <label className="field">
            Investment currency
            <select
              aria-label="Investment currency"
              value={value.currency}
              onChange={(e) =>
                change("currency", e.target.value as TermsDraft["currency"])
              }
            >
              <option value="USD">USD · US Dollar</option>
              <option value="CAD">CAD · Canadian Dollar</option>
            </select>
          </label>
        )}
        <label className="field">
          Annual investment return (%)
          <input
            aria-label="Annual investment return (%)"
            type="number"
            min="0"
            max="100"
            step="0.0001"
            value={value.return_rate}
            onChange={(e) => change("return_rate", e.target.value)}
            required
          />
          <small>Annual rate ÷ 12, prorated by daily invested balance.</small>
        </label>
      </div>
      <div
        className="return-options"
        role="group"
        aria-label="Return distribution"
      >
        <button
          type="button"
          className={value.distribution_type === "drip" ? "chosen" : ""}
          aria-pressed={value.distribution_type === "drip"}
          onClick={() => change("distribution_type", "drip")}
        >
          <Sprout size={18} />
          <span>
            <strong>DRIP</strong>
            <small>Reinvest & compound monthly</small>
          </span>
        </button>
        <button
          type="button"
          className={value.distribution_type === "cash" ? "chosen" : ""}
          aria-pressed={value.distribution_type === "cash"}
          onClick={() => change("distribution_type", "cash")}
        >
          <Wallet size={18} />
          <span>
            <strong>Cash Dividend Payout</strong>
            <small>Pay returns without reinvesting</small>
          </span>
        </button>
      </div>
      <div className="form-section-heading">TERM & RENEWAL</div>
      <div className="form-grid">
        <label className="field">
          Investment term (months)
          <input
            aria-label="Investment term (months)"
            type="number"
            min="1"
            max="1200"
            step="1"
            value={value.term_months}
            placeholder="Open-ended"
            onChange={(e) =>
              onChange({
                ...value,
                term_months: e.target.value,
                maturity_date: "",
                auto_renew: e.target.value ? value.auto_renew : false,
              })
            }
          />
          <small>Leave blank for an open-ended investment.</small>
        </label>
        <label className="field">
          Maturity date
          <input
            aria-label="Maturity date"
            type="date"
            min={startDate}
            max="9998-12-31"
            value={maturity}
            onChange={(e) => change("maturity_date", e.target.value)}
          />
          <small>
            Inclusive last day. Calculated from the term; adjustable.
          </small>
        </label>
      </div>
      <label className="renewal-toggle">
        <input
          aria-label="Renew automatically at maturity"
          type="checkbox"
          checked={value.auto_renew}
          disabled={!value.term_months}
          onChange={(e) => change("auto_renew", e.target.checked)}
        />
        <RefreshCw size={15} />
        <span>
          <strong>Renew automatically at maturity</strong>
          <small>
            Start a new term the next day and repay upfront commission on the
            renewed balance.
          </small>
        </span>
      </label>
      {trailer && (
        <>
          <div className="form-section-heading">UPFRONT PAYMENT + TRAILER</div>
          <div className="form-grid">
            <label className="field">
              Agent upfront rate (%)
              <input
                aria-label="Agent upfront rate (%)"
                type="number"
                min="0"
                max="100"
                step="0.0001"
                value={value.upfront_rate}
                onChange={(e) => change("upfront_rate", e.target.value)}
                required
              />
              <small>
                Paid at investment start and at each renewal, in addition to
                trailer.
              </small>
            </label>
            {hasManager && (
              <label className="field">
                Manager upfront override (%)
                <input
                  aria-label="Manager upfront override (%)"
                  type="number"
                  min="0"
                  max="100"
                  step="0.0001"
                  value={value.manager_upfront_rate}
                  onChange={(e) =>
                    change("manager_upfront_rate", e.target.value)
                  }
                  required
                />
              </label>
            )}
          </div>
        </>
      )}
      <p className="terms-note">
        DRIP posts at month-end and increases the balance used for future
        trailer payments. Cash payouts do not increase capital. USD and CAD are
        tracked separately; no currency conversion is applied.
      </p>
    </div>
  );
}
