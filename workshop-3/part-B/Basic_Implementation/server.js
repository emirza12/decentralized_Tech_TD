const express = require('express');
const pool = require('./db/config');
const app = express();

const PORT = 3001;

// Middleware to parse JSON
app.use(express.json());

// Add this line after express initialization
app.use(express.static('public'));

app.get('/getServer', (req, res) => {
    res.json({
        code: 200,
        server: `localhost:${PORT}`
    });
});

// Product Routes
app.get('/products', async (req, res) => {
    try {
        const { category, inStock } = req.query;
        let query = 'SELECT * FROM products WHERE 1=1';
        const values = [];

        if (category) {
            values.push(category);
            query += ` AND category = $${values.length}`;
        }
        if (inStock !== undefined) {
            values.push(inStock === 'true');
            query += ` AND in_stock = $${values.length}`;
        }

        const { rows } = await pool.query(query, values);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: "Error retrieving products" });
    }
});

app.get('/products/:id', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: "Error retrieving product" });
    }
});

app.post('/products', async (req, res) => {
    try {
        const { name, description, price, category, inStock } = req.body;
        console.log('Received product data:', req.body); // Pour le debug

        if (!name || !description || !price) {
            return res.status(400).json({ error: "Name, description and price are required" });
        }

        const { rows } = await pool.query(
            'INSERT INTO products (name, description, price, category, in_stock) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name, description, price, category, inStock]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Database error:', error); // Pour le debug
        res.status(500).json({ error: "Error creating product: " + error.message });
    }
});

app.put('/products/:id', async (req, res) => {
    try {
        const { name, description, price, category, inStock } = req.body;
        const { rows } = await pool.query(
            'UPDATE products SET name = $1, description = $2, price = $3, category = $4, in_stock = $5 WHERE id = $6 RETURNING *',
            [name, description, price, category, inStock, req.params.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: "Error updating product" });
    }
});

app.delete('/products/:id', async (req, res) => {
    try {
        const { rows } = await pool.query('DELETE FROM products WHERE id = $1 RETURNING *', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }
        res.json({ message: "Product successfully deleted" });
    } catch (error) {
        res.status(500).json({ error: "Error deleting product" });
    }
});

// Order Routes
app.post('/orders', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const { userId, products } = req.body;
        let totalPrice = 0;

        // Calculate total price
        for (const item of products) {
            const { rows } = await client.query(
                'SELECT price FROM products WHERE id = $1',
                [item.productId]
            );
            if (rows.length > 0) {
                totalPrice += rows[0].price * item.quantity;
            }
        }

        // Create order
        const { rows: orderRows } = await client.query(
            'INSERT INTO orders (user_id, total_price) VALUES ($1, $2) RETURNING *',
            [userId, totalPrice]
        );

        // Add products to order
        for (const item of products) {
            await client.query(
                'INSERT INTO order_items (order_id, product_id, quantity, price_at_time) SELECT $1, $2, $3, price FROM products WHERE id = $2',
                [orderRows[0].id, item.productId, item.quantity]
            );
        }

        await client.query('COMMIT');
        res.status(201).json(orderRows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: "Error creating order" });
    } finally {
        client.release();
    }
});

app.get('/orders/:userId', async (req, res) => {
    try {
        const { rows } = await pool.query(
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
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: "Error retrieving orders" });
    }
});

// Cart Routes
app.post('/cart/:userId', async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const { rows } = await pool.query(
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
        const { rows } = await pool.query(
            `SELECT ci.*, p.name, p.price, (p.price * ci.quantity) as total_price
            FROM cart_items ci
            JOIN products p ON ci.product_id = p.id
            WHERE ci.user_id = $1`,
            [req.params.userId]
        );
        res.json({
            items: rows,
            totalPrice: rows.reduce((sum, item) => sum + item.total_price, 0)
        });
    } catch (error) {
        res.status(500).json({ error: "Error retrieving cart" });
    }
});

app.delete('/cart/:userId/item/:productId', async (req, res) => {
    try {
        await pool.query(
            'DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2',
            [req.params.userId, req.params.productId]
        );
        res.json({ message: "Item removed from cart" });
    } catch (error) {
        res.status(500).json({ error: "Error removing item from cart" });
    }
});

// Server startup
app.listen(PORT, () => {
    console.log(`E-commerce server is running on http://localhost:${PORT}`);
}); 