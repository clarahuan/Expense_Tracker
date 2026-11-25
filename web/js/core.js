(function(root){
 'use strict';
 const expense=['饮食','交通','日用品','服饰购物','学习教育','娱乐','医疗健康','人情往来','其他'];
 const income=['家教收入','实习工资','生活费','奖学金','兼职收入','其他收入'];
 const palette=['#718b73','#bdab8e','#9baabe','#b7a1ae','#aaa97d','#c69e8f','#88aaa3','#afa6bf','#bec5b6'];
 const now=()=>new Date().toISOString();
 const localDate=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
 const uuid=()=>crypto.randomUUID?crypto.randomUUID():'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16));
 const money=n=>(Number(n||0)/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function cents(value){const s=String(value).trim().replace(/[,，¥￥元\s]/g,'');if(!/^\d{1,9}(\.\d{1,2})?$/.test(s))return null;const [a,b='']=s.split('.');const n=Number(a)*100+Number(b.padEnd(2,'0'));return n>0&&n<=1e10?n:null;}
 function validDate(s){if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s||''))return false;const d=new Date(s);return !Number.isNaN(+d)&&`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`===s;}
 function validateEntry(e){if(!e||!['expense','income'].includes(e.type)||!Number.isSafeInteger(e.cents)||e.cents<=0||e.cents>1e10||!validDate(e.date)||!e.category||typeof e.category!=='string')throw Error('请检查金额、类型、分类和完整日期');for(const k of ['merchant','note','method','external_id','source'])if(e[k]!==undefined&&(typeof e[k]!=='string'||e[k].length>1000))throw Error('账单文字格式错误或过长');return e;}
 function defaultCategories(){return [...expense.map((name,i)=>({id:`expense-${i}`,type:'expense',name,hidden:false,order:i,color:palette[i]})),...income.map((name,i)=>({id:`income-${i}`,type:'income',name,hidden:false,order:i,color:palette[i%palette.length]}))];}
 function validateSettings(value){if(!value||!Array.isArray(value.categories)||!value.categories.length||value.categories.length>200||!Array.isArray(value.rules)||value.rules.length>200)throw Error('分类或规则备份格式无效');const ids=new Set(),names=new Set();for(const c of value.categories){const key=c.type+'|'+c.name;if(!c||!['income','expense'].includes(c.type)||typeof c.name!=='string'||!c.name.trim()||c.name.length>30||!/^[-a-zA-Z0-9]{1,80}$/.test(c.id)||ids.has(c.id)||names.has(key)||!Number.isSafeInteger(c.order)||c.order<0||typeof c.hidden!=='boolean')throw Error('分类数据无效、重复或包含不安全标识');ids.add(c.id);names.add(key);}for(const type of ['income','expense'])if(!value.categories.some(c=>c.type===type&&!c.hidden))throw Error('收入与支出均需保留可见分类');for(const r of value.rules)if(!r||typeof r.keyword!=='string'||!r.keyword.trim()||r.keyword.length>50||!names.has(r.type+'|'+r.category))throw Error('自动分类规则无效');if(value.quickEntries!==undefined&&(!Array.isArray(value.quickEntries)||value.quickEntries.length>40||value.quickEntries.some(q=>!q||typeof q.name!=='string'||!q.name.trim()||q.name.length>100||typeof q.category!=='string'||!q.category.trim()||q.category.length>30)||new Set(value.quickEntries.map(q=>q.name)).size!==value.quickEntries.length))throw Error('常用消费格式无效或名称重复');return {...(value.quickEntries!==undefined?{quickEntries:value.quickEntries.map(q=>({name:q.name,category:q.category}))}:{}),categories:value.categories.map(c=>({id:c.id,name:c.name,type:c.type,order:c.order,hidden:c.hidden,color:/^#[a-f0-9]{6}$/i.test(c.color)?c.color:palette[0]})),rules:value.rules.map(r=>({keyword:r.keyword,category:r.category,type:r.type}))};}
 const oldMap={'餐饮':'饮食','购物':'服饰购物','居住':'其他','健康':'医疗健康','学习':'学习教育'};
 const fingerprint=e=>e.external_id?`${e.source||''}|${e.external_id}`:[e.type,e.date,e.cents,(e.merchant||'').trim()].join('|');
 function duplicates(rows,existing){const semantic=e=>[e.type,e.date,e.cents,(e.merchant||'').trim()].join('|'),minute=e=>[e.type,e.date,e.cents].join('|');const seen=new Set(existing.flatMap(e=>[fingerprint(e),semantic(e)])),times=new Set(existing.map(minute));return rows.map(e=>{const duplicate=seen.has(fingerprint(e))||seen.has(semantic(e)),possibleDuplicate=!duplicate&&times.has(minute(e));seen.add(fingerprint(e));seen.add(semantic(e));times.add(minute(e));return {...e,duplicate,possibleDuplicate};});}
 function inRange(e,start,end){const d=e.date.slice(0,10);return (!start||d>=start)&&(!end||d<=end);}
 function monthRange(month){const [y,m]=month.split('-').map(Number);return {start:`${month}-01`,end:`${month}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`};}
 function stats(rows,start,end){const selected=rows.filter(e=>inRange(e,start,end));let incoming=0,outgoing=0;const expenseGroups={},incomeGroups={},daily={},monthly={};for(const e of selected){if(e.type==='income'){incoming+=e.cents;incomeGroups[e.category]=(incomeGroups[e.category]||0)+e.cents;}else{outgoing+=e.cents;expenseGroups[e.category]=(expenseGroups[e.category]||0)+e.cents;daily[e.date.slice(0,10)]=(daily[e.date.slice(0,10)]||0)+e.cents;}const k=e.date.slice(0,7);monthly[k]??={income:0,expense:0};monthly[k][e.type]+=e.cents;}const today=localDate().slice(0,10);const effectiveEnd=end>today?today:end;const days=start&&effectiveEnd?Math.max(1,Math.round((new Date(effectiveEnd+'T12:00')-new Date(start+'T12:00'))/864e5)+1):1;return {incoming,outgoing,balance:incoming-outgoing,average:Math.round(outgoing/days),expenseGroups,incomeGroups,daily,monthly,rows:selected};}
 function classify(text,type='expense',customRules=[]){const rule=customRules.find(r=>r.keyword&&text.includes(r.keyword)&&r.type===type);if(rule)return rule.category;if(type==='income'){return income.find(c=>text.includes(c))||(/家教/.test(text)?'家教收入':/实习/.test(text)?'实习工资':/兼职/.test(text)?'兼职收入':'其他收入');}const rules=[['交通',/地铁|公交|滴滴|打车|车票|加油/],['日用品',/日用品|纸巾|洗衣|牙膏|洗发|超市/],['服饰购物',/衣|服饰|鞋|淘宝|京东|拼多多|购物/],['学习教育',/书|课程|学费|学习|教育/],['医疗健康',/医院|药|诊所|医疗/],['娱乐',/电影|游戏|娱乐|会员/],['人情往来',/红包|礼物|人情/],['饮食',/饭|餐|食|奶茶|咖啡|外卖|早餐|午餐|晚餐|饮食/]];return rules.find(([,re])=>re.test(text))?.[0]||'其他';}
 function legacyRows(payload){const rows=Array.isArray(payload)?payload:payload.expenses;if(!Array.isArray(rows))throw Error('不是旧版账单备份');return rows.map(r=>validateEntry({...r,type:'expense',category:oldMap[r.category]||r.category,method:'',source:'legacy',external_id:`legacy:${r.id}`,note:r.note||'',merchant:r.merchant||''}));}
 function csvCell(s){s=String(s??'');if(/^[\s]*[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
 function exportCSV(rows){return '\ufeff'+[['类型','时间','金额（元）','分类','名称','备注','支付方式','原始交易号'],...rows.map(e=>[e.type==='income'?'收入':'支出',e.date,(e.cents/100).toFixed(2),e.category,e.merchant,e.note,e.method,e.external_id])].map(r=>r.map(csvCell).join(',')).join('\r\n');}
 function exportMemo(rows,start,end){
   const selected=rows.filter(e=>!e.deleted&&inRange(e,start,end)).sort((a,b)=>a.date.localeCompare(b.date));
   if(!selected.length)return '';
   const amount=n=>(n/100).toFixed(2).replace(/\.?0+$/,'');
   const label=e=>(e.merchant||e.category||'未命名').replace(/[\r\n,，、()（）]/g,' ').trim();
   const lines=[`记账记录：${start} 至 ${end}`];
   for(const type of ['expense','income']){
     const typed=selected.filter(e=>e.type===type);if(!typed.length)continue;
     lines.push('',type==='expense'?'支出：':'收入（单独列出，不计入支出）：');
     const months=[...new Set(typed.map(e=>e.date.slice(0,7)))];
     for(const month of months){
       const monthly=typed.filter(e=>e.date.startsWith(month));lines.push(`${month.slice(0,4)}年${Number(month.slice(5))}月：`);
       const days=[...new Set(monthly.map(e=>e.date.slice(0,10)))];
       for(const day of days){const daily=monthly.filter(e=>e.date.startsWith(day));const total=daily.reduce((n,e)=>n+e.cents,0);const details=daily.filter(e=>type!=='expense'||!(['饮食','餐饮'].includes((e.category||'').trim())||/^饮食[（(\s]*当日余额[）)\s]*$/.test((e.merchant||'').trim()))).map(e=>label(e)+' '+amount(e.cents));lines.push(`${Number(day.slice(5,7))}.${Number(day.slice(8))}，${amount(total)}${details.length?'（'+details.join('，')+'）':''}`);}
       lines.push(`${Number(month.slice(5))}月${type==='expense'?'支出':'收入'}小计：${amount(monthly.reduce((n,e)=>n+e.cents,0))}元`);
     }
   }
   const totals=stats(selected,start,end);lines.push('',`范围支出合计：${amount(totals.outgoing)}元`,`范围收入合计：${amount(totals.incoming)}元`);return lines.join('\n');
 }
 const api={expense,income,palette,now,localDate,uuid,money,esc,cents,validDate,validateEntry,validateSettings,defaultCategories,oldMap,fingerprint,duplicates,inRange,monthRange,stats,classify,legacyRows,exportCSV,exportMemo};
 if(typeof module!=='undefined')module.exports=api;else root.Q=api;
})(typeof window!=='undefined'?window:globalThis);
