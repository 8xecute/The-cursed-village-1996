import { client } from '../core/client.js';


client.actions.wirePopupCollapseControl = function wirePopupCollapseControl(toggle, popup, overlay) {
    toggle.onclick = () => {
        const isCollapsed = popup.classList.toggle('is-collapsed');
        overlay.classList.toggle('is-collapsed', isCollapsed);
        toggle.textContent = isCollapsed ? 'ขยาย' : 'ย่อ';
        toggle.setAttribute('aria-expanded', String(!isCollapsed));
        toggle.setAttribute('aria-label', isCollapsed ? 'ขยายหน้าต่าง' : 'ย่อหน้าต่าง');
    };
};

client.actions.addTryalPopupCollapseControl = function addTryalPopupCollapseControl(popup, overlay, title) {
    const header = document.createElement('div');
    header.className = 'popup-collapse-header night-action-title-row';
    title.classList.add('night-action-title');
    popup.insertBefore(header, title);
    header.appendChild(title);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'popup-collapse-toggle action-btn';
    toggle.textContent = 'ย่อ';
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'ย่อหน้าต่าง');
    header.appendChild(toggle);

    const content = document.createElement('div');
    content.className = 'popup-collapsible-content';
    while (header.nextSibling) content.appendChild(header.nextSibling);
    popup.appendChild(content);

    client.actions.wirePopupCollapseControl(toggle, popup, overlay);
};
