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
// DATA FILE - WITH BETTER PATH HANDLING
// ============================================================

// Try multiple possible locations for data file
const possiblePaths = [
    path.join(__dirname, 'data.json'),
    path.join(__dirname, '..', 'data.json'),
    path.join('/tmp', 'data.json'),
];

let DATA_FILE = possiblePaths[0]; // default

function findWritablePath() {
    for (const p of possiblePaths) {
        try {
            // Try to write a test file
            fs.writeFileSync(p, JSON.stringify({ test: true }));
            fs.unlinkSync(p);
            return p;
        } catch (err) {
            console.log(`❌ Cannot write to ${p}:`, err.message);
        }
    }
    // Fallback to /tmp which is usually writable on Render
    return '/tmp/data.json';
}

// Check if data.json exists in current directory, otherwise use /tmp
function getDataFilePath() {
    const localPath = path.join(__dirname, 'data.json');
    if (fs.existsSync(localPath)) {
        return localPath;
    }
    // Use /tmp as fallback
    return '/tmp/data.json';
}

DATA_FILE = getDataFilePath();
console.log(`📁 Using data file: ${DATA_FILE}`);

function ensureDataFile() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            console.log('⚠️ data.json not found, creating...');
            fs.writeFileSync(DATA_FILE, JSON.stringify({ orders: [], customers: [] }, null, 2));
            console.log('✅ data.json created at:', DATA_FILE);
        } else {
            console.log('✅ data.json found at:', DATA_FILE);
        }
    } catch (err) {
        console.error('❌ Error with data.json:', err.message);
        // Try /tmp as fallback
        DATA_FILE = '/tmp/data.json';
        try {
            fs.writeFileSync(DATA_FILE, JSON.stringify({ orders: [], customers: [] }, null, 2));
            console.log('✅ data.json created at /tmp');
        } catch (err2) {
            console.error('❌ Failed to create data.json:', err2.message);
        }
    }
}

ensureDataFile();

function readData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            console.log('⚠️ data.json missing, creating fresh');
            const defaultData = { orders: [], customers: [] };
            fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(data);
        if (!parsed.orders) parsed.orders = [];
        if (!parsed.customers) parsed.customers = [];
        return parsed;
    } catch (err) {
        console.error('❌ Error reading data.json:', err.message);
        // Return default data
        return { orders: [], customers: [] };
    }
}

function writeData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        console.log('✅ Data written successfully to:', DATA_FILE);
    } catch (err) {
        console.error('❌ Error writing data.json:', err.message);
        // Try fallback to /tmp
        if (DATA_FILE !== '/tmp/data.json') {
            try {
                DATA_FILE = '/tmp/data.json';
                fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
                console.log('✅ Data written to /tmp successfully');
            } catch (err2) {
                console.error('❌ Failed to write data to /tmp:', err2.message);
            }
        }
    }
}

// ============================================================
// API ROUTES - CUSTOMERS
// ============================================================

app.post('/api/register', (req, res) => {
    console.log('📝 Registration attempt:', req.body);
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

    console.log('✅ Customer registered:', newCustomer);

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

    if (!db.customers || !Array.isArray(db.customers)) {
        console.log('❌ No customers found in database');
        return res.status(401).json({ error: 'No customers registered' });
    }

    console.log(`📋 Found ${db.customers.length} customers in database`);

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
// REST OF THE API ROUTES
// ============================================================

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

// Admin - Reset customer password
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

// Orders
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
    console.log(`📁 Data file location: ${DATA_FILE}`);
});
