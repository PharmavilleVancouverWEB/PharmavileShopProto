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
let sessions = new Map();
let carts = new Map();
const stockFile = path.join(__dirname, 'stock.json');
const sessionsFile = path.join(__dirname, 'sessions.json');
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

// Initialize sessions.json
async function initializeSessions() {
    try {
        if (!(await fs.access(sessionsFile).catch(() => false))) {
            console.log('sessions.json not found, creating empty');
            await fs.writeFile(sessionsFile, JSON.stringify({ sessions: [], carts: [] }, null, 2));
        } else {
            const data = JSON.parse(await fs.readFile(sessionsFile));
            sessions = new Map(data.sessions || []);
            carts = new Map(data.carts || []);
        }
    } catch (err) {
        console.error('Error initializing sessions.json:', err);
        sessions = new Map();
        carts = new Map();
    }
}

// Save sessions and carts
async function saveSessions() {
    try {
        await fs.writeFile(sessionsFile, JSON.stringify({
            sessions: Array.from(sessions.entries()),
            carts: Array.from(carts.entries())
        }, null, 2));
    } catch (err) {
        console.error('Error saving sessions.json:', err);
    }
}

// Login endpoint
app.post('/login', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ success: false, error: 'Email required' });
    }
    const normalizedEmail = email.toLowerCase();
    if (bannedEmails.includes(normalizedEmail)) {
        return res.status(403).json({ success: false, error: 'Email is banned' });
    }
    sessions.set(normalizedEmail, { lastActive: Date.now() });
    await saveSessions();
    res.json({ success: true, email: normalizedEmail });
});

// Other routes (updated to persist sessions/carts)
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
    const normalizedEmail = email.toLowerCase();
    if (bannedEmails.includes(normalizedEmail)) {
        return res.status(403).json({ success: false, error: 'Email is banned' });
    }
    sessions.set(normalizedEmail, { lastActive: Date.now() });
    carts.set(normalizedEmail, items);
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
        carts.set(normalizedEmail, []);
        await saveSessions();
    } catch (err) {
        console.error('Error writing stock.json:', err);
        return res.status(500).json({ success: false, error: 'Failed to update stock' });
    }

    const mailOptions = {
        from: process.env.GMAIL_USER || 'noreply.pharmaville@gmail.com',
        to: normalizedEmail,
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

app.post('/end-sessions', async (req, res) => {
    sessions.clear();
    carts.clear();
    await saveSessions();
    res.json({ success: true });
});

app.post('/alert-all', (req, res) => {
    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ success: false, error: 'Message required' });
    }
    res.json({ success: true, message });
});

app.post('/clear-carts', async (req, res) => {
    carts.clear();
    await saveSessions();
    res.json({ success: true });
});

app.post('/end-sessions-20m', async (req, res) => {
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
    await saveSessions();
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
            await saveSessions();
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
Promise.all([initializeStock(), initializeSessions()])
    .then(() => {
        app.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    })
    .catch((err) => {
        console.error('Failed to initialize server:', err);
        process.exit(1);
    });
