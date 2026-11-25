const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {IDBFactory}=require('fake-indexeddb'),Q=require('../web/js/core.js');
function fixture(){const c=vm.createContext({indexedDB:new IDBFactory(),Q,console});c.window=c;vm.runInContext(fs.readFileSync('web/js/store.js','utf8'),c);return c.LedgerStore;}
const payload=(note='')=>({type:'expense',cents:1500,date:'2026-11-25T12:00',category:'饮食',note});
test('离线保存刷新可读，删除可恢复，账号存储互不混入',async()=>{
 const s=fixture();await s.open('a');await s.save('1','entry',payload());await s.open('a');assert.equal((await s.read()).length,1);await s.save('1','entry',payload(),true);assert.equal((await s.get('1')).deleted,true);await s.save('1','entry',payload(),false);await s.open('b');assert.equal((await s.read()).length,0);await s.open('a');assert.equal((await s.read()).length,1);
});
test('云端未确认前不清理 outbox；较早请求不能擦除较新本机修改',async()=>{
 const s=fixture();await s.open('local');await s.save('1','entry',payload('v1'));const op=(await s.read('outbox'))[0];await s.save('1','entry',payload('v2'));await s.acknowledge(op,{status:'saved',document:{...op.doc,revision:1}});const pending=(await s.read('outbox'))[0];assert.equal(pending.doc.payload.note,'v2');assert.equal(pending.base_revision,1);await s.acknowledge(pending,{status:'saved',document:{...pending.doc,revision:2}});assert.equal((await s.read('outbox')).length,0);assert.equal((await s.get('1')).revision,2);
});
test('冲突保留双方版本，由用户决定后才能继续',async()=>{
 const s=fixture();await s.open();await s.save('1','entry',payload('local'));const op=(await s.read('outbox'))[0],remote={...op.doc,payload:payload('remote'),revision:3};await s.acknowledge(op,{status:'conflict',current:remote});assert.equal((await s.read('conflicts')).length,1);assert.equal((await s.get('1')).payload.note,'local');await s.resolveConflict('1','local');assert.equal((await s.read('outbox'))[0].base_revision,3);const op2=(await s.read('outbox'))[0];await s.acknowledge(op2,{status:'conflict',current:remote});await s.resolveConflict('1','remote');assert.equal((await s.read('outbox')).length,0);assert.equal((await s.get('1')).payload.note,'remote');
});
test('拉取不能覆盖待同步记录；一次写入一批',async()=>{
 const s=fixture();await s.open();await s.saveMany([{id:'1',kind:'entry',payload:payload('keep')},{id:'2',kind:'entry',payload:payload('also')}]);await s.receive([{id:'1',kind:'entry',payload:payload('cloud'),revision:2}]);assert.equal((await s.get('1')).payload.note,'keep');assert.equal((await s.read('outbox')).length,2);
});
test('无效云端确认不能删除待同步数据',async()=>{const s=fixture();await s.open();await s.save('1','entry',payload());const op=(await s.read('outbox'))[0];await assert.rejects(s.acknowledge(op,{status:'saved'}));assert.equal((await s.read('outbox')).length,1);});
