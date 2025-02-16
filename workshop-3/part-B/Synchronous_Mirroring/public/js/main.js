// Simulating a user ID (in a real app, this would come from authentication)
const USER_ID = 'user123';

// Load all data when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    loadCart();
    loadOrders();
});

// Products
async function loadProducts() {
    try {
        const response = await fetch('/products');
        const products = await response.json();
        const productsHTML = products.map(product => `
            <div class="col">
                <div class="card h-100">
                    <div class="card-body">
                        <span class="badge badge-stock bg-${product.in_stock ? 'success' : 'danger'}">
                            ${product.in_stock ? 'In Stock' : 'Out of Stock'}
                        </span>
                        <h5 class="card-title">${product.name}</h5>
                        <p class="card-text">${product.description}</p>
                        <p class="price">$${product.price}</p>
                        <p class="card-text"><small class="text-muted">Category: ${product.category}</small></p>
                        <div class="d-flex justify-content-between">
                            <button class="btn btn-primary" onclick="addToCart(${product.id})">
                                <i class="fas fa-cart-plus"></i> Add to Cart
                            </button>
                            <div class="btn-group">
                                <button class="btn btn-outline-secondary" onclick="editProduct(${product.id})">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-outline-danger" onclick="deleteProduct(${product.id})">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
        document.getElementById('productsList').innerHTML = productsHTML;
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

let currentProductId = null;
const productModal = new bootstrap.Modal(document.getElementById('productModal'));

function editProduct(id) {
    currentProductId = id;
    fetch(`/products/${id}`)
        .then(response => response.json())
        .then(product => {
            const form = document.getElementById('productForm');
            form.elements['name'].value = product.name;
            form.elements['description'].value = product.description;
            form.elements['price'].value = product.price;
            form.elements['category'].value = product.category;
            form.elements['inStock'].checked = product.in_stock;
            
            document.getElementById('modalTitle').textContent = 'Edit Product';
            productModal.show();
        })
        .catch(error => console.error('Error loading product:', error));
}

async function saveProduct() {
    const form = document.getElementById('productForm');
    const formData = new FormData(form);
    const productData = {
        name: formData.get('name'),
        description: formData.get('description'),
        price: parseFloat(formData.get('price')),
        category: formData.get('category'),
        inStock: formData.get('inStock') === 'on'
    };

    try {
        const url = currentProductId ? `/products/${currentProductId}` : '/products';
        const method = currentProductId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(productData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }

        form.reset();
        productModal.hide();
        loadProducts();
        currentProductId = null;
    } catch (error) {
        alert('Error saving product: ' + error.message);
    }
}

async function deleteProduct(id) {
    if (!confirm('Are you sure you want to delete this product?')) {
        return;
    }

    try {
        const response = await fetch(`/products/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }

        loadProducts();
    } catch (error) {
        alert('Error deleting product: ' + error.message);
    }
}

// Cart
async function loadCart() {
    try {
        const response = await fetch(`/cart/${USER_ID}`);
        const cart = await response.json();
        const cartHTML = cart.items.map(item => `
            <div class="card mb-2">
                <div class="card-body p-2">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="mb-0">${item.name}</h6>
                            <small class="text-muted">
                                ${item.quantity} x $${item.price}
                            </small>
                        </div>
                        <div class="d-flex align-items-center">
                            <span class="me-3">$${item.total_price}</span>
                            <button class="btn btn-sm btn-outline-danger" onclick="removeFromCart(${item.product_id})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
        
        const totalHTML = cart.items.length > 0 ? `
            <div class="border-top pt-2 mt-2">
                <h5 class="text-end">Total: $${cart.totalPrice}</h5>
            </div>
        ` : '';

        document.getElementById('cartItems').innerHTML = 
            cartHTML ? cartHTML + totalHTML : '<p class="text-muted">Your cart is empty</p>';
    } catch (error) {
        console.error('Error loading cart:', error);
    }
}

async function addToCart(productId) {
    try {
        await fetch(`/cart/${USER_ID}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                productId,
                quantity: 1
            })
        });
        loadCart();
    } catch (error) {
        console.error('Error adding to cart:', error);
    }
}

async function removeFromCart(productId) {
    try {
        await fetch(`/cart/${USER_ID}/item/${productId}`, {
            method: 'DELETE'
        });
        loadCart();
    } catch (error) {
        console.error('Error removing from cart:', error);
    }
}

// Orders
async function loadOrders() {
    try {
        const response = await fetch(`/orders/${USER_ID}`);
        const orders = await response.json();
        const ordersHTML = orders.map(order => `
            <div class="card mb-2">
                <div class="card-body">
                    <h5 class="card-title">Order #${order.id}</h5>
                    <p class="card-text">Total: $${order.total_price}</p>
                    <p class="card-text">Status: ${order.status}</p>
                    <p class="card-text">Date: ${new Date(order.created_at).toLocaleString()}</p>
                    <div class="order-items">
                        ${order.items.map(item => `
                            <div class="ms-3">
                                Product #${item.product_id}: ${item.quantity} x $${item.price}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `).join('');
        document.getElementById('ordersList').innerHTML = ordersHTML || '<p>No orders yet</p>';
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

async function placeOrder() {
    try {
        const cartResponse = await fetch(`/cart/${USER_ID}`);
        const cart = await cartResponse.json();
        
        if (cart.items.length === 0) {
            alert('Your cart is empty!');
            return;
        }

        const orderData = {
            userId: USER_ID,
            products: cart.items.map(item => ({
                productId: item.product_id,
                quantity: item.quantity
            }))
        };

        await fetch('/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });

        loadCart();
        loadOrders();
    } catch (error) {
        console.error('Error placing order:', error);
    }
}

function openNewProductModal() {
    const form = document.getElementById('productForm');
    form.reset();
    currentProductId = null;
    document.getElementById('modalTitle').textContent = 'Add New Product';
    productModal.show();
} 
 