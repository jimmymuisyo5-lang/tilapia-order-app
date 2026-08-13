const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// MONGODB CONNECTION
// ============================================================

const MONGODB_URI = 'mongodb+srv://Jimmylanguser:Jimmy%4054321@tilapia-order-app.5001h25.mongodb.net/?appName=Tilapia-order-app';
const DB_NAME = 'tilapia_order_app';

let db = null;
let client = null;
let isConnected = false;

// Connect to MongoDB
async function connectToMongoDB() {
    try {
        console.log('⏳ Connecting to MongoDB...');
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        db = client.db(DB_NAME);
        isConnected = true;
        console.log('✅ Connected to MongoDB successfully');
        console.log(`📁 Database: ${DB_NAME}`);

        // Create collections if they don't exist
        try {
            await db.createCollection('customers');
        } catch (e) { /* collection already exists */ }
        try {
            await db.createCollection('orders');
        } catch (e) { /* collection already exists */ }

        return true;
    } catch (err) {
        console.error('❌ MongoDB connection error:', err.message);
        isConnected = false;
        return false;
    }
}

// Middleware to check database connection
function checkDbConnection(req, res, next) {
    if (!isConnected || !db) {
        return res.status(503).json({ 
            error: 'Database not connected. Please try again in a moment.' 
        });
    }
    next();
}

// Apply DB check middleware to all API routes
app.use('/api/*', checkDbConnection);

// Helper to get db
function getDb() {
    return db;
}

// ============================================================
// API ROUTES - CUSTOMERS
// ============================================================

app.post('/api/register', async (req, res) => {
    try {
        const db = getDb();
        const { phoneNumber, password, name } = req.body;

        // Check if customer already exists
        const existing = await db.collection('customers').findOne({ phoneNumber });
        if (existing) {
            return res.status(400).json({ error: 'Phone number already registered' });
        }

        // Create new customer
        const newCustomer = {
            id: Date.now().toString(),
            phoneNumber: phoneNumber,
            password: password,
            name: name || 'Customer',
            createdAt: new Date().toISOString()
        };

        await db.collection('customers').insertOne(newCustomer);

        console.log(`✅ Customer registered: ${phoneNumber}`);

        const { password: _, ...customerWithoutPassword } = newCustomer;
        res.status(201).json({
            success: true,
            message: 'Registration successful',
            customer: customerWithoutPassword
        });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const db = getDb();
        const { phoneNumber, password } = req.body;

        const customer = await db.collection('customers').findOne({ phoneNumber });
        if (!customer) {
            return res.status(401).json({ error: 'Phone number not found' });
        }

        if (customer.password !== password) {
            return res.status(401).json({ error: 'Incorrect password' });
        }

        console.log(`✅ Login successful: ${phoneNumber}`);

        const { password: _, ...customerWithoutPassword } = customer;
        res.json({
            success: true,
            message: 'Login successful',
            customer: customerWithoutPassword
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/customer/:phoneNumber/orders', async (req, res) => {
    try {
        const db = getDb();
        const phoneNumber = req.params.phoneNumber;

        const customer = await db.collection('customers').findOne({ phoneNumber });
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const orders = await db.collection('orders')
            .find({ phoneNumber })
            .sort({ timestamp: -1 })
            .toArray();

        res.json(orders);
    } catch (err) {
        console.error('Error fetching orders:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================================
// ADMIN ROUTES
// ============================================================

app.post('/api/admin/reset-password', async (req, res) => {
    try {
        const db = getDb();
        const { phoneNumber, newPassword } = req.body;

        if (!phoneNumber || !newPassword) {
            return res.status(400).json({ error: 'Phone number and new password required' });
        }

        const customer = await db.collection('customers').findOne({ phoneNumber });
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        await db.collection('customers').updateOne(
            { phoneNumber },
            { $set: { password: newPassword } }
        );

        res.json({
            success: true,
            message: `Password reset successfully for ${customer.name} (${customer.phoneNumber})`
        });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/admin/customers', async (req, res) => {
    try {
        const db = getDb();
        const customers = await db.collection('customers')
            .find({})
            .project({ password: 0 })
            .toArray();
        res.json(customers);
    } catch (err) {
        console.error('Error fetching customers:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================================
// API ROUTES - ORDERS
// ============================================================

app.get('/api/orders', async (req, res) => {
    try {
        const db = getDb();
        const orders = await db.collection('orders')
            .find({})
            .sort({ timestamp: 1 })
            .toArray();
        res.json(orders);
    } catch (err) {
        console.error('Error fetching orders:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/orders', async (req, res) => {
    try {
        const db = getDb();
        const newOrder = req.body;
        await db.collection('orders').insertOne(newOrder);
        res.status(201).json(newOrder);
    } catch (err) {
        console.error('Error creating order:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/orders/:orderId', async (req, res) => {
    try {
        const db = getDb();
        const orderId = req.params.orderId;
        const updates = req.body;

        const result = await db.collection('orders').updateOne(
            { orderId: orderId },
            { $set: updates }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const updatedOrder = await db.collection('orders').findOne({ orderId });
        res.json(updatedOrder);
    } catch (err) {
        console.error('Error updating order:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/orders/:orderId', async (req, res) => {
    try {
        const db = getDb();
        const orderId = req.params.orderId;

        const result = await db.collection('orders').deleteOne({ orderId });
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json({ message: 'Order deleted' });
    } catch (err) {
        console.error('Error deleting order:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================================
// KEEP ALIVE
// ============================================================

app.get('/api/keep-alive', async (req, res) => {
    try {
        if (!isConnected) {
            return res.json({ 
                status: 'disconnected', 
                message: 'MongoDB not connected',
                timestamp: new Date().toISOString()
            });
        }
        const db = getDb();
        const customerCount = await db.collection('customers').countDocuments();
        const orderCount = await db.collection('orders').countDocuments();
        res.json({
            status: 'alive',
            connected: true,
            customers: customerCount,
            orders: orderCount,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.json({ 
            status: 'alive', 
            connected: false,
            error: err.message 
        });
    }
});

// ============================================================
// START SERVER
// ============================================================

async function startServer() {
    // Connect to MongoDB
    const connected = await connectToMongoDB();
    
    // Start the server regardless (but API routes will check connection)
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🐟 Tilapia Order Server running at http://localhost:${PORT}`);
        console.log(`📱 Customer App: http://localhost:${PORT}/customer.html`);
        console.log(`🔐 Admin App: http://localhost:${PORT}/admin.html`);
        if (connected) {
            console.log(`💾 MongoDB connected and ready`);
        } else {
            console.log(`⚠️ MongoDB NOT connected. Check your connection string.`);
        }
    });
}

startServer();
