import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/index.mjs';
process.env.SEED_DEMO='false';
test('database CRUD, validation, recalculation, CSV, and restart persistence',async () => {
  const dir=await mkdtemp(join(tmpdir(),'trailbook-test-')); const databasePath=join(dir,'test.sqlite');
  let server; let base;
  async function start() { server=createApp({databasePath});await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port; }
  const stop=() => new Promise(resolve => server.close(resolve));
  async function request(path,method='GET',body) { const res=await fetch(base+'/api/'+path,{method,...(body ? {headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : {})});return {status:res.status, data:await res.json()}; }
  await start();
  try {
    assert.equal((await request('state')).data.investments.length,0);
    const investor=(await request('investors','POST',{name:'Test Investor',email:'investor@example.com'})).data;
    const agent=(await request('agents','POST',{name:'Test Agent'})).data;
    const manager=(await request('managers','POST',{name:'Test Manager'})).data;
    const body={name:'=Test Fund',investor_id:investor.id,agent_id:agent.id,manager_id:manager.id,principal:120000,start_date:'2026-01-01',commission_type:'trailer',rate:1.2,manager_rate:.24};
    const created=await request('investments','POST',body);assert.equal(created.status,201);
    assert.equal((await request('commissions?month=2026-01')).data.summary.total_commission,144);
    const w=await request('withdrawals','POST',{investment_id:created.data.id,date:'2026-01-15',amount:60000});assert.equal(w.status,201);
    assert.equal((await request('commissions?month=2026-01')).data.summary.total_commission,106.84);
    assert.equal((await request('withdrawals','POST',{investment_id:created.data.id,date:'2026-01-20',amount:60001})).status,400);
    assert.equal((await request('withdrawals','POST',{investment_id:created.data.id,date:'2025-12-31',amount:1})).status,400);
    assert.equal((await request('investments/'+created.data.id,'PUT',{...body,principal:50000})).status,400);
    assert.equal((await request('investments/'+created.data.id,'PUT',{...body,start_date:'2026-01-20'})).status,400);
    assert.equal((await request('investors/'+investor.id,'DELETE')).status,409);
    assert.equal((await request('investments','POST',{...body,rate:101})).status,400);
    assert.equal((await request('investments','POST',{...body,principal:1.001})).status,400);
    assert.equal((await request('commissions?month=invalid')).status,400);
    const csv=await fetch(base+'/api/export?month=2026-01');const exported=await csv.text();
    assert.equal(csv.headers.get('content-type'),'text/csv; charset=utf-8');assert.ok(exported.includes('"\'=Test Fund"'));assert.ok(exported.includes('"106.84"'));
    const evil=await fetch(base+'/api/investors',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify({name:'intruder'})});assert.equal(evil.status,403);
    await stop();await start();assert.equal((await request('state')).data.withdrawals.length,1);
    assert.equal((await request('commissions?month=2026-02')).data.summary.total_commission,72);
    await request('withdrawals/'+w.data.id,'DELETE');assert.equal((await request('commissions?month=2026-01')).data.summary.total_commission,144);
    await request('investments/'+created.data.id,'DELETE');assert.equal((await request('investors/'+investor.id,'DELETE')).status,200);
  } finally {await stop();await rm(dir,{recursive:true,force:true});}
});
