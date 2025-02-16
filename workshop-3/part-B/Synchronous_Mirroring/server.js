const express = require('express');
const { executeQuery, checkDatabaseHealth } = require('./db/config');
const timeout = require('./middleware/timeout');
const app = express();

const PORT = 3001;

app.use(express.json());
app.use(express.static('public'));
app.use(timeout(5)); // 5 secondes de timeout

// Route pour vérifier l'état du système
app.get('/health', async (req, res) => {
    try {
        await checkDatabaseHealth();
        res.json({ status: 'healthy' });
    } catch (error) {
        res.status(500).json({ error: "Health check failed" });
    }
});

// Product Routes
app.get('/products', async (req, res) => {
    try {
        const result = await executeQuery('SELECT * FROM products');
        const rows = result.rows || [];
        console.log('✅ Operation successful:', 'Products found');
        res.json(rows);
    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({ 
            error: "Error retrieving products",
            details: error.message
        });
    }
});

app.get('/products/:id', async (req, res) => {
    try {
        const result = await executeQuery(
            'SELECT * FROM products WHERE id = $1',
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }
        console.log('✅ Product found:', result.rows[0].name);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({ 
            error: "Error retrieving product",
            details: error.message
        });
    }
});

app.post('/products', async (req, res) => {
    try {
        const { name, description, price, category, inStock } = req.body;
        const result = await executeQuery(
            'INSERT INTO products (name, description, price, category, in_stock) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name, description, price, category, inStock]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({ 
            error: "Error creating product",
            details: error.message
        });
    }
});

app.delete('/products/:id', async (req, res) => {
    try {
        // D'abord, vérifiez si le produit existe
        const checkResult = await executeQuery(
            'SELECT * FROM products WHERE id = $1',
            [req.params.id]
        );
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }

        // Ensuite, supprimez le produit
        await executeQuery(
            'DELETE FROM products WHERE id = $1',
            [req.params.id]
        );

        console.log('✅ Product deleted:', req.params.id);
        res.json({ message: "Product successfully deleted" });
    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({ 
            error: "Error deleting product",
            details: error.message
        });
    }
});

// Cart Routes
app.post('/cart/:userId', async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const { rows } = await executeQuery(
            `INSERT INTO cart_items (user_id, product_id, quantity)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, product_id)
            DO UPDATE SET quantity = cart_items.quantity + $3
            RETURNING *`,
            [req.params.userId, productId, quantity]
        );
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: "Error adding item to cart" });
    }
});

app.get('/cart/:userId', async (req, res) => {
    try {
        const result = await executeQuery(
            `SELECT ci.*, p.name, p.price, (p.price * ci.quantity) as total_price
            FROM cart_items ci
            JOIN products p ON ci.product_id = p.id
            WHERE ci.user_id = $1`,
            [req.params.userId]
        );
        const rows = result.rows || [];
        res.json({
            items: rows || [],
            totalPrice: rows.reduce((sum, item) => sum + parseFloat(item.total_price || 0), 0)
        });
    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({ 
            error: "Error retrieving cart",
            details: error.message
        });
    }
});

app.delete('/cart/:userId/item/:productId', async (req, res) => {
    try {
        await executeQuery(
            'DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2',
            [req.params.userId, req.params.productId]
        );
        res.json({ message: "Item removed from cart" });
    } catch (error) {
        res.status(500).json({ error: "Error removing item from cart" });
    }
});

// Order Routes
app.post('/orders', async (req, res) => {
    try {
        const { userId, products } = req.body;
        let totalPrice = 0;

        // Calculate total price
        for (const item of products) {
            const { rows } = await executeQuery(
                'SELECT price FROM products WHERE id = $1',
                [item.productId]
            );
            if (rows.length > 0) {
                totalPrice += rows[0].price * item.quantity;
            }
        }

        // Create order
        const { rows: orderRows } = await executeQuery(
            'INSERT INTO orders (user_id, total_price) VALUES ($1, $2) RETURNING *',
            [userId, totalPrice]
        );

        // Add products to order
        for (const item of products) {
            await executeQuery(
                'INSERT INTO order_items (order_id, product_id, quantity, price_at_time) SELECT $1, $2, $3, price FROM products WHERE id = $2',
                [orderRows[0].id, item.productId, item.quantity]
            );
        }

        res.status(201).json(orderRows[0]);
    } catch (error) {
        res.status(500).json({ error: "Error creating order" });
    }
});

app.get('/orders/:userId', async (req, res) => {
    try {
        const result = await executeQuery(
            `SELECT o.*, json_agg(json_build_object(
                'product_id', oi.product_id,
                'quantity', oi.quantity,
                'price', oi.price_at_time
            )) as items
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            WHERE o.user_id = $1
            GROUP BY o.id`,
            [req.params.userId]
        );
        const rows = result.rows || [];
        res.json(rows);
    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({ 
            error: "Error retrieving orders",
            details: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`E-commerce server with synchronous mirroring is running on http://localhost:${PORT}`);
}); 