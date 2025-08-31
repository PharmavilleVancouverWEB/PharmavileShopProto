const apiUrl = ''; // Relative path, same domain
let cart = [];
let stockItems = []; // Store stock data for name lookup
let isDragging = false;
let currentX;
let currentY;
let xOffset = 0;
let yOffset = 0;

const loginForm = document.getElementById('loginForm');
const loginDiv = document.getElementById('login');
const shopDiv = document.getElementById('shop');
const itemsDiv = document.getElementById('items');
const cartDiv = document.getElementById('cart');
const orderBtn = document.getElementById('orderBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loadingDiv = document.getElementById('loading');
const resultDiv = document.getElementById('result');
const adminMenu = document.getElementById('adminMenu');
const stockForm = document.getElementById('stockForm');
const deleteItemBtn = document.getElementById('deleteItemBtn');
const closeAdminBtn = document.getElementById('closeAdminBtn');
const onlineUsersDiv = document.getElementById('onlineUsers');
const loginBtn = document.getElementById('loginBtn');

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    loginBtn.classList.add('expanding');
    loginDiv.classList.add('blue-fade');
    setTimeout(() => {
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        window.currentUser = { name, email };
        loginDiv.style.display = 'none';
        shopDiv.style.display = 'block';
        shopDiv.classList.add('fade-in');
        if (name === 'Administrator' && email === 'noreply.pharmaville@gmail.com') {
            adminMenu.style.display = 'block';
            loadOnlineUsers();
            setInterval(loadOnlineUsers, 10000); // Update users every 10 seconds
        }
        loadStock();
    }, 1000); // Delay to match animation duration
});

function loadStock() {
    fetch(`${apiUrl}/stock`)
        .then(res => res.json())
        .then(items => {
            stockItems = items;
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
    loadingDiv.style.display = 'block';
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
    location.reload(); // Refresh the page for logout
});
