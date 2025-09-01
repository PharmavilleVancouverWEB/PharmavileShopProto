const express = require('express');
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const schedule = require('node-schedule');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER || 'noreply.pharmaville@gmail.com',
        pass: process.env.GMAIL_PASS || 'ljxasarmaappzsie'
    }
});

let stock = [];
let bannedEmails = [];
const stockFile = path.join(__dirname, 'stock.json');
let sessions = new Map();
let carts = new Map();
let isShutdown = false;
let shutdownEndTime = null;

// Initialize stock.json
async function initializeStock() {
    try {
        if (!(await fs.access(stockFile).catch(() => false))) {
            console.log('stock.json not found, creating with initial data');
            const initialData = {
                items: [
                    { id: 1, name: 'Item1', price: 10, stock: 5 },
                    { id: 2, name: 'Item2', price: 20, stock: 3 }
                ],
                bannedEmails: []
            };
            await fs.writeFile(stockFile, JSON.stringify(initialData, null, 2));
            stock = initialData.items;
            bannedEmails = initialData.bannedEmails;
        } else {
            const data = JSON.parse(await fs.readFile(stockFile));
            stock = data.items || [];
            bannedEmails = data.bannedEmails || [];
        }
    } catch (err) {
        console.error('Error initializing stock.json:', err);
        stock = [];
        bannedEmails = [];
    }
}

// Routes
app.get('/stock', (req, res) => {
    if (isShutdown) {
        return res.status(503).json({ success: false, error: 'Site is temporarily down' });
    }
    res.json(stock);
});

app.post('/check-ban', (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ success: false, error: 'Email required' });
    }
    res.json({ banned: bannedEmails.includes(email.toLowerCase()) });
});

app.post('/order', async (req, res) => {
    if (isShutdown) {
        return res.status(503).json({ success: false, error: 'Site is temporarily down' });
    }
    const { email, name, items } = req.body;
    if (!email || !name || !items || !Array.isArray(items)) {
        return res.status(400).json({ success: false, error: 'Invalid request data' });
    }
    sessions.set(email, { lastActive: Date.now() });
    carts.set(email, items);
    let not_in_stock = [];
    let orderSummary = '';

    items.forEach(item => {
        const stockItem = stock.find(s => s.id === item.id);
        if (stockItem && stockItem.stock >= item.quantity) {
            stockItem.stock -= item.quantity;
            orderSummary += `${stockItem.name} x${item.quantity}\n`;
        } else {
            not_in_stock.push(stockItem ? stockItem.name : `ID ${item.id}`);
        }
    });

    try {
        await fs.writeFile(stockFile, JSON.stringify({ items: stock, bannedEmails }, null, 2));
        carts.set(email, []);
    } catch (err) {
        console.error('Error writing stock.json:', err);
        return res.status(500).json({ success: false, error: 'Failed to update stock' });
    }

    const mailOptions = {
        from: process.env.GMAIL_USER || 'noreply.pharmaville@gmail.com',
        to: email,
        subject: 'Pharmaville Order Confirmation',
        text: `Dear ${name},\n\nYour order has been received:\n${orderSummary}\nNot in stock: ${not_in_stock.join(', ') || 'None'}\n\nThank you!`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Email error:', error);
            return res.status(500).json({ success: false, error: 'Failed to send email' });
        }
        res.json({ success: true, not_in_stock });
    });
});

app.post('/update-stock', async (req, res) => {
    if (isShutdown) {
        return res.status(503).json({ success: false, error: 'Site is temporarily down' });
    }
    const { id, name, price, stock: stockQty } = req.body;
    if (!name || typeof price !== 'number' || price < 0 || typeof stockQty !== 'number' || stockQty < 0) {
        return res.status(400).json({ success: false, error: 'Invalid stock data' });
    }

    if (id) {
        const item = stock.find(s => s.id === id);
        if (item) {
            item.name = name;
            item.price = price;
            item.stock = stockQty;
        } else {
            stock.push({ id, name, price, stock: stockQty });
        }
    } else {
        const newId = stock.length ? Math.max(...stock.map(s => s.id)) + 1 : 1;
        stock.push({ id: newId, name, price, stock: stockQty });
    }

    try {
        await fs.writeFile(stockFile, JSON.stringify({ items: stock, bannedEmails }, null, 2));
    } catch (err) {
        console.error('Error writing stock.json:', err);
        return res.status(500).json({ success: false, error: 'Failed to update stock' });
    }
    res.json({ success: true });
});

app.delete('/update-stock', async (req, res) => {
    if (isShutdown) {
        return res.status(503).json({ success: false, error: 'Site is temporarily down' });
    }
    const { id } = req.body;
    if (!id || typeof id !== 'number') {
        return res.status(400).json({ success: false, error: 'Invalid item ID' });
    }

    const index = stock.findIndex(s => s.id === id);
    if (index === -1) {
        return res.status(404).json({ success: false, error: 'Item not found' });
    }

    stock.splice(index, 1);
    try {
        await fs.writeFile(stockFile, JSON.stringify({ items: stock, bannedEmails }, null, 2));
    } catch (err) {
        console.error('Error writing stock.json:', err);
        return res.status(500).json({ success: false, error: 'Failed to update stock' });
    }
    res.json({ success: true });
});

app.post('/end-sessions', (req, res) => {
    sessions.clear();
    res.json({ success: true });
});

app.post('/alert-all', (req, res) => {
    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ success: false, error: 'Message required' });
    }
    res.json({ success: true, message });
});

app.post('/clear-carts', (req, res) => {
    carts.clear();
    res.json({ success: true });
});

app.post('/end-sessions-20m', (req, res) => {
    const now = Date.now();
    const twentyMinutes = 20 * 60 * 1000;
    let ended = 0;
    for (const [email, session] of sessions) {
        if (now - session.lastActive >= twentyMinutes) {
            sessions.delete(email);
            carts.delete(email);
            ended++;
        }
    }
    res.json({ success: true, ended });
});

app.post('/shutdown-site', (req, res) => {
    const { seconds } = req.body;
    if (!seconds || typeof seconds !== 'number' || seconds <= 0) {
        return res.status(400).json({ success: false, error: 'Invalid seconds' });
    }
    isShutdown = true;
    shutdownEndTime = Date.now() + seconds * 1000;
    schedule.scheduleJob(new Date(shutdownEndTime), () => {
        isShutdown = false;
        shutdownEndTime = null;
        console.log('Site shutdown ended');
    });
    console.log(`Site shutting down for ${seconds} seconds`);
    res.json({ success: true });
});

app.post('/ban-email', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ success: false, error: 'Email required' });
    }
    const normalizedEmail = email.toLowerCase();
    if (!bannedEmails.includes(normalizedEmail)) {
        bannedEmails.push(normalizedEmail);
        sessions.delete(normalizedEmail);
        carts.delete(normalizedEmail);
        try {
            await fs.writeFile(stockFile, JSON.stringify({ items: stock, bannedEmails }, null, 2));
        } catch (err) {
            console.error('Error writing stock.json:', err);
            return res.status(500).json({ success: false, error: 'Failed to update banned emails' });
        }
    }
    res.json({ success: true });
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
        app.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    })
    .catch((err) => {
        console.error('Failed to initialize server:', err);
        process.exit(1);
    });
