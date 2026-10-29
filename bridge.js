(function(){
const params=new URLSearchParams(location.search),room=params.get('room'),token=params.get('host'),isHost=!!token;
if(!room)return;

// Remove background music entirely, including the old player toolbar and embedded media.
(function removeBackgroundMusic(){
 const audio=document.getElementById('backgroundMusic');
 if(audio){audio.pause();audio.removeAttribute('autoplay');audio.removeAttribute('src');audio.querySelectorAll('source').forEach(s=>s.remove());audio.load();audio.remove();}
 const controls=['musicPlay','musicStop','playerVolume','musicStatus'];
 controls.forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none'});
 // Hide the compact music controls as a whole, without disturbing the game or timer.
 const play=document.getElementById('musicPlay');
 if(play){const parent=play.parentElement;if(parent&&parent.id!=='body')parent.style.display='none';}
 [...document.querySelectorAll('button')].filter(b=>/enable music/i.test(b.textContent||'')).forEach(b=>b.remove());
})();

/* Enable buzzer audio silently on normal user interaction; no separate button. */
(function setupBuzzerAudio(){
 const old=[...document.querySelectorAll('button')].find(b=>/enable buzzer sound/i.test(b.textContent||''));
 if(old)old.remove();
 const audio=document.getElementById('wrongAudio');
 if(!audio)return;
 audio.preload='auto';
 let unlocked=false;
 const unlock=()=>{
  if(unlocked)return;
  const previousVolume=audio.volume;
  audio.volume=0;
  try{
   const p=audio.play();
   if(p&&typeof p.then==='function')p.then(()=>{
    audio.pause();audio.currentTime=0;audio.volume=previousVolume;unlocked=true;
   }).catch(()=>{audio.volume=previousVolume});
  }catch(e){audio.volume=previousVolume}
 };
 document.addEventListener('pointerdown',unlock,{capture:true});
 document.addEventListener('keydown',unlock,{capture:true});
 window.addEventListener('message',e=>{if(e.origin===location.origin&&e.data?.type==='pronto-unlock-buzzer')unlock()});
})();
const socket=io({reconnection:true});let lobby=[];
const playerKey='pronto-room-'+room, registeredPlayerId=!isHost?localStorage.getItem(playerKey):null;
const personalPlayer=!isHost&&!!registeredPlayerId;
const section=document.createElement('section');section.id='onlineLobby';
section.style='background:#101f40;border:1px solid #4866a1;border-radius:14px;padding:15px;margin-bottom:15px;color:white';
if(isHost){
 const sidebar=document.querySelector('.sidebar');if(sidebar)sidebar.prepend(section);
 section.innerHTML='<h3 style="margin:0 0 8px;color:#ffcf58">LIVE ONLINE LOBBY</h3><div id="roomCode" style="font-size:20px;font-weight:900"></div><div style="font-size:12px;margin:10px 0">Player join link</div><input id="shareUrl" readonly style="width:100%;padding:8px;background:#0b1c3d;color:white;border:1px solid #5774a3;border-radius:7px"><div style="display:flex;gap:8px;margin:10px 0;flex-wrap:wrap"><button class="btn" id="copyJoin">Copy Join Link</button><button class="btn" id="copyDisplay">Copy Display Link</button></div><div id="joinedCount" style="font-weight:800;margin:12px 0">Waiting for players…</div><div id="livePool" style="max-height:230px;overflow:auto"></div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px"><button class="btn primary" id="randomPool">Randomly Assign Pool</button><button class="btn" id="clearAssignments">Return All to Pool</button></div><p style="font-size:11px;color:#afc1e5">Players appear here when they join. Choose a team or randomize unassigned players. Player names also appear in the existing Team Creator.</p>';
 document.getElementById('roomCode').textContent='Room: '+room;
 const joinUrl=location.origin+'/join/'+room;
 document.getElementById('shareUrl').value=joinUrl;
 document.getElementById('copyJoin').onclick=()=>navigator.clipboard?.writeText(joinUrl).then(()=>toast('Join link copied')).catch(()=>prompt('Copy link:',joinUrl));
 document.getElementById('copyDisplay').onclick=()=>{const url=location.origin+'/game?room='+room+'&view=player';navigator.clipboard?.writeText(url).then(()=>toast('Display link copied')).catch(()=>prompt('Copy link:',url))};
 function pool(){ensureTeamState();const taken=new Set(state.players.flat().map(p=>p.id));return lobby.filter(p=>!taken.has(p.id))}
 function assign(id,t){const p=lobby.find(x=>x.id===id);if(!p)return;ensureTeamState();for(const arr of state.players){const j=arr.findIndex(x=>x.id===id);if(j>=0)arr.splice(j,1)}state.players[t].push({id:p.id,name:p.name});render();showTeamCreator();paint();}
 function paint(){ensureTeamState();const unassigned=pool();document.getElementById('joinedCount').textContent=`${lobby.length} joined · ${unassigned.length} unassigned · ${lobby.filter(p=>p.connected).length} online`;
 document.getElementById('livePool').innerHTML=unassigned.length?unassigned.map(p=>`<div style="padding:8px;border-bottom:1px solid #36517c;display:flex;align-items:center;gap:5px;flex-wrap:wrap"><span style="flex:1;min-width:85px">${escapeHTML(p.name)} ${p.connected?'●':'○'}</span><button class="btn" data-pool="${p.id}" data-team="0" title="Assign to Team 1">Team 1</button><button class="btn" data-pool="${p.id}" data-team="1" title="Assign to Team 2">Team 2</button><button class="btn danger" data-kick="${p.id}" title="Remove from room">×</button></div>`).join(''):'<div style="font-size:13px;color:#b7c4e5">No unassigned players.</div>';
 document.querySelectorAll('[data-pool]').forEach(b=>b.onclick=()=>assign(b.dataset.pool,+b.dataset.team));document.querySelectorAll('[data-kick]').forEach(b=>b.onclick=()=>{if(confirm('Remove this player?'))socket.emit('kick',{id:b.dataset.kick})});
 }
 document.getElementById('randomPool').onclick=()=>{const names=pool().slice();for(let i=names.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[names[i],names[j]]=[names[j],names[i]]}names.forEach((p,i)=>{const t=state.players[0].length<=state.players[1].length?0:1;state.players[t].push({id:p.id,name:p.name})});render();showTeamCreator();paint();toast('Unassigned players randomized')};
 document.getElementById('clearAssignments').onclick=()=>{if(!confirm('Move every assigned player back into the pool?'))return;state.players=[[],[]];state.selected=[null,null];render();showTeamCreator();paint()};
 socket.on('lobby',l=>{lobby=l.participants||[];paint()});
 const originalBroadcast=broadcast;
 broadcast=function(){originalBroadcast();if(socket.connected)socket.emit('sync',{type:'sync',state:{...state,rounds},timer:remaining})};
 const prevStrike=strikeEffect;
 strikeEffect=function(){prevStrike();socket.emit('strike',{count:state.strikes})};
 // Room state starts fresh. The host can still import a previous game save explicitly.
 state={...makeDefault()};rounds=JSON.parse(JSON.stringify(defaultRounds));render();
}else{
 // The online player display is output-only even if opened on another computer.
 const switchBtn=document.getElementById('switchViewBtn');if(switchBtn)switchBtn.style.display='none';
 socket.on('gameSync',d=>receiveSync(d));socket.on('gameStrike',d=>showStrike(d.count));
}

// Distinct, short game-show buzzer. Sounds only for accepted server buzzes.
let buzzAudioContext=null;
function unlockBuzzAudio(){
 try{buzzAudioContext??=new (window.AudioContext||window.webkitAudioContext)();if(buzzAudioContext.state==='suspended')buzzAudioContext.resume().catch(()=>{});}catch(e){}
}
document.addEventListener('pointerdown',unlockBuzzAudio,{capture:true,once:true});
document.addEventListener('keydown',unlockBuzzAudio,{capture:true,once:true});
function playPlayerBuzzerSound(){
 try{
  unlockBuzzAudio();
  if(!buzzAudioContext||buzzAudioContext.state!=='running')return;
  const now=buzzAudioContext.currentTime;
  const osc=buzzAudioContext.createOscillator(),amp=buzzAudioContext.createGain();
  osc.type='square';osc.frequency.setValueAtTime(520,now);osc.frequency.exponentialRampToValueAtTime(310,now+0.22);
  amp.gain.setValueAtTime(0.0001,now);amp.gain.exponentialRampToValueAtTime(0.16,now+0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001,now+0.26);
  osc.connect(amp);amp.connect(buzzAudioContext.destination);osc.start(now);osc.stop(now+0.27);
 }catch(e){}
}
let knownBuzzIds=new Set(),buzzerInitialized=false;
function soundOnNewBuzz(b){
 const entries=Array.isArray(b?.entries)?b.entries:[];
 const currentIds=new Set(entries.map(e=>e.id));
 if(buzzerInitialized&&entries.some(e=>!knownBuzzIds.has(e.id)))playPlayerBuzzerSound();
 knownBuzzIds=currentIds;buzzerInitialized=true;
}

const buzzerPanel=document.createElement('section');
buzzerPanel.style.cssText='background:#101f40;border:1px solid #4866a1;border-radius:14px;padding:15px;margin:12px 0;color:white';
if(isHost){
 buzzerPanel.innerHTML='<h3 style="color:#ffcf58;margin:0 0 10px">LIVE PLAYER BUZZERS</h3><div id="buzzControls" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="buzzOpen">Open Buzzers</button><button class="btn" id="buzzLock">Lock</button><button class="btn" id="buzzReset">Reset Buzzers</button></div><p id="buzzInfo">Buzzers locked</p><div id="buzzRankList" style="max-height:260px;overflow:auto"></div>';
 section.appendChild(buzzerPanel);
 ['open','lock','reset'].forEach(action=>{document.getElementById('buzz'+action[0].toUpperCase()+action.slice(1)).onclick=()=>socket.emit('buzzerControl',{action},r=>{if(r?.error)alert(r.error)})});
}else{
 buzzerPanel.id='buzzWinnerOverlay';
 buzzerPanel.style.cssText='position:fixed;left:50%;top:12%;transform:translateX(-50%);width:min(640px,85vw);z-index:999;background:#091936ed;border:4px solid #ffce58;box-shadow:0 12px 45px #000b;border-radius:20px;padding:18px;text-align:center;color:white;display:none;pointer-events:none';
 document.body.appendChild(buzzerPanel);
}
function updateBuzzer(b){
 const list=Array.isArray(b?.entries)?b.entries:[];
 if(isHost){
  document.getElementById('buzzInfo').textContent=(b.open?'Buzzers OPEN':'Buzzers LOCKED')+' · '+list.length+' player(s) buzzed';
  const container=document.getElementById('buzzRankList');container.replaceChildren();
  if(!list.length){container.textContent='No buzzes yet.';return}
  list.forEach((p,i)=>{const line=document.createElement('div');line.style.cssText='padding:9px;border-bottom:1px solid #34476e;font-weight:'+(i===0?'900':'500')+';color:'+(i===0?'#ffce58':'white');line.textContent='#'+(i+1)+'  '+p.name+'  ·  '+(p.team===null?'Unassigned':'Team '+(p.team+1))+'  ·  '+(p.elapsedMs/1000).toFixed(2)+'s';container.appendChild(line)});
 }else{
  if(!list.length){buzzerPanel.style.display='none';buzzerPanel.replaceChildren();return}
  buzzerPanel.replaceChildren();
  const tag=document.createElement('div');tag.textContent='⚡ FIRST TO BUZZ ⚡';tag.style.cssText='font-size:17px;color:#ffce58;letter-spacing:2px;font-weight:800';
  const winner=document.createElement('div');winner.textContent=list[0].name;winner.style.cssText='font-size:clamp(28px,4vw,58px);font-weight:1000;margin:8px';
  const count=document.createElement('div');count.textContent=list.length+' player(s) buzzed';count.style.cssText='font-size:13px;color:#c4d6f4';
  buzzerPanel.append(tag,winner,count);buzzerPanel.style.display='block';
 }
}
// A registered player watches the same game board and buzzes directly on it.
if(personalPlayer){
 const dock=document.createElement('div');dock.id='personalBuzzDock';
 dock.style.cssText='position:relative;z-index:1;width:min(370px,92vw);margin:16px auto 76px;padding:10px 14px;border-radius:16px;background:#081c40ed;border:2px solid #ffce58;box-shadow:0 5px 20px #0005;display:flex;align-items:center;gap:10px;color:white';
 const btn=document.createElement('button');btn.id='personalBuzz';btn.textContent='BUZZER LOCKED';
 btn.style.cssText='background:#db334e;color:white;border:0;border-radius:12px;font-size:20px;font-weight:900;padding:15px 22px;flex:1;cursor:pointer';
 const info=document.createElement('span');info.id='personalBuzzInfo';info.style.cssText='font-size:12px;max-width:110px;line-height:1.3';info.textContent='Waiting for host';
 dock.append(btn,info);
// Place the personal buzzer in the page flow after the timer, never over it.
const timerLabel=[...document.querySelectorAll('span,div,p,strong')].find(el=>el.children.length===0&&/TIME REMAINING/i.test(el.textContent||''));
if(timerLabel){
 const timerRow=timerLabel.parentElement;
 timerRow?.insertAdjacentElement('afterend',dock);
}else{
 document.body.appendChild(dock);
}
// Space below the inline buzzer keeps it clear of other game elements.
dock.style.clear='both';
 let personalBuzzer={open:false,entries:[]},pending=false;
 function renderPersonalBuzz(){
  const mine=(personalBuzzer.entries||[]).find(x=>x.id===registeredPlayerId);
  btn.disabled=pending||!personalBuzzer.open||!!mine;
  btn.style.opacity=btn.disabled?'.55':'1';
  btn.textContent=mine?'BUZZED #'+mine.rank:personalBuzzer.open?'🔴 BUZZ!':'BUZZER LOCKED';
  info.textContent=mine?(mine.rank===1?'First to buzz!':'Your rank: #'+mine.rank):personalBuzzer.open?'Tap now!':'Waiting for host';
 }
 btn.onclick=()=>{if(btn.disabled)return;pending=true;renderPersonalBuzz();socket.emit('buzz',{},r=>{pending=false;if(r?.error)info.textContent=r.error;renderPersonalBuzz()})};
 socket.on('buzzerState',b=>{personalBuzzer=b;renderPersonalBuzz()});
 socket.on('connect',()=>{pending=false;renderPersonalBuzz()});
 window.applyPersonalBuzzer=b=>{personalBuzzer=b;renderPersonalBuzz()};
}

if(isHost){
 const sidebar=document.querySelector('.sidebar');
 if(sidebar){
  const css=document.createElement('style');
  css.textContent='#hostLayoutOpen{position:fixed;top:12px;right:16px;z-index:1200;background:#ffce58;color:#0b1e41;border:0;border-radius:9px;padding:12px;font-weight:900;cursor:pointer}#hostLayoutWorkspace{position:fixed;inset:0;z-index:2000;background:#06142ffb;color:white;overflow:auto;padding:16px 24px 60px;font-family:system-ui,sans-serif}#hostLayoutWorkspace[hidden]{display:none}#hostLayoutTop{position:sticky;top:-16px;background:#071a38;z-index:5;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px;border-bottom:1px solid #5277a0}#hostLayoutTop button{background:#ffce58;color:#102344;border:0;border-radius:8px;padding:9px 13px;font-weight:800;cursor:pointer}#hostLayoutRows{display:flex;flex-direction:column;gap:12px;margin:16px auto;max-width:1800px}.host-layout-row{display:flex;gap:12px;min-height:130px;align-items:stretch}.host-layout-tile{position:relative;background:#0b2248;border:1px solid #426ba3;border-radius:13px;min-width:190px;min-height:130px;display:flex;flex-direction:column;overflow:hidden}.host-layout-handle{background:#173868;color:#ffce58;cursor:grab;padding:10px 12px;font-weight:900;display:flex;gap:8px;align-items:center;user-select:none}.host-layout-handle span{flex:1}.host-layout-content{padding:10px;overflow:auto;flex:1;min-height:50px}.host-layout-content>*{max-width:100%!important;box-sizing:border-box}.host-layout-grip{position:absolute;right:0;bottom:0;width:22px;height:22px;z-index:3;cursor:nwse-resize;background:linear-gradient(135deg,transparent 45%,#ffce58 48%,#ffce58 60%,transparent 62%)}.host-layout-tile[data-drop]{outline:3px solid #ffce58;outline-offset:-3px}@media(max-width:650px){#hostLayoutWorkspace{padding:8px}.host-layout-row{flex-direction:column}.host-layout-tile{width:100%!important;flex:auto!important;min-width:0}#hostLayoutTop{top:-8px}}';
  document.head.appendChild(css);
  const workspace=document.createElement('div');workspace.id='hostLayoutWorkspace';workspace.hidden=true;
  workspace.innerHTML='<div id="hostLayoutTop"><strong style="font-size:20px;color:#ffce58">☷ Customize Host Panels</strong><div><button id="hostLayoutReset">Reset Layout</button> <button id="hostLayoutClose">Back to Game ✕</button></div></div><p style="color:#bbcfed">Drag a panel header to an edge of another panel: left/right shares a row, top/bottom creates a row. Drag the gold bottom-right corner to resize the panel. Layout is saved automatically.</p><div id="hostLayoutRows"></div>';
  document.body.appendChild(workspace);
  const open=document.createElement('button');open.id='hostLayoutOpen';open.textContent='☷ Customize Host Panels';document.body.appendChild(open);
  const root=workspace.querySelector('#hostLayoutRows'),originals=new Map(),storageKey='pronto-host-layout-v1';
  let rows=[],sizes={},dragged=null,initialized=false;
  function save(){try{localStorage.setItem(storageKey,JSON.stringify({rows,sizes}))}catch(e){}}
  function setup(){
   if(initialized)return;initialized=true;
   [...sidebar.children].filter(el=>el.nodeType===1).forEach((el,i)=>{
    const id='panel-'+i,marker=document.createComment(id);
    el.parentNode.insertBefore(marker,el);
    const heading=el.querySelector('h2,h3,h4,legend,.panel-title');
    originals.set(id,{el,marker,title:(heading?.textContent||el.id||'Host Controls '+(i+1)).trim().slice(0,70)});
   });
   const ids=[...originals.keys()];
   try{
    const saved=JSON.parse(localStorage.getItem(storageKey)||'{}'),seen=new Set();
    rows=(saved.rows||[]).map(row=>Array.isArray(row)?row.filter(id=>ids.includes(id)&&!seen.has(id)&&seen.add(id)):[]).filter(row=>row.length);
    if(saved.sizes&&typeof saved.sizes==='object')sizes=saved.sizes;
   }catch(e){}
   ids.filter(id=>!rows.some(row=>row.includes(id))).forEach(id=>rows.push([id]));
  }
  function locate(tile,event){
   const r=tile.getBoundingClientRect(),x=(event.clientX-r.left)/r.width,y=(event.clientY-r.top)/r.height;
   if(y<.25)return'top';if(y>.75)return'bottom';return x<.5?'left':'right';
  }
  function move(source,target,edge){
   if(source===target)return;
   rows=rows.map(row=>row.filter(id=>id!==source)).filter(row=>row.length);
   const ri=rows.findIndex(row=>row.includes(target));
   if(ri<0){rows.push([source])}
   else if(edge==='top'||edge==='bottom'){rows.splice(ri+(edge==='bottom'?1:0),0,[source])}
   else{const pos=rows[ri].indexOf(target);rows[ri].splice(pos+(edge==='right'?1:0),0,source)}
   save();render();
  }
  function render(){
   root.replaceChildren();
   rows.forEach(row=>{
    const rowEl=document.createElement('div');rowEl.className='host-layout-row';
    row.forEach(id=>{
     const data=originals.get(id);if(!data)return;
     const tile=document.createElement('article');tile.className='host-layout-tile';tile.dataset.id=id;
     tile.style.height=Math.max(130,Number(sizes[id]?.height)||260)+'px';
     tile.style.flex=(Math.max(15,Number(sizes[id]?.width)||50))+' 1 0%';
     const handle=document.createElement('div');handle.className='host-layout-handle';handle.draggable=true;
     const title=document.createElement('span');title.textContent='⠿  '+data.title;
     handle.appendChild(title);
     handle.addEventListener('dragstart',e=>{dragged=id;e.dataTransfer.setData('text/plain',id);e.dataTransfer.effectAllowed='move'});
     handle.addEventListener('dragend',()=>{dragged=null;root.querySelectorAll('[data-drop]').forEach(el=>el.removeAttribute('data-drop'))});
     tile.addEventListener('dragover',e=>{if(!dragged||dragged===id)return;e.preventDefault();tile.dataset.drop=locate(tile,e)});
     tile.addEventListener('dragleave',e=>{if(!tile.contains(e.relatedTarget))tile.removeAttribute('data-drop')});
     tile.addEventListener('drop',e=>{if(!dragged||dragged===id)return;e.preventDefault();move(dragged,id,locate(tile,e));dragged=null});
     const content=document.createElement('div');content.className='host-layout-content';content.appendChild(data.el);
     const grip=document.createElement('div');grip.className='host-layout-grip';grip.title='Resize panel width and height';
     grip.addEventListener('pointerdown',e=>{
      e.preventDefault();e.stopPropagation();const x=e.clientX,y=e.clientY,w=tile.getBoundingClientRect().width,h=tile.getBoundingClientRect().height,rowW=rowEl.getBoundingClientRect().width;
      grip.setPointerCapture(e.pointerId);
      function resize(ev){
       sizes[id]={height:Math.max(130,Math.min(1500,h+ev.clientY-y)),width:Math.max(15,Math.min(300,100*(w+ev.clientX-x)/rowW))};
       tile.style.height=sizes[id].height+'px';
       tile.style.flex=sizes[id].width+' 1 0%';
      }
      function done(){grip.removeEventListener('pointermove',resize);grip.removeEventListener('pointerup',done);grip.removeEventListener('pointercancel',done);save();render()}
      grip.addEventListener('pointermove',resize);grip.addEventListener('pointerup',done);grip.addEventListener('pointercancel',done);
     });
     tile.append(handle,content,grip);rowEl.appendChild(tile);
    });
    root.appendChild(rowEl);
   });
  }
  function close(){
   for(const {el,marker} of originals.values())marker.parentNode.insertBefore(el,marker.nextSibling);
   workspace.hidden=true;open.hidden=false;
  }
  open.onclick=()=>{setup();workspace.hidden=false;open.hidden=true;render()};
  workspace.querySelector('#hostLayoutClose').onclick=close;
  workspace.querySelector('#hostLayoutReset').onclick=()=>{rows=[...originals.keys()].map(id=>[id]);sizes={};save();render()};
 }
}

socket.on('buzzerState',b=>{soundOnNewBuzz(b);updateBuzzer(b)});
socket.on('connect',()=>socket.emit('enter',{room,host:token,view:isHost?'host':personalPlayer?'participant':'display',playerId:personalPlayer?registeredPlayerId:undefined},res=>{
 if(res.error){alert(res.error);return}if(personalPlayer&&!res.playerId){location.replace('/join/'+room);return}if(res.buzzer){soundOnNewBuzz(res.buzzer);updateBuzzer(res.buzzer);if(personalPlayer)window.applyPersonalBuzzer(res.buzzer)}if(!isHost&&res.snapshot)receiveSync(res.snapshot);if(isHost)broadcast();
}));
})();
