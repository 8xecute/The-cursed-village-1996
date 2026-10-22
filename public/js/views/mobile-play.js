import { client } from '../core/client.js';
let initialized = false;

export function initializeMobilePlay() {
    if (initialized) return;
    initialized = true;
    const mobile = matchMedia('(max-width:768px), (max-width:950px) and (max-height:520px)');
    const life = document.getElementById('own-life-panel');
    const navigation = document.getElementById('game-navigation');
    const menuButtons = [...document.querySelectorAll('.mobile-game-menu')];
    const detailsButton = document.getElementById('table3d-details-toggle');
    const detailsParent = detailsButton.parentElement;
    const viewRow = document.querySelector('.table3d-view-row');
    function closeMenu() {
        document.body.classList.remove('game-menu-open');
        menuButtons.forEach(button => button.setAttribute('aria-expanded', 'false'));
    }
    for (const button of menuButtons) button.addEventListener('click', () => {
        const open = !document.body.classList.contains('game-menu-open');
        document.body.classList.toggle('game-menu-open', open);
        menuButtons.forEach(control => control.setAttribute('aria-expanded', String(open)));
    });
    document.addEventListener('click', event => {
        if (event.target.closest('.mobile-game-menu')) return;
        if (!navigation.contains(event.target) || event.target.closest('button,a')) closeMenu();
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
    function layout() {
        life.open = !mobile.matches;
        closeMenu();
        // Use the existing 2D switch and its handler, without a second action.
        if (mobile.matches) {
            viewRow.appendChild(detailsButton);
            detailsButton.textContent = '2D'; detailsButton.title = 'เปลี่ยนเป็นกระดาน 2D';
        } else {
            detailsParent.prepend(detailsButton);
            detailsButton.textContent = 'เปิดกระดาน 2D';
        }
    }
    mobile.addEventListener('change', layout);
    client.state.socket.on('room left', closeMenu);
    layout();
}
