cconst axios = require('axios');
const crypto = require('crypto');

module.exports = async (req, res) => {
  try {
    // 1. Pobierz dane zamówienia - obsługa zarówno query string jak i body
    let orderData;
    
    // Próba 1: Dane w query string (GET request od Ecwid)
    if (req.query.orderId) {
      orderData = req.query;
    } 
    // Próba 2: Dane w body jako JSON (POST request od Ecwid)
    else if (req.headers['content-type']?.includes('application/json') && req.body) {
      orderData = JSON.parse(req.body);
    }
    // Próba 3: Dane w body jako form-urlencoded
    else if (req.headers['content-type']?.includes('application/x-www-form-urlencoded') && req.body) {
      const params = new URLSearchParams(req.body);
      orderData = {};
      for (const [key, value] of params) {
        orderData[key] = value;
      }
    }

    // Sprawdź, czy udało się pobrać dane
    if (!orderData || !orderData.orderId) {
      return res.status(400).json({ 
        error: 'Brak wymaganych danych zamówienia',
        receivedQuery: req.query,
        receivedBody: req.body ? (req.headers['content-type']?.includes('application/json') ? JSON.parse(req.body) : req.body) : null,
        contentType: req.headers['content-type']
      });
    }

    // Teraz możemy bezpiecznie użyć danych
    const { orderId, amount, currency, customerEmail, customerFirstName, customerLastName } = orderData;
    
    console.log(`Tworzenie zamówienia PayU dla zamówienia Ecwid: ${orderId}`);
    
    // 2. Uzyskaj token dostępowy
    const tokenResponse = await axios.post(
      'https://secure.snd.payu.com/pl/standard/user/oauth/authorize',
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: '373966',
        client_secret: 'c789a1234567890abcdef1234567890'
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    const accessToken = tokenResponse.data.access_token;
    
    // 3. Przygotuj dane zamówienia dla PayU
    const payuOrderData = {
      notifyUrl: `https://${req.headers.host}/api/payu/notify`,
      customerIp: req.headers['x-forwarded-for'] || '127.0.0.1',
      merchantPosId: '492453',
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
      'https://secure.snd.payu.com/api/v2_1/orders',
      payuOrderData,
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
      return res.redirect(302, payuResponse.data.redirectUri);
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
