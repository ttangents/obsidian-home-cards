"""Add the nineteenth-century notes in content.py to an existing vault.

Usage:
  python3 -I demo/images.py IMAGES_DIR
  python3 -I demo/build.py VAULT IMAGES_DIR [--today YYYY-MM-DD]

VAULT is Plugin Playground, the test vault for all of Les's plugins. The
script only adds: it refuses to replace a note, appends to a daily note
or to Welcome and Image credits where they exist, adds pages and sections
to Home Cards' settings without changing the ones there, and enables a
CSS snippet. Modification times come from content.py, relative to the
build date; appended notes keep their own.
"""
import json, os, re, shutil, sys
import random
from datetime import date, datetime, timedelta, time as dtime

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import content as C  # noqa: E402

random.seed(1816)
args = [a for a in sys.argv[1:] if not a.startswith("--") and not re.match(r"^\d{4}-\d{2}-\d{2}$", a)]
VAULT, IMAGES = args
TODAY = date.today()
if "--today" in sys.argv:
    TODAY = date.fromisoformat(sys.argv[sys.argv.index("--today") + 1])
assert os.path.isdir(os.path.join(VAULT, ".obsidian")), f"{VAULT} is not a vault"

notes = {}   # path -> (frontmatter dict, body, mtime datetime)
titles = {}  # basename -> path, for the notes this script adds
existing = {os.path.splitext(f)[0] for _r, _d, fs in os.walk(VAULT) for f in fs if f.endswith(".md")}


def day(offset_days_ago):
    return TODAY - timedelta(days=offset_days_ago)


NOW = datetime.now() if TODAY == date.today() else datetime.combine(TODAY, dtime(23, 0))


def stamp(days_ago, hour=None):
    """A time on the day `days_ago` before today, never later than now."""
    h = hour if hour is not None else random.choice([8, 9, 10, 11, 14, 15, 16, 17, 20, 21])
    t = datetime.combine(day(days_ago), dtime(h, random.randint(0, 59)))
    return min(t, NOW - timedelta(minutes=10 + random.randint(0, 50)))


def add(folder, title, fm, body, mtime):
    path = f"{folder}/{title}.md"
    assert title not in titles, f"duplicate note name {title}"
    titles[title] = path
    notes[path] = (fm, body, mtime)


def link(name):
    return f"[[{name}]]"


def img(slug_):
    f = f"{slug_}.jpg"
    return f"[[{f}]]" if os.path.exists(os.path.join(IMAGES, f)) else None


def created(age, explicit=None):
    if explicit is not None:
        return day(-explicit if explicit < 0 else explicit).isoformat()
    return day(age + random.randint(20, 240)).isoformat()


S = C.slug
FIELD = {"Writer": "Literature", "Scientist": "Science", "Engineer": "Science", "Artist": "Art"}

# --------------------------------------------------------------- people
for (name, _w, field, born, died, nat, known, age, body) in C.PEOPLE:
    add("People", name, {
        "type": "Person", "field": FIELD[field], "born": born, "died": died, "nationality": nat,
        "known for": known, "portrait": img(S(name)),
        "created": created(age),
    }, body, stamp(age))

for (title, _w, author, year, genres, status, rating, age, cr, body) in C.BOOKS:
    add("Reading", title, {
        "type": "Book", "author": link(author), "year": year, "status": status, "rating": rating,
        "cover": img(S(title) + "-cover"), "tags": [f"book/{g}" for g in genres], "created": created(age, cr),
    }, body, stamp(age))

for (name, w, country, kind, visited, age, body) in C.PLACES:
    add("Places", name, {
        "type": "Place", "country": country, "kind": kind, "visited": visited,
        "cover": img(S(name) + "-view") if w else None, "tags": [f"place/{country.lower()}"], "created": created(age),
    }, body, stamp(age))

for (title, _w, artist, year, museum, movement, seen, rating, age, body) in C.ARTWORKS:
    add("Gallery", title, {
        "type": "Artwork", "artist": link(artist), "year": year, "museum": museum, "seen": seen, "rating": rating,
        "cover": img(S(title) + "-art"), "tags": [f"art/{movement}"], "created": created(age),
    }, body, stamp(age))

