const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('静态资源使用仓库相对路径，PWA 缓存覆盖核心文件',()=>{
 const html=fs.readFileSync('web/index.html','utf8');for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g)){const s=m[1];assert.ok(!s.startsWith('/'),`absolute path: ${s}`);if(s.startsWith('./')&&!s.includes('#'))assert.ok(fs.existsSync('web/'+s.slice(2)),s);}
 const manifest=JSON.parse(fs.readFileSync('web/manifest.webmanifest'));assert.equal(manifest.start_url,'./#home');assert.equal(manifest.scope,'./');
 const context=vm.createContext({URL,self:{location:{href:'https://example.test/Expense_Tracker/sw.js',origin:'https://example.test'},addEventListener(){}}});vm.runInContext(fs.readFileSync('web/sw.js','utf8'),context);for(const file of vm.runInContext('CORE',context))if(file!=='./')assert.ok(fs.existsSync('web/'+file.slice(2)),file);
 assert.ok(!vm.runInContext('CORE',context).some(p=>p.includes('data/')||p.includes('legacy')));
});
test('Service Worker 断网时仍返回已缓存的同版本页面，API 不缓存',async()=>{
 const listeners={};let networkCalls=0;const response={marker:'cached-shell'};
 const c=vm.createContext({URL,fetch:()=>{networkCalls++;throw Error('offline');},caches:{open:async()=>({match:async()=>response})},self:{location:{href:'https://example.test/Expense_Tracker/sw.js',origin:'https://example.test'},addEventListener:(name,handler)=>listeners[name]=handler}});
 vm.runInContext(fs.readFileSync('web/sw.js','utf8'),c);
 let pending;listeners.fetch({request:{method:'GET',url:'https://example.test/Expense_Tracker/#bills',mode:'navigate'},respondWith:p=>pending=p});assert.equal(await pending,response);assert.equal(networkCalls,0);
 let intercepted=false;listeners.fetch({request:{method:'GET',url:'https://example.test/Expense_Tracker/api/expenses',mode:'cors'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
});
