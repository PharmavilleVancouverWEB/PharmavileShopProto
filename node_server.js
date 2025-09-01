const express = require('express');
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const WebSocket = require('ws');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

const wss = new WebSocket.Server({ server });
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER || 'noreply.pharmaville@gmail.com',
        pass: process.env.GMAIL_PASS || 'ljxasarmaappzsie'
    }
});

const HARDCODED_ADMIN_EMAIL = 'darian.bayan2@gmail.com';
let stock = [];
const stockFile = path.join(__dirname, 'stock.json');
const chatQueue = new Map(); // { email: { ws, timestamp, name } }
const activeChats = new Map(); // { email: { userWs, adminWs } }

// Initialize stock.json
async function initializeStock() {
    try {
        if (!(await fs.access(stockFile).catch(() => false))) {
            console.log('stock.json not found, creating with initial data');
            const initialData = [
                { id: 1, name: 'Band-Aid', price: 4.99, stock: 20 },
                { id: 2, name: 'Heating Pad', price: 35, stock: 3 }
            ];
            await fs.writeFile(stockFile, JSON.stringify(initialData, null, 2));
            stock = initialData;
        } else {
            stock = JSON.parse(await fs.readFile(stockFile));
        }
    } catch (err) {
        console.error('Error initializing stock.json:', err);
        stock = [];
    }
}

// WebSocket handling
wss.on('connection', (ws, req) => {
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const email = urlParams.get('email');
    const name = urlParams.get('name');
    const isAdmin = urlParams.get('isAdmin') === 'true';

    if (!email || !name) {
        ws.close(1008, 'Email and name required');
        return;
    }

    if (isAdmin) {
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                if (data.type === 'startChat' && data.userEmail) {
                    const user = chatQueue.get(data.userEmail);
                    if (user) {
                        activeChats.set(data.userEmail, { userWs: user.ws, adminWs: ws });
                        chatQueue.delete(data.userEmail);
                        user.ws.send(JSON.stringify({ type: 'chatStarted', message: 'Chat started with admin' }));
                        ws.send(JSON.stringify({ type: 'chatStarted', userEmail: data.userEmail }));
                    }
                } else if (data.type === 'message' && data.userEmail && data.message) {
                    const chat = activeChats.get(data.userEmail);
                    if (chat && chat.userWs.readyState === WebSocket.OPEN) {
                        chat.userWs.send(JSON.stringify({ type: 'message', message: data.message, from: 'Admin' }));
                    }
                }
            } catch (err) {
                console.error('WebSocket message error:', err);
            }
        });

        ws.on('close', () => {
            for (const [userEmail, chat] of activeChats) {
                if (chat.adminWs === ws) {
                    if (chat.userWs.readyState === WebSocket.OPEN) {
                        chat.userWs.send(JSON.stringify({ type: 'chatEnded', message: 'Admin disconnected' }));
                    }
                    activeChats.delete(userEmail);
                }
            }
        });
    } else {
        chatQueue.set(email, { ws, timestamp: Date.now(), name });
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                if (data.type === 'message' && data.message) {
                    const chat = activeChats.get(email);
                    if (chat && chat.adminWs.readyState === WebSocket.OPEN) {
                        chat.adminWs.send(JSON.stringify({ type: 'message', userEmail: email, message: data.message, from: name }));
                    }
                }
            } catch (err) {
                console.error('WebSocket message error:', err);
            }
        });

        ws.on('close', () => {
            chatQueue.delete(email);
            const chat = activeChats.get(email);
            if (chat && chat.adminWs.readyState === WebSocket.OPEN) {
                chat.adminWs.send(JSON.stringify({ type: 'chatEnded', userEmail: email, message: 'User disconnected' }));
                activeChats.delete(email);
            }
        });

        // Notify admins of new chat request
        wss.clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'queueUpdate', queue: Array.from(chatQueue.entries()).map(([e, { name, timestamp }]) => ({ email: e, name, timestamp })) }));
            }
        });
    }
});

// Login endpoint
app.post('/login', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        console.error('Invalid login request:', req.body);
        return res.status(400).json({ success: false, error: 'Email required' });
    }
    res.json({ success: true, email: email.toLowerCase(), isAdmin: email.toLowerCase() === 'noreply.pharmaville@gmail.com' });
});

// Get stock
app.get('/stock', async (req, res) => {
    try {
        res.json(stock);
    } catch (err) {
        console.error('Error reading stock:', err);
        res.status(500).json({ success: false, error: 'Failed to load stock' });
    }
});