for (title, w, status, area, due, progress, people, age, cr, body) in C.PROJECTS:
    add("Projects", title, {
        "type": "Project", "status": status, "area": area,
        "due": (TODAY + timedelta(days=due)).isoformat() if due is not None else None,
        "progress": progress, "people": [link(p) for p in people] or None,
        "banner": img(S(title) + "-banner") if w else None, "created": created(age, cr),
    }, body, stamp(age))

for (title, age, body) in C.TOPICS:
    add("Research", title, {"type": "Topic", "tags": ["hub"], "created": created(age)}, body, stamp(age))

for (title, _w, status, year, topic, summary, age, body) in C.SOURCES:
    add("Research", title, {
        "type": "Source", "status": status, "year": year, "topic": link(topic), "summary": summary,
        "created": created(age),
    }, body, stamp(age))

for (title, age, body) in C.NOTES:
    add("Research", title, {"type": "Note", "created": created(age, -age if age < 10 else None)}, body, stamp(age))

for (title, ago, people, project, body) in C.MEETINGS:
    when = day(ago)
    edited = max(ago, 0)
    add("Meetings", title, {
        "type": "Meeting", "date": when.isoformat(), "attendees": people, "project": link(project),
        "created": day(max(ago, 5) if ago < 0 else ago).isoformat(),
    }, body, stamp(edited))

for (folder, title, years, offset, body) in C.ON_THIS_DAY:
    when = TODAY + timedelta(days=offset)
    when = when.replace(year=when.year - years)
    ago = (TODAY - when).days
    fm = {"type": {"Meetings": "Meeting", "Ideas": "Idea", "Journal": "Journal"}[folder], "created": when.isoformat()}
    if folder == "Meetings":
        fm.update(date=when.isoformat(), project=link("Gothic reading circle"))
    add(folder, title, fm, body, stamp(ago))

for (title, age, body) in C.IDEAS:
    add("Ideas", title, {"type": "Idea", "created": created(age)}, body, stamp(age))

for (ago, body) in C.JOURNAL:
    d = day(ago)
    add("Journal", d.isoformat(), {"type": "Journal", "created": d.isoformat()}, body, stamp(ago, 21 if ago else 9))

# ------------------------------------------------- links and conflicts
for path, (fm, _b, _m) in notes.items():
    if fm.get("known for"):
        fm["known for"] = [link(k) if k in titles else k for k in fm["known for"]]
    if fm.get("artist") and fm["artist"][2:-2] not in titles:
        fm["artist"] = fm["artist"][2:-2]

missing = {}
for path, (fm, body, _m) in notes.items():
    for target in re.findall(r"\[\[([^\]|#]+)", body + json.dumps(fm, ensure_ascii=False)):
        if not target.endswith(".jpg") and target not in titles and target not in existing:
            missing.setdefault(target, []).append(path)
assert not missing, f"unresolved links: {missing}"

# A daily note that already exists gets the entry appended; any other clash stops the run.
appends = {p: v for p, v in notes.items() if p.startswith("Journal/") and os.path.exists(os.path.join(VAULT, p))}
clash = [p for p in notes if p not in appends and os.path.splitext(os.path.basename(p))[0] in existing]
assert not clash, f"notes already in the vault: {clash}"

# ----------------------------------------------------------------- write
def yaml_value(v):
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    s = str(v)
    if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        return s
    plain = (re.match(r"^[A-Za-z\u00C0-\u024F][^:#\[\]{}\"]*$", s) and not s.endswith(" ")
             and s.lower() not in ("true", "false", "yes", "no", "null", "on", "off"))
    return s if plain else json.dumps(s, ensure_ascii=False)


def frontmatter(fm):
    out = ["---"]
    for k, v in fm.items():
        if v is None or v == []:
            continue
        if isinstance(v, list):
            out.append(f"{k}:")
            out += [f"  - {yaml_value(x)}" for x in v]
        else:
            out.append(f"{k}: {yaml_value(v)}")
    out.append("---")
    return "\n".join(out)


