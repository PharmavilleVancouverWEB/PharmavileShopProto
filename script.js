document.addEventListener('DOMContentLoaded', () => {
    const apiUrl = ''; // Relative path, same domain
    let cart = [];
    let stockItems = []; // Store stock data for name lookup
    let isDragging = false;
    let currentX;
    let currentY;
    let xOffset = 0;
    let yOffset = 0;

    // DOM elements
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

    // Ensure all elements exist
    if (!loginForm || !loginDiv || !shopDiv || !itemsDiv || !cartDiv || !orderBtn || !logoutBtn || !loadingDiv || !resultDiv) {
        console.error('Critical DOM elements missing:', { loginForm, loginDiv, shopDiv, itemsDiv, cartDiv, orderBtn, logoutBtn, loadingDiv, resultDiv });
        resultDiv.textContent = 'Error: Page setup failed';
        return;
    }

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('name');
        const emailInput = document.getElementById('email');
        if (!nameInput || !emailInput) {
            console.error('Form inputs missing:', { nameInput, emailInput });
            resultDiv.textContent = 'Error: Form inputs not found';
            return;
        }
        const name = nameInput.value.trim();
        const email = emailInput.value.trim().toLowerCase();
        window.currentUser = { name, email };
        loginDiv.style.display = 'none';
        shopDiv.style.display = 'block';
        console.log('Login attempt:', { name, email });
        if (name === 'Administrator' && email === 'noreply.pharmaville@gmail.com') {
            if (adminMenu) {
                adminMenu.style.display = 'block';
                console.log('Admin menu displayed');
                loadOnlineUsers();
                setInterval(loadOnlineUsers, 10000); // Update users every 10 seconds
            } else {
                console.error('Admin menu element not found');
                resultDiv.textContent = 'Error: Admin menu not found';
            }
        }
        loadStock();
    });

    // Draggable admin menu
    if (adminMenu) {
        adminMenu.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('admin-header')) {
                isDragging = true;
                currentX = e.clientX - xOffset;
                currentY = e.clientY - yOffset;
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                xOffset = e.clientX - currentX;
                yOffset = e.clientY - currentY;
                adminMenu.style.left = `${xOffset}px`;
                adminMenu.style.top = `${yOffset}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });

        if (closeAdminBtn) {
            closeAdminBtn.addEventListener('click', () => {
                adminMenu.style.display = 'none';
            });
        }
    }

    function loadStock() {
        fetch(`${apiUrl}/stock`)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch stock`);
                return res.json();
            })
            .then(items => {
                stockItems = items;
                itemsDiv.innerHTML = '';
                items.forEach(item => {
                    const div = document.createElement('div');
                    div.innerHTML = `${item.name} - $${item.price} (Stock: ${item.stock}) <button onclick="addToCart(${item.id})">Add to Cart</button>`;
                    itemsDiv.appendChild(div);
                });
            })
            .catch(err => {
                console.error('Stock load error:', err);
                resultDiv.textContent = `Error loading stock: ${err.message}`;
            });
    }

    setInterval(loadStock, 10000);

    window.addToCart = function(id) {
        const item = stockItems.find(i => i.id === id);
        if (!item) {
            resultDiv.textContent = 'Error: Item not found';
            return;
        }
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
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}: Order request failed`);
                return res.json();
            })
            .then(result => {
                loadingDiv.style.display = 'none';
                if (result.success) {
                    resultDiv.textContent = `Order placed! Not in stock: ${result.not_in_stock.join(', ') || 'None'}`;
                    cart = [];
                    updateCart();
                    loadStock();
                } else {
                    resultDiv.textContent = `Error placing order: ${result.error || 'Unknown error'}`;
                }
            })
            .catch(err => {
                loadingDiv.style.display = 'none';
                resultDiv.textContent = `Error placing order: ${err.message}`;
            });
    });

    logoutBtn.addEventListener('click', () => {
        window.currentUser = null;
        cart = [];
        updateCart();
        resultDiv.textContent = '';
        if (adminMenu) adminMenu.style.display = 'none';
        loginDiv.style.display = 'block';
        shopDiv.style.display = 'none';
    });

    if (stockForm && deleteItemBtn) {
        stockForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const idInput = document.getElementById('itemId');
            const nameInput = document.getElementById('itemName');
            const priceInput = document.getElementById('itemPrice');
            const stockInput = document.getElementById('itemStock');
            if (!nameInput || !priceInput || !stockInput) {
                resultDiv.textContent = 'Error: Form inputs missing';
                return;
            }
            const id = idInput.value.trim();
            const name = nameInput.value.trim();
            const price = parseFloat(priceInput.value);
            const stock = parseInt(stockInput.value);
            if (!name || isNaN(price) || price < 0 || isNaN(stock) || stock < 0) {
                resultDiv.textContent = 'Please enter valid name, price (≥0), and stock (≥0)';
                return;
            }
            const item = { id: id ? parseInt(id) : null, name, price, stock };
            console.log('Submitting stock update:', item);

            fetch(`${apiUrl}/update-stock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            })
                .then(res => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}: Stock update failed`);
                    return res.json();
                })
                .then(result => {
                    if (result.success) {
                        loadStock();
                        stockForm.reset();
                        resultDiv.textContent = 'Stock updated successfully!';
                    } else {
                        resultDiv.textContent = `Error updating stock: ${result.error || 'Unknown error'}`;
                    }
                })
                .catch(err => {
                    console.error('Stock update error:', err);
                    resultDiv.textContent = `Error updating stock: ${err.message}`;
                });
        });

        deleteItemBtn.addEventListener('click', () => {
            const idInput = document.getElementById('itemId');
            if (!idInput) {
                resultDiv.textContent = 'Error: Item ID input missing';
                return;
            }
            const id = idInput.value.trim();
            if (!id || isNaN(id) || parseInt(id) <= 0) {
                resultDiv.textContent = 'Please enter a valid Item ID';
                return;
            }
            console.log('Deleting stock item:', { id });

            fetch(`${apiUrl}/update-stock`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: parseInt(id) })
            })
                .then(res => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}: Stock deletion failed`);
                    return res.json();
                })
                .then(result => {
                    if (result.success) {
                        loadStock();
                        stockForm.reset();
                        resultDiv.textContent = 'Item deleted successfully!';
                    } else {
                        resultDiv.textContent = `Error deleting stock: ${result.error || 'Unknown error'}`;
                    }
                })
                .catch(err => {
                    console.error('Stock deletion error:', err);
                    resultDiv.textContent = `Error deleting stock: ${err.message}`;
                });
        });
    }

    function loadOnlineUsers() {
        if (!onlineUsersDiv) {
            console.error('Online users div not found');
            return;
        }
        fetch(`${apiUrl}/users`)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch users`);
                return res.json();
            })
            .then(users => {
                onlineUsersDiv.innerHTML = '';
                if (users.length === 0) {
                    onlineUsersDiv.textContent = 'No users online';
                } else {
                    users.forEach(user => {
                        const div = document.createElement('div');
                        div.textContent = `${user.name} (${user.email})`;
                        onlineUsersDiv.appendChild(div);
                    });
                }
            })
            .catch(err => {
                console.error('Users load error:', err);
                onlineUsersDiv.textContent = `Error loading users: ${err.message}`;
            });
    }
});
