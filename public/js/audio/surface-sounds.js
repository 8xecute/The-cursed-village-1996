// Short filtered-noise layers: paper friction, a wooden tabletop and gun metal.
export function playSurfaceSound(audio, volume, kind, delay = 0, onEnded = () => {}) {
    const when=audio.currentTime+Math.max(0,delay), nodes=[], sources=[];
    const mix=audio.createGain(); mix.gain.value=volume; mix.connect(audio.destination); nodes.push(mix);
    let end=when, lastSource, cleaned=false;
    function noise(offset,duration,frequency,level,q=.65,paper=false) {
        const buffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*duration),audio.sampleRate), samples=buffer.getChannelData(0);
        let brown=0;
        for(let i=0;i<samples.length;i++) {
            const white=Math.random()*2-1;
            brown=(brown+white*.12)/1.05;
            // Cardstock friction has bright, uneven grains rather than a smooth bass whoosh.
            const grain=.5+.5*Math.sin(i/audio.sampleRate*2*Math.PI*173);
            samples[i]=paper ? white*(.35+.65*grain) : brown*2;
        }
        const source=audio.createBufferSource(), filter=audio.createBiquadFilter(), gain=audio.createGain(), start=when+offset;
        source.buffer=buffer; filter.type='bandpass';filter.frequency.value=frequency*(.94+Math.random()*.12);filter.Q.value=q;
        gain.gain.setValueAtTime(.0001,start);gain.gain.linearRampToValueAtTime(level,start+.004);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
        source.connect(filter);filter.connect(gain);gain.connect(mix);source.start(start);source.stop(start+duration);
        nodes.push(source,filter,gain);sources.push(source);
        if(start+duration>=end) {end=start+duration;lastSource=source;}
    }
    if(kind==='turn') { noise(0,.08,650,.5,2);noise(.105,.10,950,.36,2.5); }
    else if(kind==='mechanism') { noise(0,.055,2300,.45,1.3);noise(.07,.04,1100,.3,1.5); }
    else if(kind==='place') {
        noise(0,.027,3300,.24,.5,true); // Thin edge hitting the tabletop.
        noise(.008,.055,620,.28,.55,true);
        noise(.032,.105,2400,.13,.45,true); // Paper settles and slides a little.
    } else {
        noise(0,kind==='deal'?.10:.15,2600,.25,.45,true);
        noise(.018,.038,4800,.14,.5,true);
        if(kind==='flip')noise(.08,.045,1800,.16,.5,true);
    }
    function cleanup() { if(cleaned)return;cleaned=true;nodes.forEach(node=>node.disconnect());onEnded(); }
    const stop=()=>{sources.forEach(source=>{try{source.stop();}catch(_){}});cleanup();};
    lastSource.onended=cleanup;
    return stop;
}
