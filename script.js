const apiUrl = ''; // Relative path, same domain
let cart = [];
let retryCount = 0;
const maxRetries = 10; // Stop after 10 retries to avoid infinite loop
const baseRetryDelay = 2000; // 2 seconds initial delay

const loginForm = document.getElementById('loginForm');
const loginDiv = document.getElementById('login');
const shopDiv = document.getElementById('shop');
const itemsDiv = document.getElementById('items');
const cartDiv = document.getElementById('cart');
const orderBtn = document.getElementById('orderBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loadingDiv = document.getElementById('loading');
const resultDiv = document.getElementById('result');

// Check if already "logged in"
const user = JSON.parse(localStorage.getItem('user'));
if (user) {
    loginDiv.style.display = 'none';
    shopDiv.style.display = 'block';
    loadStock();
}

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    localStorage.setItem('user', JSON.stringify({ name, email }));
    loginDiv.style.display = 'none';
    shopDiv.style.display = 'block';
    loadStock();
});

function loadStock() {
    // Show loading message in items div
    itemsDiv.innerHTML = '<div class="loading-message">Loading stock... (Server may be waking up)</div>';
    
    const fetchOptions = {
        timeout: 30000 // 30-second timeout for slow cold starts
    };

    fetch(`${apiUrl}/stock`, { signal: AbortSignal.timeout ? AbortSignal.timeout(fetchOptions.timeout) : undefined })
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then(items => {
            retryCount = 0; // Reset retries on success
            itemsDiv.innerHTML = '';
            items.forEach(item => {
                const div = document.createElement('div');
                div.innerHTML = `${item.name} - $${item.price} (Stock: ${item.stock}) <button onclick="addToCart(${item.id})">Add to Cart</button>`;
                itemsDiv.appendChild(div);
            });
        })
        .catch(err => {
            console.error('Stock load error:', err);
            retryCount++;
            if (retryCount < maxRetries) {
                const delay = baseRetryDelay * Math.pow(2, retryCount - 1); // Exponential backoff
                itemsDiv.innerHTML = `<div class="error-message">Failed to load stock (attempt ${retryCount}/${maxRetries}). Retrying in ${delay/1000} seconds... Error: ${err.message}</div>`;
                setTimeout(loadStock, delay);
            } else {
                itemsDiv.innerHTML = '<div class="error-message">Failed to load stock after multiple retries. Please refresh the page or check server status.</div>';
            }
        });
}

// Poll stock every 10 seconds (only if successful once)
let pollInterval;
function startPolling() {
    pollInterval = setInterval(() => {
        if (retryCount === 0) { // Only poll if last load succeeded
            loadStock();
        }
    }, 10000);
}

// Start polling after first successful load
// (Call this in the .then() of loadStock if needed, but integrated above)

window.addToCart = function(id) {
    const existing = cart.find(c => c.id === id);
    if (existing) {
        existing.quantity++;
    } else {
        cart.push({ id, quantity: 1 });
    }
    updateCart();
};

function updateCart() {
    cartDiv.innerHTML = '';
    cart.forEach(c => {
        const div = document.createElement('div');
        div.textContent = `Item ${c.id} x ${c.quantity}`;
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
    const user = JSON.parse(localStorage.getItem('user'));
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
                loadStock(); // Refresh stock after order
                startPolling(); // Ensure polling resumes
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
    localStorage.removeItem('user');
    loginDiv.style.display = 'block';
    shopDiv.style.display = 'none';
    cart = [];
    updateCart();
    resultDiv.textContent = '';
    retryCount = 0;
    if (pollInterval) clearInterval(pollInterval);
});
