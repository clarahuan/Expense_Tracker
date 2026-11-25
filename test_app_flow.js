const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const ReceiptParser=require('./web/receipt-parser.js');

function setup(){
  const nodes=new Map(),requests=[];
  function node(id){
    if(!nodes.has(id))nodes.set(id,{
      value:'',hidden:false,disabled:false,checked:false,dataset:{},textContent:'',innerHTML:'',
      classList:{toggle(){}},listeners:{},
      addEventListener(event,fn){this.listeners[event]=fn;},querySelectorAll(){return [];},scrollIntoView(){}
    });
    return nodes.get(id);
  }
  const context=vm.createContext({
    document:{getElementById:node,querySelector:node,querySelectorAll:()=>[]},
    ReceiptParser,Date,Math,Set,Number,String,Array,JSON,Promise,Blob,URL,
    confirm:()=>true,setTimeout:()=>0,clearTimeout(){},
    fetch:async(path,options)=>{
      if(options){requests.push(JSON.parse(options.body));if(context.fail)throw Error('模拟断网');return{ok:true,json:async()=>({imported:2,skipped:0,total_cents:3000})};}
      return{ok:true,json:async()=>[]};
    }
  });
  vm.runInContext(fs.readFileSync('web/app.js','utf8'),context);
  return{node,context,requests,run:code=>vm.runInContext(code,context)};
}

test('多笔预览未确认前不提交，按时间排序并默认跳过重复',async()=>{
  const s=setup();await Promise.resolve();
  s.run(`showDrafts(ReceiptParser.parse('2026-10-23\\n咖啡 -20.00\\n13:00\\n公交 -10.00\\n08:00\\n公交 -10.00\\n08:00',{referenceDate:'2026-10-23'}))`);
  assert.equal(s.requests.length,0);
  assert.equal(s.run('drafts[0].date'),'2026-10-23T08:00');
  assert.equal(s.run('drafts.filter(d=>d.included).length'),2);
  assert.match(s.node('batchSummary').textContent,/2 \/ 3 笔 · ¥30.00/);
  await s.node('batchForm').listeners.submit({preventDefault(){}});
  assert.equal(s.requests.length,1);
  assert.deepEqual(s.requests[0].items.map(r=>r.cents),[1000,2000]);
  assert.equal(s.run('drafts.length'),0);
  assert.match(s.node('batchStatus').textContent,/已导入 2 笔/);
});
test('网络失败保留清单，重试使用相同导入编号',async()=>{
  const s=setup();await Promise.resolve();
  s.run(`showDrafts(ReceiptParser.parse('咖啡 2026-10-23 13:00 -20.00',{referenceDate:'2026-10-23'}))`);
  s.context.fail=true;
  await s.node('batchForm').listeners.submit({preventDefault(){}});
  assert.equal(s.run('drafts.length'),1);
  assert.match(s.node('batchStatus').textContent,/清单已保留/);
  s.context.fail=false;
  await s.node('batchForm').listeners.submit({preventDefault(){}});
  assert.equal(s.requests[0].import_id,s.requests[1].import_id);
});
test('未补全日期不能批量提交，取消勾选不计入金额',async()=>{
  const s=setup();await Promise.resolve();
  s.run(`showDrafts(ReceiptParser.parse('咖啡 -20.00',{referenceDate:'2026-10-23'}))`);
  await s.node('batchForm').listeners.submit({preventDefault(){}});
  assert.equal(s.requests.length,0);
  s.run('drafts[0].included=false;updateSummary()');
  assert.match(s.node('batchSummary').textContent,/已选 0 \/ 1 笔 · ¥0.00/);
  assert.equal(s.node('importBatch').disabled,true);
});
