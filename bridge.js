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
 // Team roster and naming are controlled in the lobby.
 const teamArea=document.createElement('div');teamArea.id='liveTeamManagement';
 teamArea.style.cssText='margin:15px 0;padding:12px;border:1px solid #4866a1;border-radius:10px;background:#0b1c3d';
 teamArea.innerHTML='<h3 style="margin:0 0 12px;color:#ffcf58">TEAMS & JOINED PLAYERS</h3><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:10px"><label style="font-size:12px">Team 1 name<input id="liveTeamName0" maxlength="45" style="width:100%;padding:8px;background:#122a54;color:white;border:1px solid #597bb1;border-radius:7px"></label><label style="font-size:12px">Team 2 name<input id="liveTeamName1" maxlength="45" style="width:100%;padding:8px;background:#122a54;color:white;border:1px solid #597bb1;border-radius:7px"></label></div><button class="btn primary" id="liveSaveTeamNames" style="margin:10px 0">Save Team Names</button><div id="liveTeamRoster" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin-top:10px"></div>';
 section.insertBefore(teamArea,document.getElementById('joinedCount'));
 function teamNames(){
  const array=Array.isArray(state.teamNames)?state.teamNames:Array.isArray(state.teams)?state.teams:null;
  return [String(array?.[0]||'Team Pronto'),String(array?.[1]||'Team Pilates')];
 }
 function paintRoster(){
  const names=teamNames(),roster=document.getElementById('liveTeamRoster');
  roster.replaceChildren();
  [0,1,-1].forEach(t=>{
   const group=document.createElement('div');group.style.cssText='padding:9px;background:#112a54;border-radius:8px;border:1px solid #3a5784';
   const heading=document.createElement('strong');heading.style.color='#ffce58';heading.textContent=t<0?'Unassigned':names[t];
   group.appendChild(heading);
   const people=lobby.filter(p=>{const i=state.players.findIndex(arr=>Array.isArray(arr)&&arr.some(member=>member.id===p.id));return i===t});
   if(!people.length){const none=document.createElement('p');none.textContent='No players';none.style.cssText='font-size:12px;color:#b9cae9';group.appendChild(none)}
   people.forEach(p=>{const item=document.createElement('div');item.style.cssText='padding:6px 0;display:flex;justify-content:space-between;gap:6px;align-items:center;border-bottom:1px solid #36517c';
    const label=document.createElement('span');label.textContent=p.name+(p.connected?' ●':' ○');label.style.fontSize='12px';
    const sel=document.createElement('select');sel.setAttribute('aria-label','Assign '+p.name+' to a team');sel.style.cssText='padding:4px;background:#102048;color:white;border:1px solid #426297;border-radius:5px;font-size:11px';
    [[-1,'Pool'],[0,names[0]],[1,names[1]]].forEach(([v,n])=>{const opt=document.createElement('option');opt.value=v;opt.textContent=n;sel.appendChild(opt)});sel.value=String(t);
    sel.onchange=()=>{const next=Number(sel.value);if(next<0){state.players.forEach(arr=>{const j=arr.findIndex(x=>x.id===p.id);if(j>=0)arr.splice(j,1)});render();paint()}else assign(p.id,next)};
    item.append(label,sel);group.appendChild(item);
   });roster.appendChild(group);
  });
 }
 // Keep all host scoring labels and player scoreboard titles in sync with team renames.
 function updateTeamLabels(names){
  const aliases=['Team Pronto','Team Pilates'];
  document.querySelectorAll('button').forEach(button=>{
   if(button.closest('#liveTeamManagement'))return;
   const original=button.dataset.prontoOriginalLabel||button.textContent.trim();
   if(!button.dataset.prontoOriginalLabel&&aliases.some(n=>original.includes(n)))button.dataset.prontoOriginalLabel=original;
   const base=button.dataset.prontoOriginalLabel;
   if(base){let next=base;aliases.forEach((name,i)=>{next=next.replaceAll(name,names[i])});button.textContent=next}
  });
  document.querySelectorAll('.scoreboard, .team-score, .team-name, .team-header, [id*=teamName], [id*=teamLabel]').forEach(el=>{
   if(el.closest('#liveTeamManagement')||el.children.length)return;
   const base=el.dataset.prontoOriginalLabel||el.textContent.trim();
   if(!el.dataset.prontoOriginalLabel&&aliases.includes(base))el.dataset.prontoOriginalLabel=base;
   if(el.dataset.prontoOriginalLabel){const i=aliases.indexOf(el.dataset.prontoOriginalLabel);if(i>=0)el.textContent=names[i]}
  });
 }
 document.getElementById('liveSaveTeamNames').onclick=()=>{
  const names=[0,1].map(i=>document.getElementById('liveTeamName'+i).value.trim().slice(0,45)||('Team '+(i+1)));
  state.teamNames=names;
  // Update common legacy team-name shapes so scoreboard and shared state use the same names.
  if(Array.isArray(state.teams)&&state.teams.every(x=>typeof x==='string'))state.teams=[...names];
  render();paint();updateTeamLabels(names);broadcast();
 };
 document.getElementById('roomCode').textContent='Room: '+room;
 const joinUrl=location.origin+'/join/'+room;
 document.getElementById('shareUrl').value=joinUrl;
 document.getElementById('copyJoin').onclick=()=>navigator.clipboard?.writeText(joinUrl).then(()=>toast('Join link copied')).catch(()=>prompt('Copy link:',joinUrl));
 document.getElementById('copyDisplay').onclick=()=>{const url=location.origin+'/game?room='+room+'&view=player';navigator.clipboard?.writeText(url).then(()=>toast('Display link copied')).catch(()=>prompt('Copy link:',url))};
 function pool(){ensureTeamState();const taken=new Set(state.players.flat().map(p=>p.id));return lobby.filter(p=>!taken.has(p.id))}
 function assign(id,t){const p=lobby.find(x=>x.id===id);if(!p)return;ensureTeamState();for(const arr of state.players){const j=arr.findIndex(x=>x.id===id);if(j>=0)arr.splice(j,1)}state.players[t].push({id:p.id,name:p.name});render();showTeamCreator();paint();}
 function paint(){ensureTeamState();const names=teamNames();updateTeamLabels(names);[0,1].forEach(i=>{const input=document.getElementById('liveTeamName'+i);if(input&&document.activeElement!==input)input.value=names[i]});paintRoster();const unassigned=pool();document.getElementById('joinedCount').textContent=`${lobby.length} joined · ${unassigned.length} unassigned · ${lobby.filter(p=>p.connected).length} online`;
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
 socket.on('gameSync',d=>{receiveSync(d);const names=d?.state?.teamNames;if(Array.isArray(names)&&names.length>=2){
   const aliases=['Team Pronto','Team Pilates'];
   document.querySelectorAll('button,.team-name,.team-header,[id*=teamName],[id*=teamLabel]').forEach(el=>{
    if(el.children.length)return;
    const base=el.dataset.prontoOriginalLabel||el.textContent.trim();
    if(!el.dataset.prontoOriginalLabel&&aliases.some(n=>base.includes(n)))el.dataset.prontoOriginalLabel=base;
    if(el.dataset.prontoOriginalLabel){let s=el.dataset.prontoOriginalLabel;aliases.forEach((v,i)=>s=s.replaceAll(v,String(names[i])));el.textContent=s}
   });
  }});socket.on('gameStrike',d=>showStrike(d.count));
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


// Host dashboard is now loaded independently by server.js, after the game DOM.

socket.on('buzzerState',b=>{soundOnNewBuzz(b);updateBuzzer(b)});
socket.on('connect',()=>socket.emit('enter',{room,host:token,view:isHost?'host':personalPlayer?'participant':'display',playerId:personalPlayer?registeredPlayerId:undefined},res=>{
 if(res.error){alert(res.error);return}if(personalPlayer&&!res.playerId){location.replace('/join/'+room);return}if(res.buzzer){soundOnNewBuzz(res.buzzer);updateBuzzer(res.buzzer);if(personalPlayer)window.applyPersonalBuzzer(res.buzzer)}if(!isHost&&res.snapshot)receiveSync(res.snapshot);if(isHost)broadcast();
}));
})();
