require('dotenv').config();
const paypal = require('@paypal/checkout-server-sdk');

console.log('🔍 Testing PayPal Configuration...\n');

// Check environment variables
console.log('Environment Variables:');
console.log('   PAYPAL_CLIENT_ID:', process.env.PAYPAL_CLIENT_ID ? '✅ Set' : '❌ Missing');
console.log('   PAYPAL_CLIENT_SECRET:', process.env.PAYPAL_CLIENT_SECRET ? '✅ Set' : '❌ Missing');
console.log('   PAYPAL_MODE:', process.env.PAYPAL_MODE || 'sandbox (default)');
console.log('   API_URL:', process.env.API_URL || '❌ Missing');
console.log('');

if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
  console.error('❌ ERROR: PayPal credentials are missing!');
  console.log('\nPlease add to your .env file:');
  console.log('PAYPAL_CLIENT_ID=your_client_id_here');
  console.log('PAYPAL_CLIENT_SECRET=your_secret_here');
  console.log('PAYPAL_MODE=sandbox');
  process.exit(1);
}

// Test PayPal client initialization
try {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const mode = process.env.PAYPAL_MODE || 'sandbox';

  let environment;
  if (mode === 'live') {
    environment = new paypal.core.LiveEnvironment(clientId, clientSecret);
    console.log('🌍 Environment: LIVE (Production)');
  } else {
    environment = new paypal.core.SandboxEnvironment(clientId, clientSecret);
    console.log('🧪 Environment: SANDBOX (Testing)');
  }

  const client = new paypal.core.PayPalHttpClient(environment);
  console.log('✅ PayPal client initialized successfully!\n');

  // Test creating a simple order
  console.log('🧪 Testing order creation...');
  
  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer("return=representation");
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [{
      amount: {
        currency_code: 'EUR',
        value: '10.00'
      }
    }]
  });

  client.execute(request)
    .then(order => {
      console.log('✅ Test order created successfully!');
      console.log('   Order ID:', order.result.id);
      console.log('   Status:', order.result.status);
      console.log('\n🎉 PayPal integration is working correctly!\n');
    })
    .catch(error => {
      console.error('❌ Failed to create test order:');
      console.error('   Error:', error.message);
      if (error.statusCode) {
        console.error('   Status Code:', error.statusCode);
      }
      console.log('\n⚠️  Please check your PayPal credentials\n');
    });

} catch (error) {
  console.error('❌ Error initializing PayPal client:');
  console.error('   ', error.message);
  console.log('\n⚠️  Configuration error - please check your setup\n');
}