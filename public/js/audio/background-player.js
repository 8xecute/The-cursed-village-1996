// Game-scoped audio, without an HTML media-player session.
export function createBackgroundPlayer(onPlaying) {
    let context, master, current, cached, pending, revision = 0;
    let file = '', volume = 0, unlocked = false, active = !document.hidden;
    let savedPosition = null;
    const voices = new Set(), fade = .45;
    function cancelLoad() { revision++; pending?.abort.abort(); pending = null; }
    function disconnect(voice) {
        voices.delete(voice); voice.source.disconnect(); voice.gain.disconnect();
    }
    function stop(remember) {
        if (remember && current) savedPosition = { file:current.file,
            offset:(current.offset + context.currentTime - current.started) % current.source.buffer.duration };
        for (const voice of [...voices]) {
            try { voice.source.stop(); } catch (_) {}
            disconnect(voice);
        }
        current = null; onPlaying(false);
    }
    function allowed() { return active && unlocked && volume > 0 && !!file; }
    function ensureContext() {
        if (context) return;
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) throw new Error('Web Audio unavailable');
        context = new Audio(); master = context.createGain(); master.gain.value = volume;
        master.connect(context.destination);
        context.onstatechange = () => onPlaying(allowed() && !!current && context.state === 'running');
    }
    async function decode(bytes) {
        // Keep a single mono track at 22 kHz, rather than caching decoded albums.
        const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        const decoded = await (Offline ? new Offline(1, 1, 22050) : context).decodeAudioData(bytes);
        if (decoded.numberOfChannels === 1) return decoded;
        const mono = context.createBuffer(1, decoded.length, decoded.sampleRate), out = mono.getChannelData(0);
        for (let c = 0; c < decoded.numberOfChannels; c++) {
            const channel = decoded.getChannelData(c);
            for (let i = 0; i < out.length; i++) out[i] += channel[i] / decoded.numberOfChannels;
        }
        return mono;
    }
    async function sync() {
        if (!allowed()) return;
        try {
            ensureContext();
            // Also queue resume behind a suspend that has not completed yet.
            await context.resume();
            if (!allowed()) return;
            if (current?.file === file) { onPlaying(context.state === 'running'); return; }
            if (pending?.file === file) return;
            cancelLoad();
            const job = { file, revision, abort:new AbortController() }; pending = job;
            try {
                let buffer = cached?.file === job.file ? cached.buffer : null;
                if (!buffer) {
                    const response = await fetch(job.file, { signal:job.abort.signal });
                    if (!response.ok) throw new Error('Music unavailable');
                    buffer = await decode(await response.arrayBuffer());
                }
                if (job.revision !== revision || job.file !== file || !allowed()) return;
                cached = { file:job.file, buffer };
                const source = context.createBufferSource(), gain = context.createGain(), now = context.currentTime;
                source.buffer = buffer; source.loop = true; source.connect(gain); gain.connect(master);
                const offset = savedPosition?.file === file ? savedPosition.offset % buffer.duration : 0;
                const voice = { source, gain, file, offset, started:now };
                gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(1, now + fade);
                if (current) {
                    current.gain.gain.cancelScheduledValues(now);
                    current.gain.gain.setValueAtTime(current.gain.gain.value, now);
                    current.gain.gain.linearRampToValueAtTime(0, now + fade);
                    current.source.stop(now + fade);
                }
                voices.add(voice);
                source.onended = () => { disconnect(voice); if (current === voice) { current = null; onPlaying(false); } };
                source.start(now, offset); current = voice; savedPosition = null;
                onPlaying(context.state === 'running');
            } catch (error) {
                if (job.revision === revision && error.name !== 'AbortError') {
                    stop(false); cached = null; context.suspend().catch(() => {});
                }
            } finally { if (pending === job) pending = null; }
        } catch (_) { onPlaying(false); }
    }
    function pause() { cancelLoad(); stop(true); context?.suspend().catch(() => {}); }
    return {
        setTrack(next) {
            if (file !== next) { file = next; savedPosition = null; cancelLoad(); }
            if (!file) { pause(); savedPosition = null; return; }
            if (allowed()) void sync();
        },
        setVolume(next) {
            volume = Math.max(0, Math.min(1, next));
            if (master) master.gain.setTargetAtTime(volume, context.currentTime, .025);
            if (!volume) pause(); else void sync();
        },
        unlock() { unlocked = true; if (allowed()) void sync(); },
        setActive(next) { active = next; if (!next) pause(); else void sync(); }
    };
}
