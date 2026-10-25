# Wedding Registry Website

A free, no-paid-services wedding registry: static HTML/CSS/JS site + Google Sheets/Apps Script backend, hosted on GitHub Pages.

## Features
- Hero, registry grid, cash gifts, shipping info, FAQ
- Search, filter by category/status, sort by price/name/featured
- First-come reservation with name (no accounts)
- Cash gifts via Venmo/PayPal/Zelle/bank transfer (no payment processing on site)
- Cash funds with progress bars
- Admin page to add/remove gifts and release reservations
- Demo mode (localStorage) when backend not configured
- Local product images in `images/registry/`

## Quick start (demo)
Run a small static server from this folder:

```sh
python -m http.server 8000
```

Then open <http://localhost:8000>. Reservations save to your browser's localStorage.
Opening `index.html` directly also works (`gifts-data.js` provides the catalog), but a local server is closer to production.

## Deploy to GitHub Pages

This repo is ready to publish. The workflow in `.github/workflows/pages.yml` deploys the repository root as a static site.

Live site: <https://stonepaw90.github.io/wedding-registry/>

Pages must be enabled once with **Source: GitHub Actions**; until then the workflow's "Configure Pages" step fails with a 404 from `GET /repos/{owner}/{repo}/pages`.

1. Create a **public** GitHub repository (GitHub Pages on private repos requires a paid plan).
2. Push this folder to the `main` branch.
3. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. The site publishes after the next push (or run the workflow manually from the **Actions** tab).
5. Your URL will be `https://<username>.github.io/<repo>/`. This repo targets <https://stonepaw90.github.io/wedding-registry/>.

No build step is needed. Asset paths are relative, so the site works under a repository subpath.

If you edit `gifts.json`, regenerate the direct-file fallback:

```sh
python tools/sync_gifts_data.py
```

## Backend: Google Sheets vs AWS

**Use Google Sheets + Apps Script.** It is the right fit for a wedding registry:

- Free, no credit card, no servers to manage
- Already implemented in `Code.gs`
- Easy to edit gifts directly in a spreadsheet
- Reservations are logged and serialized with `LockService`
- More than enough for a few hundred guests

AWS is not recommended here. A reliable setup would mean API Gateway + Lambda + DynamoDB (or Aurora), plus IAM, CORS, secrets, monitoring, and billing. That is a lot of moving parts for a temporary, low-traffic registry. Consider AWS only if you specifically want a cloud portfolio project or need heavy scale/custom auth. Supabase or Firebase would be an easier middle ground than AWS if you outgrow Sheets.

GitHub Pages can only host static files, so the backend must stay external either way.

## Production setup (Google Sheets, free)

### 1. Create Google Sheet
1. New Google Sheet. Create sheets: `Gifts`, `Funds`, `Reservations`.
2. Header rows:
   - Gifts: `id name description price category image storeUrl quantity claimed reservedBy reservedAt message priority active`
   - Funds: `id name description goal raised link qrImage`
   - Reservations: `timestamp giftId name message status`
3. Import the ready-made CSVs in `google-sheets/` (see `google-sheets/README.md`), or add your gifts manually. Set `active` = TRUE.
4. For images, use paths such as `images/registry/le-creuset-signature-oval-dutch-oven-peche.png` (relative paths work) or full `https://<username>.github.io/<repo>/images/registry/...` URLs.

### 2. Deploy Apps Script
1. In the sheet: **Extensions → Apps Script**.
2. Paste contents of `Code.gs`.
3. Set a strong admin token in **Project Settings → Script Properties** as `ADMIN_TOKEN`.
4. Deploy → New deployment → Web app. Execute as: **Me**. Who has access: **Anyone**.
5. Copy the `/exec` URL.

### 3. Configure site
Edit `config.js` and set only the endpoint:

```js
window.REGISTRY_CONFIG = {
  endpoint: "https://script.google.com/macros/s/.../exec",
  ...
};
```

Do **not** put the admin token in `config.js`; GitHub Pages serves it publicly. The admin page asks for the token and keeps it in `sessionStorage` for the current tab.

### 4. Host for free
Push to GitHub and enable Pages as described above. Netlify, Vercel, and Cloudflare Pages also work with the same static files.

### Cash gifts
No paid services. Edit cash methods in `index.html` (Venmo/PayPal/Zelle/bank details) and fund links in the `Funds` sheet. Funds progress updates when you update `raised`.

## Admin
Open `admin.html` and enter the `ADMIN_TOKEN` when prompted. Add gifts, delete, or release reservations. The admin page is public, so treat the token as the only protection.

## Notes
- Concurrency: Apps Script uses `LockService` to prevent double-booking.
- Privacy: only first name is shown as "Reserved by X"; adjust in `app.js` if desired.
- Demo mode is per-browser only. Configure the Apps Script endpoint for shared reservations.

## Ideas to consider (future)
- RSVP form
- Photo gallery
- Thank-you tracker
- Multiple registries (Amazon/Target links) section
- Gift quantity > 1 (already supported)
- Email notifications via Apps Script `MailApp` (free quota)
