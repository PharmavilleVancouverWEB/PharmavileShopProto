let stockCache = null;
let user = null;
const loading = document.getElementById('loading');
const loginForm = document.getElementById('login-form');
const stockList = document.getElementById('stock-list');
const cartDiv = document.getElementById('cart');
const cartItemsDiv = document.getElementById('cart-items');
const placeOrderBtn = document.getElementById('place-order');

async function login() {
    const email = document.getElementById('login-email').value;
    const name = document.getElementById('login-name').value;
    if (!email || !name) return alert('Email and name required');
    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const result = await response.json();
        if (result.success) {
            user = { email, name };
            localStorage.setItem('user', JSON.stringify(user));
            loginForm.style.display = 'none';
            stockList.style.display = 'block';
            cartDiv.style.display = 'block';
            fetchStock();
            updateCartDisplay();
        } else {
            alert(`Login failed: ${result.error}`);
        }
    } catch (err) {
        console.error('Login error:', err);
        alert('Failed to login. Retrying in 5s...');
        setTimeout(login, 5000);
    }
}

async function fetchStock() {
    if (!user) return;
    try {
        const response = await fetch('/stock');
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        const data = await response.json();
        stockCache = data;
        displayStock(data);
    } catch (err) {
        console.error('Fetch stock error:', err);
        stockList.innerHTML = '<p>Error loading stock. Retrying...</p>';
        setTimeout(fetchStock, 5000);
    }
}

function displayStock(stock) {
    stockList.innerHTML = stock.map(item => `
        <div class="item">
            ${item.name} - $${item.price} (Stock: ${item.stock})
            <button onclick="addToCart(${item.id})">Add to Cart</button>
        </div>
    `).join('');
}

function addToCart(itemId) {
    if (!user) return alert('Please login first');
    let cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const item = stockCache.find(s => s.id === itemId);
    if (!item) return alert('Item not found');
    const cartItem = cart.find(c => c.id === itemId);
    if (cartItem) {
        if (cartItem.quantity + 1 > item.stock) return alert('Not enough stock');
        cartItem.quantity += 1;
    } else {
        if (item.stock < 1) return alert('Not enough stock');
        cart.push({ id: itemId, quantity: 1 });
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartDisplay();
}

async function placeOrder() {
    if (!user) return alert('Please login first');
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    if (!cart.length) return alert('Cart is empty');
    try {
        loading.style.display = 'block';
        placeOrderBtn.disabled = true;
        const response = await fetch('/check-ban', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email })
        });
        const { banned } = await response.json();
        if (banned) {
            user = null;
            localStorage.removeItem('user');
            loginForm.style.display = 'block';
            stockList.style.display = 'none';
            cartDiv.style.display = 'none';
            loading.style.display = 'none';
            placeOrderBtn.disabled = false;
            return alert('Your email is banned');
        }

        const response2 = await fetch('/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email, name: user.name, items: cart })
        });
        const result = await response2.json();
        if (result.success) {
            alert('Order placed! Check your email.');
            localStorage.setItem('cart', '[]');
            fetchStock();
            updateCartDisplay();
        } else {
            alert(`Order failed: ${result.error}`);
        }
    } catch (err) {
        console.error('Order error:', err);
        alert('Failed to place order. Please try again.');
    } finally {
        loading.style.display = 'none';
        placeOrderBtn.disabled = false;
    }
}

function updateCartDisplay() {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    cartItemsDiv.innerHTML = cart.length ? cart.map(item => {
        const stockItem = stockCache ? stockCache.find(s => s.id === item.id) : null;
        return `<div>${stockItem ? stockItem.name : 'Item'} x${item.quantity}</div>`;
    }).join('') : '<p>Cart is empty</p>';
    placeOrderBtn.style.display = cart.length ? 'block' : 'none';
}

function chatToRep() {
    alert('Chat feature coming soon! Contact us at support@pharmaville.com');
}

// Initialize
if (localStorage.getItem('user')) {
    user = JSON.parse(localStorage.getItem('user'));
    loginForm.style.display = 'none';
    stockList.style.display = 'block';
    cartDiv.style.display = 'block';
    fetchStock();
    updateCartDisplay();
} else {
    loginForm.style.display = 'block';
    stockList.style.display = 'none';
    cartDiv.style.display = 'none';
}
