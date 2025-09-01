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

const HARDCODED_ADMIN_EMAIL = 'darian.bayan2@gmail.com';
let stock = [];
const stockFile = path.join(__dirname, 'stock.json');

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

// Login endpoint (simplified, no session tracking)
app.post('/login', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        console.error('Invalid login request:', req.body);
        return res.status(400).json({ success: false, error: 'Email required' });
    }
    res.json({ success: true, email: email.toLowerCase() });
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
