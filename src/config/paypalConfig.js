const paypal = require('@paypal/checkout-server-sdk');

/**
 * PayPal SDK Configuration
 * Sets up the PayPal environment (sandbox or live)
 */

function environment() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const mode = process.env.PAYPAL_MODE || 'sandbox';

  console.log('🔧 PayPal Configuration:');
  console.log('   Mode:', mode);
  console.log('   Client ID exists:', !!clientId);
  console.log('   Client Secret exists:', !!clientSecret);

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials are missing in environment variables');
  }

  // Use sandbox for testing, live for production
  if (mode === 'live') {
    return new paypal.core.LiveEnvironment(clientId, clientSecret);
  } else {
    return new paypal.core.SandboxEnvironment(clientId, clientSecret);
  }
}

/**
 * Returns PayPal HTTP client instance with credentials
 */
function client() {
  return new paypal.core.PayPalHttpClient(environment());
}

module.exports = { client };