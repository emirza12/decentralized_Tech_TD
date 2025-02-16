const { Pool } = require('pg');
const { EventEmitter } = require('events');

// Event emitter for replication events
const replicationEvents = new EventEmitter();

// Primary pool (Normalized structure)
const primaryPool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_PRIMARY_HOST || 'localhost',
    database: process.env.DB_PRIMARY_NAME || 'ecommerce_primary',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PRIMARY_PORT || 5432,
});

// Mirror pool (Denormalized structure)
const mirrorPool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_MIRROR_HOST || 'localhost',
    database: process.env.DB_MIRROR_NAME || 'ecommerce_mirror',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_MIRROR_PORT || 5432,
});

// Transform queries for mirror database
function transformQuery(query, params) {
    if (query.toLowerCase().includes('insert into products')) {
        return {
            query: `
                INSERT INTO products_denormalized (name, description, price, category, in_stock)
                VALUES ($1, $2, $3, $4, $5) RETURNING *
            `,
            params: params
        };
    }
    
    if (query.toLowerCase().includes('delete from products')) {
        return {
            query: 'DELETE FROM products_denormalized WHERE id = $1',
            params: params
        };
    }
    
    if (query.toLowerCase().includes('delete from cart_items')) {
        return {
            query: 'DELETE FROM cart_items_denormalized WHERE user_id = $1 AND product_id = $2',
            params: params
        };
    }

    if (query.toLowerCase().includes('insert into orders')) {
        return {
            query: `
                INSERT INTO orders_denormalized (
                    user_id, total_amount, items, status
                ) VALUES (
                    $1, $2, 
                    (SELECT json_agg(json_build_object(
                        'product_id', p.id,
                        'name', p.name,
                        'quantity', oi.quantity,
                        'price', oi.price_at_time
                    ))
                    FROM order_items oi
                    JOIN products p ON p.id = oi.product_id
                    WHERE oi.order_id = $3),
                    'pending'
                )
            `,
            params: [params[0], params[1], params[2]]
        };
    }

    return { query, params };
}

// Replication queue
let replicationQueue = [];
let isReplicating = false;

// Add operation to replication queue
function queueReplication(query, params) {
    const transformedQuery = transformQuery(query, params);
    replicationQueue.push(transformedQuery);
    processReplicationQueue();
}

// Process replication queue
async function processReplicationQueue() {
    if (isReplicating || replicationQueue.length === 0) return;

    isReplicating = true;
    
    while (replicationQueue.length > 0) {
        const { query, params } = replicationQueue[0];
        
        try {
            await mirrorPool.query(query, params);
            replicationQueue.shift();
            replicationEvents.emit('replicationSuccess', query);
        } catch (error) {
            console.error('Replication error:', error);
            replicationEvents.emit('replicationError', { query, error });
            break;
        }
    }

    isReplicating = false;
}

// Execute query with async replication
async function executeQuery(query, params = [], options = { requiresReplication: true }) {
    try {
        const primaryResult = await primaryPool.query(query, params);
        
        if (options.requiresReplication && !query.toLowerCase().startsWith('select')) {
            queueReplication(query, params);
        }

        return primaryResult;
    } catch (primaryError) {
        console.error('Primary database error:', primaryError);
        
        if (query.toLowerCase().startsWith('select')) {
            try {
                const mirrorResult = await mirrorPool.query(query, params);
                console.log('Failover to mirror for read operation');
                return mirrorResult;
            } catch (mirrorError) {
                throw new Error('Database system unavailable');
            }
        }
        throw primaryError;
    }
}

// Health check
async function checkDatabaseHealth() {
    try {
        await primaryPool.query('SELECT 1');
        console.log('✅ Primary database (Normalized) connected');
    } catch (error) {
        console.error('❌ Primary database error');
    }

    try {
        await mirrorPool.query('SELECT 1');
        console.log('✅ Mirror database (Denormalized) connected');
        console.log(`ℹ️ Replication queue length: ${replicationQueue.length}`);
    } catch (error) {
        console.error('❌ Mirror database error');
    }
}

// Periodic health check
setInterval(checkDatabaseHealth, 30000);
checkDatabaseHealth();

module.exports = {
    executeQuery,
    checkDatabaseHealth,
    replicationEvents
}; 