const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// MONGODB CONNECTION
// ============================================================

// ⚠️ REPLACE WITH YOUR ACTUAL CONNECTION STRING
const MONGODB_URI = 'mongodb+srv://Jimmylanguser1:Jimmy54321@tilapia-order-app.5001h25.mongodb.net/?appName=Tilapia-order-app';
const DB_NAME = 'tilapia_order_app';

let db = null;
let isConnected = false;

// Connect to MongoDB
async function connectDB() {
    try {
        console.log('⏳ Connecting to MongoDB...');
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        db = client.db(DB_NAME);
        isConnected = true;
        console.log('✅ MongoDB connected successfully!');
        console.log(`📁 Database: ${DB_NAME}`);
        return true;
    } catch (err) {
        console.error('❌ MongoDB connection error:', err.message);
        isConnected = false;
        return false;
    }
}

// ============================================================
// API ROUTES
// ============================================================

// Health check
app.get('/api/keep-alive', async (req, res) => {
    if (!isConnected || !db) {
        return res.json({
            status: 'disconnected',
            connected: false,
            error: 'MongoDB not connected',
            timestamp: new Date().toISOString()
        });
    }
    try {
        const customers = await db.collection('customers').countDocuments();
        const orders = await db.collection('orders').countDocuments();
        res.json({
            status: 'alive',
            connected: true,
            customers: customers,
            orders: orders,
            database: DB_NAME,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.json({
            status: 'alive',
            connected: false,
            error: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Register
app.post('/api/register', async (req, res) => {
    try {
        const { phoneNumber, password, name } = req.body;
        if (!db) return res.status(503).json({ error: 'Database not connected' });

        const existing = await db.collection('customers').findOne({ phoneNumber });
        if (existing) return res.status(400).json({ error: 'Phone number already registered' });

        const newCustomer = {
            id: Date.now().toString(),
            phoneNumber,
            password,
            name: name || 'Customer',
            createdAt: new Date().toISOString()
        };

        await db.collection('customers').insertOne(newCustomer);
        console.log(`✅ Registered: ${phoneNumber}`);

        const { password: _, ...customer } = newCustomer;
        res.status(201).json({ success: true, message: 'Registration successful', customer });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { phoneNumber, password } = req.body;
        if (!db) return res.status(503).json({ error: 'Database not connected' });

        const customer = await db.collection('customers').findOne({ phoneNumber });
        if (!customer) return res.status(401).json({ error: 'Phone number not found' });
        if (customer.password !== password) return res.status(401).json({ error: 'Incorrect password' });

        console.log(`✅ Login: ${phoneNumber}`);
        const { password: _, ...user } = customer;
        res.json({ success: true, message: 'Login successful', customer: user });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get customer orders
app.get('/api/customer/:phoneNumber/orders', async (req, res) => {
    try {
        const phoneNumber = req.params.phoneNumber;
        if (!db) return res.status(503).json({ error: 'Database not connected' });

        const orders = await db.collection('orders')
            .find({ phoneNumber })
            .sort({ timestamp: -1 })
            .toArray();
        res.json(orders);
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin: Get all customers
app.get('/api/admin/customers', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Database not connected' });
        const customers = await db.collection('customers')
            .find({})
            .project({ password: 0 })
            .toArray();
        res.json(customers);
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin: Reset password
app.post('/api/admin/reset-password', async (req, res) => {
    try {
        const { phoneNumber, newPassword } = req.body;
        if (!db) return res.status(503).json({ error: 'Database not connected' });

        const customer = await db.collection('customers').findOne({ phoneNumber });
        if (!customer) return res.status(404).json({ error: 'Customer not found' });

        await db.collection('customers').updateOne(
            { phoneNumber },
            { $set: { password: newPassword } }
        );

        res.json({ success: true, message: `Password reset for ${customer.name}` });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Orders
app.get('/api/orders', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Database not connected' });
        const orders = await db.collection('orders').find({}).sort({ timestamp: 1 }).toArray();
        res.json(orders);
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/orders', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Database not connected' });
        const newOrder = req.body;
        await db.collection('orders').insertOne(newOrder);
        res.status(201).json(newOrder);
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/orders/:orderId', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Database not connected' });
        const orderId = req.params.orderId;
        const updates = req.body;

        const result = await db.collection('orders').updateOne(
            { orderId },
            { $set: updates }
        );

        if (result.matchedCount === 0) return res.status(404).json({ error: 'Order not found' });

        const updated = await db.collection('orders').findOne({ orderId });
        res.json(updated);
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/orders/:orderId', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Database not connected' });
        const orderId = req.params.orderId;

        const result = await db.collection('orders').deleteOne({ orderId });
        if (result.deletedCount === 0) return res.status(404).json({ error: 'Order not found' });

        res.json({ message: 'Order deleted' });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================================
// START SERVER
// ============================================================

async function start() {
    await connectDB();
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🐟 Server running on http://localhost:${PORT}`);
        console.log(`📱 Customer: http://localhost:${PORT}/customer.html`);
        console.log(`🔐 Admin: http://localhost:${PORT}/admin.html`);
    });
}

start();
