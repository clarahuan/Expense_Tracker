const test=require('node:test'),assert=require('node:assert/strict');
global.Q=require('../web/js/core.js');
const I=require('../web/js/imports.js');
const entry=(more={})=>({type:'expense',cents:1500,date:'2026-11-25T12:00',category:'饮食',merchant:'午饭',note:'',method:'微信',...more});
test('整数分、非法日期与金额边界',()=>{
 assert.equal(Q.cents('0.29'),29);assert.equal(Q.cents('1,000.01'),100001);assert.equal(Q.cents('1.234'),null);assert.equal(Q.cents('-1'),null);assert.equal(Q.validDate('2026-02-30T12:00'),false);assert.throws(()=>Q.validateEntry(entry({cents:1.5})));
});
test('收支统计不混算',()=>{
 const s=Q.stats([entry(),entry({type:'income',cents:21000}),entry({date:'2026-10-25T12:00'})],'2026-11-01','2026-11-30');assert.equal(s.incoming,21000);assert.equal(s.outgoing,1500);assert.equal(s.balance,19500);assert.equal(s.expenseGroups['饮食'],1500);
});
test('历史每日总额格式精确拆分，不重复计入总额',()=>{
 const {rows,failures}=I.parseText('11.25，45（地铁4，日用品11）',{referenceDate:'2026-11-25'});
 assert.equal(failures.length,0);assert.equal(rows.reduce((s,r)=>s+r.cents,0),4500);assert.deepEqual(rows.map(r=>[r.category,r.cents]),[['交通',400],['日用品',1100],['饮食',3000]]);
 assert.equal(I.parseText('11.25，10（地铁12）',{referenceDate:'2026-11-25'}).rows.length,0);
});
// Synthetic values only: never publish a user's real transactions as fixtures.
test('括号只有单个名称时，整天总额归入该笔，不产生饮食余额',()=>{
 for(const text of ['4.8，88.8（GPT Plus）','4.8, 88.80 (GPT Plus)','4.8，88.8（地铁）']){
  const result=I.parseText(text,{referenceDate:'2026-04-01'});
  assert.equal(result.failures.length,0);assert.equal(result.rows.length,1);assert.equal(result.rows[0].cents,8880);assert.equal(result.rows[0].date,'2026-04-08T12:00');assert.equal(result.rows[0].type,'expense');assert.ok(!result.rows[0].merchant.includes('当日余额'));
 }
 const custom=I.parseText('4.8，88.8（GPT Plus）',{referenceDate:'2026-04-01',rules:[{keyword:'GPT',type:'expense',category:'学习教育'}]});assert.equal(custom.rows[0].category,'学习教育');assert.equal(custom.rows[0].merchant,'GPT Plus');
});
test('缺少多笔明细金额时不擅自分摊；零支出日期不生成账单',()=>{
 for(const text of ['4.8，88.8（咖啡，奶茶）','4.8，88.8（地铁4，奶茶）']){const r=I.parseText(text,{referenceDate:'2026-04-01'});assert.equal(r.rows.length,0);assert.equal(r.failures.length,1);}
 const zero=I.parseText('4.7，0\n4.8，88.8（GPT Plus）',{referenceDate:'2026-04-01'});assert.equal(zero.failures.length,0);assert.equal(zero.rows.length,1);assert.equal(zero.rows[0].cents,8880);
});
test('自然文本区分收入、支出，无法解析的内容报告失败',()=>{
 const {rows,failures}=I.parseText('午饭15元，地铁4元，奶茶8元，家教收入210元。\n不确定多少钱',{referenceDate:'2026-11-25'});assert.equal(rows.length,4);assert.equal(rows.filter(r=>r.type==='income')[0].cents,21000);assert.equal(failures.length,1);
});
test('自定义规则优先、CSV 带引号换行、CSV 公式防护',()=>{
 assert.equal(Q.classify('午饭','expense',[{keyword:'午饭',type:'expense',category:'自定义'}]),'自定义');assert.deepEqual(I.parseCSV('a,b\r\n"x,y","hello\nworld"'),[['a','b'],['x,y','hello\nworld']]);assert.match(Q.exportCSV([entry({note:'=WEBSERVICE(1)'})]),/'=WEBSERVICE/);
});
test('文件表头定位和中性交易排除，不假定第一行即表头',()=>{
 const matrix=I.parseCSV('微信支付账单\n交易时间,交易对方,商品,收/支,金额(元),支付方式,交易状态,交易单号\n2026-11-25 12:00:00,饭店,午饭,支出,15.00,零钱,支付成功,a1\n2026-11-25 13:00:00,自己,充值,不计收支,20.00,银行卡,支付成功,a2');const d=I.detectColumns(matrix),r=I.parseBills(matrix,d.header,d.mapping);assert.equal(d.header,1);assert.equal(r.rows.length,2);assert.equal(r.rows[0].category,'饮食');assert.equal(r.rows[1].included,false);assert.equal(r.rows[0].external_id,'a1');
});
test('文件重复和已有手动记录重复都能发现',()=>{
 const a=entry(),b=entry({external_id:'wechat-1',source:'bill-file'});assert.equal(Q.duplicates([b],[a])[0].duplicate,true);assert.equal(Q.duplicates([b,b],[])[1].duplicate,true);assert.equal(Q.duplicates([entry({merchant:'名称不同'})],[a])[0].possibleDuplicate,true);
});
test('旧数据迁移保留金额与身份标识，完整 JSON 备份可恢复',()=>{
 const p=I.parseBackup({format:'qingji-legacy',expenses:[{id:'old1',cents:3850,date:'2026-10-23T12:30',category:'餐饮',merchant:'餐馆',note:''}]});assert.equal(p.rows[0].cents,3850);assert.equal(p.rows[0].external_id,'legacy:old1');assert.equal(p.rows[0].category,'饮食');const r=I.parseBackup({format:'qingji-backup',version:2,documents:[{id:'123',kind:'entry',payload:entry(),deleted:false}]});assert.equal(r.rows[0].restore_id,'123');assert.throws(()=>I.parseBackup({format:'unknown'}));
});
test('SheetJS 本地库可解析 Excel 文件',()=>{
 const XLSX=require('../web/vendor/xlsx.full.min.js');const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['交易时间','金额'],['2026-11-25 12:00',15]]),'账单');const buffer=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});const back=XLSX.read(buffer,{type:'buffer'});assert.equal(XLSX.utils.sheet_to_json(back.Sheets['账单'],{header:1})[1][1],15);
});
test('备份中的不安全分类 ID 被拒绝，回收站记录保留删除标识',()=>{const settings={categories:Q.defaultCategories(),rules:[]};assert.equal(Q.validateSettings(settings).categories.length,15);settings.categories[0].id='bad" onclick="alert(1)';assert.throws(()=>Q.validateSettings(settings));const data=I.parseBackup({format:'qingji-backup',version:2,documents:[{id:'123',kind:'entry',deleted:true,payload:entry()}]});assert.equal(data.rows[0].was_deleted,true);});

