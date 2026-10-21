import { client } from '../core/client.js';

export function lifeTile(name, opened = false) {
    const tile = document.createElement('figure'); tile.className = 'life-tile';
    const card = document.createElement('div');
    card.className = `card tryal-card tryal-card-in-hand ${name === 'Witch' ? 'witch' : name === 'Constable' ? 'constable' : 'notawitch'}`;
    if (name) card.appendChild(client.actions.createCardImage(name));
    else {
        const back = document.createElement('img'); back.src = 'cards/back.svg'; back.alt = 'การ์ดชีวิตคว่ำ';
        card.appendChild(back);
    }
    tile.appendChild(card);
    if (opened) {
        tile.classList.add('life-tile-revealed');
        const caption = document.createElement('figcaption'); caption.textContent = 'เปิดเผยแล้ว';
        tile.appendChild(caption);
    }
    return tile;
}
