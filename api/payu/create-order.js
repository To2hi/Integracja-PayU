export default async function handler(req, res) {
  if (req.method === "POST") {
    let body = "";

    // odbieranie danych POST
    await new Promise((resolve) => {
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", resolve);
    });

    // parsowanie form-data (x-www-form-urlencoded)
    const params = new URLSearchParams(body);
    const stringValue = params.get("string");

    // wyświetlenie na stronie
    res.status(200).send(`<h1>Dane odebrane: ${stringValue || "brak"}</h1>`);
  } else {
    res.status(200).send("<h1>Nie otrzymano danych</h1>");
  }
}
