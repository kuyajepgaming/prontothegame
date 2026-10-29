'use strict';
const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const crypto=require('crypto');
const path=require('path');
const app=express();app.disable('x-powered-by');app.use(express.json({limit:'16kb'}));
const server=http.createServer(app);const io=new Server(server,{maxHttpBufferSize:9e6});
const rooms=new Map();
const code=()=>crypto.randomBytes(4).toString('hex').toUpperCase();
const isCode=x=>typeof x==='string'&&/^[A-F0-9]{8}$/.test(x);
const clean=x=>String(x||'').trim().replace(/[<>\x00-\x1f]/g,'').slice(0,55);
const summary=r=>({code:r.code,participants:[...r.players.values()].map(({id,name,connected,team})=>({id,name,connected,team})),hostOnline:!!r.hostSocket});
function emitBuzzer(r){io.to('room:'+r.code).emit('buzzerState',r.buzzer)}
function emitLobby(r){io.to('room:'+r.code).emit('lobby',summary(r));}
app.post('/api/rooms',(req,res)=>{let c=code();while(rooms.has(c))c=code();const token=crypto.randomBytes(32).toString('hex');rooms.set(c,{code:c,token,players:new Map(),hostSocket:null,snapshot:null,buzzer:{open:false,entries:[],startedAt:Date.now()},created:Date.now()});res.json({code:c,hostUrl:`/game?room=${c}&host=${token}`,joinUrl:`/join/${c}`,displayUrl:`/game?room=${c}&view=player`});});
app.get('/api/rooms/:code',(req,res)=>{const r=rooms.get(req.params.code.toUpperCase());if(!r)return res.status(404).json({error:'Room not found'});res.json({code:r.code,open:true,hostOnline:!!r.hostSocket});});
app.get('/bridge.js',(req,res)=>res.type('application/javascript').sendFile(path.join(__dirname,'bridge.js')));
app.get('/join/:code',(req,res)=>res.sendFile(path.join(__dirname,'public','join.html')));
app.get('/game',(req,res)=>res.sendFile(path.join(__dirname,'public','game.html')));
app.use(express.static(path.join(__dirname,'public')));
io.on('connection',socket=>{
 let current=null,role=null,playerId=null;
 socket.on('enter',({room,host,view,playerId:previousId}={},ack=()=>{})=>{
  const r=rooms.get(String(room||'').toUpperCase());if(!r)return ack({error:'Room not found. Ask the host for a new link.'});
  current=r;
  if(view==='host'){
   if(host!==r.token)return ack({error:'Invalid host link'});
   role='host';r.hostSocket=socket.id;
  }else if(view==='display')role='display';else if(view==='participant'){
   const previous=previousId&&r.players.get(previousId);
   if(previous){playerId=previous.id;previous.connected=true;}
   role='participant';
  }else return ack({error:'Invalid view'});
  socket.join('room:'+r.code);ack({ok:true,code:r.code,playerId,lobby:summary(r),snapshot:r.snapshot,buzzer:r.buzzer});emitLobby(r);
 });
 socket.on('joinPlayer',({name,previousId}={},ack=()=>{})=>{
  if(!current||role!=='participant')return ack({error:'Not connected to room'});
  name=clean(name);if(name.length<2)return ack({error:'Enter a name with at least 2 characters.'});
  if(current.players.size>=250)return ack({error:'Room is full'});
  const p=previousId&&current.players.get(previousId);
  if(p){p.name=name;p.connected=true;playerId=p.id;}
  else{playerId=crypto.randomUUID();current.players.set(playerId,{id:playerId,name,connected:true,team:null});}
  emitLobby(current);ack({ok:true,id:playerId,code:current.code});
 });
 socket.on('buzz',(_,ack=()=>{})=>{
  if(!current||role!=='participant'||!playerId||!current.players.has(playerId))return ack({error:'Join the game first'});
  const b=current.buzzer;if(!b.open)return ack({error:'The buzzer is locked'});
  if(b.entries.some(x=>x.id===playerId))return ack({error:'Already buzzed'});
  const p=current.players.get(playerId);
  b.entries.push({id:playerId,name:p.name,team:p.team,rank:b.entries.length+1,elapsedMs:Date.now()-b.startedAt});
  emitBuzzer(current);ack({ok:true,rank:b.entries.length});
 });
 socket.on('buzzerControl',({action}={},ack=()=>{})=>{
  if(!current||role!=='host'||socket.id!==current.hostSocket)return ack({error:'Host access required'});
  const b=current.buzzer;
  if(action==='reset'){b.entries=[];b.open=false;b.startedAt=Date.now();}
  else if(action==='open'){b.open=true;b.startedAt=Date.now();}
  else if(action==='lock')b.open=false;
  else return ack({error:'Unknown buzzer action'});
  emitBuzzer(current);ack({ok:true});
 });
 socket.on('sync',data=>{
  if(!current||role!=='host'||socket.id!==current.hostSocket)return;
  if(!data||typeof data!=='object'||!data.state||JSON.stringify(data).length>8e6)return;
  current.snapshot=data;socket.to('room:'+current.code).emit('gameSync',data);
  const teams=(data.state.players||[]);for(const p of current.players.values()){const t=teams.findIndex(arr=>Array.isArray(arr)&&arr.some(x=>x.id===p.id));p.team=t>=0?t:null;}emitLobby(current);
 });
 socket.on('strike',payload=>{if(current&&role==='host'&&socket.id===current.hostSocket)socket.to('room:'+current.code).emit('gameStrike',{count:Math.max(1,Math.min(3,Number(payload?.count)||1))})});
 socket.on('kick',({id}={})=>{if(current&&role==='host'&&socket.id===current.hostSocket){current.players.delete(id);current.buzzer.entries=current.buzzer.entries.filter(x=>x.id!==id);emitBuzzer(current);emitLobby(current)}});
 socket.on('disconnect',()=>{if(!current)return;if(role==='host'&&current.hostSocket===socket.id)current.hostSocket=null;if(role==='participant'&&playerId&&current.players.has(playerId))current.players.get(playerId).connected=false;emitLobby(current)});
});
const PORT=process.env.PORT||3000;server.listen(PORT,'0.0.0.0',()=>console.log('Pronto Game online at http://localhost:'+PORT));
