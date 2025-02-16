const { replicationEvents } = require('../db/config');

function replicationMonitor(req, res, next) {
    if (req.method !== 'GET') {
        replicationEvents.once('replicationSuccess', (query) => {
            console.log(`✅ Replicated: ${query}`);
        });

        replicationEvents.once('replicationError', ({ query, error }) => {
            console.error(`❌ Replication failed: ${query}`);
        });
    }
    next();
}

module.exports = replicationMonitor; 