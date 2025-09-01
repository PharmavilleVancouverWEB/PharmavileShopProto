document.addEventListener('DOMContentLoaded', () => {
    let cart = [];
    let stockItems = [];
    let user = null;
    let ws = null;
    const apiUrl = ''; // Relative path

    // DOM elements
    const loginForm = document.getElementById('loginForm');
    const loginDiv = document.getElementById('login');
    const shopDiv = document.getElementById('shop');
    const itemsDiv = document.getElementById('items');
    const cartDiv = document.getElementById('cart');
    const orderBtn = document.getElementById('orderBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const chatBtn = document.getElementById('chatBtn');
    const loadingDiv = document.getElementById('loading');
    const resultDiv = document.getElementById('result');
    const pickupForm = document.getElementById('pickupForm');
    const schedulePickupBtn = document.getElementById('schedulePickupBtn');
    const pickupTimeInput = document.getElementById('pickupTime');
    const chatForm = document.getElementById('chatForm');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChatBtn');
    const adminPanel = document.getElementById('adminPanel');
    const stockForm = document.getElementById('stockForm');
    const deleteItemBtn = document.getElementById('deleteItemBtn');
    const closeAdminBtn = document.getElementById('closeAdminBtn');
    const chatQueue = document.getElementById('chatQueue');
    const adminChatMessages = document.getElementById('adminChatMessages');
    const adminChatInput = document.getElementById('adminChatInput');
    const sendAdminChatBtn = document.getElementById('sendAdminChatBtn');

    // Validate DOM elements
    if (!loginForm || !loginDiv || !shopDiv || !itemsDiv || !cartDiv || !orderBtn || !logoutBtn || !loadingDiv || !resultDiv || !pickupForm || !schedulePickupBtn || !pickupTimeInput || !chatForm || !chatMessages || !chatInput || !sendChatBtn) {
        console.error('Critical DOM elements missing');
        resultDiv.textContent = 'Error: Page setup failed';
        return;
    }

    // Initialize
    if (localStorage.getItem('user')) {
        user = JSON.parse(localStorage.getItem('user'));
        loginDiv.style.display = 'none';
        shopDiv.style.display = 'block';
        loadStock();
        updateCart();
        pickupForm.style.display = localStorage.getItem('orderPlaced') ? 'block' : 'none';
        if (user.isAdmin) {
            adminPanel.style.display = 'block';
            initWebSocket(true);
        }
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim().toLowerCase();
        if (!name || !email) {
            resultDiv.textContent = 'Error: Name and email required';
            return;
        }
        try {
            loadingDiv.style.display = 'flex';
            const response = await fetch(`${apiUrl}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const result = await response.json();
            if (result.success) {
                user = { name, email, isAdmin: result.isAdmin };
                localStorage.setItem('user', JSON.stringify(user));
                loginDiv.style.display = 'none';
                shopDiv.style.display = 'block';
                loadStock();
                updateCart();
                if (result.isAdmin) {
                    adminPanel.style.display = 'block';
                    initWebSocket(true);
                }
            } else {
                resultDiv.textContent = `Error: ${result.error}`;
            }
        } catch (err) {
            console.error('Login error:', err);
            resultDiv.textContent = 'Error logging in. Retrying...';
            setTimeout(() => loginForm.requestSubmit(), 5000);
        } finally {
            loadingDiv.style.display = 'none';
        }
    });

    async function loadStock() {
        if (stockItems.length > 0) {
            renderStock(stockItems);
        }
        try {
            const response = await fetch(`${apiUrl}/stock`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            stockItems = await response.json();
            renderStock(stockItems);
        } catch (err) {
            console.error('Stock load error:', err);
            resultDiv.textContent = `Error loading stock: ${err.message}`;
            setTimeout(loadStock, 5000);
        }
    }

    function renderStock(items) {
        itemsDiv.innerHTML = items.map(item => `
            <div class="item">
                ${item.name} - $${item.price} (Stock: ${item.stock})
                <button class="btn btn-add-to-cart" onclick="addToCart(${item.id})">Add to Cart</button>
            </div>
        `).join('');
    }

    window.addToCart = function(id) {
        if (!user) {
            resultDiv.textContent = 'Error: Please log in';
            return;
        }
        const item = stockItems.find(i => i.id === id);
        if (!item || item.stock < 1) {
            resultDiv.textContent = 'Error: Item not available';
            return;
        }
        const existing = cart.find(c => c.id === id);
        if (existing) {
            if (existing.quantity + 1 > item.stock) {
                resultDiv.textContent = `Error: Only ${item.stock} ${item.name} in stock`;
                return;
            }
            existing.quantity++;
        } else {
            cart.push({ id, name: item.name, quantity: 1 });
        }
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCart();
    };

    function updateCart() {
        cart = JSON.parse(localStorage.getItem('cart') || '[]');
        cartDiv.innerHTML = cart.length ? cart.map(c => `
            <div>${c.name} x${c.quantity}</div>
        `).join('') : '<p>Cart is empty</p>';
        orderBtn.style.display = cart.length ? 'block' : 'none';
    }

    orderBtn.addEventListener('click', async () => {
        if (!cart.length) {
            resultDiv.textContent = 'Cart is empty!';
            return;
        }
        if (!user) {
            resultDiv.textContent = 'Error: Please log in again';
            return;
        }
        try {
            loadingDiv.style.display = 'flex';
            orderBtn.disabled = true;
            const response = await fetch(`${apiUrl}/order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, name: user.name, items: cart })
            });
            const result = await response.json();
            if (result.success) {
                resultDiv.textContent = `Order placed! Not in stock: ${result.not_in_stock.join(', ') || 'None'}`;
                cart = [];
                localStorage.setItem('cart', '[]');
                localStorage.setItem('orderPlaced', 'true');
                pickupForm.style.display = 'block';
                updateCart();
                loadStock();
            } else {
                resultDiv.textContent = `Error: ${result.error}`;
            }
        } catch (err) {
            console.error('Order error:', err);
            resultDiv.textContent = `Error placing order: ${err.message}`;
        } finally {
            loadingDiv.style.display = 'none';
            orderBtn.disabled = false;
        }
    });

    schedulePickupBtn.addEventListener('click', async () => {
        if (!user) {
            resultDiv.textContent = 'Error: Please log in again';
            return;
        }
        const pickupTime = pickupTimeInput.value;
        if (!pickupTime) {
            resultDiv.textContent = 'Error: Please select a pickup time';
            return;
        }
        try {
            loadingDiv.style.display = 'flex';
            schedulePickupBtn.disabled = true;
            const response = await fetch(`${apiUrl}/schedule-pickup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, name: user.name, pickupTime })
            });
            const result = await response.json();
            if (result.success) {
                resultDiv.textContent = `Pickup scheduled for ${result.pickupTime}`;
                localStorage.removeItem('orderPlaced');
                pickupForm.style.display = 'none';
                pickupTimeInput.value = '';
            } else {
                resultDiv.textContent = `Error: ${result.error}`;
            }
        } catch (err) {
            console.error('Pickup scheduling error:', err);
            resultDiv.textContent = `Error scheduling pickup: ${err.message}`;
        } finally {
            loadingDiv.style.display = 'none';
            schedulePickupBtn.disabled = false;
        }
    });

    function initWebSocket(isAdmin) {
        if (ws) ws.close();
        ws = new WebSocket(`ws://${window.location.host}/chat?email=${encodeURIComponent(user.email)}&name=${encodeURIComponent(user.name)}&isAdmin=${isAdmin}`);
        ws.onopen = () => {
            console.log('WebSocket connected');
        };
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'queueUpdate' && isAdmin) {
                    updateChatQueue(data.queue);
                } else if (data.type === 'chatStarted') {
                    chatForm.style.display = 'block';
                    resultDiv.textContent = isAdmin ? `Chat started with ${data.userEmail}` : 'Chat started with admin';
                    chatMessages.innerHTML = '';
                    if (isAdmin) {
                        adminChatMessages.innerHTML = '';
                        adminChatInput.dataset.userEmail = data.userEmail;
                    }
                } else if (data.type === 'message') {
                    const messagesDiv = isAdmin ? adminChatMessages : chatMessages;
                    const messageDiv = document.createElement('div');
                    messageDiv.textContent = `${data.from}: ${data.message}`;
                    messagesDiv.appendChild(messageDiv);
                    messagesDiv.scrollTop = messagesDiv.scrollHeight;
                } else if (data.type === 'chatEnded') {
                    chatForm.style.display = 'none';
                    if (isAdmin) {
                        adminChatMessages.innerHTML = '';
                        adminChatInput.dataset.userEmail = '';
                    }
                    resultDiv.textContent = isAdmin ? `Chat with ${data.userEmail} ended` : 'Chat ended';
                }
            } catch (err) {
                console.error('WebSocket message error:', err);
            }
        };
        ws.onclose = () => {
            console.log('WebSocket disconnected');
            setTimeout(() => initWebSocket(isAdmin), 5000);
        };
    }

    function updateChatQueue(queue) {
        chatQueue.innerHTML = queue.sort((a, b) => a.timestamp - b.timestamp).map(user => `
            <div>
                ${user.name} (${user.email}) - Waiting since ${new Date(user.timestamp).toLocaleTimeString()}
                <button class="btn btn-primary" onclick="startChat('${user.email}')">Start Chat</button>
            </div>
        `).join('');
    }

    window.startChat = function(userEmail) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'startChat', userEmail }));
        }
    };

    chatBtn.addEventListener('click', () => {
        if (!user) {
            resultDiv.textContent = 'Error: Please log in';
            return;
        }
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            initWebSocket(false);
        }
        chatForm.style.display = 'block';
        resultDiv.textContent = 'Waiting for a representative...';
    });

    sendChatBtn.addEventListener('click', () => {
        const message = chatInput.value.trim();
        if (!message || !ws || ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: 'message', message }));
        const messageDiv = document.createElement('div');
        messageDiv.textContent = `${user.name}: ${message}`;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        chatInput.value = '';
    });

    if (sendAdminChatBtn && adminChatInput) {
        sendAdminChatBtn.addEventListener('click', () => {
            const message = adminChatInput.value.trim();
            const userEmail = adminChatInput.dataset.userEmail;
            if (!message || !userEmail || !ws || ws.readyState !== WebSocket.OPEN) return;
            ws.send(JSON.stringify({ type: 'message', userEmail, message }));
            const messageDiv = document.createElement('div');
            messageDiv.textContent = `Admin: ${message}`;
            adminChatMessages.appendChild(messageDiv);
            adminChatMessages.scrollTop = adminChatMessages.scrollHeight;
            adminChatInput.value = '';
        });
    }

    if (stockForm && deleteItemBtn) {
        stockForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!user || !user.isAdmin) {
                resultDiv.textContent = 'Error: Admin access required';
                return;
            }
            const id = document.getElementById('itemId').value.trim();
            const name = document.getElementById('itemName').value.trim();
            const price = parseFloat(document.getElementById('itemPrice').value);
            const stock = parseInt(document.getElementById('itemStock').value);
            if (!name || isNaN(price) || price < 0 || isNaN(stock) || stock < 0) {
                resultDiv.textContent = 'Error: Valid name, price (≥0), and stock (≥0) required';
                return;
            }
            try {
                const response = await fetch(`${apiUrl}/update-stock`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: id ? parseInt(id) : null, name, price, stock })
                });
                const result = await response.json();
                if (result.success) {
                    resultDiv.textContent = 'Stock updated successfully';
                    loadStock();
                    stockForm.reset();
                } else {
                    resultDiv.textContent = `Error: ${result.error}`;
                }
            } catch (err) {
                console.error('Stock update error:', err);
                resultDiv.textContent = `Error updating stock: ${err.message}`;
            }
        });

        deleteItemBtn.addEventListener('click', async () => {
            if (!user || !user.isAdmin) {
                resultDiv.textContent = 'Error: Admin access required';
                return;
            }
            const id = document.getElementById('itemId').value.trim();
            if (!id || isNaN(id) || parseInt(id) <= 0) {
                resultDiv.textContent = 'Error: Valid Item ID required';
                return;
            }
            try {
                const response = await fetch(`${apiUrl}/update-stock`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: parseInt(id) })
                });
                const result = await response.json();
                if (result.success) {
                    resultDiv.textContent = 'Item deleted successfully';
                    loadStock();
                    stockForm.reset();
                } else {
                    resultDiv.textContent = `Error: ${result.error}`;
                }
            } catch (err) {
                console.error('Stock deletion error:', err);
                resultDiv.textContent = `Error deleting stock: ${err.message}`;
            }
        });
    }

    if (closeAdminBtn) {
        closeAdminBtn.addEventListener('click', () => {
            adminPanel.style.display = 'none';
        });
    }

    window.showTab = function(tabId) {
        document.querySelectorAll('.admin-tab').forEach(tab => tab.style.display = 'none');
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(tabId).style.display = 'block';
        document.querySelector(`[onclick="showTab('${tabId}')"]`).classList.add('active');
        if (tabId === 'chatTab' && ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'queueUpdate' }));
        }
    };

    logoutBtn.addEventListener('click', () => {
        if (ws) ws.close();
        localStorage.clear();
        location.reload();
    });
});
