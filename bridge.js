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


// Live Host Dashboard: the panels ARE the host interface, not a separate layout editor.
if(isHost){
 const sidebar=document.querySelector('.sidebar');
 if(sidebar){
  const css=document.createElement('style');
  css.textContent='#prontoHostDashboard{position:fixed;inset:0;z-index:1800;background:#07152f;color:white;overflow:auto;padding:16px 20px 55px;font:14px system-ui,sans-serif}#prontoHostDashboard[hidden]{display:none!important}#prontoHostHeader{position:sticky;top:-16px;z-index:10;background:#091b3c;border-bottom:1px solid #45618b;padding:12px 4px;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}#prontoHostHeader strong{color:#ffcf58;font-size:20px}#prontoHostHeader button{cursor:pointer;padding:10px 13px;background:#214572;color:white;border:1px solid #59769e;border-radius:8px;font-weight:800}#prontoHostGrid{display:flex;flex-direction:column;gap:12px;max-width:1900px;margin:15px auto}.pronto-host-row{display:flex;gap:12px;width:100%;align-items:stretch}.pronto-host-panel{position:relative;background:#102348;border:1px solid #4b6797;border-radius:13px;min-width:0;min-height:140px;display:flex;flex-direction:column;overflow:hidden}.pronto-host-title{display:flex;gap:8px;align-items:center;padding:11px 14px;background:#203b68;color:#ffcf58;font-weight:850;cursor:grab;user-select:none;touch-action:none}.pronto-host-title span{flex:1}.pronto-host-body{overflow:auto;min-height:70px;flex:1;padding:12px}.pronto-host-body>*{max-width:100%!important;box-sizing:border-box}.pronto-host-body input,.pronto-host-body select,.pronto-host-body textarea{max-width:100%!important}.pronto-host-panel[data-over]{outline:3px solid #ffcf58;outline-offset:-3px}.pronto-host-resize{position:absolute;bottom:0;right:0;z-index:4;width:22px;height:22px;cursor:nwse-resize;background:linear-gradient(135deg,transparent 46%,#ffcf58 47%,#ffcf58 65%,transparent 66%)}@media(max-width:700px){#prontoHostDashboard{padding:8px}.pronto-host-row{flex-wrap:wrap}.pronto-host-panel{flex-basis:100%!important}#prontoHostHeader{top:-8px}}';
  document.head.appendChild(css);
  const dashboard=document.createElement('div');dashboard.id='prontoHostDashboard';
  dashboard.innerHTML='<div id="prontoHostHeader"><strong>☷ Pronto Host Control Panel</strong><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="prontoHostBoard">Show Game Board</button><button id="prontoHostReset">Reset Panel Layout</button></div></div><p style="color:#b9c9e9;margin:10px 2px">Drag panel headers to arrange. Drop on the left/right side to share a row or on the top/bottom to create a full-width row. Resize with the gold bottom-right corner. Layout saves automatically.</p><div id="prontoHostGrid"></div>';
  // Mount at document level: sidebar transforms/layout must never hide or clip the dashboard.
  document.body.appendChild(dashboard);
  const grid=dashboard.querySelector('#prontoHostGrid'),panels=new Map(),key='pronto-host-dashboard-v3';
  let rows=[],sizes={},moving=null;
  function addPanel(nodes,label){
   if(!nodes.length)return;
   const id='section-'+panels.size;
   const wrap=document.createElement('section');
   nodes[0].parentNode.insertBefore(wrap,nodes[0]);
   nodes.forEach(node=>wrap.appendChild(node));
   panels.set(id,{wrap,title:label||'Host Controls '+(panels.size+1)});
  }
  // Find the actual heading boundaries. Handle both headings directly under the
  // sidebar and one-level nested containers with multiple headings.
  function heading(node){
   if(!node||node.nodeType!==1)return'';
   if(node.matches('h1,h2,h3,h4,legend,.section-title,.panel-title'))return(node.textContent||'').trim();
   return'';
  }
  function split(container){
   const children=[...container.children].filter(n=>n!==dashboard);
   let current=[],title='';
   function flush(){if(current.length){addPanel(current,title);current=[];title=''}}
   for(const node of children){
    const h=heading(node);
    if(h){flush();title=h;current=[node];continue}
    const directHeaders=[...node.children].filter(ch=>!!heading(ch));
    if(directHeaders.length>=2){
     flush();split(node);continue;
    }
    const headingInside=node.querySelector('h2,h3,h4,legend');
    if(headingInside){
     flush();
     addPanel([node],node.id==='onlineLobby'?'LIVE ONLINE LOBBY':headingInside.textContent.trim());
     continue;
    }
    if(!current.length)title=node.id||'General Host Controls';
    current.push(node);
   }
   flush();
  }
  // Split the entire host sidebar by actual headings and existing sections.
  split(sidebar);
  // The host workspace is always visible; the legacy narrow sidebar is not the host panel.
  // Original control elements are moved (not cloned), retaining their event listeners.
  const ids=[...panels.keys()];const seen=new Set();
  try{const saved=JSON.parse(localStorage.getItem(key)||'{}');
   rows=(Array.isArray(saved.rows)?saved.rows:[]).map(row=>Array.isArray(row)?row.filter(id=>ids.includes(id)&&!seen.has(id)&&seen.add(id)):[]).filter(row=>row.length);
   sizes=saved.sizes&&typeof saved.sizes==='object'?saved.sizes:{};
  }catch(e){}
  ids.filter(id=>!seen.has(id)).forEach(id=>rows.push([id]));
  function save(){try{localStorage.setItem(key,JSON.stringify({rows,sizes}))}catch(e){}}
  function edge(tile,e){const r=tile.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;return y<.25?'top':y>.75?'bottom':x<.5?'left':'right'}
  function move(source,target,side){
   if(source===target)return;
   rows=rows.map(r=>r.filter(id=>id!==source)).filter(r=>r.length);
   const ri=rows.findIndex(r=>r.includes(target));if(ri<0)rows.push([source]);
   else if(side==='top'||side==='bottom')rows.splice(ri+(side==='bottom'?1:0),0,[source]);
   else{const i=rows[ri].indexOf(target);rows[ri].splice(i+(side==='right'?1:0),0,source)}
   save();render();
  }
  function render(){
   grid.replaceChildren();
   for(const rowIds of rows){
    const row=document.createElement('div');row.className='pronto-host-row';
    for(const id of rowIds){
     const item=panels.get(id);if(!item)continue;
     const tile=document.createElement('section');tile.className='pronto-host-panel';tile.dataset.id=id;
     const size=sizes[id]||{};tile.style.height=Math.max(140,Math.min(1500,Number(size.height)||280))+'px';
     tile.style.flex=(Math.max(10,Math.min(350,Number(size.width)||100)))+' 1 0';
     const handle=document.createElement('div');handle.className='pronto-host-title';handle.draggable=true;
     const name=document.createElement('span');name.textContent='⠿ '+item.title;handle.appendChild(name);
     handle.addEventListener('dragstart',e=>{moving=id;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',id)});
     handle.addEventListener('dragend',()=>{moving=null;grid.querySelectorAll('[data-over]').forEach(n=>n.removeAttribute('data-over'))});
     tile.addEventListener('dragover',e=>{if(!moving||moving===id)return;e.preventDefault();tile.dataset.over=edge(tile,e)});
     tile.addEventListener('dragleave',e=>{if(!tile.contains(e.relatedTarget))tile.removeAttribute('data-over')});
     tile.addEventListener('drop',e=>{if(!moving||moving===id)return;e.preventDefault();move(moving,id,edge(tile,e));moving=null});
     const body=document.createElement('div');body.className='pronto-host-body';body.appendChild(item.wrap);
     const grip=document.createElement('div');grip.className='pronto-host-resize';grip.title='Resize panel';
     grip.addEventListener('pointerdown',e=>{
      e.preventDefault();e.stopPropagation();const x=e.clientX,y=e.clientY,r=tile.getBoundingClientRect(),rr=row.getBoundingClientRect();
      grip.setPointerCapture(e.pointerId);
      const resize=ev=>{sizes[id]={height:Math.max(140,Math.min(1500,r.height+ev.clientY-y)),width:Math.max(10,Math.min(350,(r.width+ev.clientX-x)/rr.width*100))};tile.style.height=sizes[id].height+'px';tile.style.flex=sizes[id].width+' 1 0'};
      const done=()=>{grip.removeEventListener('pointermove',resize);grip.removeEventListener('pointerup',done);grip.removeEventListener('pointercancel',done);save();render()};
      grip.addEventListener('pointermove',resize);grip.addEventListener('pointerup',done);grip.addEventListener('pointercancel',done);
     });
     tile.append(handle,body,grip);row.appendChild(tile);
    }
    grid.appendChild(row);
   }
  }
  render();
  dashboard.hidden=false;
  dashboard.querySelector('#prontoHostReset').onclick=()=>{rows=ids.map(id=>[id]);sizes={};save();render()};
  dashboard.querySelector('#prontoHostBoard').onclick=()=>{
   const hide=!dashboard.hidden;dashboard.hidden=hide;
   const toggle=document.getElementById('prontoHostReturn');
   if(toggle)toggle.hidden=!hide;
  };
  const back=document.createElement('button');back.id='prontoHostReturn';back.textContent='☷ Host Panels';back.hidden=true;
  back.style.cssText='position:fixed;right:15px;top:12px;z-index:1800;background:#ffcf58;color:#102342;border:0;border-radius:9px;padding:12px;font-weight:850;cursor:pointer';
  back.onclick=()=>{dashboard.hidden=false;back.hidden=true};document.body.appendChild(back);
 }
}

socket.on('buzzerState',b=>{soundOnNewBuzz(b);updateBuzzer(b)});
socket.on('connect',()=>socket.emit('enter',{room,host:token,view:isHost?'host':personalPlayer?'participant':'display',playerId:personalPlayer?registeredPlayerId:undefined},res=>{
 if(res.error){alert(res.error);return}if(personalPlayer&&!res.playerId){location.replace('/join/'+room);return}if(res.buzzer){soundOnNewBuzz(res.buzzer);updateBuzzer(res.buzzer);if(personalPlayer)window.applyPersonalBuzzer(res.buzzer)}if(!isHost&&res.snapshot)receiveSync(res.snapshot);if(isHost)broadcast();
}));
})();
