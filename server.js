const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// IN-MEMORY DATA STORAGE (No file needed)
// ============================================================

// This stores data in memory while the server is running
// Note: Data will be lost if the server restarts, but it will work
const memoryData = {
    orders: [],
    customers: []
};

// Read data from memory
function readData() {
    return {
        orders: memoryData.orders || [],
        customers: memoryData.customers || []
    };
}

// Write data to memory
function writeData(data) {
    memoryData.orders = data.orders || [];
    memoryData.customers = data.customers || [];
    console.log(`✅ Data updated: ${memoryData.customers.length} customers, ${memoryData.orders.length} orders`);
    return true;
}

// ============================================================
// API ROUTES - CUSTOMERS
// ============================================================

app.post('/api/register', (req, res) => {
    console.log('📝 Registration attempt:', req.body.phoneNumber);
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

    console.log(`✅ Customer registered: ${phoneNumber}`);
    console.log(`   📋 Total customers: ${db.customers.length}`);

    const { password: _, ...customerWithoutPassword } = newCustomer;
    res.status(201).json({
        success: true,
        message: 'Registration successful',
        customer: customerWithoutPassword
    });
});

app.post('/api/login', (req, res) => {
    console.log('🔑 Login attempt:', req.body.phoneNumber);
    const db = readData();
    const { phoneNumber, password } = req.body;

    console.log(`📋 Found ${db.customers ? db.customers.length : 0} customers in database`);

    if (!db.customers || !Array.isArray(db.customers) || db.customers.length === 0) {
        console.log('❌ No customers in database');
        return res.status(401).json({ error: 'No customers registered. Please register first.' });
    }

    // Log all registered phones for debugging
    const phones = db.customers.map(c => c.phoneNumber);
    console.log('   Registered phones:', phones.join(', '));

    const customer = db.customers.find(c => c.phoneNumber === phoneNumber);
    if (!customer) {
        console.log('❌ Phone number not found:', phoneNumber);
        return res.status(401).json({ error: 'Phone number not found' });
    }

    if (customer.password !== password) {
        console.log('❌ Incorrect password for:', phoneNumber);
        return res.status(401).json({ error: 'Incorrect password' });
    }

    console.log('✅ Login successful for:', phoneNumber);

    const { password: _, ...customerWithoutPassword } = customer;
    res.json({
        success: true,
        message: 'Login successful',
        customer: customerWithoutPassword
    });
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

    if (!db.customers || !Array.isArray(db.customers) || db.customers.length === 0) {
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

// Get customer orders
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

// Admin - Get all customers
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
    console.log(`💾 Data stored in memory (${memoryData.customers.length} customers, ${memoryData.orders.length} orders)`);
    console.log(`⚠️ Note: Data will reset if server restarts`);
});
