import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateScenario } from '../server/scenario.mjs';
const input = { principal:120000, start_date:'2026-01-01', month:'2026-01', commission_type:'trailer',rate:1.2,manager_rate:.24,include_manager:true,withdrawals:[] };
test('standalone scenario calculates payouts and a complete 12-month projection',() => {
  const result=calculateScenario(input);
  assert.equal(result.result.total_commission,144);assert.equal(result.projected_total,1728);assert.equal(result.schedule.length,12);assert.equal(result.schedule[11].month,'2026-12');
});
test('scenario partial withdrawal matches the investment ledger',() => {
  const result=calculateScenario({...input,withdrawals:[{date:'2026-01-15',amount:60000}]});
  assert.equal(result.result.average_balance,89032.26);assert.equal(result.result.total_commission,106.84);assert.equal(result.schedule[1].total_commission,72);assert.equal(result.remaining_after_withdrawals,60000);
});
test('scenario lump-sum is paid once; disabling manager removes its payout',() => {
  const result=calculateScenario({...input,commission_type:'lump_sum',rate:2,include_manager:false});
  assert.equal(result.result.total_commission,2400);assert.equal(result.result.manager_commission,0);assert.equal(result.schedule[1].total_commission,0);assert.equal(result.projected_total,2400);
});
test('scenario validation rejects invalid dates, rates, cents, and over-withdrawals',() => {
  for (const patch of [{principal:-1},{principal:1.001},{rate:101},{manager_rate:-1},{start_date:'2026-02-30'},{month:'9998-12'},{withdrawals:[{date:'2025-12-31',amount:1}]},{withdrawals:[{date:'2026-01-15',amount:120001}]},{withdrawals:[{date:'2026-01-15',amount:.001}]},{withdrawals:[null]}]) {
    assert.throws(() => calculateScenario({...input,...patch}),e => e.status===400);
  }
});
