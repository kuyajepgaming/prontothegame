(function(){
'use strict';
if(!new URLSearchParams(location.search).has('host'))return;
function init(){
 if(document.getElementById('prontoFixedHost'))return;
 const sidebar=document.querySelector('.sidebar');if(!sidebar)return;
 const layout=sidebar.parentElement;
 if(!layout)return;
 const main=[...layout.children].find(el=>el!==sidebar&&el.querySelector&&el.querySelector('[class*=board],[id*=board],[id*=question],[class*=question]'));
 if(!main)return;
 const style=document.createElement('style');style.textContent="#prontoFixedHost{position:fixed;inset:95px 10px 10px;z-index:1000;display:grid;grid-template-columns:minmax(260px,23%) minmax(0,1fr) minmax(280px,25%);gap:12px;background:#102956;color:white;overflow:hidden}#prontoFixedHost[hidden]{display:none}#prontoFixedHost .ph-column{min-height:0;min-width:0;display:flex;flex-direction:column;gap:10px;overflow-y:auto;scrollbar-width:thin}#prontoFixedHost .ph-card{background:#102449;border:1px solid #416493;border-radius:9px;min-width:0;flex-shrink:0;overflow:hidden}#prontoFixedHost .ph-title{background:#244573;color:#ffcd56;padding:9px 12px;font-weight:900;font-size:12px}#prontoFixedHost .ph-inner{padding:10px;min-width:0}#prontoFixedHost .ph-inner>*{max-width:100%!important}#prontoFixedHost .ph-inner input,#prontoFixedHost .ph-inner select{max-width:100%;box-sizing:border-box}#prontoFixedHost #liveTeamRoster{max-height:160px;overflow:auto}#prontoFixedHost #onlineLobby{margin:0!important;width:100%!important}#prontoFixedHost #liveTeamManagement{margin:0!important}@media(max-width:900px){#prontoFixedHost{position:static;height:auto;display:flex;flex-direction:column;overflow:visible}#prontoFixedHost .ph-column{overflow:visible}}";document.head.appendChild(style);
 const root=document.createElement('div');root.id='prontoFixedHost';
 const left=document.createElement('aside'),middle=document.createElement('main'),right=document.createElement('aside');
 [left,middle,right].forEach(el=>el.className='ph-column');
 root.append(left,middle,right);document.body.appendChild(root);
 middle.appendChild(main);
 const rules=[['LIVE ONLINE LOBBY',left],['TEAMS & JOINED PLAYERS',left],['LIVE PLAYER BUZZERS',left],['TEAMS & PLAYERS',left],['OPENING SCREEN & QUESTION VISIBILITY',right],['QUESTION PICKER',right],['HOST • REVEAL AN ANSWER',right],['MANUAL SCORING',right],['ROUND TIMER',middle],['CUSTOMIZE GAME',middle],['SAVE & SHARING',right]];
 const norm=x=>String(x||'').replace(/\\s+/g,' ').trim().toUpperCase();
 const find=x=>rules.find(r=>norm(x).startsWith(r[0]));
 function card(name,place,items){if(!items.length)return;const box=document.createElement('section');box.className='ph-card';const title=document.createElement('div');title.className='ph-title';title.textContent=name;const body=document.createElement('div');body.className='ph-inner';items.forEach(n=>body.appendChild(n));box.append(title,body);place.appendChild(box)}
 let current=null,items=[];
 function flush(){if(items.length){card(current?current[0]:'HOST CONTROLS',current?current[1]:right,items);items=[]}}
 function split(parent,depth){
  if(depth>5)return;
  const nodes=[...parent.children];
  for(const el of nodes){
   if(el.id==='onlineLobby'){
    flush();
    const team=el.querySelector('#liveTeamManagement');
    if(team){card('TEAMS & JOINED PLAYERS',left,[team])}
    card('LIVE ONLINE LOBBY',left,[el]);current=null;continue;
   }
   const isHeading=el.matches('h1,h2,h3,h4,h5,h6,legend,.section-title,.panel-title');
   const heading=isHeading?find(el.textContent):null;
   if(heading){flush();current=heading;items.push(el);continue}
   const nested=[...el.children].filter(ch=>ch.matches('h2,h3,h4,h5,legend,.section-title,.panel-title')).length;
   if(nested>=2){flush();current=null;split(el,depth+1);continue}
   if(nested===1&&nodes.length===1){flush();current=null;split(el,depth+1);continue}
   const first=el.querySelector('h2,h3,h4,h5,legend');
   const grouped=first?find(first.textContent):null;
   if(grouped&&el.children.length>1){flush();card(grouped[0],grouped[1],[el]);current=null;continue}
   items.push(el);
  }
  flush();current=null;
 }
 split(sidebar,0);
 // A fixed desktop dashboard with independent scrolling inside columns.
 root.querySelectorAll('h1,h2,h3,h4,h5').forEach(h=>{
  if(norm(h.textContent)==='MANUAL SCORE EDITOR'){const panel=h.closest('.ph-card');if(panel)panel.remove()}
 });
 document.querySelectorAll('#ph-edit-button,#ph-dashboard,.ph-return,#hostLayoutOpen,#hostLayoutWorkspace').forEach(el=>el.remove());
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.addEventListener('load',init,{once:true});
})();