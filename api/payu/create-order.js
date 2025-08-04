const axios = require('axios');
const crypto = require('crypto');

module.exports = async (req, res) => {
  try {
    // 1. Pobierz dane zamówienia z Ecwid
    const { orderId, amount, currency, customerEmail, customerFirstName, customerLastName } = req.body;
    
    if (!orderId || !amount) {
      return res.status(400).json({ error: 'Brak wymaganych danych zamówienia' });
    }
    
    console.log(`Tworzenie zamówienia PayU dla zamówienia Ecwid: ${orderId}`);
    
    // 2. Uzyskaj token dostępowy
    const tokenResponse = await axios.post(
      'https://secure.payu.com/pl/standard/user/oauth/authorize',
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.PAYU_OAUTH_CLIENT_ID,
        client_secret: process.env.PAYU_CLIENT_SECRET
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    const accessToken = tokenResponse.data.access_token;
    
    // 3. Przygotuj dane zamówienia dla PayU
    const orderData = {
      notifyUrl: `https://${req.headers.host}/api/payu/notify`,
      customerIp: req.headers['x-forwarded-for'] || '127.0.0.1',
      merchantPosId: process.env.PAYU_POS_ID,
      description: `Zamówienie Ecwid #${orderId}`,
      currencyCode: currency || "PLN",
      totalAmount: Math.round(amount * 100), // Kwota w groszach
      extOrderId: orderId,
      buyer: {
        email: customerEmail || 'nieznany@meat4dogs.pl',
        firstName: customerFirstName || 'Nieznany',
        lastName: customerLastName || 'Klient'
      },
      products: [
        {
          name: "Zakupy w sklepie meat4dogs.pl",
          unitPrice: Math.round(amount * 100),
          quantity: "1"
        }
      ]
    };
    
    // 4. Utwórz zamówienie w PayU
    const payuResponse = await axios.post(
      'https://secure.payu.com/api/v2_1/orders',
      orderData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // 5. Przekieruj klienta do płatności
    if (payuResponse.data.redirectUri) {
      console.log(`Przekierowanie na PayU dla zamówienia ${orderId}`);
      return res.status(302).json({ redirectUrl: payuResponse.data.redirectUri });
    } else {
      throw new Error('Brak redirectUri w odpowiedzi PayU');
    }
  } catch (error) {
    console.error('Błąd tworzenia zamówienia:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Błąd tworzenia zamówienia w PayU',
      details: error.response?.data || error.message 
    });
  }
};
