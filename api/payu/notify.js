
const { v4: uuidv4 } = require('uuid');

// 🔐 Dane konfiguracyjne
const POS_ID = '492453'; // Id punktu płatności (pos_id)
const CLIENT_ID = '492453'; // OAuth client_id
const CLIENT_SECRET = 'aedb543dda4489471a8a2ec1fcb71117'; // OAuth client_secret
const PAYU_OAUTH_URL = 'https://secure.snd.payu.com/pl/standard/user/oauth/authorize';
const PAYU_ORDER_URL = 'https://secure.snd.payu.com/api/v2_1/orders';


module.exports = async (req, res) => {
  try {
    const { amount, currency, customerEmail, orderId } = req.body;

    if (!amount || !currency || !customerEmail || !orderId) {
      return res.status(400).json({ error: 'Brakuje wymaganych danych zamówienia' });
    }

    // 1. 🔐 Uzyskaj token dostępu OAuth
    const tokenResponse = await fetch(PAYU_OAUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      console.error('❌ Błąd autoryzacji PayU:', tokenData);
      return res.status(500).json({ error: 'Błąd autoryzacji PayU' });
    }

    const accessToken = tokenData.access_token;

    // 2. 🧾 Przygotuj dane zamówienia
    const extOrderId = orderId || uuidv4();
    const orderPayload = {
      customerIp: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      merchantPosId: POS_ID,
      description: 'Zamówienie Ecwid',
      currencyCode: currency || 'PLN',
      totalAmount: Math.round(parseFloat(amount) * 100).toString(), // 10.00 zł => 1000 groszy
      extOrderId: extOrderId,
      buyer: {
        email: customerEmail
      },
      products: [
        {
          name: 'Produkt Ecwid',
          unitPrice: Math.round(parseFloat(amount) * 100).toString(),
          quantity: 1
        }
      ]
    };

    // 3. 📦 Wyślij zamówienie do PayU
    const orderResponse = await fetch(PAYU_ORDER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(orderPayload)
    });

    const orderData = await orderResponse.json();

    if (orderData.status?.statusCode !== 'SUCCESS') {
      console.error('❌ Błąd tworzenia zamówienia:', orderData);
      return res.status(500).json({ error: 'Błąd tworzenia zamówienia w PayU' });
    }

    // 4. ✅ Zwrot linku do płatności
    const redirectUri = orderData.redirectUri;
    res.status(200).json({
      message: 'Zamówienie utworzone',
      redirectUri,
      payuOrderId: orderData.orderId
    });

  } catch (error) {
    console.error('❌ Błąd create-order.js:', error);
    res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
  }
};
