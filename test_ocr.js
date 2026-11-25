// Optional integration check: install Tesseract.js into data/ocr-runtime first.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createWorker}=require('./data/ocr-runtime/node_modules/tesseract.js');
const {parse}=require('./web/receipt-parser.js');
(async()=>{
  const worker=await createWorker('chi_sim+eng',1,{cachePath:path.join(__dirname,'data')});
  try{
    const {data}=await worker.recognize(path.join(__dirname,'data/synthetic-receipt.png'));
    fs.writeFileSync(path.join(__dirname,'data/ocr-test-text.txt'),data.text);
    const rows=parse(data.text,{referenceDate:'2026-10-23'});
    fs.writeFileSync(path.join(__dirname,'data/ocr-test-rows.json'),JSON.stringify(rows,null,2));
    assert.equal(rows.length,3,'Expected three expenses from synthetic image');
    assert.deepEqual(rows.map(r=>r.amount),['70.00','4.00','28.00']);
    assert.deepEqual(rows.map(r=>r.date),['2026-10-21T16:15','2026-10-22T08:10','2026-10-23T12:30']);
    console.log('OCR image → three sorted expenses: passed');
  }finally{await worker.terminate();}
})().catch(error=>{console.error(error);process.exitCode=1;});