// Process order
app.post('/order', async (req, res) => {
    const { email, name, items } = req.body;
    if (!email || !name || !items || !Array.isArray(items)) {
        console.error('Invalid order request:', { email, name, items });
        return res.status(400).json({ success: false, error: 'Invalid request data' });
    }
    try {
        let ordered = [];
        let notInStock = [];
        let totalPrice = 0;

        for (const orderItem of items) {
            const stockItem = stock.find(s => s.id === orderItem.id);
            if (!stockItem) {
                notInStock.push(`Item ID ${orderItem.id}`);
                continue;
            }
            if (stockItem.stock >= orderItem.quantity) {
                stockItem.stock -= orderItem.quantity;
                ordered.push(`${stockItem.name} x${orderItem.quantity} at $${stockItem.price} each`);
                totalPrice += stockItem.price * orderItem.quantity;
            } else {
                notInStock.push(`${stockItem.name} (requested ${orderItem.quantity}, available ${stockItem.stock})`);
            }
        }

        await fs.writeFile(stockFile, JSON.stringify(stock, null, 2));

        const userMailOptions = {
            from: process.env.GMAIL_USER || 'noreply.pharmaville@gmail.com',
            to: email,
            subject: 'Pharmaville Order Confirmation',
            text: `Dear ${name},\n\nYour order has been received:\n${ordered.join('\n') || 'None'}\nNot in stock:\n${notInStock.join('\n') || 'None'}\nTotal: $${totalPrice.toFixed(2)}\n\nPlease schedule a pickup time.`
        };

        const adminMailOptions = {
            from: process.env.GMAIL_USER || 'noreply.pharmaville@gmail.com',
            to: HARDCODED_ADMIN_EMAIL,
            subject: `New Order from ${name}`,
            text: `Order from ${name} (${email}):\n${ordered.join('\n') || 'None'}\nTotal: $${totalPrice.toFixed(2)}\nNot in stock:\n${notInStock.join('\n') || 'None'}`
        };

        await Promise.all([
            transporter.sendMail(userMailOptions),
            transporter.sendMail(adminMailOptions)
        ]);

        res.json({ success: true, not_in_stock: notInStock });
    } catch (err) {
        console.error('Order processing error:', err);
        res.status(500).json({ success: false, error: 'Failed to process order' });
    }
});

// Schedule pickup
app.post('/schedule-pickup', async (req, res) => {
    const { email, name, pickupTime } = req.body;
    if (!email || !name || !pickupTime) {
        console.error('Invalid pickup request:', { email, name, pickupTime });
        return res.status(400).json({ success: false, error: 'Invalid request data' });
    }
    try {
        const pickupDate = new Date(pickupTime);
        if (isNaN(pickupDate.getTime())) {
            return res.status(400).json({ success: false, error: 'Invalid pickup time' });
        }
        const userMailOptions = {
            from: process.env.GMAIL_USER || 'noreply.pharmaville@gmail.com',
            to: email,
            subject: 'Pharmaville Pickup Confirmation',
            text: `Dear ${name},\n\nYour medication pickup is scheduled for ${pickupDate.toLocaleString()}.\n\nThank you!`
        };
        const adminMailOptions = {
            from: process.env.GMAIL_USER || 'noreply.pharmaville@gmail.com',
            to: HARDCODED_ADMIN_EMAIL,
            subject: `New Pickup Scheduled by ${name}`,
            text: `Pickup scheduled by ${name} (${email}) for ${pickupDate.toLocaleString()}.`
        };
        await Promise.all([
            transporter.sendMail(userMailOptions),
            transporter.sendMail(adminMailOptions)
        ]);
        res.json({ success: true, pickupTime: pickupDate.toLocaleString() });
    } catch (err) {
        console.error('Pickup scheduling error:', err);
        res.status(500).json({ success: false, error: 'Failed to schedule pickup' });
    }
});

// Update stock
app.post('/update-stock', async (req, res) => {
    const { id, name, price, stock: stockQty } = req.body;
    if (!name || name.trim() === '' || price == null || price < 0 || stockQty == null || stockQty < 0) {
        console.error('Invalid stock update request:', { id, name, price, stock: stockQty });
        return res.status(400).json({ success: false, error: 'Invalid item data: name, price (≥0), and stock (≥0) required' });
    }
    try {
        if (id === null || id === undefined) {
            const newId = stock.length ? Math.max(...stock.map(i => i.id)) + 1 : 1;
            stock.push({ id: newId, name, price, stock: stockQty });
        } else {
            const itemIndex = stock.findIndex(i => i.id === id);
            if (itemIndex === -1) {
                return res.status(404).json({ success: false, error: `Item with ID ${id} not found` });
            }
            stock[itemIndex] = { id, name, price, stock: stockQty };
        }
        await fs.writeFile(stockFile, JSON.stringify(stock, null, 2));
        res.json({ success: true });
    } catch (err) {
        console.error('Stock update error:', err);
        res.status(500).json({ success: false, error: `Failed to update stock: ${err.message}` });
    }
});

// Delete stock item
app.delete('/update-stock', async (req, res) => {
    const { id } = req.body;
    if (!id || isNaN(id) || id <= 0) {
        console.error('Invalid stock deletion request:', { id });
        return res.status(400).json({ success: false, error: 'Valid Item ID required' });
    }
    try {
        const itemIndex = stock.findIndex(i => i.id === id);
        if (itemIndex === -1) {
            return res.status(404).json({ success: false, error: `Item with ID ${id} not found` });
        }
        stock.splice(itemIndex, 1);
        await fs.writeFile(stockFile, JSON.stringify(stock, null, 2));
        res.json({ success: true });
    } catch (err) {
        console.error('Stock deletion error:', err);
        res.status(500).json({ success: false, error: `Failed to delete stock: ${err.message}` });
    }
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
});

// Process error handlers
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
initializeStock()
    .then(() => {
        console.log('Server initialized');
    })
    .catch((err) => {
        console.error('Failed to initialize server:', err);
        process.exit(1);
    });
