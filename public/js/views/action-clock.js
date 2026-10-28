import { client } from '../core/client.js';
export function initialize() {
  const settings=document.createElement('div');settings.className='lobby-witch-setting';
  const label=document.createElement('label');label.textContent='เวลาต่อแอ็กชัน (วินาที)';label.htmlFor='action-seconds';
  const input=document.createElement('input');input.id='action-seconds';input.type='number';input.min='0';input.max='600';input.step='1';input.value='0';
  const hint=document.createElement('small');hint.textContent='0 = ไม่จำกัด · ทุกคนกดนาฬิกาทรายเริ่ม 60 วินาทีได้';
  settings.append(label,input,hint);document.querySelector('.lobby-settings-grid').append(settings);
  const panel=document.createElement('div');panel.id='action-clock-controls';panel.hidden=true;
  const start=document.createElement('button');start.type='button';start.textContent='⌛ 60 วินาที';start.title='เริ่มจับเวลาแอ็กชัน 60 วินาที';start.setAttribute('aria-label',start.title);
  const time=document.createElement('span');time.setAttribute('role','timer');
  const cancel=document.createElement('button');cancel.type='button';cancel.textContent='ยกเลิกเวลา';cancel.hidden=true;
  panel.append(start,time,cancel);document.getElementById('game-section').prepend(panel);
  const style=document.createElement('style');style.textContent=`#action-clock-controls[hidden]{display:none!important} #action-clock-controls{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:6px;padding:6px;background:#241c15;border:1px solid #9b7b49;border-radius:8px} #action-clock-controls button[hidden]{display:none!important} #action-clock-controls button{min-height:44px;width:auto;margin:0;padding:6px 10px;font-size:14px} #action-clock-controls span{color:#efdab5;font-variant-numeric:tabular-nums} #action-clock-controls.is-urgent{border-color:#e1a04c} body.game-view-3d #action-clock-controls{position:absolute;top:58px;left:50%;transform:translateX(-50%);z-index:100;max-width:calc(100% - 24px);width:max-content}`;document.head.append(style);
  let state=null,offset=0;
  const render=()=>{
    if(!state)return;
    const timer=state.actionTimer;
    const active=state.gameStarted && !state.gameOver;
    panel.hidden=!active;
    if(!active)return;
    const root=document.body.classList.contains('game-view-3d')?document.querySelector('#table3d-section .table3d-hand-controls'):document.getElementById('game-section');
    if(panel.parentElement!==root)root.prepend(panel);
    const seconds=timer?.deadline?Math.max(0,Math.ceil((timer.deadline-Date.now()-offset)/1000)):null;
    start.hidden=!!timer?.seconds || !!timer?.deadline;
    start.disabled=!timer?.available || !client.state.socket.connected || !state.players?.[client.state.myUniqueId]?.alive || state.isSpectator;
    time.textContent=!timer?'⌛ ต้องรีสตาร์ตเซิร์ฟเวอร์เพื่อใช้ตัวจับเวลา':!timer.available?'⌛ เริ่มจับเวลาในเทิร์นกลางวัน':seconds===null?(timer.seconds?'⌛ ยกเลิกเวลาแล้ว':'⌛ ไม่จำกัดเวลา'):`⌛ ${seconds} วินาที`;
    time.hidden=!timer?.deadline && !start.hidden && !!timer?.available;
    cancel.hidden=seconds===null || seconds>10 || timer?.playerId!==client.state.myUniqueId;
    cancel.disabled=!client.state.socket.connected;
    panel.classList.toggle('is-urgent',seconds!==null && seconds<=10);
  };
  input.addEventListener('change',()=>{const value=Number(input.value);if(Number.isInteger(value)&&value>=0&&value<=600)client.state.socket.emit('set action seconds',value);});
  start.onclick=()=>client.state.socket.emit('start action clock');cancel.onclick=()=>client.state.socket.emit('cancel action clock');
  client.state.socket.on('room state update',next=>{state=next;offset=(next.actionTimer?.serverNow || Date.now())-Date.now();input.disabled=next.gameStarted || !next.players?.[client.state.myUniqueId]?.isHost;input.value=String(next.actionTimer?.seconds || 0);render();});
  client.state.socket.on('room left',()=>{state=null;panel.hidden=true;});
  setInterval(render,200);
}
