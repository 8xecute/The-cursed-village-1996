import { client } from '../core/client.js';

export function cardArtworkUrl(file) {
    const classic = client.state.cardArtwork === 'classic';
    return `cards/${classic ? 'classic/' : ''}${file}?v=${classic ? 'classic-v1' : 'new-v4'}`;
}

export function initialize() {
    try { client.state.cardArtwork = localStorage.getItem('villageCardArtwork') === 'classic' ? 'classic' : 'new'; }
    catch (_) { client.state.cardArtwork = 'new'; }
    const button = document.getElementById('card-artwork-toggle');
    function updateImages(root = document) {
        const images = root.matches?.('img') ? [root] : [...(root.querySelectorAll?.('img') || [])];
        for (const image of images) {
            let file = image.dataset.cardArtwork;
            if (!file) {
                const match = image.getAttribute('src')?.match(/(?:^|\/)cards\/(?:classic\/)?([a-z]+\.png)(?:[?#]|$)/);
                if (!match) continue;
                file = match[1]; image.dataset.cardArtwork = file;
            }
            const url = cardArtworkUrl(file);
            if (image.getAttribute('src') !== url) image.setAttribute('src', url);
        }
    }
    function refresh() {
        button.textContent = client.state.cardArtwork === 'classic' ? 'ภาพการ์ด: เก่า ⇄' : 'ภาพการ์ด: ใหม่ ⇄';
        button.setAttribute('aria-pressed', String(client.state.cardArtwork === 'classic'));
        const label = `ภาพการ์ด: ${client.state.cardArtwork === 'classic' ? 'เก่า' : 'ใหม่'} · กดเพื่อสลับ`;
        button.title = label;
        button.setAttribute('aria-label', label);
        updateImages();
        client.actions.syncTable3D?.();
    }
    button.addEventListener('click', () => {
        client.state.cardArtwork = client.state.cardArtwork === 'classic' ? 'new' : 'classic';
        try { localStorage.setItem('villageCardArtwork', client.state.cardArtwork); } catch (_) { /* Session setting still works. */ }
        refresh();
    });
    new MutationObserver(records => {
        for (const record of records) for (const node of record.addedNodes) {
            if (node.nodeType === 1) updateImages(node);
        }
    }).observe(document.body, { childList: true, subtree: true });
    refresh();
}
