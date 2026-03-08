const Stripe = require('stripe');
const paypal = require('@paypal/checkout-server-sdk');
const paypalClient = require('../config/paypalConfig');
const User = require('../models/User');
const PayPalOrder = require('../models/PayPalOrder');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const API_URL = process.env.API_URL;

// ✅ Subscription Plans
const PLANS = {
  '1month': {
    name: 'Premium 1 Month',
    price: 500, // 5€ in cents
    duration: 30,
    description: 'Premium access for 30 days'
  },
  '3months': {
    name: 'Premium 3 Months',
    price: 1200, // 12€ in cents (20% discount)
    duration: 90,
    description: 'Premium access for 3 months - Save 20%'
  },
  '6months': {
    name: 'Premium 6 Months',
    price: 2000, // 20€ in cents (33% discount)
    duration: 180,
    description: 'Premium access for 6 months - Save 33%'
  }
};

// ================================
// STRIPE PAYMENT METHODS
// ================================

// 1️⃣ Create Stripe Checkout Session
exports.createCheckoutSession = async (req, res) => {
  try {
    const { email, planType } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    if (!planType || !PLANS[planType]) {
      return res.status(400).json({ error: "Invalid plan type" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const selectedPlan = PLANS[planType];

    // Create Stripe customer if not existing
    let customerId = user.subscription.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { 
          userId: user._id.toString(),
          email: user.email 
        },
      });
      customerId = customer.id;
      user.subscription.stripeCustomerId = customerId;
      await user.save();
    }

    // Create the payment session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: selectedPlan.name,
              description: selectedPlan.description,
            },
            unit_amount: selectedPlan.price,
          },
          quantity: 1,
        },
      ],
      metadata: { 
        userId: user._id.toString(),
        email: user.email,
        planType: planType,
        duration: selectedPlan.duration.toString(),
        paymentMethod: 'stripe'
      },
      success_url: `https://backendastomeetingapp-production.up.railway.app/payment-success`,
      cancel_url: `https://backendastomeetingapp-production.up.railway.app/payment-cancel`,
    });

    console.log('✅ Stripe session created:', session.id, 'Plan:', planType);
    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating Stripe session:', error.message);
    res.status(400).json({ error: error.message });
  }
};

// 2️⃣ Stripe Webhook Handler
exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body, 
      sig, 
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('❌ Stripe Webhook Error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('📩 Stripe Webhook received:', event.type);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('✅ Stripe Session Completed:', session);

    const userId = session.metadata?.userId;
    const email = session.metadata?.email;
    const planType = session.metadata?.planType;
    const duration = parseInt(session.metadata?.duration);

    console.log('🔍 Looking for user with ID:', userId, 'Plan:', planType);

    let user = null;

    if (userId) {
      user = await User.findById(userId);
    }
    
    if (!user && email) {
      user = await User.findOne({ email: email.toLowerCase() });
    }

    if (user) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (duration || 30));

      user.subscription.plan = 'premium';
      user.subscription.active = true;
      user.subscription.duration = planType;
      user.subscription.expiresAt = expiresAt;
      user.subscription.paymentMethod = 'stripe';

      await user.save();
      console.log(`✅ User ${user.email} is now PREMIUM (${planType}) until ${expiresAt}`);
    } else {
      console.error(`⚠️ User not found for userId: ${userId} or email: ${email}`);
    }
  }

  res.json({ received: true });
};

// ================================
// PAYPAL PAYMENT METHODS
// ================================

