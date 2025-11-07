// src/controllers/paymentController.js
const Stripe = require('stripe');
const User = require('../models/User');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * POST /api/payment/create-checkout-session
 * Body: { userId, plan }
 * Retourne: { url } (url Stripe Checkout)
 */
/*exports.createCheckoutSession = async (req, res) => {
  try {
    const { userId, plan } = req.body;
    if (!userId || !plan) return res.status(400).json({ message: 'userId et plan requis' });

    // prix en centimes
    const priceMap = {
      premium: 999, // 9.99 €
      pro: 1999,   // 19.99 €
    };
    const price = priceMap[plan];
    if (!price) return res.status(400).json({ message: 'Plan invalide' });

    // (Optionnel) Vérifier l'utilisateur existe
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });

    // Créer la session Checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment', // paiement unique ; pour abonnements -> "subscription"
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Upgrade vers ${plan}`,
              description: `Accès premium (${plan})`,
            },
            unit_amount: price,
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/cancel`,
      metadata: {
        userId: String(userId),
        plan,
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('createCheckoutSession error:', err);
    res.status(500).json({ message: 'Erreur création session Stripe' });
  }
};

/**
 * Webhook Stripe : POST /api/payment/webhook
 * Utiliser bodyParser.raw pour que req.body soit un Buffer
 */
exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // req.body est un Buffer si handler configuré correctement (bodyParser.raw)
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Gérer différents types d'événements
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    const plan = session.metadata?.plan;

    try {
      if (userId && plan) {
        // Exemple : activer pour 30 jours
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await User.findByIdAndUpdate(userId, {
          'subscription.plan': plan,
          'subscription.active': true,
          'subscription.expiresAt': expiresAt,
        });
        console.log(`Paiement réussi -> user ${userId} plan ${plan}`);
      }
    } catch (err) {
      console.error('Erreur mise à jour user après webhook:', err);
    }
  }

  // Répondre à Stripe
  res.json({ received: true });
};

/*
exports.createCheckoutSession = async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Abonnement Premium Test',
              description: 'Accès premium pendant 1 mois',
            },
            unit_amount: 500, // Montant en centimes : 500 = 5.00 €
          },
          quantity: 1,
        },
      ],
      // URLs de redirection
      success_url: 'http://localhost:5000/test-stripe?success=true',
      cancel_url: 'http://localhost:5000/test-stripe?canceled=true',
    });

    // Renvoie l’URL Stripe Checkout
    res.json({ url: session.url });
  } catch (error) {
    console.error("Erreur création session Stripe:", error.message);
    res.status(400).json({ error: error.message });
  }
};
*/

// ==========================================================
// ✅ 1. Créer une session Stripe Checkout
// ==========================================================
exports.createCheckoutSession = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId est requis" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    // Crée un client Stripe si non existant
    let customerId = user.subscription.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user._id.toString() },
      });
      customerId = customer.id;
      user.subscription.stripeCustomerId = customerId;
      await user.save();
    }

    // Crée la session de paiement
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Abonnement Premium',
              description: 'Accès illimité pendant 30 jours',
            },
            unit_amount: 500, // 5,00 €
          },
          quantity: 1,
        },
      ],
      metadata: { userId: userId.toString() },
      success_url: 'https://ton-app-mobile/success',
      cancel_url: 'https://ton-app-mobile/cancel',
    });

    // Renvoie l’URL au frontend (app mobile)
    res.json({ url: session.url });
  } catch (error) {
    console.error('Erreur création session Stripe:', error.message);
    res.status(400).json({ error: error.message });
  }
};

// ==========================================================
// ✅ 2. Webhook Stripe — Confirmation de paiement
// ==========================================================
exports.handleWebhook = async (req, res) => {
  let event;
  try {
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Erreur Webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 🧩 Paiement réussi
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata.userId;

    try {
      const user = await User.findById(userId);
      if (user) {
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 30); // expire dans 30 jours

        user.subscription.plan = 'premium';
        user.subscription.active = true;
        user.subscription.expiresAt = expirationDate;
        await user.save();

        console.log(`✅ Utilisateur ${user.email} est maintenant PREMIUM jusqu'au ${expirationDate}`);
      } else {
        console.error(`⚠️ Utilisateur non trouvé pour ID ${userId}`);
      }
    } catch (error) {
      console.error('Erreur mise à jour abonnement:', error);
    }
  }

  res.json({ received: true });
};