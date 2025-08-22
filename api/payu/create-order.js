export default async function handler(req, res) {
  if (req.method === "POST") {
    // ręczne czytanie body (x-www-form-urlencoded)
    let body = "";
    await new Promise((resolve) => {
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", resolve);
    });

    // parsowanie danych formularza
    const params = new URLSearchParams(body);
    const stringValue = params.get("string");

    res.status(200).send(`<h1>Dane odebrane: ${stringValue || "brak"}</h1>`);
  } else {
    res.status(200).send("<h1>Nie otrzymano danych</h1>");
  }
}
