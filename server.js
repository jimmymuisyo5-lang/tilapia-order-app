const express = require('express');
const cors = require('cors');
const path = require('path');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// MONGODB CONNECTION
// ============================================================

// REPLACE THIS WITH YOUR ACTUAL CONNECTION STRING
// Make sure <db_username> is replaced with your actual username (e.g., admin)
const MONGODB_URI = 'mongodb+srv://admin:4r2ofixtNlfjGB5f@tilapia-order-app.5001h25.mongodb.net/?appName=Tilapia-order-app';

let db;
let ordersCollection;
let customersCollection;

async function connectToMongoDB() {
    try {
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        console.log('✅ Connected to MongoDB successfully!');

        const database = client.db('tilapia_order_app');
        ordersCollection = database.collection('orders');
        customersCollection = database.collection('customers');

        // Create indexes for faster queries
        await customersCollection.createIndex({ phoneNumber: 1 }, { unique: true });
        await ordersCollection.createIndex({ phoneNumber: 1 });

        console.log('📋 Collections ready: orders, customers');
        return true;
    } catch (err) {
        console.error('❌ MongoDB connection error:', err.message);
        return false;
    }
}

// ============================================================
// API ROUTES - CUSTOMERS
// ============================================================

app.post('/api/register', async (req, res) => {
    try {
        console.log('📝 Registration attempt:', req.body.phoneNumber);
        const { phoneNumber, password, name } = req.body;

        if (!customersCollection) {
            return res.status(500).json({ error: 'Database not connected' });
        }

        // Check if customer already exists
        const existing = await customersCollection.findOne({ phoneNumber: phoneNumber });
        if (existing) {
            return res.status(400).json({ error: 'Phone number already registered' });
        }

        const newCustomer = {
            phoneNumber: phoneNumber,
            password: password,
            name: name || 'Customer',
            createdAt: new Date().toISOString()
        };

        await customersCollection.insertOne(newCustomer);
        console.log('✅ Customer registered:', phoneNumber);

        // Count customers
        const count = await customersCollection.countDocuments();
        console.log(`   📋 Total customers: ${count}`);

        const { password: _, ...customerWithoutPassword } = newCustomer;
        res.status(201).json({
            success: true,
            message: 'Registration successful',
            customer: customerWithoutPassword
        });
    } catch (err) {
        console.error('❌ Registration error:', err.message);
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        console.log('🔑 Login attempt:', req.body.phoneNumber);
        const { phoneNumber, password } = req.body;

        if (!customersCollection) {
            return res.status(500).json({ error: 'Database not connected' });
        }

        // Count total customers
        const totalCustomers = await customersCollection.countDocuments();
        console.log(`📋 Found ${totalCustomers} customers in database`);

        if (totalCustomers === 0) {
            return res.status(401).json({ error: 'No customers registered. Please register first.' });
        }

        const customer = await customersCollection.findOne({ phoneNumber: phoneNumber });
        if (!customer) {
            console.log('❌ Phone number not found:', phoneNumber);
            // Log all registered phones for debugging
            const allCustomers = await customersCollection.find({}).toArray();
            const phones = allCustomers.map(c => c.phoneNumber);
            console.log('   Registered phones:', phones.join(', '));
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
    } catch (err) {
        console.error('❌ Login error:', err.message);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.get('/api/customer/:phoneNumber/orders', async (req, res) => {
    try {
        const phoneNumber = req.params.phoneNumber;

        if (!customersCollection || !ordersCollection) {
            return res.status(500).json({ error: 'Database not connected' });
        }

        const customer = await customersCollection.findOne({ phoneNumber: phoneNumber });
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const orders = await ordersCollection.find({ phoneNumber: phoneNumber }).toArray();
        res.json(orders);
    } catch (err) {
        console.error('❌ Error fetching orders:', err.message);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// ============================================================
// ADMIN - RESET CUSTOMER PASSWORD
// ============================================================

app.post('/api/admin/reset-password', async (req, res) => {
    try {
        const { phoneNumber, newPassword } = req.body;

        if (!phoneNumber || !newPassword) {
            return res.status(400).json({ error: 'Phone number and new password required' });
        }

        if (!customersCollection) {
            return res.status(500).json({ error: 'Database not connected' });
        }

        const customer = await customersCollection.findOne({ phoneNumber: phoneNumber });
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        await customersCollection.updateOne(
            { phoneNumber: phoneNumber },
            { $set: { password: newPassword } }
        );

        res.json({
            success: true,
            message: `Password reset successfully for ${customer.name} (${customer.phoneNumber})`
        });
    } catch (err) {
        console.error('❌ Password reset error:', err.message);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

app.get('/api/admin/customers', async (req, res) => {
    try {
        if (!customersCollection) {
            return res.status(500).json({ error: 'Database not connected' });
        }

        const customers = await customersCollection.find({}).toArray();
        const customersWithoutPasswords = customers.map(c => {
            const { password, ...rest } = c;
            return rest;
        });
        res.json(customersWithoutPasswords);
    } catch (err) {
        console.error('❌ Error fetching customers:', err.message);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});

// ============================================================
// API ROUTES - ORDERS
// ============================================================

app.get('/api/orders', async (req, res) => {
    try {
        if (!ordersCollection) {
            return res.status(500).json({ error: 'Database not connected' });
        }

        const orders = await ordersCollection.find({}).toArray();
        res.json(orders);
    } catch (err) {
        console.error('❌ Error fetching orders:', err.message);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

app.post('/api/orders', async (req, res) => {
    try {
        if (!ordersCollection) {
            return res.status(500).json({ error: 'Database not connected' });
        }

        const newOrder = req.body;
        await ordersCollection.insertOne(newOrder);
        console.log('✅ Order placed:', newOrder.orderId);
        res.status(201).json(newOrder);
    } catch (err) {
        console.error('❌ Order placement error:', err.message);
        res.status(500).json({ error: 'Failed to place order' });
    }
});

app.put('/api/orders/:orderId', async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const updates = req.body;

        if (!ordersCollection) {
            return res.status(500).json({ error: 'Database not connected' });
        }

        const result = await ordersCollection.updateOne(
            { orderId: orderId },
            { $set: updates }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const updatedOrder = await ordersCollection.findOne({ orderId: orderId });
        res.json(updatedOrder);
    } catch (err) {
        console.error('❌ Order update error:', err.message);
        res.status(500).json({ error: 'Failed to update order' });
    }
});

app.delete('/api/orders/:orderId', async (req, res) => {
    try {
        const orderId = req.params.orderId;

        if (!ordersCollection) {
            return res.status(500).json({ error: 'Database not connected' });
        }

        const result = await ordersCollection.deleteOne({ orderId: orderId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json({ message: 'Order deleted' });
    } catch (err) {
        console.error('❌ Order deletion error:', err.message);
        res.status(500).json({ error: 'Failed to delete order' });
    }
});

// ============================================================
// KEEP ALIVE ENDPOINT
// ============================================================

app.get('/api/keep-alive', async (req, res) => {
    try {
        const customerCount = customersCollection ? await customersCollection.countDocuments() : 0;
        const orderCount = ordersCollection ? await ordersCollection.countDocuments() : 0;
        res.json({
            status: 'alive',
            customers: customerCount,
            orders: orderCount,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.json({
            status: 'alive',
            timestamp: new Date().toISOString()
        });
    }
});

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🐟 Tilapia Order Server running at http://localhost:${PORT}`);
    console.log(`📱 Customer App: http://localhost:${PORT}/customer.html`);
    console.log(`🔐 Admin App: http://localhost:${PORT}/admin.html`);

    // Connect to MongoDB
    await connectToMongoDB();
});
