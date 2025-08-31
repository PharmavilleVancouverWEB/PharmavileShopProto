const express = require('express');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000; // Use Render's PORT or 3000 locally

// Email configuration (use environment variables for Render)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'noreply.pharmaville@gmail.com', // Your Gmail
    pass: process.env.EMAIL_PASS || 'ljxa sarm aapp zsie' // Generate from Google settings
  }
});

const HARDCODED_EMAIL = 'darian.bayan2@gmail.com'; // Change as needed

app.use(express.json());
app.use(express.static(path.join(__dirname, '.'))); // Serve static files from root

// Get stock
app.get('/stock', (req, res) => {
  try {
    const stock = JSON.parse(fs.readFileSync('stock.json', 'utf8'));
    res.json(stock);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load stock' });
  }
});

// Process order
app.post('/order', async (req, res) => {
  const { email, name, items } = req.body;

  try {
    // Read stock
    let stock = JSON.parse(fs.readFileSync('stock.json', 'utf8'));
    let ordered = [];
    let notInStock = [];
    let totalPrice = 0;

    // Process each item
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

    // Update stock file
    fs.writeFileSync('stock.json', JSON.stringify(stock, null, 2));

    // Send user email
    const userMailOptions = {
      from: process.env.EMAIL_USER || 'yourgmail@gmail.com',
      to: email,
      subject: 'Your Order Confirmation',
      text: `Your order:\n${ordered.join('\n')}\n\nNot in stock:\n${notInStock.join('\n') || 'None'}`
    };

    await transporter.sendMail(userMailOptions);

    // Send admin email
    const adminMailOptions = {
      from: process.env.EMAIL_USER || 'yourgmail@gmail.com',
      to: HARDCODED_EMAIL,
      subject: 'New Order Notification',
      text: `Order from ${name} (${email}):\n${ordered.join('\n')}\nTotal price: $${totalPrice}\n\nNot fulfilled:\n${notInStock.join('\n') || 'None'}`
    };

    await transporter.sendMail(adminMailOptions);

    res.json({ success: true, not_in_stock: notInStock });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Node.js server running on port ${PORT}`);
});
