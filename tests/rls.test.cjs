// Real PostgreSQL semantics in an in-memory PGlite database, not a hosted Supabase test.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('SQL schema compiles; anonymous and another account cannot read or alter owned data; RPC is idempotent',async()=>{
 const db=new PGlite(),A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',id='11111111-1111-4111-8111-111111111111';
 try{
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to anon,authenticated; insert into auth.users values('${A}'),('${B}');`);
  await db.exec(fs.readFileSync('supabase/schema.sql','utf8'));
  const as=async(uid,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec('set role '+role);};
  const apply=(payload,base=0,mutation=crypto.randomUUID())=>db.query('select public.qj_apply_document($1,$2,$3,$4,$5,$6) as result',[id,'entry',payload,false,base,mutation]);
  const entry={type:'expense',cents:1500,date:'2026-11-25T12:00',category:'饮食',merchant:'Synthetic'};
  await as(A);const mutation=crypto.randomUUID();const first=(await apply(entry,0,mutation)).rows[0].result;
  assert.equal(first.status,'saved');assert.equal(first.document.owner_id,A);
  assert.deepEqual((await apply(entry,0,mutation)).rows[0].result,first);
  const conflict=(await apply({...entry,cents:2000},0)).rows[0].result;assert.equal(conflict.status,'conflict');assert.equal(conflict.current.payload.cents,1500);
  const second=(await apply({...entry,cents:2000},1)).rows[0].result;assert.equal(second.document.revision,2);
  await as('', 'anon');await assert.rejects(db.query('select * from public.qj_documents'),/permission denied/);
  await assert.rejects(apply(entry),/permission denied/);
  await as(B);assert.equal((await db.query('select * from public.qj_documents')).rows.length,0);assert.equal((await db.query('select * from public.qj_mutations')).rows.length,0);
  await assert.rejects(db.query('insert into public.qj_documents(owner_id,id,kind,payload) values($1,$2,$3,$4)',[A,crypto.randomUUID(),'entry',entry]),/row-level security/);
  assert.equal((await db.query('update public.qj_documents set deleted=true where owner_id=$1 returning id',[A])).rows.length,0);
  await as(A);assert.equal((await db.query('select * from public.qj_documents')).rows[0].payload.cents,2000);
  await assert.rejects(apply({...entry,cents:1.5},2),/check constraint/);
  await assert.rejects(apply({date:'2026-11-25T12:00'},2),/check constraint/);
 }finally{await db.close();}
});
