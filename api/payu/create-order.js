const fetch = require('node-fetch');
const IS_SANDBOX = true; // Ustaw na false w produkcji

module.exports = async (req, res) => {
  try {
    const { orderId, amount, currency, customerEmail } = req.body;

    if (!orderId || !amount || !currency || !customerEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const PAYU_URL = IS_SANDBOX
      ? 'https://secure.snd.payu.com'
      : 'https://secure.payu.com';

    const CLIENT_ID = '492453';
    const CLIENT_SECRET = 'aedb543dda4489471a8a2ec1fcb71117';
    const POS_ID = '492453';

    const tokenResponse = await fetch(`${PAYU_URL}/pl/standard/user/oauth/authorize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
      },
      body: 'grant_type=client_credentials'
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      throw new Error('Nie udało się pobrać tokenu dostępu');
    }

    const accessToken = tokenData.access_token;

    const orderResponse = await fetch(`${PAYU_URL}/api/v2_1/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        notifyUrl: 'https://integracja-pay-u-git-main-meat4dogs-projects.vercel.app/api/payu/notify',
        customerIp: '127.0.0.1',
        merchantPosId: POS_ID,
        description: 'Zamówienie Ecwid',
        currencyCode: currency,
        totalAmount: Math.round(parseFloat(amount) * 100).toString(),
        extOrderId: orderId,
        buyer: {
          email: customerEmail,
          language: 'pl'
        },
        products: [{
          name: 'Zamówienie',
          unitPrice: Math.round(parseFloat(amount) * 100).toString(),
          quantity: '1'
        }]
      })
    });

    const orderData = await orderResponse.json();

    if (orderData.status.statusCode !== 'SUCCESS') {
      throw new Error(`Błąd PayU: ${orderData.status.statusCode}`);
    }

    res.redirect(orderData.redirectUri);
  } catch (error) {
    console.error('❌ Błąd przetwarzania powiadomienia:', error);
    res.status(500).send('Internal Server Error');
  }
};

  return response.json();
}
