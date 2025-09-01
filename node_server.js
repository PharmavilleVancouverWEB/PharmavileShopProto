const express = require('express');
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
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
let carts = new Map();
const stockFile = path.join(__dirname, 'stock.json');

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
    res.json({ success: true, email: normalizedEmail });
});

// Routes
app.get('/stock', (req, res) => {
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
    const { email, name, items } = req.body;
    if (!email || !name || !items || !Array.isArray(items)) {
        return res.status(400).json({ success: false, error: 'Invalid request data' });
    }
    const normalizedEmail = email.toLowerCase();
    if (bannedEmails.includes(normalizedEmail)) {
        return res.status(403).json({ success: false, error: 'Email is banned' });
    }
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
