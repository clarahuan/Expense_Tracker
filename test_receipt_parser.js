const test = require('node:test');
const assert = require('node:assert/strict');
const {parse} = require('./web/receipt-parser.js');
const options = {referenceDate:'2026-10-23'};

test('多笔微信列表匹配商户、金额及各自日期，按时间升序', () => {
  const rows = parse(`微信账单\n2026年10月\n支出合计 ¥102.00\n咖啡店 -28.00\n10月23日 12:30\n地铁出行 -4.00\n10月22日 08:10\n图书店 -70.00\n10月21日 16:15`, options);
  assert.deepEqual(rows.map(r=>[r.amount,r.merchant,r.date,r.category]), [
    ['70.00','图书店','2026-10-21T16:15','学习'],
    ['4.00','地铁出行','2026-10-22T08:10','交通'],
    ['28.00','咖啡店','2026-10-23T12:30','餐饮']
  ]);
});
test('支付宝商户、时间、金额分行排列，月汇总不作为账单', () => {
  const rows = parse(`2026年10月\n本月支出 1234.00\n超市\n2026-10-23 10:20\n-38.50\n公交\n2026-10-22 08:30\n-2.00`, options);
  assert.equal(rows.length,2);
  assert.deepEqual(rows.map(r=>[r.merchant,r.date]),[['公交','2026-10-22T08:30'],['超市','2026-10-23T10:20']]);
});
test('完整日期在金额前的同行记录不会将日期识别为金额',()=>{
  const rows=parse('咖啡 2026-10-23 12:30 -35.00',options);
  assert.equal(rows.length,1);assert.equal(rows[0].amount,'35.00');assert.equal(rows[0].date,'2026-10-23T12:30');
});
test('单笔详情中的商户和时间可出现在金额后面',()=>{
  const [row]=parse('付款成功\n￥38.50\n商户全称：咖啡店\n付款时间：2026-10-22 12:30',options);
  assert.equal(row.merchant,'咖啡店');assert.equal(row.date,'2026-10-22T12:30');assert.equal(row.category,'餐饮');
});
test('收入、退款和转账默认不勾选，普通支出不受下一笔影响',()=>{
  const rows=parse('2026-10-23\n咖啡店 -10.00\n12:00\n朋友转账 +20.00\n13:00\n超市退款 +8.00\n14:00',options);
  assert.deepEqual(rows.map(r=>r.included),[true,false,false]);
});
test('缺失日期不伪造当前日期；时刻缺失明确提示',()=>{
  const [missing]=parse('超市 -8.00',options);
  assert.equal(missing.date,'');assert.ok(missing.warnings.some(w=>w.includes('补全')));
  const [dated]=parse('2026年10月22日\n超市 -8.00',options);
  assert.equal(dated.date,'2026-10-22T00:00');assert.ok(dated.warnings.some(w=>w.includes('00:00')));
});
test('跨年、相对日期和无年份日期处理',()=>{
  const rows=parse('超市 -8.00\n2026-01-01 09:00\n咖啡 -9.00\n2025-12-31 08:00',options);
  assert.equal(rows[0].date,'2025-12-31T08:00');
  const [relative]=parse('昨天\n咖啡 -9.00\n08:00',options);
  assert.equal(relative.date,'2026-10-22T08:00');assert.ok(relative.warnings.some(w=>w.includes('推断')));
});
test('千位分隔符、全角符号和拆开的金额符号',()=>{
  const rows=parse('2026年10月23日\n商场 ￥1,250.00\n12:00\n咖啡\n¥\n20.50\n13:00',options);
  assert.deepEqual(rows.map(r=>r.amount),['1250.00','20.50']);
});
test('没有消费金额时不生成伪造记录',()=>{
  assert.deepEqual(parse('账单\n2026年10月\n订单号 202610231234\n支出合计 ¥100.00',options),[]);
});
test('日期分组标题不被上一笔消费抢走，小数金额不被识别成日期',()=>{
  const rows=parse('2026年10月23日\n咖啡 -28.00\n2026年10月22日\n地铁 -4.00',options);
  assert.deepEqual(rows.map(r=>r.date),['2026-10-22T00:00','2026-10-23T00:00']);
  assert.equal(parse('咖啡 -10.20',options)[0].date,'');
});
