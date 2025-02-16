const express = require('express');
const { executeQuery } = require('./db/config');
const replicationMonitor = require('./middleware/replication-monitor');
const app = express();

const PORT = 3001;

app.use(express.json());
app.use(express.static('public'));
app.use(replicationMonitor);

// Product Routes
app.get('/products', async (req, res) => {
    try {
        const { rows } = await executeQuery('SELECT * FROM products');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: "Error retrieving products" });
    }
});

app.get('/products/:id', async (req, res) => {
    try {
        const { rows } = await executeQuery('SELECT * FROM products WHERE id = $1', [req.params.id]);
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
        const { rows } = await executeQuery(
            'INSERT INTO products (name, description, price, category, in_stock) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name, description, price, category, inStock]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: "Error creating product" });
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
        const { rows } = await executeQuery(
            `SELECT ci.*, p.name, p.price, (p.price * ci.quantity) as total_price
            FROM cart_items ci
            JOIN products p ON ci.product_id = p.id
            WHERE ci.user_id = $1`,
            [req.params.userId]
        );
        res.json({
            items: rows,
            totalPrice: rows.reduce((sum, item) => sum + parseFloat(item.total_price), 0)
        });
    } catch (error) {
        res.status(500).json({ error: "Error retrieving cart" });
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

        for (const item of products) {
            const { rows } = await executeQuery(
                'SELECT price FROM products WHERE id = $1',
                [item.productId]
            );
            if (rows.length > 0) {
                totalPrice += rows[0].price * item.quantity;
            }
        }

        const { rows: orderRows } = await executeQuery(
            'INSERT INTO orders (user_id, total_price) VALUES ($1, $2) RETURNING *',
            [userId, totalPrice]
        );

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
        const { rows } = await executeQuery(
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

// Ajoutez ces routes
app.delete('/products/:id', async (req, res) => {
    try {
        const { rows } = await executeQuery(
            'DELETE FROM products WHERE id = $1 RETURNING *',
            [req.params.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }
        res.json({ message: "Product successfully deleted" });
    } catch (error) {
        res.status(500).json({ error: "Error deleting product" });
    }
});

app.put('/products/:id', async (req, res) => {
    try {
        const { name, description, price, category, inStock } = req.body;
        const { rows } = await executeQuery(
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

app.listen(PORT, () => {
    console.log(`E-commerce server with asynchronous replication running on http://localhost:${PORT}`);
}); 