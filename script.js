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
    const chatBtn = document.getElementById('chatBtn');
    const loadingDiv = document.getElementById('loading');
    const resultDiv = document.getElementById('result');
    const adminMenu = document.getElementById('adminMenu');
    const stockForm = document.getElementById('stockForm');
    const deleteItemBtn = document.getElementById('deleteItemBtn');
    const closeAdminBtn = document.getElementById('closeAdminBtn');
    const consoleMenu = document.getElementById('consoleMenu');
    const consoleInput = document.getElementById('consoleInput');
    const consoleOutput = document.getElementById('consoleOutput');
    const loginBtn = document.getElementById('loginBtn');

    // Validate critical DOM elements
    if (!loginForm || !loginDiv || !shopDiv || !itemsDiv || !cartDiv || !orderBtn || !logoutBtn || !loadingDiv || !resultDiv || !loginBtn) {
        console.error('Critical DOM elements missing:', { loginForm, loginDiv, shopDiv, itemsDiv, cartDiv, orderBtn, logoutBtn, loadingDiv, resultDiv, loginBtn });
        resultDiv.textContent = 'Error: Page setup failed';
        return;
    }

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        console.log('Login form submitted');
        loginBtn.classList.add('expanding');
        loginDiv.classList.add('blue-fade');
        setTimeout(() => {
            console.log('Animation complete, processing login');
            const nameInput = document.getElementById('name');
            const emailInput = document.getElementById('email');
            if (!nameInput || !emailInput) {
                console.error('Form inputs missing:', { nameInput, emailInput });
                resultDiv.textContent = 'Error: Form inputs not found';
                loginBtn.classList.remove('expanding');
                loginDiv.classList.remove('blue-fade');
                return;
            }
            const name = nameInput.value.trim();
            const email = emailInput.value.trim().toLowerCase();
            if (!name || !email) {
                console.error('Invalid input:', { name, email });
                resultDiv.textContent = 'Error: Name and email required';
                loginBtn.classList.remove('expanding');
                loginDiv.classList.remove('blue-fade');
                return;
            }
            window.currentUser = { name, email };
            console.log('User set:', window.currentUser);
            loginDiv.style.display = 'none';
            shopDiv.style.display = 'block';
            shopDiv.classList.add('fade-in');
            // Admin menu only opens via keybinds, not here
            loadStock();
        }, 1000); // Match animation duration
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
                if (consoleMenu) consoleMenu.style.display = 'none';
            });
        }
    }

    // Console menu logic
    if (consoleMenu && consoleInput && consoleOutput) {
        consoleInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const command = consoleInput.value.trim().toLowerCase();
                consoleInput.value = '';
                processConsoleCommand(command);
            }
        });
    }

    function processConsoleCommand(command) {
        const output = document.createElement('div');
        output.classList.add('console-line');
        switch (command) {
            case 'clear':
                consoleOutput.innerHTML = '';
                output.textContent = 'Console cleared';
                break;
            case 'stock':
                output.textContent = `Current stock: ${stockItems.map(item => `${item.name} (ID: ${item.id}, Price: $${item.price}, Stock: ${item.stock})`).join(', ') || 'No items'}`;
                break;
            case 'help':
                output.textContent = 'Commands: clear (clear console), stock (list stock), help (show this)';
                break;
            default:
                output.textContent = `Unknown command: ${command}. Type 'help' for commands.`;
        }
        consoleOutput.appendChild(output);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }

    // Keybinds for admin
    document.addEventListener('keydown', (e) => {
        if (window.currentUser && window.currentUser.name === 'Administrator' && window.currentUser.email === 'noreply.pharmaville@gmail.com') {
            if (e.key.toLowerCase() === 'a' && adminMenu) {
                adminMenu.style.display = adminMenu.style.display === 'block' ? 'none' : 'block';
                if (adminMenu.style.display === 'none' && consoleMenu) {
                    consoleMenu.style.display = 'none';
                }
                console.log(`Admin panel toggled: ${adminMenu.style.display}`);
            }
            if (e.key.toLowerCase() === 'c' && consoleMenu && adminMenu.style.display === 'block') {
                consoleMenu.style.display = consoleMenu.style.display === 'block' ? 'none' : 'block';
                console.log(`Console menu toggled: ${consoleMenu.style.display}`);
            }
        }
    });

    function loadStock() {
        if (stockItems.length > 0) {
            console.log('Rendering cached stock:', stockItems);
            renderStock(stockItems);
        }

        fetch(`${apiUrl}/stock`)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch stock`);
                return res.json();
            })
            .then(items => {
                console.log('Fetched stock:', items);
                stockItems = items;
                renderStock(items);
            })
            .catch(err => {
                console.error('Stock load error:', err);
                resultDiv.textContent = `Error loading stock: ${err.message}`;
            });
    }

    function renderStock(items) {
        itemsDiv.innerHTML = '';
        items.forEach(item => {
            const div = document.createElement('div');
            div.innerHTML = `${item.name} - $${item.price} (Stock: ${item.stock}) <button class="btn btn-add-to-cart" onclick="addToCart(${item.id})">Add to Cart</button>`;
            itemsDiv.appendChild(div);
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
            div.classList.add('animated');
            cartDiv.appendChild(div);
        });
    }

    orderBtn.addEventListener('click', () => {
        if (cart.length === 0) {
            resultDiv.textContent = 'Cart is empty!';
            return;
        }
        if (!window.currentUser) {
            resultDiv.textContent = 'Error: Please log in again';
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
        location.reload(); // Refresh page for logout
    });

    if (chatBtn) {
        chatBtn.addEventListener('click', () => {
            resultDiv.textContent = 'No representatives available at this time';
        });
    }

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
});
