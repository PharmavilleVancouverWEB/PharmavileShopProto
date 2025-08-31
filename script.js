const apiUrl = ''; // Relative path, same domain
let cart = [];
let stockItems = []; // Store stock data for name lookup

const loginForm = document.getElementById('loginForm');
const loginDiv = document.getElementById('login');
const shopDiv = document.getElementById('shop');
const itemsDiv = document.getElementById('items');
const cartDiv = document.getElementById('cart');
const orderBtn = document.getElementById('orderBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loadingDiv = document.getElementById('loading');
const resultDiv = document.getElementById('result');

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    // Store user data in memory, not localStorage
    window.currentUser = { name, email };
    loginDiv.style.display = 'none';
    shopDiv.style.display = 'block';
    loadStock();
});

function loadStock() {
    fetch(`${apiUrl}/stock`)
        .then(res => res.json())
        .then(items => {
            stockItems = items; // Cache stock for name lookup
            itemsDiv.innerHTML = '';
            items.forEach(item => {
                const div = document.createElement('div');
                div.innerHTML = `${item.name} - $${item.price} (Stock: ${item.stock}) <button onclick="addToCart(${item.id})">Add to Cart</button>`;
                itemsDiv.appendChild(div);
            });
        })
        .catch(err => console.error(err));
}

// Poll stock every 10 seconds
setInterval(loadStock, 10000);

window.addToCart = function(id) {
    const item = stockItems.find(i => i.id === id);
    if (!item) return; // Item not found
    const existing = cart.find(c => c.id === id);
    if (existing) {
        existing.quantity++;
    } else {
        cart.push({ id, name: item.name, quantity: 1 });
    }
    updateCart();
};

function updateCart() {
    cartDiv.innerHTML = '';
    cart.forEach(c => {
        const div = document.createElement('div');
        div.textContent = `${c.name} x ${c.quantity}`;
        cartDiv.appendChild(div);
    });
}

orderBtn.addEventListener('click', () => {
    if (cart.length === 0) {
        resultDiv.textContent = 'Cart is empty!';
        return;
    }
    loadingDiv.style.display = 'flex';
    resultDiv.textContent = '';
    const user = window.currentUser;
    fetch(`${apiUrl}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, name: user.name, items: cart })
    })
        .then(res => res.json())
        .then(result => {
            loadingDiv.style.display = 'none';
            if (result.success) {
                resultDiv.textContent = `Order placed! Not in stock: ${result.not_in_stock.join(', ') || 'None'}`;
                cart = [];
                updateCart();
                loadStock();
            } else {
                resultDiv.textContent = `Error: ${result.error}`;
            }
        })
        .catch(err => {
            loadingDiv.style.display = 'none';
            resultDiv.textContent = `Error: ${err.message}`;
        });
});

logoutBtn.addEventListener('click', () => {
    window.currentUser = null;
    cart = [];
    updateCart();
    resultDiv.textContent = '';
    loginDiv.style.display = 'block';
    shopDiv.style.display = 'none';
});
