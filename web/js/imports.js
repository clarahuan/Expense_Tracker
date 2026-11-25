(function(root){
 'use strict';
 function draft(name,amount,date,opts={}){const type=opts.type||(/收入|工资|奖学金|生活费|家教|兼职/.test(name)?'income':'expense');return {id:Q.uuid(),type,cents:Q.cents(amount),date,category:Q.classify(name,type,opts.rules),merchant:name.trim(),note:'',method:'',source:opts.source||'text',warnings:[],included:true,...opts};}
 function parseText(text,{referenceDate=Q.localDate().slice(0,10),rules=[]}={}){
   const rows=[],failures=[];
   for(const line of text.normalize('NFKC').split(/[\n;；]/).map(s=>s.trim()).filter(Boolean)){
     const history=line.match(/^(?:(20\d{2})[./年-])?(\d{1,2})[./月-](\d{1,2})日?\s*[,，]\s*(\d+(?:\.\d{1,2})?)\s*(?:元)?\s*(?:\((.*)\))?\s*$/);
     if(history){
       const [,year,m,d,totalText,detail='']=history;const date=`${year||referenceDate.slice(0,4)}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T12:00`;
       if(!Q.validDate(date)){failures.push(line+'：日期无效');continue;}
       // A zero-spend day without details is valid, but creates no transaction.
       if(Number(totalText)===0&&!detail.trim())continue;
       const total=Q.cents(totalText);if(!total){failures.push(line+'：总金额必须大于零');continue;}
       const details=[],invalid=[];let sum=0;
       const parts=detail.split(/[,，、]/).map(s=>s.trim()).filter(Boolean);
       // One name without an amount labels the entire day's total, not a food remainder.
       const namedTotal=parts.length===1&&!/[\d()]/.test(parts[0])&&/\p{L}/u.test(parts[0])&&!/[¥￥]/.test(parts[0]);
       if(namedTotal){
         details.push(draft(parts[0],totalText,date,{rules,type:'expense'}));sum=total;
         details[0].warnings.push('括号内仅有名称，已将当日总额归入这一笔，请核对分类');
       }else{
         for(const part of parts){const found=part.match(/^(.+?)\s*(\d+(?:\.\d{1,2})?)\s*元?$/);const value=found&&Q.cents(found[2]);if(!value){invalid.push(part);continue;}sum+=value;details.push(draft(found[1],found[2],date,{rules,type:'expense'}));}
       }
       if(invalid.length||sum>total){failures.push(line+'：明细无法识别或超过当天总额，请修正后重新解析');continue;}
       if(total>sum)details.push(draft('饮食（当日余额）',((total-sum)/100).toFixed(2),date,{rules,type:'expense',category:'饮食'}));
       for(const row of details){row.note='历史每日总额拆分；原文：'+line;row.warnings.push('时间暂填 12:00，请核对'+(year?'':'；年份取参考年份'));}
       rows.push(...details);continue;
     }
     const parts=line.split(/[,，。]/).map(s=>s.trim()).filter(Boolean);
     for(let part of parts){
       let rowDate=referenceDate;const relative=part.match(/^(今天|昨天|前天)\s*/);if(relative){const base=new Date(referenceDate+'T12:00');base.setDate(base.getDate()-({'今天':0,'昨天':1,'前天':2}[relative[1]]));rowDate=`${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,'0')}-${String(base.getDate()).padStart(2,'0')}`;part=part.slice(relative[0].length);}
       const match=part.match(/^(.+?)\s*(\d+(?:\.\d{1,2})?)\s*元?$/);
       if(!match){failures.push(part+'：未识别到明确的名称和金额');continue;}
       const row=draft(match[1],match[2],rowDate+'T'+Q.localDate().slice(11),{rules});
       if(!row.cents)failures.push(part+'：金额无效');else rows.push(row);
     }
   }
   return {rows:rows.sort((a,b)=>a.date.localeCompare(b.date)),failures};
 }
 function parseCSV(text){
   text=text.replace(/^\ufeff/,'');const rows=[];let row=[],field='',quoted=false;
   for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else if(quoted||field==='')quoted=!quoted;else field+=c;}else if(c===','&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(v=>v.trim()))rows.push(row);row=[];field='';}else field+=c;}
   if(quoted)throw Error('CSV 引号未闭合，请检查文件');row.push(field);if(row.some(v=>v.trim()))rows.push(row);return rows;
 }
 const aliases={date:['交易时间','交易创建时间','付款时间','时间','日期'],amount:['金额(元)','金额（元）','金额','金额(人民币)','金额（人民币）','交易金额'],type:['收/支','收支','类型','收支类型'],merchant:['交易对方','商户名称','交易对象','名称','对方名称'],note:['商品','商品名称','商品说明','备注','说明'],method:['支付方式','收/付款方式','付款方式'],external_id:['交易单号','交易订单号','订单号','原始交易号'],status:['交易状态','状态']};
 const normalize=s=>String(s||'').trim().replace(/[\s\u200b]/g,'').replace(/（/g,'(').replace(/）/g,')');
 function detectColumns(matrix){let header=-1,mapping={};for(let i=0;i<Math.min(matrix.length,60);i++){const candidate={};for(const [key,names] of Object.entries(aliases)){candidate[key]=matrix[i].findIndex(c=>names.some(n=>normalize(n)===normalize(c)));}if(candidate.date>=0&&candidate.amount>=0){header=i;mapping=candidate;break;}}return {header,mapping};}
 function billDate(value){let s=String(value||'').trim().replace(/\//g,'-').replace(/年|月/g,'-').replace(/日/g,'').replace(' ','T');const m=s.match(/^(20\d{2})-(\d{1,2})-(\d{1,2})(?:T(\d{1,2}):(\d{2})(?::\d{2})?)?/);if(!m)return '';return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}T${(m[4]||'12').padStart(2,'0')}:${m[5]||'00'}`;}
 function parseBills(matrix,header,mapping,rules=[]){
   if(header<0||mapping.date<0||mapping.amount<0)throw Error('请先指定表头行、日期列和金额列');
   const rows=[],failures=[];let skipped=0;
   for(let i=header+1;i<matrix.length;i++){
     const cells=matrix[i],get=k=>String(cells[mapping[k]]??'').trim();if(!get('date')&&!get('amount'))continue;
     const text=cells.join(' '),date=billDate(get('date')),amount=get('amount').replace(/^[+\-]/,'');
     const neutral=/退款|转账|充值|提现|不计收支|信用卡还款|已关闭|失败|撤销/.test(text)||/不计/.test(get('type'));
     const type=/收入|收款/.test(get('type'))?'income':'expense';
     const row=draft(get('merchant')||get('note')||'待确认交易',amount,date,{rules,type,category:Q.classify(get('merchant')+' '+get('note'),type,rules),note:get('note'),method:get('method'),external_id:get('external_id'),source:'bill-file',included:!neutral&&mapping.type>=0&&!!get('type')});
     if(!date||!Q.validDate(date)||!row.cents){failures.push(`第 ${i+1} 行：日期或金额无法解析`);continue;}
     if(neutral){row.warnings.push('退款 / 转账 / 资金移动 / 非成功交易默认不计入，请核对原交易');skipped++;}
     if(mapping.type<0||!get('type'))row.warnings.push('缺少收支类型，暂按支出，请核对');
     if(!/\d{1,2}:\d{2}/.test(get('date')))row.warnings.push('缺少时刻，暂填 12:00');
     rows.push(row);
   }return {rows,failures,skipped};
 }
 function parseBackup(payload){
   if(payload.format==='qingji-legacy'||Array.isArray(payload)||Array.isArray(payload.expenses))return {rows:Q.legacyRows(payload),settings:null};
   if(payload.format!=='qingji-backup'||payload.version!==2||!Array.isArray(payload.documents))throw Error('不是受支持的轻记 JSON 备份');
   const rows=payload.documents.filter(d=>d.kind==='entry').map(d=>({...Q.validateEntry(d.payload),restore_id:d.id,was_deleted:!!d.deleted,warnings:d.deleted?['备份中的已删除账单，导入后仍放在回收站，不计入统计']:[]}));
   const settings=payload.documents.find(d=>d.kind==='settings'&&!d.deleted)?.payload;
   return {rows,settings:settings?Q.validateSettings(settings):null};
 }
 const api={parseText,parseCSV,detectColumns,parseBills,billDate,parseBackup};
 if(typeof module!=='undefined')module.exports=api;else root.Importers=api;
})(typeof window!=='undefined'?window:globalThis);
