const crypto = require('crypto');

module.exports = async (req, res) => {
  try {
    console.log('Otrzymano powiadomienie od PayU');
    
    // 1. Weryfikacja podpisu
    const signatureHeader = req.headers['openpayu-signature'];
    if (!signatureHeader) {
      console.error('Brak nagłówka OpenPayu-Signature');
      return res.status(400).send('Brak nagłówka OpenPayu-Signature');
    }
    
    // 2. Oblicz oczekiwany podpis
    const expectedSignature = crypto.createHash('md5')
      .update(req.body + process.env.PAYU_MD5_KEY)
      .digest('hex');
    
    // 3. Sprawdź poprawność podpisu
    if (signatureHeader !== `sender=payu;signature=${expectedSignature}`) {
      console.error('Nieprawidłowy podpis:', {
        received: signatureHeader,
        expected: `sender=payu;signature=${expectedSignature}`
      });
      return res.status(400).send('Nieprawidłowy podpis');
    }
    
    // 4. Przetwarzanie powiadomienia
    const notification = JSON.parse(req.body);
    const orderId = notification.order.extOrderId;
    const status = notification.order.status;
    
    console.log(`Powiadomienie dla zamówienia ${orderId}: status ${status}`);
    
    // 5. Aktualizacja statusu zamówienia w Ecwid
    if (status === 'COMPLETED' || status === 'WAITING_FOR_CONFIRMATION') {
      try {
        await updateEcwidOrderStatus(orderId, 'processing');
        console.log(`Status zamówienia ${orderId} zaktualizowany na processing`);
      } catch (err) {
        console.error(`Błąd aktualizacji statusu zamówienia ${orderId}:`, err);
      }
    } else if (status === 'CANCELED') {
      try {
        await updateEcwidOrderStatus(orderId, 'canceled');
        console.log(`Status zamówienia ${orderId} zaktualizowany na canceled`);
      } catch (err) {
        console.error(`Błąd aktualizacji statusu zamówienia ${orderId}:`, err);
      }
    }
    
    // 6. Potwierdzenie odbioru
    res.status(200).send('OK');
  } catch (error) {
    console.error('Błąd w notifyUrl:', error.message);
    res.status(500).send('Internal Server Error');
  }
};

async function updateEcwidOrderStatus(orderId, status) {
  const response = await fetch(`https://app.ecwid.com/api/v3/${process.env.ECWID_STORE_ID}/orders/${orderId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${process.env.ECWID_PUBLIC_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      paymentStatus: status
    })
  });
  
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
  }
  
  return response.json();
}
