let stockCache = null;
const isAdmin = true; // Replace with actual auth check
const adminPanel = document.getElementById('admin-panel');
const consoleDiv = document.getElementById('console');
const loading = document.getElementById('loading');

async function fetchStock() {
    try {
        loading.style.display = 'flex';
        const response = await fetch('/stock');
        if (!response.ok) throw new Error('Failed to fetch stock');
        const data = await response.json();
        stockCache = data;
        displayStock(data);
    } catch (err) {
        console.error('Fetch error:', err);
        document.getElementById('stock-list').innerHTML = '<p>Error loading stock. Retrying...</p>';
        setTimeout(fetchStock, 5000); // Retry after 5s
    } finally {
        loading.style.display = 'none';
    }
}

function displayStock(stock) {
    const stockList = document.getElementById('stock-list');
    stockList.innerHTML = stock.map(item => `
        <div class="item">
            ${item.name} - $${item.price} (Stock: ${item.stock})
            <button onclick="addToCart(${item.id})">Add to Cart</button>
        </div>
    `).join('');
}

async function addToCart(itemId) {
    const email = prompt('Enter your email:');
    const name = prompt('Enter your name:');
    if (!email || !name) return alert('Email and name required');
    try {
        const response = await fetch('/check-ban', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const { banned } = await response.json();
        if (banned) return alert('Your email is banned');
        
        const response2 = await fetch('/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, name, items: [{ id: itemId, quantity: 1 }] })
        });
        const result = await response2.json();
        if (result.success) {
            alert('Order placed! Check your email.');
            fetchStock(); // Refresh stock
        } else {
            alert(`Order failed: ${result.error}`);
        }
    } catch (err) {
        console.error('Order error:', err);
        alert('Failed to place order');
    }
}

async function updateStock() {
    if (!isAdmin) return alert('Admin access required');
    const id = parseInt(document.getElementById('item-id').value) || undefined;
    const name = document.getElementById('item-name').value;
    const price = parseFloat(document.getElementById('item-price').value);
    const stock = parseInt(document.getElementById('item-stock').value);
    try {
        const response = await fetch('/update-stock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, name, price, stock })
        });
        const result = await response.json();
        if (result.success) {
            alert('Stock updated');
            fetchStock();
        } else {
            alert(`Failed to update stock: ${result.error}`);
        }
    } catch (err) {
        console.error('Update stock error:', err);
        alert('Failed to update stock');
    }
}

async function banEmail() {
    if (!isAdmin) return alert('Admin access required');
    const email = document.getElementById('ban-email').value;
    try {
        const response = await fetch('/ban-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const result = await response.json();
        if (result.success) {
            alert('Email banned');
        } else {
            alert(`Failed to ban email: ${result.error}`);
        }
    } catch (err) {
        console.error('Ban email error:', err);
        alert('Failed to ban email');
    }
}

async function shutdownSite() {
    if (!isAdmin) return alert('Admin access required');
    try {
        const response = await fetch('/shutdown-site', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ seconds: 30 })
        });
        const result = await response.json();
        if (result.success) {
            alert('Site shutting down for 30 seconds');
        } else {
            alert(`Shutdown failed: ${result.error}`);
        }
    } catch (err) {
        console.error('Shutdown error:', err);
        alert('Failed to shutdown site');
    }
}

function chatToRep() {
    alert('Chat feature coming soon! Contact us at support@pharmaville.com');
}

document.addEventListener('keydown', (e) => {
    if (!isAdmin) return;
    if (e.key === 'A') {
        adminPanel.classList.toggle('active');
    }
    if (e.key === 'C') {
        consoleDiv.style.display = consoleDiv.style.display === 'none' ? 'block' : 'none';
        consoleDiv.innerHTML = 'Console: Ready for admin commands';
    }
});

fetchStock();
