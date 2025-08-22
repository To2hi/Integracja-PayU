import querystring from 'querystring';

// Konfiguracja PayU (sandbox)
const IS_SANDBOX = true;
const POS_ID = '492453';
const CLIENT_ID = '492453';
const CLIENT_SECRET = 'aedb543dda4489471a8a2ec1fcb71117';

// Endpoint API Next.js
export default async function handler(req, res) {
  try {
    // 1. Parsowanie body
    if (!req.body) {
      const buffers = [];
      for await (const chunk of req) buffers.push(chunk);
      const rawBody = Buffer.concat(buffers).toString();
      const contentType = req.headers['content-type'] || '';

      if (contentType.includes('application/json')) {
        req.body = JSON.parse(rawBody);
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        req.body = querystring.parse(rawBody);
      } else {
        throw new Error(`Unsupported content type: ${contentType}`);
      }
    }

    // 2. Wyciągnięcie danych zamówienia
    const { orderId, amount, currency, customerEmail, products } = req.body;

    if (!orderId || !amount || !currency || !customerEmail || !products) {
      return res.status(400).json({ error: 'Brak wymaganych danych w body' });
    }

    // 3. Pobranie tokenu PayU
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

    if (!accessToken) {
      throw new Error('Nie udało się pobrać tokenu PayU');
    }

    // 4. Przygotowanie danych do zamówienia
    const orderData = {
      notifyUrl: 'https://twoja-strona.vercel.app/api/payu/notify', // webhook PayU
      customerIp: req.headers['x-forwarded-for'] || '127.0.0.1',
      merchantPosId: POS_ID,
      description: `Zamówienie ${orderId} z Ecwid`,
      currencyCode: currency,
      totalAmount: Math.round(parseFloat(amount) * 100).toString(), // PayU w groszach
      extOrderId: orderId,
      buyer: { email: customerEmail },
      products: products.map(p => ({
        name: p.name,
        unitPrice: Math.round(parseFloat(p.price) * 100).toString(),
        quantity: p.quantity || 1,
      })),
    };

    // 5. Tworzenie zamówienia w PayU
    const payuResponse = await fetch('https://secure.snd.payu.com/api/v2_1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });

    const payuData = await payuResponse.json();

    if (!payuResponse.ok) {
      return res.status(400).json({ error: 'Błąd tworzenia zamówienia', details: payuData });
    }

    // 6. Zwrócenie redirectUrl dla klienta
    return res.status(200).json({
      redirectUrl: payuData.redirectUri,
      orderId: payuData.orderId,
    });
  } catch (err) {
    console.error('❌ Błąd:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
}
