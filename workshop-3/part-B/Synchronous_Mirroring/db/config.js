const { Pool } = require('pg');

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
    // Pour les requêtes SELECT sur products
    if (query.toLowerCase().includes('select * from products')) {
        if (query.toLowerCase().includes('where id =')) {
            return {
                query: 'SELECT * FROM products_denormalized WHERE id = $1',
                params: params
            };
        }
        return {
            query: 'SELECT * FROM products_denormalized',
            params: []
        };
    }

    // Pour les requêtes UPDATE sur products
    if (query.toLowerCase().includes('update products set')) {
        return {
            query: `
                UPDATE products_denormalized 
                SET name = $1, 
                    description = $2, 
                    price = $3, 
                    category = $4, 
                    in_stock = $5 
                WHERE id = $6 
                RETURNING *
            `,
            params: params
        };
    }

    // Pour les requêtes DELETE sur products
    if (query.toLowerCase().includes('delete from products')) {
        return {
            query: 'DELETE FROM products_denormalized WHERE id = $1',
            params: params
        };
    }

    // Pour les requêtes INSERT dans products
    if (query.toLowerCase().includes('insert into products')) {
        return {
            query: `
                INSERT INTO products_denormalized (name, description, price, category, in_stock)
                VALUES ($1, $2, $3, $4, $5) RETURNING *
            `,
            params: params
        };
    }

    // Pour les requêtes sur cart_items
    if (query.toLowerCase().includes('cart_items')) {
        if (query.toLowerCase().includes('insert into')) {
            return {
                query: `
                    INSERT INTO cart_items_denormalized (user_id, product_id, quantity)
                    VALUES ($1, $2, $3) RETURNING *
                `,
                params: params
            };
        }
        if (query.toLowerCase().includes('delete')) {
            return {
                query: 'DELETE FROM cart_items_denormalized WHERE user_id = $1 AND product_id = $2',
                params: params
            };
        }
        if (query.toLowerCase().includes('select')) {
            return {
                query: 'SELECT * FROM cart_items_denormalized WHERE user_id = $1',
                params: [params[0]]
            };
        }
    }

    // Pour les requêtes sur orders
    if (query.toLowerCase().includes('orders')) {
        if (query.toLowerCase().includes('select o.*')) {
            return {
                query: 'SELECT * FROM orders_denormalized WHERE user_id = $1',
                params: [params[0]]
            };
        }
    }

    // Si aucune transformation n'est nécessaire, retourner la requête originale
    return { query, params };
}

// Execute query on both databases with transformation
async function executeQuery(query, params = []) {
    try {
        // Execute on primary (normalized)
        const primaryResult = await primaryPool.query(query, params);
        
        // Transform and execute on mirror (denormalized)
        const { query: mirrorQuery, params: mirrorParams } = transformQuery(query, params);
        console.log('🔄 Mirror query:', {
            query: mirrorQuery,
            params: mirrorParams
        });
        await mirrorPool.query(mirrorQuery, mirrorParams);

        return primaryResult;
    } catch (error) {
        console.error('❌ Database error:', error.message);
        throw error;
    }
}

// Health check
async function checkDatabaseHealth() {
    try {
        await primaryPool.query('SELECT 1');
        console.log('✅ Primary DB connected');
    } catch (error) {
        console.error('❌ Primary DB error');
    }

    try {
        await mirrorPool.query('SELECT 1');
        console.log('✅ Mirror DB connected');
    } catch (error) {
        console.error('❌ Mirror DB error');
    }
}

setInterval(checkDatabaseHealth, 30000);
checkDatabaseHealth();

module.exports = {
    executeQuery,
    checkDatabaseHealth
}; 