def append_keeping_mtime(path, text):
    st = os.stat(path)
    with open(path, "a") as f:
        f.write(text)
    os.utime(path, (st.st_atime, st.st_mtime))


for path, (fm, body, mtime) in notes.items():
    full = os.path.join(VAULT, path)
    if path in appends:
        append_keeping_mtime(full, "\n" + body.strip() + "\n")
        continue
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "x") as f:
        f.write(frontmatter(fm) + "\n" + body.strip() + "\n")
    ts = mtime.timestamp()
    os.utime(full, (ts, ts))

used = sorted({fm[k][2:-6] for fm, _b, _m in notes.values() for k in ("portrait", "cover", "banner") if fm.get(k)})
att = os.path.join(VAULT, "Attachments")
for key in used:
    if not os.path.exists(os.path.join(att, key + ".jpg")):
        shutil.copy2(os.path.join(IMAGES, key + ".jpg"), att)

# ------------------------------------------------- welcome and credits
SHELF = """## The nineteenth-century shelf
The same reader keeps a second interest: nineteenth-century books, science and art, with a reading circle, a newsletter, talks and two trips. Facts come from Wikipedia; the summaries were written for this vault.
- **People:** 28 writers, scientists and artists with portraits, from [[Mary Shelley]] to [[Marie Curie]].
- **Reading:** 25 more books with first-edition covers, beside the Tolkien shelf.
- **Places and Gallery:** 15 places, from [[London]] to [[Mount Fuji]], and 14 paintings with whether the reader has seen them.
- **Projects:** 13 more projects with status, area, due dates and banners, among them [[Gothic reading circle]] and [[Trip - Amsterdam and Delft]].
- **Research:** five hubs, such as [[History of computing]] and [[Gothic fiction]], with sources, notes and stubs.
- **Meetings, Journal and Ideas:** more dated notes, including some edited in this week of earlier years.
- [[Gallery.base]]: the paintings in a Bases view.

The Home Cards pages People and Gallery each carry a CSS class, `portraits` and `gallery-wall`, which the snippet `home-cards-pages.css` uses to give their covers a different shape.

"""
welcome = os.path.join(VAULT, "Welcome.md")
w = open(welcome).read()
if "## The nineteenth-century shelf" not in w:
    st = os.stat(welcome)
    w = w.replace("## Plugins under test", SHELF + "## Plugins under test", 1) if "## Plugins under test" in w else w + "\n" + SHELF
    open(welcome, "w").write(w)
    os.utime(welcome, (st.st_atime, st.st_mtime))

credits = json.load(open(os.path.join(IMAGES, "credits.json")))
by_image = {}
for path, (fm, _b, _m) in notes.items():
    for k in ("portrait", "cover", "banner"):
        if fm.get(k):
            by_image[fm[k][2:-6]] = os.path.splitext(os.path.basename(path))[0]
rows = []
for key in used:
    c = credits[key]
    artist = re.sub(r"<[^>]+>", "", c.get("artist") or "").strip() or "unknown"
    lic = "Public domain" if c["licence"].startswith(("public", "pd")) else c["licence"].upper()
    rows.append(f"- `{key}.jpg`, used for {by_image[key]}: {c['file'].replace('_', ' ').rsplit('.', 1)[0]}. Artist: {artist}. {lic}. [Source]({c['page']})")
cred = os.path.join(att, "Image credits.md")
if os.path.exists(cred) and "## The nineteenth-century shelf" not in open(cred).read():
    append_keeping_mtime(cred, "\n## The nineteenth-century shelf\nEach is the lead image of an English Wikipedia article, marked public domain or CC0 on Wikimedia Commons.\n\n" + "\n".join(rows) + "\n")

# --------------------------------------------------------------- bases
base = os.path.join(VAULT, "Gallery.base")
if not os.path.exists(base):
    open(base, "w").write("""filters:
  and:
    - file.inFolder("Gallery")
views:
  - type: home-cards
    name: Paintings as cards
  - type: table
    name: Paintings
    order:
      - file.name
      - artist
      - year
      - museum
      - seen
      - rating
""")

