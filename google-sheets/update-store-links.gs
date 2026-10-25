/**
 * One-time helper: replace the Google-search links in the "Gifts" sheet with
 * real product pages (the same URLs as google-sheets/gifts.csv).
 *
 * How to run:
 *   1. Open your registry spreadsheet.
 *   2. Extensions > Apps Script.
 *   3. Add this as a new file (e.g. UpdateLinks.gs), paste this, and save.
 *   4. Choose the function "updateStoreLinks" and click Run.
 *   5. Reload the live site to confirm the View buttons point to the stores.
 *
 * Re-running is safe: it only rewrites the storeUrl column for matching ids.
 */

function updateStoreLinks() {
  var URLS = {
    g1: 'https://www.lecreuset.com/oval-dutch-oven-6-3-4-qt-peche/21178031423071.html',
    g2: 'https://www.crateandbarrel.com/kitchenaid-matte-black-hard-anodized-ceramic-nonstick-10-piece-cookware-set/s516943',
    g3: 'https://www.kitchenaid.com/countertop-appliances/stand-mixers/tilt-head-stand-mixers/p.artisan-series-5-quart-tilt-head-stand-mixer.KSM150PSPT.html',
    g4: 'https://www.amazon.com/dp/B07FDJMC9Q',
    g5: 'https://www.cuisinart.com/4-slice-compact-toaster/CPT-142P1.html',
    g6: 'https://www.crock-pot.com/slow-cookers/7-quart-up/crock-pot-programmable-8-quart-slow-cooker-black-stainless-collection/SAP_2133119.html',
    g7: 'https://www.nutribullet.com/shop/blenders/nutribullet-pro/',
    g8: 'https://www.cuisinart.com/pro-classic-7-cup-food-processor/DLC-10SYP1.html',
    g9: 'https://www.bloomingdales.com/shop/product/villeroy-boch-like-champagne-set-of-2?ID=6127133',
    g10: 'https://www.mikasa.com/products/bliss-8-piece-bar-tool-set',
    g11: 'https://www.crowcanyonhome.com/products/cch-catalina-large-pitcher',
    g12: 'https://www.cuisinart.com/6-piece-bakeware-set/AMB-6CH.html',
    g13: 'https://www.amazon.com/dp/B0015QV5S4',
    g14: 'https://www.joyjolt.com/products/alain-drinking-glasses-set-of-8',
    g15: 'https://www.everythingkitchens.com/escali-compact-folding-digital-thermometer-black.html',
    g16: 'https://www.target.com/p/classic-cotton-solid-sheet-set-brooklyn-loom/-/A-79310411',
    g17: 'https://www.joyjolt.com/products/stainless-steel-mixing-bowls-with-lids-set',
    g18: 'https://www.all-clad.com/pro-release-nonstick-bakeware-cooling-and-baking-rack-11-x-17-inch.html',
    g19: 'https://www.bodum.com/us/en/11883-259us-melior',
    g20: 'https://www.oxo.com/oxo-good-grips-3-piece-prep-peeler-set-assorted-blades.html',
    g21: 'https://us.josephjoseph.com/products/multi-grate-store-3-in-1-grater-set-with-storage-container-multicolor',
    g22: 'https://www.stonelain.com/products/brasa-stoneware-dinnerware-sets-white',
    g23: 'https://www.oxo.com/conical-burr-coffee-grinder.html'
  };

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Gifts');
  if (!sheet) throw new Error('No sheet named "Gifts"');

  var width = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, width).getValues()[0];
  var idCol = headers.indexOf('id') + 1;
  var urlCol = headers.indexOf('storeUrl') + 1;
  if (!idCol || !urlCol) throw new Error('Missing "id" or "storeUrl" header');

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('No gift rows found.');
    return;
  }

  var ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
  var updated = 0;
  var unknown = [];

  for (var i = 0; i < ids.length; i++) {
    var id = String(ids[i][0]).trim();
    var url = URLS[id];
    if (!url) {
      if (id) unknown.push(id);
      continue;
    }
    sheet.getRange(i + 2, urlCol).setValue(url);
    updated++;
  }

  Logger.log('Updated %s gift links.', updated);
  if (unknown.length) Logger.log('No URL for ids: %s', unknown.join(', '));
}
