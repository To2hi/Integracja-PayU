module.exports = async (req, res) => {
  try {
    console.log('Otrzymano powiadomienie od PayU');
    
    // FLAGA DLA ŚRODOWISKA TESTOWEGO
    const isSandbox = true; // Ustaw na false w produkcji
    
    // 1. Weryfikacja podpisu (tylko w produkcji)
    const signatureHeader = req.headers['openpayu-signature'];
    
    if (!isSandbox && !signatureHeader) {
      console.error('Brak nagłówka OpenPayu-Signature');
      return res.status(400).send('Brak nagłówka OpenPayu-Signature');
    }
    
    // 2. Oblicz oczekiwany podpis (tylko w produkcji)
    let isSignatureValid = true;
    if (!isSandbox && signatureHeader) {
      const expectedSignature = crypto.createHash('md5')
        .update(req.body + '618b313785d080ceea568dc2eab2ab7f')
        .digest('hex');
      
      isSignatureValid = signatureHeader === `sender=payu;signature=${expectedSignature}`;
      
      if (!isSignatureValid) {
        console.error('Nieprawidłowy podpis:', {
          received: signatureHeader,
          expected: `sender=payu;signature=${expectedSignature}`
        });
        return res.status(400).send('Nieprawidłowy podpis');
      }
    }
    
    // 3. Przetwarzanie powiadomienia
    const notification = JSON.parse(req.body);
    const orderId = notification.order.extOrderId;
    const status = notification.order.status;
    
    console.log(`Powiadomienie dla zamówienia ${orderId}: status ${status}`);
    
    // 4. Aktualizacja statusu zamówienia w Ecwid
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
    
    // 5. Potwierdzenie odbioru
    res.status(200).send('OK');
  } catch (error) {
    console.error('Błąd w notifyUrl:', error.message);
    res.status(500).send('Internal Server Error');
  }
};
