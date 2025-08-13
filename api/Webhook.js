Import crypto from "crypto";
import getRawBody from "raw-body";

export const config = {
  api: {
    bodyParser: false, // Musimy wyłączyć domyślny parser, żeby dostać RAW body
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // Pobierz RAW body
    const rawBody = (await getRawBody(req)).toString("utf8");

    // Pobierz podpis z nagłówków
    const signature = req.headers["x-ecwid-webhook-signature"];

    // Oblicz swój podpis
    const expectedSignature = crypto
      .createHmac("sha256", process.env.ECWID_CLIENT_SECRET)
      .update(rawBody)
      .digest("base64");

    // Sprawdź zgodność podpisów
    if (signature !== expectedSignature) {
      console.warn("❌ Niepoprawny podpis webhooka Ecwid");
      return res.status(401).json({ error: "Invalid signature" });
    }

    // Parsujemy JSON dopiero po weryfikacji
    const payload = JSON.parse(rawBody);

    console.log("✅ Webhook OK:", payload);

    // Tu możesz dodać swoją logikę, np. zapis do bazy, wysyłka maila itd.

    return res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("❌ Błąd obsługi webhooka:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
