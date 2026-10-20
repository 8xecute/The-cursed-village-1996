import { getTrainingCardCategory } from './lessons.js';

let bundle;
function loadBundle() {
    if (window.VillageTable3D) return Promise.resolve();
    if (!bundle) bundle = new Promise((resolve, reject) => {
        const script = document.createElement('script'); script.src = 'table3d.bundle.js';
        script.onload = () => window.VillageTable3D ? resolve() : reject(new Error('โหลดโต๊ะไม่สำเร็จ'));
        script.onerror = () => { script.remove(); reject(new Error('โหลดโต๊ะไม่สำเร็จ')); };
        document.head.appendChild(script);
    }).catch(error => { bundle = null; throw error; });
    return bundle;
}

// The tutorial owns a separate renderer and invokes only local lesson actions.
// It never joins a room or emits a gameplay socket event.
export function createTrainingTable({ imageFor, action, onError }) {
    const root = document.createElement('section'); root.className = 'training-table';
    const canvas = document.createElement('div'); canvas.className = 'training-table-canvas';
    const controls = document.createElement('div'); controls.className = 'training-table-controls';
    root.append(canvas, controls);
    let engine, snapshot, generation = 0, lowered = false, visible = false;
    function control(label, handler) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
        button.onclick = handler; controls.appendChild(button); return button;
    }
    control('◀', () => engine?.stepSeat(-1)).setAttribute('aria-label', 'ดูผู้เล่นทางซ้าย');
    const handToggle = control('วางไพ่', () => { lowered = !lowered; handToggle.textContent = lowered ? 'ยกไพ่' : 'วางไพ่'; sync(); });
    control('กลับโต๊ะ', () => engine?.resetCamera());
    control('▶', () => engine?.stepSeat(1)).setAttribute('aria-label', 'ดูผู้เล่นทางขวา');
    const end = control('จบเทิร์น', () => action('end'));
    end.className = 'training-candle-button'; canvas.appendChild(end);
    function sync() {
        if (!engine || !snapshot || !visible) return;
        const { scene, lesson, selected, targets, finished, lifeOwner, lifeChoice, lifeCount, effectChoices, effectSelection, drawAction, endAction, endLabel } = snapshot;
        const category = name => ({ 'card-red': 'Red', 'card-green': 'Green', 'card-blue': 'Blue', 'card-black': 'Black' }[getTrainingCardCategory(name).className]);
        const players = Object.fromEntries(scene.players.map(player => [String(player.id), {
            uniqueId: String(player.id), name: player.name, alive: player.alive,
            handSize: player.hand, tryalCardCount: player.life,
            tryalCards: Array.from({length: player.life}, (_, i) => ({ name: player.id === 0
                ? (i === 0 && scene.role === 'ปอบ' ? 'Witch' : i === 0 && scene.role === 'หมอผี' ? 'Constable' : 'Not A Witch') : null })),
            revealedTryalCards: [], accusationPoints: player.accusations.reduce((sum, name) => sum + ({Accusation:1, Evidence:3, Witness:7}[name] || 0), 0),
            inPlayCards: [...player.effects.filter(name => name !== 'constable-protected'), ...player.accusations].map(name => ({ name, color: category(name) }))
        }]));
        let interaction = null;
        if (!finished && lifeOwner != null) interaction = { kind:'life', owner:String(lifeOwner), eligible:Array.from({length:lifeCount}, (_,i)=>i), selected:lifeChoice == null ? [] : [lifeChoice] };
        else if (!finished && effectChoices.length) interaction = { kind:'effect', owner:'1', eligible:effectChoices, selected:effectSelection };
        else if (!finished && (selected || ['witch','healer','reveal'].includes(lesson.kind))) interaction = {
            kind:'player', eligible:scene.players.filter(p => p.alive && p.id !== 0).map(p=>String(p.id)),
            selected:targets.map(String), blocked:{'0':'คุณ'}, outcomes:{}
        };
        const hand = lesson.kind === 'card' && !finished ? [{ name:lesson.card, color:category(lesson.card) }] : [];
        end.hidden = !endAction; end.textContent = endLabel || 'จบเทิร์น';
        engine.update({state:{gameStarted:true, currentPhase:scene.phase === 'กลางคืน' ? 'NIGHT':'DAY', players, deckCount:scene.deck, discardPileCount:scene.discard},
            me:'0', hand, selected:selected ? 0:null, imageFor, handLowered:lowered, interaction, canDraw:!!drawAction, canEndTurn:!!endAction});
    }
    return {
        root,
        async update(next) {
            snapshot = next; visible = true;
            const version = ++generation;
            try {
                await loadBundle();
                if (!visible || version !== generation) return;
                if (!engine) engine = window.VillageTable3D.create({container:canvas, quality:'low',
                    onCard:()=>action('card'), onDraw:()=>action(snapshot.drawAction), onEndTurn:()=>action('end'),
                    onPlayer:id=>action(`target-${id}`), onLife:(id,i)=>{
                        if (snapshot.lesson.kind === 'life' && id === '0') action('card');
                        else if (snapshot.lifeOwner != null && id === String(snapshot.lifeOwner)) action(`life-${i}`);
                    },
                    onEffect:(_,i)=>action(`effect-${snapshot.effectMap[i]}`),
                    onCandleAnchor:({x,y,visible:inView})=>{
                        end.style.left=`${x.toFixed(2)}%`; end.style.top=`${y.toFixed(2)}%`;
                        end.hidden = !inView || !snapshot?.endAction;
                    }, onError:()=>onError()});
                engine.setActive(true); sync();
            } catch (_) { if (visible && version === generation) onError(); }
        },
        pause() { visible=false; generation++; engine?.setActive(false); },
        dispose() { visible=false; generation++; engine?.dispose(); engine=null; }
    };
}
