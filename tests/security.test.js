import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { requireUser, validateClaims, sessionCookie, hasAdminSession, sameOrigin } from '../lib/auth.js';
import { validateContent } from '../api/admin-content.js';
import admin from '../api/admin-unlock.js';
import tts from '../api/elevenlabs-tts.js';
import preview from '../api/elevenlabs-voice-preview.js';
import { forwardedHeaders, transformHtml, upstreamUrl } from '../api/proxy.js';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const clock=Math.floor(Date.now()/1000);
const claims={sub:'owner123',aud:'test-project',iss:'https://securetoken.google.com/test-project',iat:clock,auth_time:clock,exp:clock+3600,email:'owner@example.test',email_verified:true,firebase:{sign_in_provider:'google.com'}};
process.env.FIREBASE_PROJECT_ID='test-project';process.env.ADMIN_EMAIL='owner@example.test';
process.env.ADMIN_PANEL_PASSWORD='test-pin';process.env.ADMIN_SESSION_SECRET='a'.repeat(64);
function token(overrides={}){const header=Buffer.from(JSON.stringify({alg:'RS256',kid:'test'})).toString('base64url'),body=Buffer.from(JSON.stringify({...claims,...overrides})).toString('base64url');return header+'.'+body+'.'+sign('RSA-SHA256',Buffer.from(header+'.'+body),privateKey).toString('base64url');}
function response(){return{code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(data){this.data=data;return this;}};}
test('Firebase signature, project, verified Google provider and expiry are enforced',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({test:publicKey.export({type:'spki',format:'pem'})},{headers:{'cache-control':'max-age=300'}});
  try{
    assert.equal((await requireUser({headers:{authorization:'Bearer '+token()}})).uid,'owner123');
    for(const bad of [{aud:'other'}, {iss:'wrong'}, {exp:clock-1}, {email_verified:false}, {firebase:{sign_in_provider:'password'}}])await assert.rejects(()=>requireUser({headers:{authorization:'Bearer '+token(bad)}}));
    const forged=token().split('.');forged[1]=Buffer.from(JSON.stringify({...claims,sub:'intruder'})).toString('base64url');
    await assert.rejects(()=>requireUser({headers:{authorization:'Bearer '+forged.join('.')}}));
    assert.throws(()=>validateClaims({...claims,exp:'999999999999'},'test-project'));
  }finally{globalThis.fetch=original;}
});
test('admin requires owner token before password; correct password establishes bound expiring session',async()=>{
  let res=response();await admin({method:'POST',headers:{},body:{password:'test-pin'}},res);assert.equal(res.code,401);
  res=response();await admin({method:'POST',headers:{authorization:'Bearer '+token({email:'other@example.test'})},body:{password:'test-pin'}},res);assert.equal(res.code,403);
  res=response();await admin({method:'POST',headers:{authorization:'Bearer '+token()},body:{password:'wrong'}},res);assert.equal(res.code,401);assert.match(res.data.error,/Parol xato/);
  res=response();await admin({method:'POST',headers:{authorization:'Bearer '+token()},body:{password:'test-pin'}},res);assert.equal(res.code,200);assert.equal(res.data.unlocked,true);
  assert.match(res.headers['set-cookie'],/HttpOnly; SameSite=Strict/);
  const cookie=sessionCookie('owner123',1000).split(';')[0];
  assert.equal(hasAdminSession({headers:{cookie}},'owner123',2000),true);
  assert.equal(hasAdminSession({headers:{cookie}},'another',2000),false);
  assert.equal(hasAdminSession({headers:{cookie}},'owner123',2000000),false);
  assert.equal(hasAdminSession({headers:{cookie:cookie+'x'}},'owner123',2000),false);
});
test('cross-site requests and invalid content cannot publish',()=>{
  assert.throws(()=>sameOrigin({headers:{host:'example.test',origin:'https://evil.test'}}));
  assert.throws(()=>validateContent({action:'question',options:['a'],correctIndex:4},'owner123'));
  assert.throws(()=>validateContent({action:'hide',kind:'question',id:'../users/private'},'owner123'));
  const item=validateContent({action:'essay',title:'Mavzu',prompt:'Ikki qarash'},'owner123');
  assert.equal(item.fields.createdBy,'owner123');assert.equal(item.collection,'contentEssayTopics');
  assert.equal(validateContent({action:'hide',kind:'topic',id:'abc'},'owner123').fields.published,false);
});
test('voice endpoints reject anonymous cost-generating requests and prototype voice names',async()=>{
  let res=response();await tts({method:'POST',headers:{},body:{text:'Salom'}},res);assert.equal(res.code,401);
  res=response();await preview({method:'GET',headers:{},query:{voice:'constructor'}},res);assert.equal(res.code,404);
  res=response();await preview({method:'GET',headers:{},query:{list:'1'}},res);assert.equal(res.data.voices.length,5);
});
test('proxy does not forward identity, cookies, authorization, or arbitrary domains',()=>{
  const request=new Request('https://example.test/api/proxy?path=api/me',{headers:{authorization:'Bearer secret',cookie:'private=secret','oai-authenticated-user-id':'spoof','x-onatili-visitor':'v_abc',accept:'application/json'}});
  const headers=forwardedHeaders(request);assert.equal(headers.get('authorization'),null);assert.equal(headers.get('cookie'),null);assert.equal(headers.get('oai-authenticated-user-id'),null);
  assert.equal(headers.get('x-onatili-visitor'),'v_abc');assert.equal(upstreamUrl(request).pathname,'/api/me');
  const html=transformHtml('<html><head></head><body></body></html>');assert.match(html,/ONATILI_FIREBASE=true/);assert.match(html,/audit-20261117/);
});
