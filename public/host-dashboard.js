(function(){
if(!new URLSearchParams(location.search).has('host'))return;
function init(){
 if(document.getElementById('ph-dashboard'))return;
 const sidebar=document.querySelector('.sidebar');if(!sidebar)return;
 // Remove the retired Manual Score Editor, without affecting Manual Scoring.
 const oldEditorHeading=[...sidebar.querySelectorAll('h1,h2,h3,h4,h5')].find(el=>el.textContent.trim().toUpperCase()==='MANUAL SCORE EDITOR');
 if(oldEditorHeading){
  const section=oldEditorHeading.closest('section,.panel,.card,.control-section')||oldEditorHeading.parentElement;
  if(section&&section!==sidebar)section.remove();
 }
 const wanted=['LIVE ONLINE LOBBY','OPENING SCREEN & QUESTION VISIBILITY','QUESTION PICKER','HOST • REVEAL AN ANSWER','MANUAL SCORING','ROUND TIMER','CUSTOMIZE GAME','TEAMS & PLAYERS','SAVE & SHARING','LIVE PLAYER BUZZERS'];
 const n=s=>(s||'').replace(/\s+/g,' ').trim().toUpperCase();
 const label=el=>{if(!el||el.nodeType!==1)return null;const h=el.matches('h1,h2,h3,h4,h5,legend')?el:el.firstElementChild?.matches('h1,h2,h3,h4,h5,legend')?el.firstElementChild:null;return h?wanted.find(x=>n(h.textContent).startsWith(x)):null};
 const style=document.createElement('style');
 style.textContent='#ph-dashboard{position:fixed;inset:0;z-index:9999;background:#081735;color:#fff;overflow:auto;padding:16px 22px 55px;font:14px system-ui,sans-serif}#ph-dashboard[hidden]{display:none}.ph-bar{position:sticky;top:-16px;z-index:10;background:#10234b;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:12px}.ph-bar strong{color:#ffce58;font-size:21px}.ph-bar button,.ph-return{background:#ffce58;border:0;border-radius:8px;padding:10px 15px;color:#11254d;font-weight:800;cursor:pointer}.ph-grid{display:flex;flex-direction:column;gap:12px;max-width:1850px;margin:16px auto}.ph-row{display:flex;gap:12px;width:100%}.ph-panel{min-width:0;display:flex;flex-direction:column;background:#12274e;border:1px solid #5877a9;border-radius:12px;position:relative;overflow:hidden}.ph-handle{padding:12px;background:#214472;color:#ffce58;cursor:grab;font-weight:900;user-select:none}.ph-content{padding:12px;overflow:auto;flex:1;min-height:70px}.ph-content>*{max-width:100%!important}.ph-content input,.ph-content select{max-width:100%;box-sizing:border-box}.ph-panel[data-hover]{outline:3px solid #ffce58;outline-offset:-3px}.ph-resize{position:absolute;right:0;bottom:0;width:24px;height:24px;cursor:nwse-resize;background:linear-gradient(135deg,transparent 45%,#ffce58 46%,#ffce58 67%,transparent 68%)}.ph-return{position:fixed;right:15px;top:15px;z-index:9998}@media(max-width:680px){.ph-row{flex-direction:column}.ph-panel{flex:1 0 auto!important}}';
 document.head.appendChild(style);
 const root=document.createElement('div');root.id='ph-dashboard';root.hidden=true;
 root.innerHTML='<div class="ph-bar"><strong>☷ PRONTO HOST PANELS</strong><div><button id="ph-reset">Reset Layout</button> <button id="ph-save">Save Layout</button> <button id="ph-game">Back to Game</button></div></div><p style="color:#bed2f5">Drag panel headings above, below or beside another panel. Resize with the gold corner. Your layout saves automatically.</p><div class="ph-grid"></div>';
 document.body.appendChild(root);
 const launcher=document.createElement('button');launcher.id='ph-edit-button';launcher.type='button';launcher.textContent='☷ Edit Layout';
 launcher.style.cssText='position:fixed;top:105px;right:18px;z-index:1500;background:#ffcf58;color:#12264a;border:0;border-radius:9px;padding:12px 17px;font-weight:900;box-shadow:0 4px 15px #0008;cursor:pointer';
 document.body.appendChild(launcher);
 const back=document.createElement('button');back.className='ph-return';back.hidden=true;back.textContent='☷ Edit Layout';document.body.appendChild(back);
 const panels=new Map();
 function add(title,els){
  if(!els.length)return;const id='panel-'+panels.size,wrap=document.createElement('section');const parent=els[0].parentNode;const marker=document.createComment('host-panel-'+id);parent.insertBefore(marker,els[0]);parent.insertBefore(wrap,els[0]);els.forEach(el=>wrap.appendChild(el));panels.set(id,{title,wrap,marker});
 }
 function group(parent,depth){
  if(depth>6)return;
  const nodes=[...parent.children].filter(el=>el!==root);
  let pending=[],title=null;
  function flush(){if(pending.length){add(title||'Other Host Controls',pending);pending=[];title=null}}
  for(const el of nodes){
   const titleFound=label(el);
   if(titleFound){flush();title=titleFound;pending.push(el);continue}
   if(el.id==='onlineLobby'){flush();add('LIVE ONLINE LOBBY',[el]);continue}
   const nested=[...el.children].filter(ch=>label(ch)).length;
   if(nested>=2||(nested===1&&nodes.length===1)){flush();group(el,depth+1);continue}
   pending.push(el);
  }
  flush();
 }
 let collected=false;
 function collect(){if(collected)return;collected=true;group(sidebar,0)}
 const all=[];

 // Twelve-column dashboard grid with explicit X/Y positions and row/column spans.
 const key='pronto-host-free-grid-v1',allSlots=12;
 let positions={},drag=null,editing=false;
 const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
 const occupied=(id,c,r,w,h)=>Object.entries(positions).some(([other,p])=>
  other!==id&&c<p.c+p.w&&c+w>p.c&&r<p.r+p.h&&r+h>p.r);
 function vacancy(id,w,h,fromC=1,fromR=1){
  for(let r=fromR;r<200;r++)for(let c=r===fromR?fromC:1;c<=allSlots-w+1;c++)
   if(!occupied(id,c,r,w,h))return {c,r,w,h};
  return {c:1,r:201,w,h};
 }
 function load(){
  all.splice(0,all.length,...panels.keys());positions={};
  try{const saved=JSON.parse(localStorage.getItem(key)||'{}');if(saved.positions&&typeof saved.positions==='object'){
   for(const id of all){const p=saved.positions[id];if(!p)continue;
    const w=clamp(Math.round(+p.w||6),1,12),h=clamp(Math.round(+p.h||2),1,12),c=clamp(Math.round(+p.c||1),1,13-w),r=clamp(Math.round(+p.r||1),1,200);
    if(!occupied(id,c,r,w,h))positions[id]={c,r,w,h};
   }
  }}catch(e){}
  all.forEach(id=>{if(!positions[id])positions[id]=vacancy(id,12,2)});
 }
 function save(){try{localStorage.setItem(key,JSON.stringify({positions}))}catch(e){}}
 function relocate(id,c,r,w=positions[id].w,h=positions[id].h){
  w=clamp(w,1,12);h=clamp(h,1,12);c=clamp(c,1,13-w);r=clamp(r,1,200);
  // Displace colliding tiles into the next free cells.
  const previous={...positions[id]};
  positions[id]={c,r,w,h};
  for(const other of all){
   if(other===id)continue;
   const p=positions[other];if(!p)continue;
   if(c<p.c+p.w&&c+w>p.c&&r<p.r+p.h&&r+h>p.r){
    const safe=vacancy(other,p.w,p.h,1,r+h);
    positions[other]=safe;
   }
  }
  save();draw();
 }
 function draw(){
  const grid=root.querySelector('.ph-grid');grid.replaceChildren();
  grid.style.cssText='display:grid;grid-template-columns:repeat(12,minmax(0,1fr));grid-auto-rows:90px;gap:12px;align-items:stretch;max-width:1900px;margin:16px auto';
  for(const id of all){
   const d=panels.get(id),p=positions[id];if(!d||!p)continue;
   const tile=document.createElement('article');tile.className='ph-panel';tile.dataset.id=id;
   tile.style.cssText='grid-column:'+p.c+' / span '+p.w+';grid-row:'+p.r+' / span '+p.h+';height:auto;min-width:0;min-height:0;display:flex;flex-direction:column';
   const head=document.createElement('div');head.className='ph-handle';head.draggable=editing;head.textContent='⠿ '+d.title;
   head.addEventListener('dragstart',e=>{if(!editing){e.preventDefault();return}drag=id;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',id)});
   head.addEventListener('dragend',()=>{drag=null;grid.querySelectorAll('[data-hover]').forEach(el=>el.removeAttribute('data-hover'))});
   tile.addEventListener('dragover',e=>{if(!editing||!drag||drag===id)return;e.preventDefault();tile.dataset.hover='true'});
   tile.addEventListener('dragleave',e=>{if(!tile.contains(e.relatedTarget))tile.removeAttribute('data-hover')});
   tile.addEventListener('drop',e=>{
    if(!editing||!drag||drag===id)return;e.preventDefault();const target=positions[id];
    const rect=tile.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width,y=(e.clientY-rect.top)/rect.height;
    const source=positions[drag];
    if(y>=.25&&y<=.75&&(x<.33||x>.67)){
     // Two full-width panels can be split into equal columns by a side drop.
     const half=Math.max(1,Math.floor(target.w/2));
     if(target.w>=2){
      if(x<.33){
       positions[id]={...target,c:target.c+half,w:target.w-half};
       positions[drag]={c:target.c,r:target.r,w:half,h:source.h};
      }else{
       positions[id]={...target,w:half};
       positions[drag]={c:target.c+half,r:target.r,w:target.w-half,h:source.h};
      }
      // Repair collisions with any other panels.
      for(const other of all){
       if(other===id||other===drag)continue;
       const p=positions[other];if(p&&occupied(other,p.c,p.r,p.w,p.h))
        positions[other]=vacancy(other,p.w,p.h,1,target.r+Math.max(target.h,source.h));
      }
      save();draw();drag=null;return;
     }
    }
    const c=x<.33?Math.max(1,target.c-source.w):x>.67?target.c+target.w:target.c;
    const r=y<.25?Math.max(1,target.r-source.h):y>.75?target.r+target.h:target.r;
    relocate(drag,c,r);drag=null;
   });
   const content=document.createElement('div');content.className='ph-content';content.appendChild(d.wrap);
   const resize=document.createElement('div');resize.className='ph-resize';resize.title='Resize width and height';resize.hidden=!editing;resize.style.display=editing?'block':'none';
   resize.addEventListener('pointerdown',e=>{
    if(!editing)return;e.preventDefault();e.stopPropagation();
    const startX=e.clientX,startY=e.clientY,original={...positions[id]},rect=grid.getBoundingClientRect();
    const colPx=(rect.width-11*12)/12,rowPx=102;
    resize.setPointerCapture(e.pointerId);
    const move=ev=>{
     const w=clamp(original.w+Math.round((ev.clientX-startX)/colPx),1,13-original.c);
     const h=clamp(original.h+Math.round((ev.clientY-startY)/rowPx),1,12);
     tile.style.gridColumn=original.c+' / span '+w;tile.style.gridRow=original.r+' / span '+h;
    };
    const done=ev=>{
     resize.removeEventListener('pointermove',move);resize.removeEventListener('pointerup',done);resize.removeEventListener('pointercancel',done);
     const w=clamp(original.w+Math.round((ev.clientX-startX)/colPx),1,13-original.c);
     const h=clamp(original.h+Math.round((ev.clientY-startY)/rowPx),1,12);
     relocate(id,original.c,original.r,w,h);
    };
    resize.addEventListener('pointermove',move);resize.addEventListener('pointerup',done);resize.addEventListener('pointercancel',done);
   });
   tile.append(head,content,resize);grid.appendChild(tile);
  }
 }
 function enterEdit(){
  collect();if(!all.length)load();
  editing=true;root.querySelector('#ph-save').textContent='Save Layout';root.hidden=false;launcher.hidden=true;back.hidden=true;draw();
 }
 function finishEdit(){
  editing=false;save();draw();root.querySelector('#ph-save').textContent='Edit Layout';
 }
 function restore(){
  for(const item of panels.values()) {
   // Move controls back to the original sidebar locations, preserving live listeners.
   item.marker.replaceWith(...item.wrap.children);
   item.wrap.remove();
  }
  panels.clear();collected=false;all.length=0;
  root.hidden=true;launcher.hidden=false;back.hidden=true;
  positions={};
 }
 launcher.onclick=enterEdit;
 root.querySelector('#ph-reset').onclick=()=>{positions={};all.forEach(id=>positions[id]=vacancy(id,12,2));save();draw()};
 root.querySelector('#ph-save').onclick=()=>{if(editing){finishEdit()}else{editing=true;draw();root.querySelector('#ph-save').textContent='Save Layout'}};
 root.querySelector('#ph-game').onclick=restore;
 back.onclick=enterEdit;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.addEventListener('load',init,{once:true});
})();