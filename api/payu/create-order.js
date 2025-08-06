import crypto from 'crypto';
import fetch from 'node-fetch'; // jeśli potrzebujesz, w nowszych node wersjach globalny fetch jest dostępny

const MD5_KEY = '618b313785d080ceea568dc2eab2ab7f';  // Twój MD5 klucz PayU
const ECWID_STORE_ID = '42380002';                     // Twój Ecwid Store ID
const ECWID_TOKEN = 'public_JzusuYGtep43TAjXNkguMATTdduPBzH8'; // Ecwid API token

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    // 1. Wczytaj body (może być string lub już JSON)
    const bodyRaw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    // 2. Odczytaj podpis z nagłówka (lub z body, zależnie od PayU)
    // Załóżmy, że PayU wysyła podpis w nagłówku 'OpenPayu-Signature' lub w body JSON pod 'signature'
    // Dostosuj do swojego przypadku
    const receivedSignature = req.headers['openpayu-signature'] || (req.body && req.body.signature);
    if (!receivedSignature) {
      console.error('Brak podpisu w żądaniu');
      return res.status(400).send('Brak podpisu');
    }

    // 3. Oblicz lokalny podpis (MD5 na body + MD5_KEY)
    const localSignature = crypto
      .createHash('md5')
      .update(bodyRaw + MD5_KEY)
      .digest('hex');

    if (localSignature !== receivedSignature) {
      console.error(`Nieprawidłowy podpis. Otrzymano: ${receivedSignature}, oczekiwano: ${localSignature}`);
      return res.status(400).send('Nieprawidłowy podpis');
    }

    // 4. Parsuj powiadomienie
    const notification = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    const orderId = notification.order?.extOrderId;
    const status = notification.order?.status;

    if (!orderId || !status) {
      console.error('Brak orderId lub statusu w powiadomieniu');
      return res.status(400).send('Brak orderId lub statusu');
    }

    console.log(`Powiadomienie dla zamówienia ${orderId}: status ${status}`);

    // 5. Mapowanie statusów PayU na statusy Ecwid
    let ecwidStatus = null;
    if (status === 'COMPLETED' || status === 'WAITING_FOR_CONFIRMATION') {
      ecwidStatus = 'PROCESSING';  // status Ecwid dla płatności zaakceptowanych
    } else if (status === 'CANCELED') {
      ecwidStatus = 'CANCELED';    // status Ecwid dla anulowanych zamówień
    } else {
      // inne statusy ignorujemy lub logujemy
      console.log(`Status ${status} nie wymaga aktualizacji w Ecwid`);
      return res.status(200).send('OK');
    }

    // 6. Aktualizuj status zamówienia w Ecwid
    await updateEcwidOrderStatus(orderId, ecwidStatus);
    console.log(`Status zamówienia ${orderId} zaktualizowany na ${ecwidStatus}`);

    // 7. Zwróć potwierdzenie odbioru webhooka
    res.status(200).send('OK');
  } catch (error) {
    console.error('Błąd w handlerze webhooka:', error);
    res.status(500).send('Internal Server Error');
  }
}

async function updateEcwidOrderStatus(orderId, status) {
  const response = await fetch(`https://app.ecwid.com/api/v3/${ECWID_STORE_ID}/orders/${orderId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${ECWID_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      orderStatus: status
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Błąd HTTP: ${response.status}, odpowiedź: ${errorBody}`);
  }

  return response.json();
}

