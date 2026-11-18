import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../public/onatili-firebase.js',import.meta.url),'utf8').replace(/import\s*\{[\s\S]*?\}\s*from\s*'[^']+';/g,'').replace('void begin();','');
function sandbox(){
  const records=new Map(),nodes=new Map();
  const context=vm.createContext({console,AbortController,AbortSignal,crypto,URL,Request,Date,Intl,Map,Promise,setTimeout,clearTimeout,requestAnimationFrame:fn=>fn(),localStorage:{getItem:k=>records.get(k)||null,setItem:(k,v)=>records.set(k,v),removeItem:k=>records.delete(k)},document:{querySelector:s=>nodes.get(s)||null,querySelectorAll:()=>[],activeElement:null},window:{setTimeout,clearTimeout},getDoc:async()=>({exists:()=>false}),setDoc:async()=>{},doc:(_db,...parts)=>parts.join('/'),serverTimestamp:()=>({seconds:1})});
  vm.runInContext(source,context);return{context,records,nodes,run:code=>vm.runInContext(code,context)};
}
test('cancelling playback resolves active audio and frees the button',async()=>{
  const s=sandbox();
  s.run("window.AudioContext=function(){};TUTOR_TTS.context={state:'running',decodeAudioData:async()=>({}),destination:{},createBufferSource(){return {connect(){},disconnect(){},start(){},stop(){}}}}");
  const playing=s.run('playTutorAudio(new ArrayBuffer(8),0)');
  await new Promise(resolve=>setTimeout(resolve,1));
  s.run('stopTutorVoice()');
  await Promise.race([playing,new Promise((_,reject)=>setTimeout(()=>reject(Error('playback hung')),100))]);
  assert.equal(s.run('TUTOR_TTS.source'),null);
});
test('pending results deduplicate, remain bound to user, and preserve new arrivals during flush',async()=>{
  const s=sandbox();
  s.run("STATE.db={};STATE.user={uid:'alice'};queueRecord({id:'one',bucket:'attempts',owner:'alice',payload:{points:1}});queueRecord({id:'one',bucket:'attempts',owner:'alice',payload:{points:1}});queueRecord({id:'private-bob',bucket:'attempts',owner:'bob',payload:{points:2}})");
  assert.equal(s.run('pendingRecords().length'),2);
  s.context.getDoc=async()=>{s.run("queueRecord({id:'new',bucket:'essays',owner:'alice',payload:{score:3}})");return{exists:()=>false}};
  await s.run('flushPendingRecords()');
  assert.deepEqual(Array.from(s.run('pendingRecords().map(x=>x.id)')),['private-bob','new']);
});
test('guest records require explicit import and are not auto-attached to another account',async()=>{
  const s=sandbox();s.run("STATE.db={};STATE.user={uid:'alice'};queueRecord({id:'guest',bucket:'attempts',owner:null,payload:{points:1}})");
  await s.run('flushPendingRecords()');assert.equal(s.run('pendingRecords().length'),1);
  await s.run('flushPendingRecords(true)');assert.equal(s.run('pendingRecords().length'),0);
});
test('modal close wins over CSS display and remains keyboard accessible',()=>{
  const s=sandbox(),style={setProperty(k,v,p){this[k]=v;this.priority=p;}};
  const modal={hidden:false,style,setAttribute(k,v){this[k]=v;},contains:()=>false};
  s.nodes.set('#authModal',modal);s.run('closeModal()');assert.equal(modal.hidden,true);assert.equal(style.display,'none');assert.equal(style.priority,'important');assert.equal(modal['aria-hidden'],'true');
});

test('community renders an empty list and binds every published question and essay action',async()=>{
  const s=sandbox();
  const listeners=[], appended=[];
  let populated=false;
  const questions=[{id:'q1',question:'Sinov savoli',options:['A','B','C','D'],correctIndex:1}];
  const topics=[{id:'t1',title:'Sinov mavzusi',prompt:'Ikki qarashni solishtiring.'}];
  s.nodes.set('#communityContent',{
    innerHTML:'',
    querySelector:()=>null,
    querySelectorAll(selector){
      if(!populated)return [];
      if(selector==='[data-community-question]')return Array.from({length:4},()=>({addEventListener:(type,fn)=>listeners.push({type,fn})}));
      return [{append:button=>appended.push(button)}];
    }
  });
  s.context.published=()=>({questions:populated?questions:[],topics:populated?topics:[],announcement:null});
  s.run('readPublishedContent=async()=>published()');
  await s.run('renderCommunity()');
  assert.match(s.nodes.get('#communityContent').innerHTML,/Hozircha yangi esse mavzusi yo‘q/);
  populated=true;
  s.context.document.createElement=()=>({dataset:{}});
  const select={options:[],append(option){this.options.push(option)}};
  s.nodes.set('#essayTopic',select);
  let route;
  s.context.window.setRoute=value=>{route=value};
  await s.run('renderCommunity()');
  assert.equal(listeners.length,4);
  assert.ok(listeners.every(item=>item.type==='click'&&typeof item.fn==='function'));
  assert.equal(appended.length,1);
  appended[0].onclick();
  assert.equal(route,'essay');
  assert.equal(select.value,'community-t1');
  assert.equal(select.options[0].dataset.prompt,topics[0].prompt);
});
