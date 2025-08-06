const crypto = require('crypto');

// Flaga środowiska testowego
const IS_SANDBOX = true;

// Klucze PayU
const POS_ID = '492453';
const CLIENT_ID = '492453';
const CLIENT_SECRET = 'aedb543dda4489471a8a2ec1fcb71117';
const SECOND_KEY_MD5 = '618b313785d080ceea568dc2eab2ab7f';

module.exports = async (req, res) => {
  try {
    const { orderId, amount, currency, customerEmail } = req.body;

    // 1. Pobierz token dostępu od PayU
    const tokenResponse = await fetch('https://secure.snd.payu.com/pl/standard/user/oauth/authorize', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // 2. Przygotuj dane zamówienia
    const orderData = {
      notifyUrl: 'https://integracja-pay-u-git-main-meat4dogs-projects.vercel.app/api/payu/notify',
      customerIp: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
      merchantPosId: POS_ID,
      description: 'Zamówienie z Ecwid',
      currencyCode: currency,
      totalAmount: Math.round(parseFloat(amount) * 100).toString(), // w groszach
      extOrderId: orderId,
      buyer: {
        email: customerEmail,
      },
      products: [
        {
          name: 'Produkt testowy',
          unitPrice: Math.round(parseFloat(amount) * 100).toString(),
          quantity: 1,
        },
      ],
    };

    // 3. Wyślij żądanie utworzenia zamówienia
    const payuResponse = await fetch('https://secure.snd.payu.com/api/v2_1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });

    const payuData = await payuResponse.json();

    if (payuResponse.status !== 302 && payuResponse.status !== 200) {
      return res.status(400).json({
        error: 'Nie udało się utworzyć zamówienia w PayU',
        details: payuData,
      });
    }

    // 4. Przekieruj klienta do płatności
    return res.status(200).json({
      redirectUrl: payuData.redirectUri,
      orderId: payuData.orderId,
    });
  } catch (err) {
    console.error('❌ Błąd przetwarzania powiadomienia:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
};
