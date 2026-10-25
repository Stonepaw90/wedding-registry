# Google Sheets backend import

These CSVs are a starting point for the production Google Sheets backend.

1. Create a new Google Sheet.
2. Import each CSV into its own sheet:
   - `gifts.csv` → sheet named **Gifts**
   - `funds.csv` → sheet named **Funds**
   - `reservations.csv` → sheet named **Reservations**
3. In Google Sheets: **File → Import → Upload**, choose the CSV, then **Insert new sheet(s)**.
   Rename the imported tabs exactly as above.
4. Open **Extensions → Apps Script**, paste `Code.gs`, and set `ADMIN_TOKEN` under
   **Project Settings → Script Properties**.
5. Deploy as a web app: **Execute as: Me**, **Who has access: Anyone**.
6. Put the `/exec` URL into `config.js` as `endpoint`.

The `image` column already contains paths such as
`images/registry/le-creuset-signature-oval-dutch-oven-peche.png`. Those resolve
relative to the GitHub Pages site. If you prefer absolute URLs, replace them with
`https://<username>.github.io/<repo>/images/registry/...`.

Add your real cash funds to the **Funds** sheet. `funds.csv` contains headers only
so the demo placeholder funds are not published by accident.
