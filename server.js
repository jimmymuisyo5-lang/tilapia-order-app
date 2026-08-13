const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// DATA FILE
// ============================================================

const DATA_FILE = path.join(__dirname, 'data.json');

function ensureDataFile() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            console.log('⚠️ data.json not found, creating...');
            fs.writeFileSync(DATA_FILE, JSON.stringify({ orders: [], customers: [] }, null, 2));
            console.log('✅ data.json created');
        } else {
            console.log('✅ data.json found at:', DATA_FILE);
        }
    } catch (err) {
        console.error('❌ Error with data.json:', err.message);
    }
}

ensureDataFile();

function readData() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(data);
        if (!parsed.orders) parsed.orders = [];
        if (!parsed.customers) parsed.customers = [];
        return parsed;
    } catch (err) {
        console.error('❌ Error reading data.json:', err.message);
        return { orders: [], customers: [] };
    }
}

function writeData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('❌ Error writing data.json:', err.message);
    }
}

// ============================================================
// API ROUTES - CUSTOMERS
// ============================================================

app.post('/api/register', (req, res) => {
    const db = readData();
    const { phoneNumber, password, name } = req.body;

    if (!db.customers) db.customers = [];

    const existing = db.customers.find(c => c.phoneNumber === phoneNumber);
    if (existing) {
        return res.status(400).json({ error: 'Phone number already registered' });
    }

    const newCustomer = {
        id: Date.now().toString(),
        phoneNumber: phoneNumber,
        password: password,
        name: name || 'Customer',
        createdAt: new Date().toISOString()
    };

    db.customers.push(newCustomer);
    writeData(db);

    const { password: _, ...customerWithoutPassword } = newCustomer;
    res.status(201).json({
        success: true,
        message: 'Registration successful',
        customer: customerWithoutPassword
    });
});

app.post('/api/login', (req, res) => {
    const db = readData();
    const { phoneNumber, password } = req.body;

    if (!db.customers || !Array.isArray(db.customers)) {
        return res.status(401).json({ error: 'No customers registered' });
    }

    const customer = db.customers.find(c => c.phoneNumber === phoneNumber);
    if (!customer) {
        return res.status(401).json({ error: 'Phone number not found' });
    }

    if (customer.password !== password) {
        return res.status(401).json({ error: 'Incorrect password' });
    }

    const { password: _, ...customerWithoutPassword } = customer;
    res.json({
        success: true,
        message: 'Login successful',
        customer: customerWithoutPassword
    });
});

app.get('/api/customer/:phoneNumber/orders', (req, res) => {
    const db = readData();
    const phoneNumber = req.params.phoneNumber;

    if (!db.customers || !Array.isArray(db.customers)) {
        return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = db.customers.find(c => c.phoneNumber === phoneNumber);
    if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
    }

    if (!db.orders) db.orders = [];
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

    if (!db.customers || !Array.isArray(db.customers)) {
        return res.status(404).json({ error: 'No customers found' });
    }

    const customer = db.customers.find(c => c.phoneNumber === phoneNumber);
    if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
    }

    customer.password = newPassword;
    writeData(db);

    res.json({
        success: true,
        message: `Password reset successfully for ${customer.name} (${customer.phoneNumber})`
    });
});

app.get('/api/admin/customers', (req, res) => {
    const db = readData();
    if (!db.customers || !Array.isArray(db.customers)) {
        return res.json([]);
    }
    const customers = db.customers.map(c => {
        const { password, ...rest } = c;
        return rest;
    });
    res.json(customers);
});

// ============================================================
// API ROUTES - ORDERS
// ============================================================

app.get('/api/orders', (req, res) => {
    const db = readData();
    if (!db.orders || !Array.isArray(db.orders)) {
        return res.json([]);
    }
    res.json(db.orders);
});

app.post('/api/orders', (req, res) => {
    const db = readData();
    if (!db.orders) db.orders = [];
    const newOrder = req.body;
    db.orders.push(newOrder);
    writeData(db);
    res.status(201).json(newOrder);
});

app.put('/api/orders/:orderId', (req, res) => {
    const db = readData();
    const orderId = req.params.orderId;
    const updates = req.body;

    if (!db.orders || !Array.isArray(db.orders)) {
        return res.status(404).json({ error: 'No orders found' });
    }

    const index = db.orders.findIndex(o => o.orderId === orderId);
    if (index === -1) {
        return res.status(404).json({ error: 'Order not found' });
    }

    db.orders[index] = { ...db.orders[index], ...updates };
    writeData(db);
    res.json(db.orders[index]);
});

app.delete('/api/orders/:orderId', (req, res) => {
    const db = readData();
    const orderId = req.params.orderId;

    if (!db.orders || !Array.isArray(db.orders)) {
        return res.status(404).json({ error: 'No orders found' });
    }

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
