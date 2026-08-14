const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// SUPABASE CONNECTION - YOUR CREDENTIALS
// ============================================================

const SUPABASE_URL = 'https://sascbmavbhstzbhkrdlq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhc2NibWF2YmhzdHpiaGtyZGxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2ODA4NDYsImV4cCI6MjEwMjI1Njg0Nn0.Q8_hFBwwsTJpyIrvNV25XB_Gg18xweXlpT__vzGZ9Ys';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let isConnected = false;

// Test connection
async function testConnection() {
    try {
        const { data, error } = await supabase.from('customers').select('count').limit(1);
        if (error) {
            console.log('⚠️ Supabase connection test:', error.message);
            isConnected = false;
            return false;
        }
        isConnected = true;
        console.log('✅ Supabase connected successfully!');
        return true;
    } catch (err) {
        console.error('❌ Supabase connection error:', err.message);
        isConnected = false;
        return false;
    }
}

// ============================================================
// MIDDLEWARE
// ============================================================

function checkDb(req, res, next) {
    if (!isConnected) {
        return res.status(503).json({
            error: 'Database not connected',
            tip: 'Please try again in a moment.'
        });
    }
    next();
}

app.use('/api/*', checkDb);

// ============================================================
// API ROUTES
// ============================================================

// Health check
app.get('/api/keep-alive', async (req, res) => {
    if (!isConnected) {
        return res.json({
            status: 'disconnected',
            connected: false,
            error: 'Supabase not connected',
            timestamp: new Date().toISOString()
        });
    }
    try {
        const { count: customers, error: custErr } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true });

        const { count: orders, error: ordErr } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true });

        res.json({
            status: 'alive',
            connected: true,
            customers: customers || 0,
            orders: orders || 0,
            database: 'Supabase',
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

        // Check if customer exists
        const { data: existing, error: findErr } = await supabase
            .from('customers')
            .select('phone_number')
            .eq('phone_number', phoneNumber)
            .single();

        if (existing) {
            return res.status(400).json({ error: 'Phone number already registered' });
        }

        // Insert new customer
        const { data, error } = await supabase
            .from('customers')
            .insert([{
                phone_number: phoneNumber,
                password: password,
                name: name || 'Customer'
            }])
            .select();

        if (error) throw error;

        console.log(`✅ Registered: ${phoneNumber}`);

        const customer = data[0];
        const { password: _, ...customerWithoutPassword } = customer;
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

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { phoneNumber, password } = req.body;

        const { data: customer, error } = await supabase
            .from('customers')
            .select('*')
            .eq('phone_number', phoneNumber)
            .single();

        if (error || !customer) {
            return res.status(401).json({ error: 'Phone number not found' });
        }

        if (customer.password !== password) {
            return res.status(401).json({ error: 'Incorrect password' });
        }

        console.log(`✅ Login: ${phoneNumber}`);

        const { password: _, ...user } = customer;
        res.json({
            success: true,
            message: 'Login successful',
            customer: user
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get customer orders
app.get('/api/customer/:phoneNumber/orders', async (req, res) => {
    try {
        const phoneNumber = req.params.phoneNumber;

        const { data: orders, error } = await supabase
            .from('orders')
            .select('*')
            .eq('phone_number', phoneNumber)
            .order('timestamp', { ascending: false });

        if (error) throw error;

        res.json(orders || []);
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin: Get all customers
app.get('/api/admin/customers', async (req, res) => {
    try {
        const { data: customers, error } = await supabase
            .from('customers')
            .select('id, phone_number, name, created_at');

        if (error) throw error;

        res.json(customers || []);
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin: Reset password
app.post('/api/admin/reset-password', async (req, res) => {
    try {
        const { phoneNumber, newPassword } = req.body;

        const { data: customer, error: findErr } = await supabase
            .from('customers')
            .select('name')
            .eq('phone_number', phoneNumber)
            .single();

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const { error: updateErr } = await supabase
            .from('customers')
            .update({ password: newPassword })
            .eq('phone_number', phoneNumber);

        if (updateErr) throw updateErr;

        res.json({
            success: true,
            message: `Password reset for ${customer.name}`
        });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Orders
app.get('/api/orders', async (req, res) => {
    try {
        const { data: orders, error } = await supabase
            .from('orders')
            .select('*')
            .order('timestamp', { ascending: true });

        if (error) throw error;

        res.json(orders || []);
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/orders', async (req, res) => {
    try {
        const newOrder = req.body;

        const { data, error } = await supabase
            .from('orders')
            .insert([{
                order_id: newOrder.orderId,
                size: newOrder.size,
                price: newOrder.price,
                phone_number: newOrder.phoneNumber,
                delivery_area: newOrder.deliveryArea,
                order_stage: newOrder.orderStage || 'Order Received',
                fry_status: newOrder.fryStatus || 'Not Fried',
                timestamp: new Date().toISOString(),
                created_at: newOrder.createdAt || new Date().toISOString()
            }])
            .select();

        if (error) throw error;

        res.status(201).json(data[0]);
    } catch (err) {
        console.error('Error creating order:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/orders/:orderId', async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const updates = req.body;

        // Build update object
        const updateObj = {};
        if (updates.orderStage) updateObj.order_stage = updates.orderStage;
        if (updates.fryStatus) updateObj.fry_status = updates.fryStatus;

        const { data, error } = await supabase
            .from('orders')
            .update(updateObj)
            .eq('order_id', orderId)
            .select();

        if (error) throw error;

        if (data.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json(data[0]);
    } catch (err) {
        console.error('Error updating order:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/orders/:orderId', async (req, res) => {
    try {
        const orderId = req.params.orderId;

        const { error } = await supabase
            .from('orders')
            .delete()
            .eq('order_id', orderId);

        if (error) throw error;

        res.json({ message: 'Order deleted' });
    } catch (err) {
        console.error('Error deleting order:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================================
// START SERVER
// ============================================================

async function start() {
    await testConnection();
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🐟 Server running on http://localhost:${PORT}`);
        console.log(`📱 Customer: http://localhost:${PORT}/customer.html`);
        console.log(`🔐 Admin: http://localhost:${PORT}/admin.html`);
    });
}

start();
