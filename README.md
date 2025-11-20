# porjaikai.github.io
พอใจขาย

Webapp scaffold: static frontend that talks to a Google Apps Script webapp (doGet/doPost).

Pages added:
- `index.html` — report page
- `seller.html` — manage stock/products
- `order.html` — create a new order

Client JS: `/assets/app.js` uses your provided Apps Script URL and Sheet ID. It will fall back to the repo CSV files `ร้านพอใจขาย - orderz.csv` and `ร้านพอใจขาย - seller (1).csv` when the script doesn't return data, so you can preview locally.

How to preview locally:

1. Run a local static server from repo root:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/index.html
```

2. The frontend expects the Apps Script webapp at:

```
https://script.google.com/macros/s/AKfycbxy9eAYKy-8HjBOCcWEz2A2sTVJFGylQQciVWvMfMfzPAu771cbkh8h7vQoPOYgByLj/exec
```

3. If you want the full integration, the Apps Script needs to implement JSON responses for actions used by the client: `listSellers`, `listOrders`, `createOrder`, `confirmPayment`, `updateStock`, `saveProduct`.

If you'd like, I can also scaffold the Google Apps Script code (doGet/doPost) that reads/writes the provided Google Sheet ID.

