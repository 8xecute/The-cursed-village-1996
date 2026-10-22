// Short filtered-noise layers: paper friction, a wooden tabletop and gun metal.
export function playSurfaceSound(audio, volume, kind, delay = 0, onEnded = () => {}) {
    const when=audio.currentTime+Math.max(0,delay), nodes=[], sources=[];
    const mix=audio.createGain(); mix.gain.value=volume; mix.connect(audio.destination); nodes.push(mix);
    let end=when, lastSource, cleaned=false;
    function noise(offset,duration,frequency,level,q=.65) {
        const buffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*duration),audio.sampleRate), samples=buffer.getChannelData(0);
        let brown=0;
        for(let i=0;i<samples.length;i++) { brown=(brown+(Math.random()*2-1)*.12)/1.05; samples[i]=brown*2; }
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
        noise(0,.12,1700,.34);noise(.012,.085,240,.55,.6);
        const thump=audio.createOscillator(), envelope=audio.createGain();thump.type='sine';
        thump.frequency.setValueAtTime(118,when);thump.frequency.exponentialRampToValueAtTime(52,when+.065);
        envelope.gain.setValueAtTime(.10,when);envelope.gain.exponentialRampToValueAtTime(.0001,when+.09);
        thump.connect(envelope);envelope.connect(mix);thump.start(when);thump.stop(when+.1);nodes.push(thump,envelope);sources.push(thump);
    } else {
        noise(0,kind==='deal'?.13:.19,1500,kind==='deal'?.33:.42);
        noise(.025,.075,3600,.2,1.1);
    }
    function cleanup() { if(cleaned)return;cleaned=true;nodes.forEach(node=>node.disconnect());onEnded(); }
    const stop=()=>{sources.forEach(source=>{try{source.stop();}catch(_){}});cleanup();};
    lastSource.onended=cleanup;
    return stop;
}
