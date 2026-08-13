const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// DATA STORAGE
// ============================================================

const DATA_FILE = path.join(__dirname, 'data.json');

function readData() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return { orders: [], customers: [] };
    }
}

function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ============================================================
// API ROUTES - CUSTOMERS
// ============================================================

// Register a new customer
app.post('/api/register', (req, res) => {
    const db = readData();
    const { phoneNumber, password, name } = req.body;

    // Check if customer already exists
    const existing = db.customers.find(c => c.phoneNumber === phoneNumber);
    if (existing) {
        return res.status(400).json({ error: 'Phone number already registered' });
    }

    // Create new customer
    const newCustomer = {
        id: Date.now().toString(),
        phoneNumber: phoneNumber,
        password: password, // In production, hash this!
        name: name || 'Customer',
        createdAt: new Date().toISOString()
    };

    db.customers.push(newCustomer);
    writeData(db);

    // Return customer info without password
    const { password: _, ...customerWithoutPassword } = newCustomer;
    res.status(201).json({
        success: true,
        message: 'Registration successful',
        customer: customerWithoutPassword
    });
});

// Login customer
app.post('/api/login', (req, res) => {
    const db = readData();
    const { phoneNumber, password } = req.body;

    const customer = db.customers.find(c => c.phoneNumber === phoneNumber);
    if (!customer) {
        return res.status(401).json({ error: 'Phone number not found' });
    }

    if (customer.password !== password) {
        return res.status(401).json({ error: 'Incorrect password' });
    }

    // Return customer info without password
    const { password: _, ...customerWithoutPassword } = customer;
    res.json({
        success: true,
        message: 'Login successful',
        customer: customerWithoutPassword
    });
});

// Get customer orders
app.get('/api/customer/:phoneNumber/orders', (req, res) => {
    const db = readData();
    const phoneNumber = req.params.phoneNumber;

    const customer = db.customers.find(c => c.phoneNumber === phoneNumber);
    if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
    }

    const orders = db.orders.filter(o => o.phoneNumber === phoneNumber);
    res.json(orders);
});

// ============================================================
// ADMIN - RESET CUSTOMER PASSWORD
// ============================================================

app.post('/api/admin/reset-password', (req, res) => {
    const db = readData();
    const { phoneNumber, newPassword } = req.body;

    if (!phoneNumber || !newPassword) {
        return res.status(400).json({ error: 'Phone number and new password required' });
    }

    // Find the customer
    const customer = db.customers.find(c => c.phoneNumber === phoneNumber);
    if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
    }

    // Update password
    customer.password = newPassword;
    writeData(db);

    res.json({
        success: true,
        message: `Password reset successfully for ${customer.name} (${customer.phoneNumber})`
    });
});

// GET all customers (for admin to see list)
app.get('/api/admin/customers', (req, res) => {
    const db = readData();
    // Remove passwords from response
    const customers = db.customers.map(c => {
        const { password, ...rest } = c;
        return rest;
    });
    res.json(customers);
});

// ============================================================
// API ROUTES - ORDERS
// ============================================================

// GET all orders
app.get('/api/orders', (req, res) => {
    const db = readData();
    res.json(db.orders);
});

// POST new order
app.post('/api/orders', (req, res) => {
    const db = readData();
    const newOrder = req.body;
    db.orders.push(newOrder);
    writeData(db);
    res.status(201).json(newOrder);
});

// PUT update an order
app.put('/api/orders/:orderId', (req, res) => {
    const db = readData();
    const orderId = req.params.orderId;
    const updates = req.body;

    const index = db.orders.findIndex(o => o.orderId === orderId);
    if (index === -1) {
        return res.status(404).json({ error: 'Order not found' });
    }

    db.orders[index] = { ...db.orders[index], ...updates };
    writeData(db);
    res.json(db.orders[index]);
});

// DELETE an order
app.delete('/api/orders/:orderId', (req, res) => {
    const db = readData();
    const orderId = req.params.orderId;
    db.orders = db.orders.filter(o => o.orderId !== orderId);
    writeData(db);
    res.json({ message: 'Order deleted' });
});

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🐟 Tilapia Order Server running at http://localhost:${PORT}`);
    console.log(`📱 Customer App: http://localhost:${PORT}/customer.html`);
    console.log(`🔐 Admin App: http://localhost:${PORT}/admin.html`);
});
