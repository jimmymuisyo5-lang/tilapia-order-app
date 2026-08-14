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
// SUPABASE CONNECTION
// ============================================================

// ⚠️ REPLACE THESE WITH YOUR ACTUAL SUPABASE CREDENTIALS
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co'; // <-- PASTE YOUR URL
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY'; // <-- PASTE YOUR ANON KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================
// API ROUTES
// ============================================================

// REGISTER
app.post('/api/register', async (req, res) => {
    try {
        const { phoneNumber, password, name } = req.body;

        // Check if user exists using phone_number column
        const { data: existing, error: findError } = await supabase
            .from('customers')
            .select('*')
            .eq('phone_number', phoneNumber)
            .maybeSingle();

        if (existing) {
            return res.status(400).json({ error: 'Phone number already registered' });
        }

        // Insert new user
        const { data: newCustomer, error: insertError } = await supabase
            .from('customers')
            .insert([{ 
                phone_number: phoneNumber,
                password: password, 
                name: name || 'Customer',
                created_at: new Date().toISOString() 
            }])
            .select()
            .single();

        if (insertError) {
            console.error('Insert error:', insertError);
            return res.status(500).json({ error: 'Registration failed', details: insertError.message });
        }

        const { password: _, ...customerWithoutPassword } = newCustomer;
        res.status(201).json({ success: true, message: 'Registration successful', customer: customerWithoutPassword });

    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// LOGIN
app.post('/api/login', async (req, res) => {
    try {
        const { phoneNumber, password } = req.body;

        const { data: customer, error } = await supabase
            .from('customers')
            .select('*')
            .eq('phone_number', phoneNumber)
            .maybeSingle();

        if (error || !customer) {
            return res.status(401).json({ error: 'Phone number not found' });
        }

        if (customer.password !== password) {
            return res.status(401).json({ error: 'Incorrect password' });
        }

        const { password: _, ...customerWithoutPassword } = customer;
        res.json({ success: true, message: 'Login successful', customer: customerWithoutPassword });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PLACE ORDER
app.post('/api/orders', async (req, res) => {
    try {
        const newOrder = req.body;
        
        // Ensure the order has an order_id
        if (!newOrder.order_id) {
            newOrder.order_id = 'TIL-' + Date.now();
        }

        const { data, error } = await supabase
            .from('orders')
            .insert([{
                order_id: newOrder.order_id,
                size: newOrder.size,
                price: newOrder.price,
                phone_number: newOrder.phone_number || newOrder.phoneNumber,
                delivery_area: newOrder.delivery_area || newOrder.deliveryArea,
                order_stage: newOrder.order_stage || newOrder.orderStage || 'Order Received',
                fry_status: newOrder.fry_status || newOrder.fryStatus || 'Not Fried',
                timestamp: newOrder.timestamp || new Date().toISOString(),
                created_at: newOrder.created_at || new Date().toISOString()
            }])
            .select()
            .single();

        if (error) {
            console.error('Insert order error:', error);
            return res.status(500).json({ error: 'Failed to place order', details: error.message });
        }

        res.status(201).json(data);

    } catch (err) {
        console.error('Order error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET CUSTOMER ORDERS
app.get('/api/customer/:phoneNumber/orders', async (req, res) => {
    try {
        const phoneNumber = req.params.phoneNumber;

        const { data: orders, error } = await supabase
            .from('orders')
            .select('*')
            .eq('phone_number', phoneNumber)
            .order('timestamp', { ascending: false });

        if (error) {
            console.error('Fetch orders error:', error);
            return res.status(500).json({ error: 'Failed to fetch orders' });
        }

        // Convert column names back to camelCase for the frontend
        const formattedOrders = orders.map(o => ({
            orderId: o.order_id,
            size: o.size,
            price: o.price,
            phoneNumber: o.phone_number,
            deliveryArea: o.delivery_area,
            orderStage: o.order_stage,
            fryStatus: o.fry_status,
            timestamp: o.timestamp,
            createdAt: o.created_at
        }));

        res.json(formattedOrders || []);

    } catch (err) {
        console.error('Fetch orders error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET ALL ORDERS (ADMIN)
app.get('/api/orders', async (req, res) => {
    try {
        const { data: orders, error } = await supabase
            .from('orders')
            .select('*')
            .order('timestamp', { ascending: true });

        if (error) {
            console.error('Fetch all orders error:', error);
            return res.status(500).json({ error: 'Failed to fetch orders' });
        }

        // Convert column names back to camelCase for the frontend
        const formattedOrders = orders.map(o => ({
            orderId: o.order_id,
            size: o.size,
            price: o.price,
            phoneNumber: o.phone_number,
            deliveryArea: o.delivery_area,
            orderStage: o.order_stage,
            fryStatus: o.fry_status,
            timestamp: o.timestamp,
            createdAt: o.created_at
        }));

        res.json(formattedOrders || []);

    } catch (err) {
        console.error('Fetch orders error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// UPDATE ORDER (ADMIN)
app.put('/api/orders/:orderId', async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const updates = req.body;

        // Convert camelCase to snake_case for database
        const dbUpdates = {};
        if (updates.orderStage) dbUpdates.order_stage = updates.orderStage;
        if (updates.fryStatus) dbUpdates.fry_status = updates.fryStatus;

        const { data, error } = await supabase
            .from('orders')
            .update(dbUpdates)
            .eq('order_id', orderId)
            .select()
            .single();

        if (error) {
            console.error('Update error:', error);
            return res.status(404).json({ error: 'Order not found' });
        }

        // Convert back to camelCase
        const formattedOrder = {
            orderId: data.order_id,
            size: data.size,
            price: data.price,
            phoneNumber: data.phone_number,
            deliveryArea: data.delivery_area,
            orderStage: data.order_stage,
            fryStatus: data.fry_status,
            timestamp: data.timestamp,
            createdAt: data.created_at
        };

        res.json(formattedOrder);

    } catch (err) {
        console.error('Update error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET CUSTOMERS (ADMIN)
app.get('/api/admin/customers', async (req, res) => {
    try {
        const { data: customers, error } = await supabase
            .from('customers')
            .select('id, phone_number, name, created_at');

        if (error) {
            console.error('Fetch customers error:', error);
            return res.status(500).json({ error: 'Failed to fetch customers' });
        }

        // Convert to camelCase for frontend
        const formattedCustomers = customers.map(c => ({
            id: c.id,
            phoneNumber: c.phone_number,
            name: c.name,
            createdAt: c.created_at
        }));

        res.json(formattedCustomers || []);

    } catch (err) {
        console.error('Fetch customers error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// RESET PASSWORD (ADMIN)
app.post('/api/admin/reset-password', async (req, res) => {
    try {
        const { phoneNumber, newPassword } = req.body;

        const { data, error } = await supabase
            .from('customers')
            .update({ password: newPassword })
            .eq('phone_number', phoneNumber)
            .select()
            .single();

        if (error) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        res.json({ success: true, message: `Password reset for ${data.name}` });

    } catch (err) {
        console.error('Reset error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================================
// KEEP ALIVE
// ============================================================
app.get('/api/keep-alive', async (req, res) => {
    try {
        const { count: customerCount, error: cErr } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true });

        const { count: orderCount, error: oErr } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true });

        res.json({
            status: 'alive',
            connected: true,
            customers: customerCount || 0,
            orders: orderCount || 0,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.json({ status: 'alive', connected: false, error: err.message });
    }
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🐟 Tilapia Order Server running at http://localhost:${PORT}`);
    console.log(`📱 Customer App: http://localhost:${PORT}/customer.html`);
    console.log(`🔐 Admin App: http://localhost:${PORT}/admin.html`);
    console.log(`💾 Supabase connected and ready`);
});
