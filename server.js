// server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

// Path to data file
const DATA_FILE = path.join(__dirname, 'data.json');

// Helper: Read data
function readData() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        // If file doesn't exist, return empty array
        return [];
    }
}

// Helper: Write data
function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ===== API ROUTES =====

// GET all orders
app.get('/api/orders', (req, res) => {
    const orders = readData();
    res.json(orders);
});

// POST new order
app.post('/api/orders', (req, res) => {
    const orders = readData();
    const newOrder = req.body;
    orders.push(newOrder);
    writeData(orders);
    res.status(201).json(newOrder);
});

// PUT update an order
app.put('/api/orders/:orderId', (req, res) => {
    const orders = readData();
    const orderId = req.params.orderId;
    const updates = req.body;

    const index = orders.findIndex(o => o.orderId === orderId);
    if (index === -1) {
        return res.status(404).json({ error: 'Order not found' });
    }

    orders[index] = { ...orders[index], ...updates };
    writeData(orders);
    res.json(orders[index]);
});

// DELETE an order (optional)
app.delete('/api/orders/:orderId', (req, res) => {
    let orders = readData();
    const orderId = req.params.orderId;
    orders = orders.filter(o => o.orderId !== orderId);
    writeData(orders);
    res.json({ message: 'Order deleted' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🐟 Tilapia Order Server running at http://localhost:${PORT}`);
    console.log(`📱 Customer App: http://localhost:${PORT}/customer.html`);
    console.log(`🔐 Admin App: http://localhost:${PORT}/admin.html`);
});
