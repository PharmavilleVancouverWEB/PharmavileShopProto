const express = require('express');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'noreply.pharmaville@gmail.com',
        pass: 'ljxasarmaappzsie' // Replace with actual app-specific password
    }
});

let stock = [];
const stockFile = path.join(__dirname, 'stock.json');

if (fs.existsSync(stockFile)) {
    stock = JSON.parse(fs.readFileSync(stockFile));
}

app.get('/stock', (req, res) => {
    res.json(stock);
});

app.post('/order', (req, res) => {
    const { email, name, items } = req.body;
    if (!email || !name || !items || !Array.isArray(items)) {
        return res.status(400).json({ success: false, error: 'Invalid request data' });
    }

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

    fs.writeFileSync(stockFile, JSON.stringify(stock, null, 2));

    const mailOptions = {
        from: 'noreply.pharmaville@gmail.com',
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

app.post('/update-stock', (req, res) => {
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

    fs.writeFileSync(stockFile, JSON.stringify(stock, null, 2));
    res.json({ success: true });
});

app.delete('/update-stock', (req, res) => {
    const { id } = req.body;
    if (!id || typeof id !== 'number') {
        return res.status(400).json({ success: false, error: 'Invalid item ID' });
    }

    const index = stock.findIndex(s => s.id === id);
    if (index === -1) {
        return res.status(404).json({ success: false, error: 'Item not found' });
    }

    stock.splice(index, 1);
    fs.writeFileSync(stockFile, JSON.stringify(stock, null, 2));
    res.json({ success: true });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
