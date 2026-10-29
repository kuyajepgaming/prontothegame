(function(){
if(!new URLSearchParams(location.search).has('host'))return;
function init(){
 if(document.getElementById('ph-dashboard'))return;
 const sidebar=document.querySelector('.sidebar');if(!sidebar)return;
 const wanted=['LIVE ONLINE LOBBY','OPENING SCREEN & QUESTION VISIBILITY','QUESTION PICKER','HOST • REVEAL AN ANSWER','MANUAL SCORE EDITOR','MANUAL SCORING','ROUND TIMER','CUSTOMIZE GAME','TEAMS & PLAYERS','SAVE & SHARING','LIVE PLAYER BUZZERS'];
 const n=s=>(s||'').replace(/\s+/g,' ').trim().toUpperCase();
 const label=el=>{if(!el||el.nodeType!==1)return null;const h=el.matches('h1,h2,h3,h4,h5,legend')?el:el.firstElementChild?.matches('h1,h2,h3,h4,h5,legend')?el.firstElementChild:null;return h?wanted.find(x=>n(h.textContent).startsWith(x)):null};
 const style=document.createElement('style');
 style.textContent='#ph-dashboard{position:fixed;inset:0;z-index:9999;background:#081735;color:#fff;overflow:auto;padding:16px 22px 55px;font:14px system-ui,sans-serif}#ph-dashboard[hidden]{display:none}.ph-bar{position:sticky;top:-16px;z-index:10;background:#10234b;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:12px}.ph-bar strong{color:#ffce58;font-size:21px}.ph-bar button,.ph-return{background:#ffce58;border:0;border-radius:8px;padding:10px 15px;color:#11254d;font-weight:800;cursor:pointer}.ph-grid{display:flex;flex-direction:column;gap:12px;max-width:1850px;margin:16px auto}.ph-row{display:flex;gap:12px;width:100%}.ph-panel{min-width:0;display:flex;flex-direction:column;background:#12274e;border:1px solid #5877a9;border-radius:12px;position:relative;overflow:hidden}.ph-handle{padding:12px;background:#214472;color:#ffce58;cursor:grab;font-weight:900;user-select:none}.ph-content{padding:12px;overflow:auto;flex:1;min-height:70px}.ph-content>*{max-width:100%!important}.ph-content input,.ph-content select{max-width:100%;box-sizing:border-box}.ph-panel[data-hover]{outline:3px solid #ffce58;outline-offset:-3px}.ph-resize{position:absolute;right:0;bottom:0;width:24px;height:24px;cursor:nwse-resize;background:linear-gradient(135deg,transparent 45%,#ffce58 46%,#ffce58 67%,transparent 68%)}.ph-return{position:fixed;right:15px;top:15px;z-index:9998}@media(max-width:680px){.ph-row{flex-direction:column}.ph-panel{flex:1 0 auto!important}}';
 document.head.appendChild(style);
 const root=document.createElement('div');root.id='ph-dashboard';
 root.innerHTML='<div class="ph-bar"><strong>☷ PRONTO HOST PANELS</strong><div><button id="ph-reset">Reset Layout</button> <button id="ph-game">Show Game Board</button></div></div><p style="color:#bed2f5">Drag panel headings above, below or beside another panel. Resize with the gold corner. Your layout saves automatically.</p><div class="ph-grid"></div>';
 document.body.appendChild(root);
 const back=document.createElement('button');back.className='ph-return';back.hidden=true;back.textContent='☷ Host Panels';document.body.appendChild(back);
 const panels=new Map();
 function add(title,els){
  if(!els.length)return;const id='panel-'+panels.size,wrap=document.createElement('section');const parent=els[0].parentNode;parent.insertBefore(wrap,els[0]);els.forEach(el=>wrap.appendChild(el));panels.set(id,{title,wrap});
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
 group(sidebar,0);
 const all=[...panels.keys()];if(!all.length){root.remove();back.remove();return}
 const key='pronto-explicit-host-layout-v1';let rows=all.map(id=>[id]),sizes={},drag=null;
 try{const saved=JSON.parse(localStorage.getItem(key)||'{}');if(Array.isArray(saved.rows)){const seen=new Set(),r=saved.rows.map(row=>Array.isArray(row)?row.filter(id=>panels.has(id)&&!seen.has(id)&&seen.add(id)):[]).filter(x=>x.length);all.filter(id=>!seen.has(id)).forEach(id=>r.push([id]));rows=r}if(saved.sizes&&typeof saved.sizes==='object')sizes=saved.sizes}catch(e){}
 function save(){try{localStorage.setItem(key,JSON.stringify({rows,sizes}))}catch(e){}}
 function side(el,e){const r=el.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;return y<.25?'top':y>.75?'bottom':x<.5?'left':'right'}
 function rearrange(a,b,position){
  if(a===b)return;rows=rows.map(r=>r.filter(x=>x!==a)).filter(r=>r.length);
  const index=rows.findIndex(r=>r.includes(b));if(index<0)rows.push([a]);
  else if(position==='top'||position==='bottom')rows.splice(index+(position==='bottom'?1:0),0,[a]);
  else rows[index].splice(rows[index].indexOf(b)+(position==='right'?1:0),0,a);
  save();draw();
 }
 function draw(){
  const grid=root.querySelector('.ph-grid');grid.replaceChildren();
  for(const rr of rows){const row=document.createElement('div');row.className='ph-row';
   for(const id of rr){const d=panels.get(id);if(!d)continue;
    const tile=document.createElement('article');tile.className='ph-panel';tile.style.height=Math.max(140,Math.min(1500,Number(sizes[id]?.height)||290))+'px';tile.style.flex=Math.max(10,Math.min(400,Number(sizes[id]?.width)||100))+' 1 0%';
    const head=document.createElement('div');head.className='ph-handle';head.draggable=true;head.textContent='⠿ '+d.title;
    head.addEventListener('dragstart',e=>{drag=id;e.dataTransfer.setData('text/plain',id)});
    head.addEventListener('dragend',()=>{drag=null;grid.querySelectorAll('[data-hover]').forEach(el=>el.removeAttribute('data-hover'))});
    tile.addEventListener('dragover',e=>{if(!drag||drag===id)return;e.preventDefault();tile.dataset.hover=side(tile,e)});
    tile.addEventListener('dragleave',e=>{if(!tile.contains(e.relatedTarget))tile.removeAttribute('data-hover')});
    tile.addEventListener('drop',e=>{if(!drag||drag===id)return;e.preventDefault();rearrange(drag,id,side(tile,e));drag=null});
    const content=document.createElement('div');content.className='ph-content';content.appendChild(d.wrap);
    const resize=document.createElement('div');resize.className='ph-resize';resize.title='Resize panel width and height';
    resize.addEventListener('pointerdown',e=>{e.preventDefault();const x=e.clientX,y=e.clientY,rect=tile.getBoundingClientRect(),rowW=row.getBoundingClientRect().width;resize.setPointerCapture(e.pointerId);
     const move=ev=>{sizes[id]={height:Math.max(140,rect.height+ev.clientY-y),width:Math.max(10,Math.min(400,100*(rect.width+ev.clientX-x)/rowW))};tile.style.height=sizes[id].height+'px';tile.style.flex=sizes[id].width+' 1 0%'};
     const done=()=>{resize.removeEventListener('pointermove',move);resize.removeEventListener('pointerup',done);resize.removeEventListener('pointercancel',done);save();draw()};
     resize.addEventListener('pointermove',move);resize.addEventListener('pointerup',done);resize.addEventListener('pointercancel',done);
    });
    tile.append(head,content,resize);row.appendChild(tile);
   }grid.appendChild(row);
  }
 }
 draw();
 root.querySelector('#ph-reset').onclick=()=>{rows=all.map(id=>[id]);sizes={};save();draw()};
 root.querySelector('#ph-game').onclick=()=>{root.hidden=true;back.hidden=false};
 back.onclick=()=>{root.hidden=false;back.hidden=true};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.addEventListener('load',init,{once:true});
})();