// 3️⃣ Create PayPal Order
// 3️⃣ Create PayPal Order
exports.createPayPalOrder = async (req, res) => {
  try {
    const { email, planType } = req.body;

    console.log('📩 PayPal order request received:', { email, planType });

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    if (!planType || !PLANS[planType]) {
      return res.status(400).json({ error: "Invalid plan type" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const selectedPlan = PLANS[planType];
    const amountInEuros = (selectedPlan.price / 100).toFixed(2);

    console.log('💰 Creating PayPal order for amount:', amountInEuros, 'EUR');

    if (!paypalClient || !paypalClient.client) {
      console.error('❌ PayPal client not initialized!');
      return res.status(500).json({ error: 'PayPal configuration error' });
    }

    // Create PayPal order
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'EUR',
          value: amountInEuros,
          breakdown: {
            item_total: {
              currency_code: 'EUR',
              value: amountInEuros
            }
          }
        },
        description: selectedPlan.description,
        custom_id: JSON.stringify({
          userId: user._id.toString(),
          email: user.email,
          planType: planType,
          duration: selectedPlan.duration
        }),
        items: [{
          name: selectedPlan.name,
          description: selectedPlan.description,
          unit_amount: {
            currency_code: 'EUR',
            value: amountInEuros
          },
          quantity: '1'
        }]
      }],
      application_context: {
        brand_name: 'Syni',
        landing_page: 'BILLING',
        user_action: 'PAY_NOW',
        return_url: `https://backendastomeetingapp-production.up.railway.app/api/payment/paypal/success`,
        cancel_url: `$https://backendastomeetingapp-production.up.railway.app/payment-success`
      }
    });

    console.log('🔄 Executing PayPal order creation...');
    const order = await paypalClient.client().execute(request);
    console.log('✅ PayPal order created:', order.result.id);

    // ✅ SAUVEGARDER LA COMMANDE DANS LA BASE DE DONNÉES
    const paypalOrder = new PayPalOrder({
      orderId: order.result.id,
      userId: user._id,
      email: user.email,
      planType: planType,
      duration: selectedPlan.duration,
      amount: selectedPlan.price,
      currency: 'EUR',
      status: 'pending',
      createdAt: new Date()
    });

    await paypalOrder.save();
    console.log('✅ Order saved to database:', order.result.id);

    // Find the approval URL
    const approvalUrl = order.result.links.find(link => link.rel === 'approve').href;

    if (!approvalUrl) {
      console.error('❌ No approval URL found in PayPal response');
      return res.status(500).json({ error: 'PayPal response missing approval URL' });
    }

    res.json({
      orderId: order.result.id,
      approvalUrl: approvalUrl
    });

  } catch (error) {
    console.error('❌ Error creating PayPal order:');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    if (error.response) {
      console.error('PayPal API Response:', error.response);
    }
    
    res.status(500).json({ 
      error: error.message || 'Failed to create PayPal order',
      details: error.response ? error.response.data : null
    });
  }
};

