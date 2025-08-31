const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const sessions = new Map(); // Track online users

// Email configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const HARDCODED_EMAIL = process.env.ADMIN_EMAIL || 'darian.bayan2@gmail.com';

app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

// Middleware to track sessions
app.use((req, res, next) => {
    const sessionId = req.headers['x-session-id'] || Math.random().toString(36).slice(2);
    res.setHeader('x-session-id', sessionId);
    if (req.body.name && req.body.email) {
        sessions.set(sessionId, { name: req.body.name, email: req.body.email });
    }
    setTimeout(() => sessions.delete(sessionId), 30 * 60 * 1000); // Expire after 30 minutes
    next();
});

// Get stock
app.get('/stock', async (req, res) => {
    try {
        const stock = JSON.parse(await fs.readFile('stock.json', 'utf8'));
        res.json(stock);
    } catch (err) {
        console.error('Error reading stock.json:', err);
        res.status(500).json({ error: 'Failed to load stock' });
    }
});

// Process order
app.post('/order', async (req, res) => {
    const { email, name, items } = req.body;

    if (!email || !name || !items) {
        console.error('Invalid order request:', { email, name, items });
        return res.status(400).json({ success: false, error: 'Invalid request data' });
    }

    try {
        let stock = JSON.parse(await fs.readFile('stock.json', 'utf8'));
        let ordered = [];
        let notInStock = [];
        let totalPrice = 0;

        for (const orderItem of items) {
            const itemId = orderItem.id;
            const qty = orderItem.quantity;
            let found = false;

            for (const stockItem of stock) {
                if (stockItem.id === itemId) {
                    found = true;
                    if (stockItem.stock >= qty) {
                        stockItem.stock -= qty;
                        ordered.push(`${stockItem.name} x ${qty} at $${stockItem.price} each`);
                        totalPrice += stockItem.price * qty;
                    } else {
                        notInStock.push(`${stockItem.name} (requested ${qty}, available ${stockItem.stock})`);
                    }
                    break;
                }
            }
            if (!found) {
                notInStock.push(`Item ${itemId} not found`);
            }
        }

        await fs.writeFile('stock.json', JSON.stringify(stock, null, 2));

        const userMailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Your Order Confirmation',
            text: `Your order:\n${ordered.join('\n')}\n\nNot in stock:\n${notInStock.join('\n') || 'None'}`
        };

        await transporter.sendMail(userMailOptions);

        const adminMailOptions = {
            from: process.env.EMAIL_USER,
            to: HARDCODED_EMAIL,
            subject: `New Order from ${name}`,
            text: `Order from ${name} (${email}):\n${ordered.join('\n')}\nTotal price: $${totalPrice}\n\nNot fulfilled:\n${notInStock.join('\n') || 'None'}`
        };

        await transporter.sendMail(adminMailOptions);

        res.json({ success: true, not_in_stock: notInStock });
    } catch (err) {
        console.error('Order processing error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Update stock
app.post('/update-stock', async (req, res) => {
    const { id, name, price, stock } = req.body;
    if (!name || price == null || stock == null) {
        console.error('Invalid stock update request:', { id, name, price, stock });
        return res.status(400).json({ success: false, error: 'Invalid item data' });
    }
    try {
        let stockData = JSON.parse(await fs.readFile('stock.json', 'utf8'));
        if (id === null) {
            const newId = stockData.length ? Math.max(...stockData.map(i => i.id)) + 1 : 1;
            stockData.push({ id: newId, name, price, stock });
        } else {
            const itemIndex = stockData.findIndex(i => i.id === id);
            if (itemIndex === -1) {
                return res.status(404).json({ success: false, error: 'Item not found' });
            }
            stockData[itemIndex] = { id, name, price, stock };
        }
        await fs.writeFile('stock.json', JSON.stringify(stockData, null, 2));
        res.json({ success: true });
    } catch (err) {
        console.error('Stock update error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Delete stock item
app.delete('/update-stock', async (req, res) => {
    const { id } = req.body;
    if (!id) {
        console.error('Invalid stock deletion request:', { id });
        return res.status(400).json({ success: false, error: 'Item ID required' });
    }
    try {
        let stockData = JSON.parse(await fs.readFile('stock.json', 'utf8'));
        const itemIndex = stockData.findIndex(i => i.id === id);
        if (itemIndex === -1) {
            return res.status(404).json({ success: false, error: 'Item not found' });
        }
        stockData.splice(itemIndex, 1);
        await fs.writeFile('stock.json', JSON.stringify(stockData, null, 2));
        res.json({ success: true });
    } catch (err) {
        console.error('Stock deletion error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get online users
app.get('/users', (req, res) => {
    const users = Array.from(sessions.values());
    res.json(users);
});

app.listen(PORT, () => {
    console.log(`Node.js server running on port ${PORT}`);
});