# ------------------------------------------------------------- snippet
obs = os.path.join(VAULT, ".obsidian")
os.makedirs(os.path.join(obs, "snippets"), exist_ok=True)
open(os.path.join(obs, "snippets", "home-cards-pages.css"), "w").write("""/* Home Cards: shapes for two pages, by the CSS class each page carries.
   Set a page's class in its editor under Advanced → CSS class. */

/* People: portrait covers in narrower cards. */
.home-cards.portraits {
  --hc-card-min: 190px;
  --hc-cover-ratio: 3 / 4;
}

/* Gallery: the classic 4:3 shape of a painting. */
.home-cards.gallery-wall {
  --hc-cover-ratio: 4 / 3;
}
""")
ap = os.path.join(obs, "appearance.json")
appearance = json.load(open(ap)) if os.path.exists(ap) else {}
snips = appearance.setdefault("enabledCssSnippets", [])
if "home-cards-pages" not in snips:
    snips.append("home-cards-pages")
json.dump(appearance, open(ap, "w"), indent=2)

# ------------------------------------------------------ Home Cards pages
dp = os.path.join(obs, "plugins", "home-cards", "data.json")
data = json.load(open(dp))
_n = [0]


def sec(kind, title="", count=8, image="none", conditions=(), fields=(), strategy="forgotten", **kw):
    _n[0] += 1
    s = {"id": f"c19-{_n[0]}", "title": title, "kind": kind, "count": count, "enabled": True,
         "propertyKey": "", "propertyValue": "", "sortKey": "", "sortDir": "desc", "tag": "", "strategy": strategy,
         "filterTags": [], "filterProps": [], "filterFolders": [],
         "conditions": [{"property": p, "op": o, "value": v} for (p, o, v) in conditions],
         "fields": list(fields), "image": image, "query": "", "note": "", "relation": "", "cssClass": ""}
    s.update(kw)
    return s


def page(pid, name, folder, sections, css):
    return {"id": pid, "name": name, "scope": {"kind": "folder", "folder": folder, "tag": "", "propertyKey": "", "propertyValue": ""},
            "sections": sections, "cssClass": css}


pages = {p["id"]: p for p in data["pages"]}
new_pages = [
    page("page-c19-people", "People", "People", [
        sec("most-linked", "Writers", 8, "cover", [("field", "is", "Literature")], ["born", "died"]),
        sec("most-linked", "Scientists", 8, "cover", [("field", "is", "Science")], ["born", "died"]),
        sec("most-linked", "Artists", 8, "cover", [("field", "is", "Art")], ["born", "died"]),
    ], "portraits"),
    page("page-c19-gallery", "Gallery", "Gallery", [
        sec("recent-modified", "Seen in person", 8, "cover", [("seen", "is", "true")], ["artist", "museum"]),
        sec("recent-modified", "Still to see", 8, "cover", [("seen", "is", "false")], ["artist", "museum"]),
    ], "gallery-wall"),
]
for p in new_pages:
    if p["id"] not in pages:
        data["pages"].append(p)


def ensure_section(page_id, title, section, before=None):
    p = pages.get(page_id)
    if p is None or title in [s["title"] for s in p["sections"]]:
        return
    at = next((i for i, s in enumerate(p["sections"]) if s["title"] == before), len(p["sections"]))
    p["sections"].insert(at, section)


ensure_section("page-projects", "Someday", sec("recent-modified", "Someday", 8, "cover", [("status", "is", "someday")], ["area"]), before="Done")
ensure_section("page-library", "Abandoned", sec("recent-modified", "Abandoned", 4, "thumbnail", [("status", "is", "abandoned")], ["author"]))
json.dump(data, open(dp, "w"), indent=2)

print(f"added {len(notes) - len(appends)} notes, appended to {len(appends)} daily notes, {len(used)} images, built for {TODAY}")
