'use strict';
const $ = id => document.getElementById(id);
const categories = ['餐饮','购物','交通','居住','娱乐','健康','学习','其他'];
const icons = ['♨','▧','↗','⌂','♫','♡','▤','⋯'];
const colors = ['#53765b','#a4b58b','#d4bd83','#9dacc0','#b0a1bd','#c89786','#82aaa3','#d0d2c5'];
let records = [], selected = '餐饮', filter = '全部', imageFile = null, worker = null;
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
function setTab(scan){$('scanArea').hidden=!scan;$('scanTab').classList.toggle('active',scan);$('manualTab').classList.toggle('active',!scan);}
$('scanTab').onclick=()=>setTab(true);$('manualTab').onclick=()=>setTab(false);
$('imageInput').addEventListener('change',()=>{imageFile=$('imageInput').files[0];$('recognize').disabled=!imageFile;if(!imageFile)return;if(imageFile.size>20*1024*1024){toast('请选择小于 20 MB 的截图');$('recognize').disabled=true;return;}if($('preview').dataset.url)URL.revokeObjectURL($('preview').dataset.url);const url=URL.createObjectURL(imageFile);$('preview').src=url;$('preview').dataset.url=url;$('preview').hidden=false;$('ocrStatus').textContent='截图已就绪。识别结果需要你确认后保存。';});
function loadOCR(){if(window.Tesseract)return Promise.resolve();return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';s.onload=resolve;s.onerror=()=>{s.remove();reject(new Error('识别组件下载失败，请检查网络后重试'));};document.head.appendChild(s);});}
function parseReceipt(text){
 const compact=text.replace(/[ \t]/g,'');
 const amount=compact.match(/(?:实付金额|付款金额|支付金额|支出金额|实付款|金额)[：:]?[¥￥]?[-−]?(\d+(?:[.,]\d{1,2})?)/)||compact.match(/[¥￥][-−]?(\d+(?:[.,]\d{1,2})?)/)||compact.match(/[-−](\d+\.\d{2})/);
 if(amount)$('amount').value=amount[1].replace(',','.');else $('amount').value='';
 const date=compact.match(/(20\d{2})[年/.-](\d{1,2})[月/.-](\d{1,2})日?\s*(\d{1,2}):(\d{2})/);
 if(date)$('date').value=`${date[1]}-${date[2].padStart(2,'0')}-${date[3].padStart(2,'0')}T${date[4].padStart(2,'0')}:${date[5]}`;
 else $('date').value=localDate();
 const merchant=compact.match(/(?:商户全称|商户名称|收款方|收款商户)[：:]?([^\n\r]{2,60})/);$('merchant').value=merchant?merchant[1]:'';
 const rules={'餐饮':/餐|咖啡|奶茶|外卖|美团|饿了么|麦当劳|肯德基/,'交通':/地铁|公交|打车|滴滴|车票|铁路|加油/,'购物':/淘宝|京东|拼多多|超市|商场/,'居住':/房租|水费|电费|燃气|物业/,'娱乐':/电影|游戏|会员|影院/,'健康':/医院|药|诊所/,'学习':/书店|课程|学费/};selectCategory(Object.keys(rules).find(c=>rules[c].test(compact))||'其他');
 const flags=[];if(!amount)flags.push('未识别到金额，请手动填写');if(!date)flags.push('未识别到时间，暂填当前时间');if(/退款|收入|转账|充值/.test(compact))flags.push('可能包含退款、收入或转账，请确认是否属于支出');
 $('ocrStatus').textContent=`已提取信息，请核对金额、分类和时间后保存。${flags.length?' '+flags.join('；')+'。':''}`;
}
$('recognize').addEventListener('click',async()=>{if(!imageFile)return;$('recognize').disabled=true;try{$('ocrStatus').textContent='正在加载识别组件，首次使用可能需要一些时间…';await loadOCR();if(!worker)worker=await Tesseract.createWorker('chi_sim+eng',1,{logger:m=>{if(m.status==='recognizing text')$('ocrStatus').textContent=`正在识别截图… ${Math.round(m.progress*100)}%`;}});const result=await worker.recognize(imageFile);if(!result.data.text.trim())throw new Error('未识别到文字，请换一张清晰的单笔账单截图');parseReceipt(result.data.text);toast('识别完成，请核对后保存');}catch(err){$('ocrStatus').textContent=err.message||'识别失败，请更换 PNG/JPG 截图或手动填写';}finally{$('recognize').disabled=false;}});
refresh().catch(()=>{toast('无法连接账本服务，请通过启动脚本打开网页');});