// 4️⃣ Capture PayPal Payment
exports.capturePayPalPayment = async (req, res) => {
  console.log('📥 Capture payment request received');
  console.log('Request body:', req.body);
  
  try {
    const { orderId } = req.body;

    if (!orderId) {
      console.error('❌ Order ID missing');
      return res.status(400).json({ error: "Order ID is required" });
    }

    console.log('🔍 Looking for order in database:', orderId);

    // ✅ RETRIEVE ORDER DATA FROM DATABASE
    const paypalOrder = await PayPalOrder.findOne({ orderId: orderId });

    if (!paypalOrder) {
      console.error('❌ Order not found in database:', orderId);
      return res.status(404).json({ error: 'Order not found' });
    }

    console.log('✅ Order found in database');
    console.log('   User ID:', paypalOrder.userId);
    console.log('   Email:', paypalOrder.email);
    console.log('   Plan:', paypalOrder.planType);
    console.log('   Duration:', paypalOrder.duration, 'days');

    // Check if already captured
    if (paypalOrder.status === 'completed') {
      console.log('⚠️ Order already captured');
      return res.json({
        success: true,
        message: 'Payment already processed',
        subscription: {
          plan: 'premium'
        }
      });
    }

    console.log('🔍 Capturing PayPal order:', orderId);

    // Initialize PayPal client
    let client;
    try {
      const clientId = process.env.PAYPAL_CLIENT_ID;
      const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
      const environment = new paypal.core.SandboxEnvironment(clientId, clientSecret);
      client = new paypal.core.PayPalHttpClient(environment);
      console.log('✅ PayPal client initialized');
    } catch (error) {
      console.error('❌ Failed to initialize PayPal client:', error.message);
      return res.status(500).json({ error: 'PayPal configuration error' });
    }

    // Capture the payment
    const request = new paypal.orders.OrdersCaptureRequest(orderId);
    request.requestBody({});

    console.log('🔄 Executing capture request...');
    const capture = await client.execute(request);
    
    console.log('✅ PayPal payment captured');
    console.log('Capture ID:', capture.result.id);
    console.log('Status:', capture.result.status);

    // Find user and update subscription
    let user = await User.findById(paypalOrder.userId);
    
    if (!user) {
      console.log('⚠️ User not found by ID, trying by email');
      user = await User.findOne({ email: paypalOrder.email.toLowerCase() });
    }

    if (!user) {
      console.error('❌ User not found');
      paypalOrder.status = 'failed';
      await paypalOrder.save();
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('✅ User found:', user.email);

    // Update subscription
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + paypalOrder.duration);

    user.subscription.plan = 'premium';
    user.subscription.active = true;
    user.subscription.duration = paypalOrder.planType;
    user.subscription.expiresAt = expiresAt;
    user.subscription.paymentMethod = 'paypal';
    user.subscription.paypalOrderId = orderId;

    await user.save();
    console.log(`✅ User ${user.email} is now PREMIUM (${paypalOrder.planType}) via PayPal until ${expiresAt}`);

    // Update order status
    paypalOrder.status = 'completed';
    paypalOrder.capturedAt = new Date();
    await paypalOrder.save();
    console.log('✅ Order marked as completed in database');

    return res.json({
      success: true,
      message: 'Payment successful',
      subscription: {
        plan: 'premium',
        expiresAt: expiresAt
      }
    });

  } catch (error) {
    console.error('❌ Error capturing PayPal payment');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    if (error.statusCode) {
      console.error('Status code:', error.statusCode);
    }

    // Try to update order status to failed
    try {
      const { orderId } = req.body;
      if (orderId) {
        await PayPalOrder.findOneAndUpdate(
          { orderId: orderId },
          { status: 'failed' }
        );
      }
    } catch (updateError) {
      console.error('Failed to update order status:', updateError.message);
    }

    return res.status(500).json({ 
      error: error.message || 'Failed to capture payment',
      details: process.env.NODE_ENV === 'development' ? error.toString() : undefined
    });
  }
};

// 5️⃣ PayPal Success Redirect Handler
exports.handlePayPalSuccess = async (req, res) => {
  const { token } = req.query; // PayPal returns 'token' which is the order ID
  
  console.log('📩 PayPal success callback received, token:', token);
  
  // Redirect to success page
  res.redirect(`https://backendastomeetingapp-production.up.railway.app/payment-success?provider=paypal&orderId=${token}`);
};

// ================================
// COMMON METHODS
// ================================

// 6️⃣ Get Available Plans
exports.getPlans = async (req, res) => {
  try {
    const plans = Object.entries(PLANS).map(([key, plan]) => ({
      id: key,
      name: plan.name,
      price: plan.price / 100, // Convert to euros
      duration: plan.duration,
      description: plan.description
    }));

    res.json(plans);
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
};

// 7️⃣ Get PayPal Orders (Admin/Debug)
exports.getPayPalOrders = async (req, res) => {
  try {
    const { userId, email, status } = req.query;
    
    let query = {};
    
    if (userId) query.userId = userId;
    if (email) query.email = email.toLowerCase();
    if (status) query.status = status;

    const orders = await PayPalOrder.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('userId', 'name email');

    res.json(orders);
  } catch (error) {
    console.error('Error fetching PayPal orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};