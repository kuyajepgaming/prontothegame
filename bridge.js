(function(){
const params=new URLSearchParams(location.search),room=params.get('room'),token=params.get('host'),isHost=!!token;
if(!room)return;

// Try playing the title music as soon as the remote player display loads.
// Browsers may reject audible autoplay until the visitor interacts with this page.
if(!isHost && params.get('view')==='player'){
 const music=document.getElementById('backgroundMusic');
 const playButton=document.getElementById('musicPlay');
 const stopButton=document.getElementById('musicStop');
 const status=document.getElementById('musicStatus');
 if(music){
  music.loop=true;
  let intentionallyStopped=false,starting=false,started=false;
  const enable=document.createElement('button');
  enable.type='button';enable.textContent='▶ Enable Music';
  enable.setAttribute('aria-label','Enable background music');
  enable.style.cssText='position:fixed;right:16px;bottom:82px;z-index:1001;padding:10px 14px;border-radius:9px;background:#ffca54;color:#061736;border:0;font-weight:800;cursor:pointer;box-shadow:0 4px 20px #0009;display:none';
  document.body.appendChild(enable);
  async function tryStart(){
   if(intententionallyStopped||started||starting||!music.paused)return;
   starting=true;
   try{
    const value=Number(document.getElementById('playerVolume')?.value||45);
    music.volume=Math.max(0,Math.min(1,value/100));
    await music.play();started=true;enable.style.display='none';
    if(typeof updateMusicStatus==='function'){musicPlaying=true;updateMusicStatus()}
   }catch(e){
    if(!intentionallyStopped){enable.style.display='block';if(status)status.textContent='Tap Enable Music'}
   }finally{starting=false}
  }
  enable.addEventListener('click',()=>{intentionallyStopped=false;started=false;tryStart()});
  stopButton?.addEventListener('click',()=>{intentionallyStopped=true;started=false;enable.style.display='none'});
  playButton?.addEventListener('click',()=>{intentionallyStopped=false;started=true;enable.style.display='none'});
  // Browsers allow sound after an explicit click/touch/keyboard gesture.
  const unlock=()=>{if(!intentionallyStopped&&!started)tryStart()};
  document.addEventListener('pointerdown',unlock,{capture:true});
  document.addEventListener('keydown',unlock,{capture:true});
  window.addEventListener('pageshow',tryStart);
  tryStart();
 }
}
const socket=io({reconnection:true});let lobby=[];
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
socket.on('connect',()=>socket.emit('enter',{room,host:token,view:isHost?'host':'display'},res=>{
 if(res.error){alert(res.error);return}if(!isHost&&res.snapshot)receiveSync(res.snapshot);if(isHost)broadcast();
}));
})();
