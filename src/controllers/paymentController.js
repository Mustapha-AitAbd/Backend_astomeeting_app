const Stripe = require('stripe');
const User = require('../models/User');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ================================
// 1️⃣ Creating a payment session
// ================================
exports.createCheckoutSession = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Create a Stripe customer if not existing
    let customerId = user.subscription.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { email: user.email },
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
              name: 'Premium Subscription',
              description: 'Unlimited access for 30 days',
            },
            unit_amount: 500, // 5,00 €
          },
          quantity: 1,
        },
      ],
      metadata: { email: user.email },
      success_url: 'https://ton-app-mobile/success',
      cancel_url: 'https://ton-app-mobile/cancel',
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating Stripe session:', error.message);
    res.status(400).json({ error: error.message });
  }
};

// ================================
// 2️⃣ Stripe Webhook - Payment Confirmation
// controllers/paymentController.js
exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe Webhook Error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('✅ Stripe Session:', session);

    const email = session.metadata?.email;
    console.log('Email metadata:', email);

    if (email) {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (user) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        user.subscription.plan = 'premium';
        user.subscription.active = true;
        user.subscription.expiresAt = expiresAt;

        await user.save();
        console.log(`✅User ${user.email} is now PREMIUM until ${expiresAt}`);
      } else {
        console.error(`⚠️ User not found for email ${email}`);
      }
    }
  }

  res.json({ received: true });
};
