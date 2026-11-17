import { randomUUID } from 'node:crypto';
import { requireAdmin, sameOrigin, respondError, HttpError, rateLimit } from '../lib/auth.js';

export function validateContent(data, uid, now = new Date().toISOString()) {
  const str = (key, max, required = true) => {
    const value = typeof data[key] === 'string' ? data[key].trim() : '';
    if ((required && !value) || value.length > max) throw new HttpError(400, 'Maydonlarni to‘liq va belgilangan hajmda kiriting.');
    return value;
  };
  if (data.action === 'question') {
    const options = data.options;
    if (!Array.isArray(options) || options.length !== 4 || options.some(x=>typeof x!=='string'||!x.trim()||x.length>500) || !Number.isInteger(data.correctIndex) || data.correctIndex<0 || data.correctIndex>3) throw new HttpError(400, 'To‘rtta variant va to‘g‘ri javobni belgilang.');
    return { collection: 'contentQuestions', id: randomUUID(), fields: { category:str('category',80), question:str('question',2000), options:options.map(x=>x.trim()), correctIndex:data.correctIndex, explanation:str('explanation',3000,false), published:true, createdAt:{timestampValue:now}, updatedAt:{timestampValue:now}, createdBy:uid } };
  }
  if (data.action === 'essay') return { collection:'contentEssayTopics',id:randomUUID(),fields:{title:str('title',200),prompt:str('prompt',4000),published:true,createdAt:{timestampValue:now},updatedAt:{timestampValue:now},createdBy:uid} };
  if (data.action === 'announcement') return { collection:'siteSettings',id:'announcement',merge:true,fields:{message:str('message',600,!!data.active),active:data.active===true,updatedAt:{timestampValue:now},updatedBy:uid} };
  if (data.action === 'hide') {
    if (!['question','topic'].includes(data.kind) || !/^[A-Za-z0-9_-]{1,100}$/.test(data.id)) throw new HttpError(400,'Material topilmadi.');
    return {collection:data.kind==='question'?'contentQuestions':'contentEssayTopics',id:data.id,merge:true,fields:{published:false,updatedAt:{timestampValue:now},updatedBy:uid}};
  }
  throw new HttpError(400,'Amal noto‘g‘ri.');
}
function field(value) {
  if (typeof value==='string') return {stringValue:value};
  if (typeof value==='boolean') return {booleanValue:value};
  if (typeof value==='number') return {integerValue:String(value)};
  if (Array.isArray(value)) return {arrayValue:{values:value.map(field)}};
  return value;
}
export default async function handler(req,res) {
  res.setHeader('cache-control','no-store');
  try {
    if(req.method!=='POST'){res.setHeader('allow','POST');throw new HttpError(405,'Faqat POST so‘rovi qabul qilinadi.');}
    sameOrigin(req);
    const user=await requireAdmin(req); rateLimit('content:'+user.uid,20);
    const item=validateContent(req.body||{},user.uid);
    const base='https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(process.env.FIREBASE_PROJECT_ID)+'/databases/(default)/documents/';
    const url=new URL(base+item.collection+'/'+item.id);
    if(item.merge)Object.keys(item.fields).forEach(key=>url.searchParams.append('updateMask.fieldPaths',key));
    else url.searchParams.set('currentDocument.exists','false');
    const response=await fetch(url,{method:'PATCH',signal:AbortSignal.timeout(10000),headers:{authorization:'Bearer '+user.token,'content-type':'application/json'},body:JSON.stringify({fields:Object.fromEntries(Object.entries(item.fields).map(([key,value])=>[key,field(value)]))})});
    if(!response.ok)throw new HttpError(response.status===403?403:503,'Material saqlanmadi. Hisob ruxsatini yoki internetni tekshiring.');
    res.status(200).json({ok:true,id:item.id});
  }catch(error){respondError(res,error);}
}
