-- Mirror Database (Denormalized Structure)
CREATE TABLE products_denormalized (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    category VARCHAR(50),
    in_stock BOOLEAN DEFAULT true,
    stock_quantity INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders_denormalized (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    items JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE cart_items_denormalized (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    product_id INTEGER,
    product_name VARCHAR(100),
    product_price DECIMAL(10,2),
    quantity INTEGER NOT NULL,
    total_price DECIMAL(10,2),
    UNIQUE(user_id, product_id)
); 