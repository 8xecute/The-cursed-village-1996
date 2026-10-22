import { client } from '../core/client.js';

// Public reveal events share one presentation in both views, in server event order.
export function initialize() {
    const stage=document.createElement('section');
    stage.id='life-reveal';stage.hidden=true;stage.setAttribute('aria-label','เปิดชะตา');
    stage.innerHTML='<div class="reveal-panel"><p class="reveal-eyebrow">เปิดชะตา</p><h2></h2><p class="reveal-context"></p><div class="reveal-card"><div class="reveal-back"></div><div class="reveal-front"></div></div><p class="reveal-result" role="status" aria-live="polite"></p><button type="button">กลับไปดูกระดาน</button></div>';
    document.body.append(stage);
    const queue=[];let busy=false,timers=[];
    const later=(fn,delay)=>timers.push(setTimeout(fn,delay));
    function clear() {
        timers.forEach(clearTimeout);timers=[];queue.length=0;busy=false;
        stage.hidden=true;stage.classList.remove('is-open');
        client.actions.setRevealMusicDucking?.(false);
    }
    function next() {
        if(busy || !queue.length || document.hidden)return;
        busy=true;const event=queue.shift();
        const name=client.actions.displayCardName(event.cardName);
        stage.dataset.card=event.cardName;
        stage.querySelector('h2').textContent=event.playerName;
        stage.querySelector('.reveal-context').textContent=`${event.phase==='PRE_DAWN'?'สารภาพ':'เปิดการ์ดชีวิต'} · ใบที่ ${event.slot+1}`;
        stage.querySelector('.reveal-front').replaceChildren(client.actions.createCardImage(event.cardName));
        stage.querySelector('.reveal-result').textContent='กำลังเปิดชะตา…';
        stage.classList.remove('is-open');stage.hidden=false;
        client.actions.setRevealMusicDucking?.(true);
        client.actions.playGameSound?.('deal');
        later(()=>{
            stage.classList.add('is-open');
            const result=event.cardName==='Witch'?'เปิดพบปอบ · เสียชีวิต':event.remaining===0?`${name} · ไม่เหลือการ์ดชีวิตแล้ว`:event.cardName==='Constable'?`หมอผีถูกเปิดเผย · หมดพลังปกป้อง`:`ชาวบ้าน · ชีวิตที่ยังไม่เปิด ${event.remaining} ใบ`;
            stage.querySelector('.reveal-result').textContent=result;
            client.actions.playGameSound?.('place');
        },1100);
        later(()=>{
            stage.hidden=true;stage.classList.remove('is-open');busy=false;timers=[];
            client.actions.setRevealMusicDucking?.(false);next();
        },3500);
    }
    stage.querySelector('button').onclick=clear;
    client.state.socket.on('life card revealed',event=>{
        if(document.hidden || !event || !['Not A Witch','Witch','Constable'].includes(event.cardName))return;
        queue.push(event);next();
    });
    client.state.socket.on('room left',clear);
    client.state.socket.on('disconnect',clear);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
}
