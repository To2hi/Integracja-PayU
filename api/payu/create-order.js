import querystring from 'querystring';

const IS_SANDBOX = true;
const POS_ID = '492453';
const CLIENT_ID = '492453';
const CLIENT_SECRET = 'aedb543dda4489471a8a2ec1fcb71117';

export default async function handler(req, res) {
  try {
    // Obsługa tylko POST
    if (req.method !== 'POST') {
      return res.status(200).send('<h1>Nie otrzymano danych</h1>');
    }

    // Parsowanie body ręcznie
    if (!req.body) {
      const buffers = [];
      for await (const chunk of req) {
        buffers.push(chunk);
      }
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

    // Pobranie danych z Ecwid
    const { string, orderId, amount, currency, customerEmail } = req.body;

    // Jeśli wysyłasz tylko testowo "ABC"
    if (string) {
      return res.status(200).send(`<h1>Dane odebrane: ${string}</h1>`);
    }

    // Jeśli chcesz tworzyć zamówienie w PayU
    if (!orderId || !amount || !currency || !customerEmail) {
      return res.status(400).json({ error: 'Brak wymaganych danych w body' });
    }

    // 1. Token PayU
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

    // 2. Tworzenie zamówienia
    const orderData = {
      notifyUrl: 'https://integracja-pay-u-git-main-meat4dogs-projects.vercel.app/api/payu/notify',
      customerIp: req.headers['x-forwarded-for'] || '127.0.0.1',
      merchantPosId: POS_ID,
      description: 'Zamówienie z Ecwid',
      currencyCode: currency,
      totalAmount: Math.round(parseFloat(amount) * 100).toString(),
      extOrderId: orderId,
      buyer: { email: customerEmail },
      products: [{ name: 'Produkt testowy', unitPrice: Math.round(parseFloat(amount) * 100).toString(), quantity: 1 }],
    };

    const payuResponse = await fetch('https://secure.snd.payu.com/api/v2_1/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData),
    });

    const payuData = await payuResponse.json();

    if (!payuResponse.ok) {
      return res.status(400).json({ error: 'Błąd tworzenia zamówienia', details: payuData });
    }

    return res.status(200).json({ redirectUrl: payuData.redirectUri, orderId: payuData.orderId });
  } catch (err) {
    console.error('❌ Błąd:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
}