test('备忘录按日期和月份汇总，收入单列，排除范围外和已删除记录',()=>{
 const rows=[entry({date:'2026-12-01T12:00',cents:2000,merchant:'订阅'}),entry({date:'2026-11-02T13:00',cents:29,merchant:'小食'}),entry({date:'2026-11-02T12:00',cents:400,merchant:'地铁',category:'交通'}),entry({type:'income',cents:50000,merchant:'家教收入'}),entry({deleted:true,cents:99999}),entry({date:'2025-11-01T12:00',cents:99999})];
 const text=Q.exportMemo(rows,'2026-11-01','2026-12-01');
 assert.ok(text.includes('11.2，4.29（地铁 4）'));
 assert.ok(text.indexOf('11.2，')<text.indexOf('12.1，'));
 assert.ok(text.includes('2026年12月：'));assert.ok(text.includes('范围支出合计：24.29元'));assert.ok(text.includes('范围收入合计：500元'));assert.ok(text.includes('收入（单独列出，不计入支出）：'));
 assert.equal(Q.exportMemo(rows,'2024-01-01','2024-01-31'),'');
});
test('备忘录明细清理换行和分隔符，明确金额可按历史格式核对',()=>{
 const text=Q.exportMemo([entry({merchant:'商店（分店）\n用品，纸',category:'日用品',cents:1230})],'2026-11-01','2026-11-30');
 const line=text.split('\n').find(s=>s.startsWith('11.25，'));
 const parsed=I.parseText(line,{referenceDate:'2026-11-25'});assert.equal(parsed.failures.length,0);assert.equal(parsed.rows.length,1);assert.equal(parsed.rows[0].cents,1230);
});

test('备忘录饮食只计入总额，全饮食不带括号，混合明细可还原支出总额',()=>{
 const rows=[entry({merchant:'午饭',cents:1500}),entry({merchant:'地铁',category:'交通',cents:400}),entry({merchant:'外卖',date:'2026-11-24T12:00',cents:1288})];
 const text=Q.exportMemo(rows,'2026-11-01','2026-11-30');
 assert.ok(text.includes('11.24，12.88\n'));assert.ok(text.includes('11.25，19（地铁 4）'));assert.ok(!text.includes('午饭'));assert.ok(!text.includes('外卖'));assert.ok(text.includes('范围支出合计：31.88元'));
 const daily=text.split('\n').filter(s=>/^11\.\d+，/.test(s)).join('\n');const parsed=I.parseText(daily,{referenceDate:'2026-11-25'});assert.equal(parsed.failures.length,0);assert.equal(parsed.rows.reduce((n,e)=>n+e.cents,0),3188);
});
