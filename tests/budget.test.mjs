import test from 'node:test';
import assert from 'node:assert/strict';
import '../ao-command-web/budget-core.js';
const B = globalThis.AOCommandBudget;
test('Budget amounts preserve zero, cents, credits, and accounting notation', () => {
  assert.equal(B.cents('0.00'), 0); assert.equal(B.cents('$1,350.04'), 135004);
  assert.equal(B.cents('($80.00)'), -8000); assert.equal(B.cents('-0.29'), -29);
  for (const value of ['', null, 'abc', '1.001', 'Infinity']) assert.throws(() => B.cents(value));
});
test('Fiscal months follow July 2026 through June 2027', () => {
  const months = B.months('2026-07-01'); assert.equal(months.length, 12);
  assert.equal(months[0].key, '2026-07'); assert.equal(months[11].key, '2027-06');
  assert.throws(() => B.months('2026-13-01'));
});
const line = { title:'Supplies',kind:'expense',source_key:'source:1',monthly_plan_cents:Array(12).fill(10000),actual_cents:[12000,0,...Array(10).fill(0)] };
test('Year-to-date variance does not compare partial-year spend to full-year plan', () => {
  const summary = B.summarize([line], 0); assert.equal(summary.expensePlan, 120000);
  assert.equal(summary.expenseYtdPlan, 10000); assert.equal(summary.expenseVariance, -2000);
  assert.equal(summary.remaining, 108000); assert.equal(summary.netActual, -12000);
});
test('Income favorable direction and refunds are calculated correctly', () => {
  const s = B.summarize([{...line,kind:'income',actual_cents:[12000,...Array(11).fill(0)]},{...line,actual_cents:[-500,...Array(11).fill(0)]}],0);
  assert.equal(s.incomeVariance,2000); assert.equal(s.expenseActual,-500); assert.equal(s.netActual,12500);
});
test('Archived line history still contributes to budget totals', () => assert.equal(B.summarize([{...line,archived:true}],0).expenseActual,12000));
test('Transfer validates twelve integer-cent months and unique source keys', () => {
  const doc = {format:'ao-command-budget-v1',budgets:[{name:'Operating',starts_on:'2026-07-01',lines:[line]}]};
  assert.equal(B.validateImport(doc),doc);
  assert.throws(()=>B.validateImport({...doc,budgets:[{...doc.budgets[0],lines:[line,line]}]}));
  assert.throws(()=>B.validateImport({...doc,budgets:[{...doc.budgets[0],lines:[{...line,monthly_plan_cents:[1]}]}]}));
  assert.throws(()=>B.validateImport({...doc,budgets:[{...doc.budgets[0],lines:[{...line,monthly_plan_cents:Array(12).fill(1.5)}]}]}));
});
test('Summary CSV quotes fields and protects spreadsheet formula injection',()=>{
  const csv=B.csv([['=HYPERLINK("url")','A,B',0,'-80.00']]);
  assert.ok(csv.includes("'=HYPERLINK")); assert.ok(csv.includes('"A,B"')); assert.ok(csv.endsWith('"0","-80.00"'));
});
