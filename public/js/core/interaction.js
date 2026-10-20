// Selection data and commands shared by 2D and 3D. Views own their DOM.
const sessions = new Map();
let serial = 0;
const priority = { life: 4, effect: 3, event: 2, player: 1 };
export function selectionChanged() {
    document.dispatchEvent(new Event('table3d selection'));
}
export function registerInteraction(root, descriptor) {
    const session = { ...descriptor, root, serial: ++serial, selected: [] };
    sessions.set(root, session);
    selectionChanged();
    return session;
}
export function currentInteraction() {
    for (const [root] of sessions) if (!root.isConnected) sessions.delete(root);
    return [...sessions.values()].sort((a, b) => (priority[b.kind] - priority[a.kind]) || b.serial - a.serial)[0] || null;
}
export function interactionSnapshot(session = currentInteraction()) {
    if (!session) return null;
    const data = session.read ? session.read() : session;
    return { kind: session.kind, owner: session.owner, event: session.event, eligible: [...(data.eligible || [])],
        selected: [...(data.selected || [])], blocked: { ...(data.blocked || {}) } };
}
// The view registers each command while building its controls, never via DOM lookup.
export function registerLifeInteraction(root, owner, commands, skip = null) {
    const session = registerInteraction(root, { kind: 'life', owner, eligible: [...commands.keys()], skip });
    session.choose = index => {
        if (!session.eligible.includes(index)) return;
        if (session.selected[0] === index) { sessions.delete(root); commands.get(index)(); }
        else session.selected = [index];
        selectionChanged();
    };
    return session;
}
