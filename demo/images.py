"""Fetch public-domain lead images for the demo vault from Wikipedia/Commons.

Usage: python3 -I images.py OUT_DIR  (reads IMAGE_TITLES below)
Writes OUT_DIR/<slug>.jpg and OUT_DIR/credits.json. Skips anything whose
Commons licence is not public domain or CC0.
"""
import json, os, sys, time, urllib.error, urllib.parse, urllib.request, io
from PIL import Image

UA = "HomeCardsDemoVault/1.0 (https://github.com/ttangents/obsidian-home-cards)"
API = "https://en.wikipedia.org/w/api.php"

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for i in range(6):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if i == 5 or e.code not in (429, 500, 502, 503, 504): raise
            wait = int(e.headers.get("Retry-After") or 0) or 5 * (i + 1)
            print("  retry in", wait, "s:", e.code); time.sleep(wait)
        except Exception:
            if i == 5: raise
            time.sleep(3 * (i + 1))

def api(**params):
    params.update(format="json", formatversion="2")
    return json.loads(get(API + "?" + urllib.parse.urlencode(params)))

def lead_images(titles):
    out = {}
    for i in range(0, len(titles), 40):
        chunk = titles[i:i + 40]
        d = api(action="query", prop="pageimages", piprop="name", redirects=1, titles="|".join(chunk))
        norm = {n["from"]: n["to"] for n in d["query"].get("normalized", [])}
        redir = {n["from"]: n["to"] for n in d["query"].get("redirects", [])}
        pages = {p["title"]: p.get("pageimage") for p in d["query"]["pages"]}
        for t in chunk:
            k = norm.get(t, t); k = redir.get(k, k)
            out[t] = pages.get(k)
    return out

def info(files, width):
    out = {}
    for i in range(0, len(files), 10):
        chunk = files[i:i + 10]
        time.sleep(1)
        d = api(action="query", prop="imageinfo", iiprop="url|extmetadata", iiurlwidth=width,
                titles="|".join("File:" + f for f in chunk))
        for p in d["query"]["pages"]:
            ii = (p.get("imageinfo") or [None])[0]
            if ii: out[p["title"][5:].replace(" ", "_")] = ii
    return out

PD = ("public domain", "pd", "cc0", "pdm")

def licence_ok(meta):
    short = (meta.get("LicenseShortName", {}).get("value") or "").lower()
    lic = (meta.get("License", {}).get("value") or "").lower()
    return short.startswith(PD) or lic.startswith(("pd", "cc0")) or "public domain" in short, short or lic

def main(out_dir, wanted, width=1000):
    os.makedirs(out_dir, exist_ok=True)
    leads = lead_images([t for _, t in wanted])
    files = sorted({f for f in leads.values() if f})
    meta = info(files, width)
    credits = {}
    for slug, title in wanted:
        f = leads.get(title)
        if not f:
            print("NO IMAGE   ", slug, title); continue
        ii = meta.get(f.replace(" ", "_"))
        if not ii:
            print("NO INFO    ", slug, f); continue
        ok, lic = licence_ok(ii["extmetadata"])
        if not ok:
            print("LICENCE    ", slug, f, lic); continue
        path = os.path.join(out_dir, slug + ".jpg")
        if not os.path.exists(path):
            raw = get(ii.get("thumburl") or ii["url"])
            im = Image.open(io.BytesIO(raw)).convert("RGB")
            im.thumbnail((width, width))
            im.save(path, "JPEG", quality=78, optimize=True, progressive=True)
            time.sleep(1.5)
        artist = ii["extmetadata"].get("Artist", {}).get("value", "")
        credits[slug] = {"title": title, "file": f, "licence": lic,
                         "page": ii.get("descriptionurl", ""), "artist": artist}
        print("ok         ", slug, lic)
    json.dump(credits, open(os.path.join(out_dir, "credits.json"), "w"), indent=1)

if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from content import IMAGE_TITLES
    main(sys.argv[1], IMAGE_TITLES)
