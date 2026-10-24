import type { Currency, InvestmentTerms } from "./types";
export const formatMoney = (
  value: number,
  currency: Currency = "USD",
  compact = false,
) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: compact ? 0 : 2,
    minimumFractionDigits: compact ? 0 : 2,
  }).format(value);
export type TermsDraft = {
  currency: Currency;
  return_rate: string;
  distribution_type: "cash" | "drip";
  term_months: string;
  maturity_date: string;
  auto_renew: boolean;
  upfront_rate: string;
  manager_upfront_rate: string;
};
export const termsDraft = (i?: Partial<InvestmentTerms>): TermsDraft => ({
  currency: i?.currency ?? "USD",
  return_rate: String(i?.return_rate ?? 0),
  distribution_type: i?.distribution_type ?? "cash",
  term_months: String(i?.term_months || ""),
  maturity_date: i?.maturity_date ?? "",
  auto_renew: !!i?.auto_renew,
  upfront_rate: String(i?.upfront_rate ?? 0),
  manager_upfront_rate: String(i?.manager_upfront_rate ?? 0),
});
export const termsPayload = (v: TermsDraft): InvestmentTerms => ({
  ...v,
  return_rate: Number(v.return_rate),
  term_months: Number(v.term_months),
  maturity_date: v.maturity_date || null,
  upfront_rate: Number(v.upfront_rate),
  manager_upfront_rate: Number(v.manager_upfront_rate),
});
export function computedMaturity(start: string, months: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !months || Number(months) < 1)
    return "";
  const date = new Date(start + "T12:00:00Z");
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + Number(months));
  const end = new Date(date);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(0);
  date.setUTCDate(Math.min(day, end.getUTCDate()));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
