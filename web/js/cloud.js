(function(root){
 'use strict';
 function stored(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}}
 let config=stored('qj-cloud'),session=stored('qj-session'),busy=false;
 if(!config?.url||!config?.key||!session?.user?.id||!session?.refresh_token||!session?.access_token)session=null;
 let status='未配置云同步';
 const emit=()=>root.dispatchEvent(new CustomEvent('sync-status',{detail:status}));
 function setStatus(s){status=s;emit();}
 function configure(url,key){
   let parsed;try{parsed=new URL(url.trim());}catch{throw Error('请输入完整项目网址，例如 https://项目编号.supabase.co');}
   if(parsed.protocol!=='https:'||!/^[-a-z0-9]+\.supabase\.co$/.test(parsed.hostname)||parsed.port||parsed.username||parsed.password||parsed.search||parsed.hash||!['/','/rest/v1','/rest/v1/'].includes(parsed.pathname))throw Error('请填写 Supabase 项目地址，或复制 Data API 的 /rest/v1 地址');
   url=parsed.origin;key=key.trim();
   if(!key)throw Error('请粘贴 Publishable key，通常以 sb_publishable_ 开头');
   if(/\s/.test(key))throw Error('公开密钥中包含空格或换行，请重新复制完整内容');
   if(!key.startsWith('sb_publishable_')){try{const info=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(info.role!=='anon')throw Error();}catch{throw Error('只能使用 publishable 或 anon 公开密钥，禁止管理密钥');}}
   if(session&&config?.url!==url)throw Error('请先退出当前账号再更换项目');
   config={url,key};localStorage.setItem('qj-cloud',JSON.stringify(config));setStatus('已配置，尚未登录');
 }
 async function request(path,{body,token,method='POST'}={}){
   if(!config)throw Error('请先配置 Supabase 项目');
   const headers={apikey:config.key,'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;
   const r=await fetch(config.url+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(25000)});
   const raw=await r.text();let result;try{result=JSON.parse(raw);}catch{result={};}
   if(!r.ok)throw Error(result.msg||result.message||result.error_description||`云服务请求失败 (${r.status})`);
   return result;
 }
 function persist(s){session={...s,expires_at:Date.now()+s.expires_in*1000};localStorage.setItem('qj-session',JSON.stringify(session));}
 function redirectURL(){const redirect=new URL(root.location.pathname,root.location.origin);redirect.searchParams.set('qj_project',config.url);redirect.searchParams.set('qj_key',config.key);return redirect.href;}
 async function sendCode(email){if(!config)throw Error('请先保存连接配置');await request('/auth/v1/otp?redirect_to='+encodeURIComponent(redirectURL()),{body:{email,create_user:false}});}
 async function consumeCallback(){
   const params=new URLSearchParams(root.location.hash.slice(1));
   if(!params.has('access_token')&&!params.has('error')&&!params.has('error_description'))return null;
   const callback=new URL(root.location.href),project=callback.searchParams.get('qj_project'),key=callback.searchParams.get('qj_key');
   // Remove tokens from the address bar before any asynchronous verification or rendering.
   callback.hash='mine';callback.searchParams.delete('qj_project');callback.searchParams.delete('qj_key');
   root.history.replaceState(null,'',callback.pathname+callback.search+callback.hash);
   if(params.has('error')||params.has('error_description'))throw Error('登录链接无效或已过期，请重新发送登录邮件。');
   if(project&&key)configure(project,key);
   if(!config)throw Error('请先保存此 Supabase 项目的公开连接信息，再重新发送登录邮件。');
   const access=params.get('access_token'),refresh=params.get('refresh_token');
   if(!access||!refresh)throw Error('登录链接不完整，请重新发送登录邮件。');
   const user=await request('/auth/v1/user',{token:access,method:'GET'});
   if(!user||typeof user.id!=='string'||!user.id)throw Error('无法验证登录身份，请重试。');
   const expires=Number(params.get('expires_in'));
   const s={access_token:access,refresh_token:refresh,user,expires_in:expires>0&&expires<=86400?expires:3600};persist(s);return s;
 }
 async function verify(email,code){const s=await request('/auth/v1/verify',{body:{email,token:code,type:'email'}});if(!s.user?.id||!s.access_token)throw Error('验证码验证失败');persist(s);return s;}
 async function token(){if(!session)throw Error('请先登录');if(session.expires_at<Date.now()+60000){const s=await request('/auth/v1/token?grant_type=refresh_token',{body:{refresh_token:session.refresh_token}});persist(s);}return session.access_token;}
 async function logout(){if(session)try{await request('/auth/v1/logout',{token:await token()});}catch{}session=null;localStorage.removeItem('qj-session');setStatus('已退出，使用独立本地账本');}
 function namespace(){return session?`${config.url.split('//')[1].split('.')[0]}-${session.user.id}`:'local';}
 async function syncUnlocked(){
   if(busy)return;if(!navigator.onLine){setStatus('离线模式');return;}if(!session){setStatus(config?'尚未登录 · 本地保存':'本地保存 · 未配置云端');return;}
   busy=true;const original=namespace();setStatus('正在同步');
   try{
     const t=await token();
     for(const op of await LedgerStore.read('outbox')){
       if(namespace()!==original)throw Error('账号已变化，请重试');if(op.conflict)continue;
       const result=await request('/rest/v1/rpc/qj_apply_document',{token:t,body:{p_id:op.id,p_kind:op.doc.kind,p_payload:op.doc.payload,p_deleted:op.doc.deleted,p_base_revision:op.base_revision,p_mutation:op.mutation}});
       if(namespace()!==original)throw Error('账号已变化，请重试');
       await LedgerStore.acknowledge(op,result);
     }
     for(let offset=0;;offset+=500){
       const rows=await request(`/rest/v1/qj_documents?select=*&order=id&limit=500&offset=${offset}`,{token:t,method:'GET'});
       if(namespace()!==original)throw Error('账号已变化，请重试');
       await LedgerStore.receive(rows);if(rows.length<500)break;
     }
     const pending=await LedgerStore.read('outbox'),conflicts=await LedgerStore.read('conflicts');
     if(!pending.length&&!conflicts.length)localStorage.setItem('qj-last-sync-'+original,new Date().toISOString());
     setStatus(conflicts.length?`有 ${conflicts.length} 条冲突待处理`:pending.length?`待同步 ${pending.length} 条`:'已同步');
     root.dispatchEvent(new CustomEvent('ledger-updated'));
   }catch(e){setStatus('同步失败：'+e.message);}finally{busy=false;}
 }
 async function sync(){if(navigator.locks)return navigator.locks.request('qingji-sync-'+namespace(),{ifAvailable:true},lock=>lock?syncUnlocked():undefined);return syncUnlocked();}
 root.Cloud={configure,sendCode,verify,consumeCallback,logout,sync,namespace,getConfig:()=>config,getSession:()=>session,getStatus:()=>status,isBusy:()=>busy};
 root.addEventListener('online',()=>sync());root.addEventListener('offline',()=>setStatus('离线模式'));
})(window);
