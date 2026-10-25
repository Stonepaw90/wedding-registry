from PIL import Image, ImageDraw
import numpy as np
import os, json

SCREENSHOTS = r"C:\Users\abrah\Pictures\Screenshots"
OUT = r"C:\Users\abrah\Documents\WeddingRegistryOpenCode\images\registry"
os.makedirs(OUT, exist_ok=True)

# Product order follows the three registry screenshots, left-to-right, top-to-bottom.
# Each entry: (screenshot filename, row band (y0,y1), column index, slug, brand, name, price)
PRODUCTS = [
    ("Screenshot 2026-10-25 163848.png", (90, 410), 0, "le-creuset-signature-oval-dutch-oven-peche", "Le Creuset", "6.75 Qt. Signature Oval Cast Iron Dutch Oven in Peche", "485.00"),
    ("Screenshot 2026-10-25 163848.png", (90, 410), 1, "kitchenaid-hard-anodized-cookware-set", "KitchenAid", "Hard Anodized Ceramic Nonstick Cookware Set", ""),
    ("Screenshot 2026-10-25 163848.png", (90, 410), 2, "kitchenaid-artisan-stand-mixer-pistachio", "KitchenAid", "Artisan Series 5 Qt. Tilt-Head Stand Mixer in Pistachio", "500.00"),
    ("Screenshot 2026-10-25 163848.png", (90, 410), 3, "ninja-airfryer", "Ninja", "Airfryer", "120.00"),
    ("Screenshot 2026-10-25 163848.png", (920, 1180), 0, "cuisinart-compact-4-slice-toaster", "Cuisinart", "Compact 4-Slice Toaster", "70.00"),
    ("Screenshot 2026-10-25 163848.png", (920, 1180), 1, "crock-pot-8-quart-slow-cooker", "Crock-Pot", "8-Quart Programable Slow Cooker", "120.00"),
    ("Screenshot 2026-10-25 163848.png", (920, 1180), 2, "nutribullet-pro-single-serve-blender", "Nutribullet", "PRO Single Serve Blender in Matte Linen", "100.00"),
    ("Screenshot 2026-10-25 163848.png", (920, 1180), 3, "cuisinart-7-cup-food-processor", "Cuisinart", "7-Cup Food Processor in White", "100.00"),
    ("Screenshot 2026-10-25 164238.png", (40, 405), 0, "villeroy-boch-like-champagne-glasses", "Villeroy & Boch", "Like Champagne Glasses in Clay, Set of 2", "45.00"),
    ("Screenshot 2026-10-25 164238.png", (40, 405), 1, "mikasa-bliss-bar-tool-set", "Mikasa", "Bliss 8-Piece Bar Tool Set with Wooden Stand", "110.00"),
    ("Screenshot 2026-10-25 164238.png", (40, 405), 2, "crow-canyon-catalina-pitcher-pink-sunset", "Crow Canyon Home", "Catalina Enamelware Large Pitcher in Pink Sunset", "67.00"),
    ("Screenshot 2026-10-25 164238.png", (40, 405), 3, "cuisinart-chefs-classic-bakeware-set", "Cuisinart", "Chef's Classic 6-Piece Nonstick Bakeware Set in Champagne", "60.00"),
    ("Screenshot 2026-10-25 164238.png", (900, 1180), 0, "anchor-hocking-3-piece-measuring-cups", "Anchor Hocking", "3-Piece Measuring Cup Set", "40.00"),
    ("Screenshot 2026-10-25 164238.png", (900, 1180), 1, "joyjolt-alain-drinking-glasses", "JoyJolt", "Alain 8-Piece Drinking Glasses Set", "33.00"),
    ("Screenshot 2026-10-25 164238.png", (900, 1180), 2, "escali-folding-thermometer", "Escali", "Compact Folding Digital Thermometer in Black", "20.00"),
    ("Screenshot 2026-10-25 164238.png", (900, 1180), 3, "brooklyn-loom-cotton-sheet-set", "Brooklyn Loom", "Classic Cotton 4-Piece Sheet Set in White, Queen", "50.00"),
    ("Screenshot 2026-10-25 164243.png", (75, 370), 0, "joyjolt-14-piece-mixing-bowls", "JoyJolt", "14-Piece Stainless Steel Mixing Bowls with Lids Set", "38.00"),
    ("Screenshot 2026-10-25 164243.png", (75, 370), 1, "all-clad-pro-release-cooling-rack", "All-Clad", "Pro-Release Cooling and Baking Rack", "35.00"),
    ("Screenshot 2026-10-25 164243.png", (75, 370), 2, "bodum-melior-gooseneck-kettle", "Bodum", "Melior Gooseneck Electric Water Kettle", "50.00"),
    ("Screenshot 2026-10-25 164243.png", (75, 370), 3, "oxo-3-piece-peeler-set", "OXO", "3-Piece Peeler Set", "28.00"),
    ("Screenshot 2026-10-25 164243.png", (910, 1180), 0, "joseph-joseph-multi-grate-grater", "Joseph Joseph", "Multi-Grate & Store 3-in-1 Grater Set with Storage Container", "35.00"),
    ("Screenshot 2026-10-25 164243.png", (910, 1180), 1, "stone-lain-brasa-dinnerware-set", "Stone + Lain", "Brasa 16-Piece Dinnerware Set in White, Service for 4", "80.00"),
    ("Screenshot 2026-10-25 164243.png", (910, 1180), 2, "oxo-brew-coffee-grinder", "OXO", "Brew Conical Burr Coffee Grinder in Black", "110.00"),
]

