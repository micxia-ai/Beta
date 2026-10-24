import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateInvestment, report, validDate } from '../server/commissions.mjs';
const investment = { id:'investment',name:'Fund',investor_id:'investor',agent_id:'agent',manager_id:'manager',principal:120000,start_date:'2026-01-01',commission_type:'trailer',rate:1.2,manager_rate:.24 };
const withdrawal = (date,amount) => ({ id:date, investment_id:'investment',date,amount });
test('full-month trailer pays annual rates divided by 12 to agent and manager',() => {
  const row=calculateInvestment(investment,[],'2026-01');
  assert.equal(row.agent_commission,120);assert.equal(row.manager_commission,24);assert.equal(row.total_commission,144);assert.equal(row.average_balance,120000);
});
test('start day is included and previous months earn zero',() => {
  const i={...investment,start_date:'2026-01-16'};
  const row=calculateInvestment(i,[],'2026-01');
  assert.equal(row.earning_days,16);assert.equal(row.agent_commission,61.94);
  assert.equal(calculateInvestment(i,[],'2025-12').total_commission,0);
  assert.equal(calculateInvestment(i,[],'2025-12').closing_balance,0);
});
test('partial withdrawal preserves its date and reduces subsequent daily balances',() => {
  const withdrawals=[withdrawal('2026-01-15',60000)];
  const row=calculateInvestment(investment,withdrawals,'2026-01');
  assert.equal(row.average_balance,89032.26);assert.equal(row.agent_commission,89.03);assert.equal(row.manager_commission,17.81);assert.equal(row.closing_balance,60000);
  assert.equal(calculateInvestment(investment,withdrawals,'2026-02').agent_commission,60);
});
test('full withdrawal on first day still earns that day and ends all subsequent commissions',() => {
  const events=[withdrawal('2026-01-01',120000)];
  const row=calculateInvestment(investment,events,'2026-01');
  assert.equal(row.earning_days,1);assert.equal(row.agent_commission,3.87);assert.equal(row.closing_balance,0);
  assert.equal(calculateInvestment(investment,events,'2026-02').total_commission,0);
});
test('multiple and same-day withdrawals use cumulative balances and ignore unrelated records',() => {
  const events=[withdrawal('2026-01-10',30000),withdrawal('2026-01-10',30000),withdrawal('2026-01-20',60000),{...withdrawal('2026-01-01',120000),investment_id:'other'}];
  const row=calculateInvestment(investment,events,'2026-01');
  assert.equal(row.agent_commission,58.06);assert.equal(row.earning_days,20);assert.equal(row.closing_balance,0);
});
test('leap February uses 29 calendar days',() => {
  const row=calculateInvestment({...investment,start_date:'2024-02-15'},[],'2024-02');
  assert.equal(row.days_in_month,29);assert.equal(row.earning_days,15);assert.equal(row.agent_commission,62.07);
});
test('lump-sum pays original principal once in start month and has no withdrawal clawback',() => {
  const i={...investment,commission_type:'lump_sum',start_date:'2026-01-31',rate:2,manager_rate:.5};
  const events=[withdrawal('2026-01-31',120000)];
  assert.equal(calculateInvestment(i,events,'2026-01').total_commission,3000);
  assert.equal(calculateInvestment(i,events,'2026-02').total_commission,0);
});
test('manager is optional; totals sum separately rounded payouts',() => {
  const i={...investment,manager_id:null,principal:3333.33};
  const state={investments:[i],withdrawals:[],investors:[],agents:[],managers:[]};
  const result=report(state,'2026-01');
  assert.equal(result.summary.manager_commission,0);assert.equal(result.summary.total_commission,3.33);
});
test('calendar validation rejects overflow dates and malformed reporting months',() => {
  assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2024-02-29'),true);
  assert.throws(() => calculateInvestment(investment,[],'2026-13'));
});
