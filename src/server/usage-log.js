const { randomUUID } = require('crypto');

function usageLog(event, fields = {}) {
    const entry = { timestamp: new Date().toISOString(), level: 'info', category: 'usage', schemaVersion: 1, eventId: randomUUID(), event };
    for (const [key, value] of Object.entries(fields)) {
        if (typeof value === 'string') entry[key] = value.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 180);
        else if (typeof value === 'number' || typeof value === 'boolean' || value === null) entry[key] = value;
    }
    // Production mutes legacy console.log calls; usage records must still reach Render.
    process.stdout.write(`${JSON.stringify(entry)}\n`);
}

module.exports = { usageLog };
