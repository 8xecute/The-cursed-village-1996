import { client } from '../core/client.js';

export function cardArtworkUrl(file) {
    return `cards/${file}?v=new-v4`;
}

export function initialize() {
    client.state.cardArtwork = 'new';
    try { localStorage.removeItem('villageCardArtwork'); } catch (_) {}
}
