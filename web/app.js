'use strict';
const $ = id => document.getElementById(id);
const categories = ['餐饮','购物','交通','居住','娱乐','健康','学习','其他'];
const icons = ['♨','▧','↗','⌂','♫','♡','▤','⋯'];
const colors = ['#53765b','#a4b58b','#d4bd83','#9dacc0','#b0a1bd','#c89786','#82aaa3','#d0d2c5'];
let records = [], selected = '餐饮', filter = '全部', imageFiles = [], worker = null;
const money = cents => (cents / 100).toLocaleString('zh-CN', {minimumFractionDigits:2,maximumFractionDigits:2});
const localDate = () => {const d=new Date();return new Date(d-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
const escapeHTML = str => String(str).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,4500);}
async function api(path,options){const r=await fetch(path,options);const data=await r.json();if(!r.ok)throw new Error(data.error||'请求失败');return data;}
function selectCategory(category){selected=category;document.querySelectorAll('.category').forEach(b=>{const active=b.dataset.category===category;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});}
$('categories').innerHTML=categories.map((c,i)=>`<button type="button" class="category" data-category="${c}"><span>${icons[i]}</span>${c}</button>`).join('');
$('categories').addEventListener('click',e=>{const b=e.target.closest('button');if(b)selectCategory(b.dataset.category);});
selectCategory(selected);$('date').value=localDate();$('month').value=localDate().slice(0,7);
$('filterCategories').innerHTML=categories.map(c=>`<button data-filter="${c}">${c}</button>`).join('');
document.querySelector('.filters').addEventListener('click',e=>{if(!e.target.dataset.filter)return;filter=e.target.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===filter));render();});
function render(){
 const month=$('month').value;if(!/^\d{4}-\d{2}$/.test(month))return;
 const rows=records.filter(r=>r.date.startsWith(month));const total=rows.reduce((s,r)=>s+r.cents,0);
 const [y,m]=month.split('-').map(Number),days=new Date(y,m,0).getDate();const today=new Date();
 const divisor=month===localDate().slice(0,7)?today.getDate():days;
 const sums=categories.map(c=>rows.filter(r=>r.category===c).reduce((s,r)=>s+r.cents,0));
 const ranked=categories.map((c,i)=>({category:c,cents:sums[i],color:colors[i]})).filter(c=>c.cents).sort((a,b)=>b.cents-a.cents);
 const parts=money(total).split('.');$('total').innerHTML=`¥${parts[0]}<span>.${parts[1]}</span>`;
 $('count').textContent=`${rows.length} 笔消费`;$('average').textContent=`¥${money(Math.round(total/divisor))}`;
 $('averageLabel').textContent=`按${month===localDate().slice(0,7)?'本月已过':'整月'} ${divisor} 天计算`;
 $('topCategory').textContent=ranked[0]?.category||'暂无';$('topAmount').textContent=ranked[0]?`¥${money(ranked[0].cents)} · 占总支出 ${(ranked[0].cents/total*100).toFixed(1)}%`:'记下第一笔，发现消费倾向';
 const previous=new Date(y,m-2,1),pm=`${previous.getFullYear()}-${String(previous.getMonth()+1).padStart(2,'0')}`;
 const prevTotal=records.filter(r=>r.date.startsWith(pm)).reduce((s,r)=>s+r.cents,0);
 $('comparison').textContent=prevTotal?`较上月整月 ${total>=prevTotal?'增加':'减少'} ${Math.abs((total-prevTotal)/prevTotal*100).toFixed(1)}%`:'好好生活，从第一笔开始';
 let angle=0;const stops=ranked.map(c=>{const start=angle;angle+=c.cents/total*360;return `${c.color} ${start}deg ${angle}deg`;});
 $('donut').style.background=total?`conic-gradient(${stops.join(',')})`:'#edf0e9';$('donutTotal').textContent=`¥${money(total)}`;
 $('legend').innerHTML=ranked.length?ranked.map(c=>`<div class="legend-row"><i style="background:${c.color}"></i><b>${c.category}</b><span>¥${money(c.cents)}</span><small>${(c.cents/total*100).toFixed(0)}%</small></div>`).join(''):'<p class="empty-small">还没有消费记录<br>记下第一笔，图表就会亮起来。</p>';
 const daily=Array.from({length:days},(_,i)=>rows.filter(r=>Number(r.date.slice(8,10))===i+1).reduce((s,r)=>s+r.cents,0));
 const max=Math.max(...daily,1);$('bars').innerHTML=daily.map((c,i)=>`<button class="bar" data-day="${i+1}" data-cents="${c}" style="height:${Math.max(c/max*100,2)}%;opacity:${c?1:.22}" aria-label="${m}月${i+1}日支出 ${money(c)} 元" title="${i+1}日 ¥${money(c)}"></button>`).join('');$('lastDay').textContent=`${days} 日`;
 const visible=rows.filter(r=>filter==='全部'||r.category===filter);$('listCount').textContent=rows.length;
 $('entries').innerHTML=visible.length?visible.map(r=>`<article class="entry"><div class="entry-icon">${icons[categories.indexOf(r.category)]}</div><div class="entry-content"><div class="entry-title">${escapeHTML(r.merchant||r.category)}</div><div class="entry-meta">${escapeHTML(r.date.replace('T',' ').slice(5))} · ${r.category}${r.note?' · '+escapeHTML(r.note):''}</div></div><span class="entry-amount">− ¥${money(r.cents)}</span><button class="delete" data-id="${r.id}" aria-label="删除${escapeHTML(r.merchant||r.category)}账单">×</button></article>`).join(''):`<div class="empty"><span>▤</span>${filter==='全部'?'这个月，等你记下第一笔':'这个分类还没有消费'}<p>一杯咖啡，一次出行，都是生活的印记。</p></div>`;
}
$('month').addEventListener('change',render);
$('bars').addEventListener('click',e=>{const b=e.target.closest('button');if(b)$('chartHint').textContent=`${$('month').value}-${String(b.dataset.day).padStart(2,'0')} · 支出 ¥${money(Number(b.dataset.cents))}`;});
async function refresh(){records=await api('/api/expenses');render();}
$('expenseForm').addEventListener('submit',async e=>{
 e.preventDefault();const input=$('amount').value.trim();
 if(!/^\d{1,9}(\.\d{1,2})?$/.test(input)||Number(input)<=0||Number(input)>100000000){toast('请输入大于 0 的金额，最多两位小数');return;}
 const [whole,decimal='']=input.split('.');const cents=Number(whole)*100+Number(decimal.padEnd(2,'0'));
 const row={cents,category:selected,date:$('date').value,merchant:$('merchant').value.trim(),note:$('note').value.trim()};
 if(records.some(r=>r.cents===row.cents&&r.date===row.date&&r.merchant===row.merchant)&&!confirm('发现相同金额、时间和商户的账单，仍然保存吗？'))return;
 $('save').disabled=true;
 try{await api('/api/expenses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(row)});$('month').value=row.date.slice(0,7);$('amount').value='';$('merchant').value='';$('note').value='';$('date').value=localDate();await refresh();toast('已记下这一笔，月度分析已更新');}catch(err){toast(err.message||'连接失败，请检查电脑服务');}finally{$('save').disabled=false;}
});
$('entries').addEventListener('click',async e=>{const b=e.target.closest('[data-id]');if(!b||!confirm('确定删除这笔账单？'))return;try{await api('/api/expenses/'+b.dataset.id,{method:'DELETE'});await refresh();toast('账单已删除');}catch{toast('删除失败，请检查连接');}});
$('export').addEventListener('click',()=>{
 const rows=records.filter(r=>r.date.startsWith($('month').value));if(!rows.length)return toast('本月还没有可导出的账单');
 const csvCell=s=>'"'+String(s).replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"';
 const csv='\ufeff'+[['时间','金额（元）','分类','商户','备注'],...rows.map(r=>[r.date,money(r.cents).replace(/,/g,''),r.category,r.merchant,r.note])].map(row=>row.map(csvCell).join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=`轻记-${$('month').value}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
});
function setTab(scan){$('scanArea').hidden=!scan;$('expenseForm').hidden=scan;$('scanTab').classList.toggle('active',scan);$('manualTab').classList.toggle('active',!scan);}
$('scanTab').onclick=()=>setTab(true);$('manualTab').onclick=()=>setTab(false);
$('referenceDate').value=localDate().slice(0,10);
$('imageInput').addEventListener('change',()=>{
 imageFiles=Array.from($('imageInput').files);$('recognize').disabled=!imageFiles.length;
 if($('preview').dataset.url)URL.revokeObjectURL($('preview').dataset.url);
 $('preview').hidden=true;
 if(!imageFiles.length)return;
 if(imageFiles.length>10||imageFiles.some(f=>f.size>20*1024*1024)){
   imageFiles=[];$('recognize').disabled=true;toast('每次最多 10 张，每张小于 20 MB');return;
 }
 const url=URL.createObjectURL(imageFiles[0]);$('preview').src=url;$('preview').dataset.url=url;$('preview').hidden=false;
 $('ocrStatus').textContent=`已选择 ${imageFiles.length} 张截图，第一张预览如上。识别后统一核对并导入。`;
});
function loadOCR(){if(window.Tesseract)return Promise.resolve();return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';s.onload=resolve;s.onerror=()=>{s.remove();reject(new Error('识别组件下载失败，请检查网络后重试'));};document.head.appendChild(s);});}
let drafts=[], batchBusy=false, batchRevision=0, pendingImport=null, activeImage=0;
function centsFrom(value){
 if(!/^\d{1,9}(\.\d{1,2})?$/.test(value)||Number(value)<=0||Number(value)>100000000)return null;
 const [a,b='']=value.split('.');return Number(a)*100+Number(b.padEnd(2,'0'));
}
const rowKey = r => `${r.date}|${r.cents??centsFrom(r.amount)}|${r.merchant.trim()}`;
function markDuplicates(){
 const known=new Set(records.map(rowKey));
 for(const d of drafts){d.duplicate=known.has(rowKey(d));if(d.duplicate)d.included=false;known.add(rowKey(d));}
}
function showDrafts(rows){
 drafts=ReceiptParser.sort(rows.map((r,i)=>({...r,id:`draft-${i}`,order:i})));
 markDuplicates();batchRevision++;pendingImport=null;
 $('batchPanel').hidden=false;renderDrafts();
}
function renderDrafts(){
 $('batchRows').innerHTML=drafts.map((d,i)=>`<article class="draft-row ${d.included?'':'draft-excluded'}" data-draft="${d.id}">
 <div class="draft-top"><label><input type="checkbox" data-field="included" ${d.included?'checked':''} ${d.duplicate?'disabled':''}> 第 ${i+1} 笔</label><small>${escapeHTML(d.source)}</small></div>
 <div class="draft-fields"><label>金额（元）<input data-field="amount" type="text" inputmode="decimal" value="${escapeHTML(d.amount)}" aria-label="第${i+1}笔金额"></label>
 <label>分类<select data-field="category" aria-label="第${i+1}笔分类">${categories.map(c=>`<option ${c===d.category?'selected':''}>${c}</option>`).join('')}</select></label>
 <label class="draft-date">消费时间<input data-field="date" type="datetime-local" value="${escapeHTML(d.date)}" aria-label="第${i+1}笔时间"></label>
 <label>商户<input data-field="merchant" maxlength="100" value="${escapeHTML(d.merchant)}" aria-label="第${i+1}笔商户"></label>
 <label>备注<input data-field="note" maxlength="500" value="${escapeHTML(d.note)}" aria-label="第${i+1}笔备注"></label></div>
 <p class="draft-warning">${d.duplicate?'疑似重复，默认跳过。修改金额、时间或商户后可重新勾选。':escapeHTML(d.warnings.join('；'))}</p>
 <details><summary>对照识别原文</summary><pre>${escapeHTML(d.raw)}</pre></details></article>`).join('');
 updateSummary();
}
function updateSummary(){
 const chosen=drafts.filter(d=>d.included);const total=chosen.reduce((s,d)=>s+(centsFrom(d.amount)||0),0);
 $('batchSummary').textContent=`已选 ${chosen.length} / ${drafts.length} 笔 · ¥${money(total)}`;
 $('importBatch').disabled=batchBusy||!chosen.length;
 const eligible=drafts.filter(d=>!d.duplicate);$('selectAll').checked=eligible.length>0&&eligible.every(d=>d.included);
 $('selectAll').indeterminate=chosen.length>0&&!$('selectAll').checked;
 $('batchForm').querySelectorAll('.draft-fields input,.draft-fields select').forEach(el=>{
   const d=drafts.find(d=>d.id===el.closest('[data-draft]').dataset.draft);
   el.required=d.included&&['date','amount'].includes(el.dataset.field);
 });
}
$('batchRows').addEventListener('input',e=>{
 const field=e.target.dataset.field;if(!field)return;
 const d=drafts.find(d=>d.id===e.target.closest('[data-draft]').dataset.draft);
 d[field]=field==='included'?e.target.checked:e.target.value;
 if(field!=='included'){
   d.duplicate=records.some(r=>rowKey(r)===rowKey(d))||drafts.some(r=>r!==d&&r.included&&rowKey(r)===rowKey(d));
   if(d.duplicate)d.included=false;
   const check=e.target.closest('[data-draft]').querySelector('[data-field="included"]');check.disabled=d.duplicate;check.checked=d.included;
   e.target.closest('[data-draft]').querySelector('.draft-warning').textContent=d.duplicate?'疑似重复，将跳过。':d.warnings.join('；');
 }
 e.target.closest('[data-draft]').classList.toggle('draft-excluded',!d.included);
 batchRevision++;pendingImport=null;updateSummary();
});
$('selectAll').addEventListener('change',()=>{drafts.forEach(d=>d.included=!d.duplicate&&$('selectAll').checked);batchRevision++;pendingImport=null;renderDrafts();});
$('sortBatch').onclick=()=>{ReceiptParser.sort(drafts);renderDrafts();};
$('discardBatch').onclick=()=>{if(batchBusy)return;if(drafts.length&&!confirm('清空待确认的记录？已保存的账单不受影响。'))return;drafts=[];$('batchPanel').hidden=true;pendingImport=null;};
$('reparse').onclick=()=>{if(batchBusy)return;if(drafts.length&&!confirm('重新解析会替换当前清单及你的修改，继续吗？'))return;showDrafts(ReceiptParser.parse($('ocrText').value,{referenceDate:$('referenceDate').value,source:'修正后的识别文字'}));};
$('batchForm').addEventListener('submit',async e=>{
 e.preventDefault();if(batchBusy)return;
 const chosen=drafts.filter(d=>d.included);if(!chosen.length)return;
 if(chosen.length>200)return toast('每次最多导入 200 笔，请取消部分勾选后再导入');
 for(const d of chosen){if(!centsFrom(d.amount)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(d.date)){toast('请补全选中账单的有效金额和完整时间');return;}}
 const items=ReceiptParser.sort([...chosen]).map(d=>({cents:centsFrom(d.amount),category:d.category,date:d.date,merchant:d.merchant.trim(),note:d.note.trim()}));
 if(!pendingImport||pendingImport.revision!==batchRevision)pendingImport={revision:batchRevision,body:JSON.stringify({import_id:`batch-${Date.now()}-${Math.random().toString(36).slice(2)}`,items})};
 batchBusy=true;$('batchForm').querySelectorAll('input,select,button').forEach(el=>el.disabled=true);$('recognize').disabled=true;$('imageInput').disabled=true;$('reparse').disabled=true;
 $('batchStatus').textContent='正在导入，请稍候…';
 try{
   const result=await api('/api/expenses/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:pendingImport.body});
   // Clear successful drafts before fetching stats so a refresh failure cannot re-submit them.
   drafts=[];pendingImport=null;$('month').value=items[items.length-1].date.slice(0,7);
   $('batchRows').innerHTML='';$('batchStatus').textContent=`已导入 ${result.imported} 笔，合计 ¥${money(result.total_cents)}；跳过 ${result.skipped} 笔重复记录。跨月记录已归入各自月份。`;
   $('ocrText').value='';toast(`已导入 ${result.imported} 笔消费`);
   try{await refresh();}catch{$('batchStatus').textContent+=' 账单已保存，统计刷新失败，请刷新网页查看。';}
 }catch(err){$('batchStatus').textContent=`${err.message}。清单已保留，可重试；同一批次重试不会重复写入。`;}
 finally{batchBusy=false;$('batchForm').querySelectorAll('input,select,button').forEach(el=>el.disabled=false);$('imageInput').disabled=false;$('recognize').disabled=!imageFiles.length;$('reparse').disabled=false;if(drafts.length)renderDrafts();else updateSummary();}
});
$('recognize').addEventListener('click',async()=>{
 if(!imageFiles.length||batchBusy)return;
 if(drafts.length&&!confirm('重新识别会替换待确认清单，继续吗？'))return;
 if(!$('referenceDate').value)return toast('请选择识别参考日期');
 $('recognize').disabled=true;$('imageInput').disabled=true;$('batchPanel').inert=true;
 const texts=[],rows=[],failures=[];
 try{
   $('ocrStatus').textContent='正在加载识别组件，首次使用可能需要一些时间…';await loadOCR();
   if(!worker)worker=await Tesseract.createWorker('chi_sim+eng',1,{logger:m=>{if(m.status==='recognizing text')$('ocrStatus').textContent=`正在识别第 ${activeImage+1}/${imageFiles.length} 张… ${Math.round(m.progress*100)}%`;}});
   for(let i=0;i<imageFiles.length;i++){
     activeImage=i;
     try{
       const result=await worker.recognize(imageFiles[i]);
       texts.push(result.data.text);
       rows.push(...ReceiptParser.parse(result.data.text,{referenceDate:$('referenceDate').value,source:`截图 ${i+1} · ${imageFiles[i].name}`}));
       if(!result.data.text.trim())failures.push(`第 ${i+1} 张没有识别到文字`);
     }catch{failures.push(`第 ${i+1} 张识别失败，请换成清晰的 PNG/JPG 重试`);}
   }
   $('ocrText').value=texts.join('\n\n');showDrafts(rows);
   $('batchStatus').textContent=rows.length?'请核对每笔数据，确认后点击“确认并批量导入”。':'未找到可识别的消费金额。可展开下方识别原文，修正文字后重新解析。';
   $('ocrStatus').textContent=`识别到 ${rows.length} 笔候选记录，请在下方清单核对。${failures.join('；')}`;
   toast(`识别到 ${rows.length} 笔，尚未保存`);$('batchPanel').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(err){$('ocrStatus').textContent=err.message||'识别失败，请检查网络或更换 PNG/JPG 截图';}
 finally{$('recognize').disabled=false;$('imageInput').disabled=false;$('batchPanel').inert=false;}
});
refresh().catch(()=>{toast('无法连接账本服务，请通过启动脚本打开网页');});
