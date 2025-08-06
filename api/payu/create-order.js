const crypto = require('crypto');


// 🔐 Dane konfiguracyjne
const MD5_SECOND_KEY = '618b313785d080ceea568dc2eab2ab7f'; // Drugi klucz z panelu PayU
const ECWID_STORE_ID = '42380002';
const ECWID_API_TOKEN = 'public_JzusuYGtep43TAjXNkguMATTdduPBzH8';


module.exports = async (req, res) => {
  try {
    console.log('✅ Odebrano powiadomienie od PayU');

    // Pobierz nagłówek podpisu (tylko w produkcji)
    const signatureHeader = req.headers['openpayu-signature'];

    // Walidacja nagłówka (jeśli produkcja)
    if (!IS_SANDBOX && !signatureHeader) {
      console.error('❌ Brak nagłówka OpenPayu-Signature');
      return res.status(400).send('Brak nagłówka OpenPayu-Signature');
    }

    // Parsowanie ciała
    const bodyString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const notification = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    // Sprawdzenie podpisu (jeśli produkcja)
    if (!IS_SANDBOX && signatureHeader) {
      const expectedHash = crypto
        .createHash('md5')
        .update(bodyString + MD5_SECOND_KEY)
        .digest('hex');

      const expectedSignature = `sender=payu;signature=${expectedHash}`;

      if (signatureHeader !== expectedSignature) {
        console.error('❌ Nieprawidłowy podpis:', {
          odebrany: signatureHeader,
          oczekiwany: expectedSignature,
        });
        return res.status(400).send('Nieprawidłowy podpis');
      }
    }

    // 🧾 Pobierz dane z powiadomienia
    const orderId = notification?.order?.extOrderId;
    const status = notification?.order?.status;

    if (!orderId || !status) {
      console.error('❌ Brakuje orderId lub statusu w powiadomieniu');
      return res.status(400).send('Nieprawidłowe dane');
    }

    console.log(`🔔 Zamówienie ${orderId} - status: ${status}`);

    // 🛠️ Mapowanie statusów PayU -> Ecwid
    let ecwidOrderStatus = null;

    if (['COMPLETED', 'WAITING_FOR_CONFIRMATION'].includes(status)) {
      ecwidOrderStatus = 'PROCESSING';
    } else if (status === 'CANCELED') {
      ecwidOrderStatus = 'CANCELED';
    } else {
      console.log(`ℹ️ Status ${status} nie wymaga aktualizacji w Ecwid`);
      return res.status(200).send('OK');
    }

    // 🔄 Aktualizacja statusu zamówienia w Ecwid
    await updateEcwidOrderStatus(orderId, ecwidOrderStatus);
    console.log(`✅ Status zamówienia ${orderId} zaktualizowany na ${ecwidOrderStatus}`);

    return res.status(200).send('OK');

  } catch (err) {
    console.error('❌ Błąd przetwarzania powiadomienia:', err);
    return res.status(500).send('Internal Server Error');
  }
};

// 🔧 Funkcja aktualizująca status w Ecwid
async function updateEcwidOrderStatus(orderId, status) {
  const url = `https://app.ecwid.com/api/v3/${ECWID_STORE_ID}/orders/${orderId}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${ECWID_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      orderStatus: status
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return response.json();
}