COLUMN_BOUNDS = {
    "Screenshot 2026-10-25 163848.png": [(0, 470), (470, 950), (950, 1435), (1435, 1932)],
    "Screenshot 2026-10-25 164238.png": [(0, 490), (490, 974), (974, 1458), (1458, 1992)],
    "Screenshot 2026-10-25 164243.png": [(0, 490), (490, 975), (975, 1460), (1460, 2099)],
}

CANVAS = 500          # final square size
CONTENT = 460         # max content area inside canvas
PAD = 8               # padding around detected content before squaring

images = {}
manifest = []

for shot, (y0, y1), col, slug, brand, name, price in PRODUCTS:
    if shot not in images:
        images[shot] = Image.open(os.path.join(SCREENSHOTS, shot)).convert("RGB")
    im = images[shot]
    x0, x1 = COLUMN_BOUNDS[shot][col]
    region = im.crop((x0, y0, x1, y1))
    a = np.array(region)
    mask = (a < 246).any(axis=2)
    ys, xs = np.where(mask)
    if len(xs) == 0:
        raise RuntimeError(f"No content found for {slug}")
    bx0, bx1 = int(xs.min()) + x0, int(xs.max()) + x0 + 1
    by0, by1 = int(ys.min()) + y0, int(ys.max()) + y0 + 1

    # Add a little breathing room, clamped to image bounds
    bx0 = max(0, bx0 - PAD); by0 = max(0, by0 - PAD)
    bx1 = min(im.width, bx1 + PAD); by1 = min(im.height, by1 + PAD)
    content = im.crop((bx0, by0, bx1, by1))
    cw, ch = content.size

    # Scale to fit the square canvas, preserving aspect ratio (allow upscaling for uniformity)
    scale = min(CONTENT / cw, CONTENT / ch)
    nw, nh = max(1, round(cw * scale)), max(1, round(ch * scale))
    content = content.resize((nw, nh), Image.LANCZOS)

    canvas = Image.new("RGB", (CANVAS, CANVAS), "white")
    canvas.paste(content, ((CANVAS - nw) // 2, (CANVAS - nh) // 2))

    path = os.path.join(OUT, slug + ".png")
    canvas.save(path, "PNG", optimize=True)

    manifest.append({
        "slug": slug,
        "brand": brand,
        "name": name,
        "price": price,
        "image": f"images/registry/{slug}.png",
        "source": {"screenshot": shot, "box": [bx0, by0, bx1, by1]},
    })
    print(f"{slug:50s} bbox={bx0},{by0},{bx1},{by1}  content={cw}x{ch}")

with open(os.path.join(OUT, "products.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)

# Contact sheet for quick visual verification
cols = 6
thumb = 220
rows = (len(manifest) + cols - 1) // cols
sheet = Image.new("RGB", (cols * thumb, rows * (thumb + 22)), "white")
d = ImageDraw.Draw(sheet)
for i, item in enumerate(manifest):
    img = Image.open(os.path.join(OUT, item["slug"] + ".png")).resize((thumb, thumb), Image.LANCZOS)
    cx, cy = (i % cols) * thumb, (i // cols) * (thumb + 22)
    sheet.paste(img, (cx, cy))
    d.text((cx + 4, cy + thumb + 5), item["slug"][:34], fill="black")
sheet.save(os.path.join(OUT, "_contact_sheet.png"))
print("done")
