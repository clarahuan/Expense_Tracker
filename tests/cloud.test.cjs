const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {IDBFactory}=require('fake-indexeddb'),Q=require('../web/js/core.js');
async function fixture(){
 const local=new Map(),events=[];const c=vm.createContext({Q,console,indexedDB:new IDBFactory(),AbortSignal,atob,Date,navigator:{onLine:true},CustomEvent:class{constructor(type,opts={}){this.type=type;this.detail=opts.detail;}},localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)}});c.window=c;c.dispatchEvent=e=>events.push(e);c.addEventListener=()=>{};
 c.fetch=async(url,opts)=>{const payload=JSON.parse(opts.body||'null');if(url.includes('/verify'))return{ok:true,text:async()=>JSON.stringify({user:{id:'user-a',email:'synthetic@example.test'},access_token:'test-access',refresh_token:'test-refresh',expires_in:3600})};if(url.includes('/rpc/')){if(c.fail)throw Error('network unavailable');return{ok:true,text:async()=>JSON.stringify({status:'saved',document:{id:payload.p_id,kind:payload.p_kind,payload:payload.p_payload,deleted:false,revision:1}})};}return{ok:true,text:async()=>'[]'};};
 vm.runInContext(fs.readFileSync('web/js/store.js','utf8'),c);vm.runInContext(fs.readFileSync('web/js/cloud.js','utf8'),c);c.Cloud.configure('https://synthetic.supabase.co','sb_publishable_test');await c.Cloud.verify('synthetic@example.test','000000');await c.LedgerStore.open(c.Cloud.namespace());return c;
}
test('网络失败及离线均保留待同步数据，重试收到确认后才移除',async()=>{
 const c=await fixture();await c.LedgerStore.save('one','entry',{cents:1500});c.fail=true;await c.Cloud.sync();assert.equal((await c.LedgerStore.read('outbox')).length,1);assert.match(c.Cloud.getStatus(),/同步失败/);c.navigator.onLine=false;await c.Cloud.sync();assert.equal(c.Cloud.getStatus(),'离线模式');c.navigator.onLine=true;c.fail=false;await c.Cloud.sync();assert.equal((await c.LedgerStore.read('outbox')).length,0);assert.equal(c.Cloud.getStatus(),'已同步');
});
test('管理密钥拒绝进入前端配置',async()=>{
 const c=await fixture();assert.throws(()=>c.Cloud.configure('https://synthetic.supabase.co','sb_secret_forbidden'),/禁止管理密钥/);const key='a.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.c';assert.throws(()=>c.Cloud.configure('https://synthetic.supabase.co',key),/禁止管理密钥/);
});
