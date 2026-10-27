# Wedding Registry Website

A free, no-paid-services wedding registry: static HTML/CSS/JS site + Google Sheets/Apps Script backend, hosted on GitHub Pages.

## Features
- Hero, registry grid, cash gifts, shipping info, FAQ
- Search, filter by category/status, sort by price/name/featured
- First-come reservation with name; reservation names stay private
- Guests can cancel their own reservation from any device with one confirmation
- Cash gifts via Venmo/PayPal/Zelle/bank transfer (no payment processing on site)
- Cash funds with percentage progress bars and an "Add cash!" form at the bottom of the page
- Guests record what they sent (or are sending); the fund total and progress bar update immediately
- Admin page to add, edit, delete, and release gifts
- Demo mode (localStorage) when backend not configured
- Local product images in `images/registry/`

## Quick start (demo)
Run a small static server from this folder:

```sh
python -m http.server 8000
```

Then open <http://localhost:8000>. Reservations and recorded contributions save to your browser's localStorage.
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
1. New Google Sheet. Create sheets: `Gifts`, `Funds`, `Reservations`, `Contributions`.
2. Header rows:
   - Gifts: `id name description price category image storeUrl quantity claimed reservedBy reservedAt message priority active note`
   - Funds: `id name description goal raised link qrImage`
   - Reservations: `timestamp giftId name message status`
   - Contributions: `timestamp fundId fundName name amount note`
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
No paid services. Edit cash methods in `index.html` (Venmo/PayPal/Zelle/bank details) and fund links in the `Funds` sheet.

Each `Funds` row shows a percentage bar based on `raised / goal`. Guests can click **Add cash!**, enter the amount they sent (or are sending), and optionally leave their name and a note. That immediately adds the amount to `raised`, appends a row to `Contributions`, and updates the bar. The site never processes a payment; guests send money directly using the methods listed above the funds.

There is intentionally no undo button. To correct a recorded contribution, edit `raised` in the `Funds` sheet (and the matching row in `Contributions` for your records).

## Admin
Open `admin.html` and enter the `ADMIN_TOKEN` when prompted. Add gifts, edit existing gifts, delete them, or release reservations. The admin page is public, so treat the token as the only protection.

The public `list` endpoint strips `reservedBy`, `reservedAt`, and `message`, so guests never see who reserved a gift. The admin page uses the token-gated `adminList` action.

## Notes
- Concurrency: Apps Script uses `LockService` to prevent double-booking and lost contributions.
- Privacy: reservation names and messages are only returned to the admin page. Contribution names and notes are stored only in the private `Contributions` sheet.
- Guest cancellation: anyone with the page can release a reserved gift by clicking "Cancel reservation" and confirming. This is intentional — there are no accounts, tokens, or identity checks. Every cancellation is logged in the `Reservations` sheet.
- Cash contributions: any guest can record an amount for a fund. Contributions increment `raised` immediately and cannot be undone from the site. Every contribution is logged in the `Contributions` sheet.
- Demo mode is per-browser only. Configure the Apps Script endpoint for shared reservations.

## Ideas to consider (future)
- RSVP form
- Photo gallery
- Thank-you tracker
- Multiple registries (Amazon/Target links) section
- Gift quantity > 1 (already supported)
- Email notifications via Apps Script `MailApp` (free quota)
