"""Build the Home Cards demo vault.

Usage:
  python3 -I demo/images.py IMAGES_DIR
  python3 -I demo/build.py OUT_DIR IMAGES_DIR PLUGIN_DIR [--today YYYY-MM-DD]

OUT_DIR is created (it must not exist). IMAGES_DIR holds the output of
images.py. PLUGIN_DIR holds main.js, manifest.json and styles.css, usually
the repository root. Every note's modification time is set from content.py,
relative to the build date, and listed in mtimes.tsv beside OUT_DIR for
copies that drop modification times.
"""
import json, os, random, shutil, sys
from datetime import date, datetime, timedelta, timezone, time as dtime

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import content as C  # noqa: E402

random.seed(1816)
args = [a for a in sys.argv[1:] if not a.startswith("--")]
OUT, IMAGES, PLUGIN = args
TODAY = date.today()
if "--today" in sys.argv:
    TODAY = date.fromisoformat(sys.argv[sys.argv.index("--today") + 1])

notes = {}   # path -> (frontmatter dict, body, mtime datetime)
titles = {}  # basename -> path


def day(offset_days_ago):
    return TODAY - timedelta(days=offset_days_ago)


NOW = datetime.now() if TODAY == date.today() else datetime.combine(TODAY, dtime(23, 0))


def stamp(days_ago, hour=None):
    """A time on the day `days_ago` before today, never later than now."""
    h = hour if hour is not None else random.choice([8, 9, 10, 11, 14, 15, 16, 17, 20, 21])
    t = datetime.combine(day(days_ago), dtime(h, random.randint(0, 59)))
    return min(t, NOW - timedelta(minutes=10 + random.randint(0, 50)))


def add(folder, title, fm, body, mtime):
    path = f"{folder}/{title}.md" if folder else f"{title}.md"
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
    add("Library", title, {
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

# ------------------------------------------------------------- welcome
WELCOME = f"""This vault shows what [Home Cards](https://github.com/ttangents/obsidian-home-cards) does with a vault that has some years in it. It belongs to an imaginary reader who keeps notes on nineteenth-century books, science and art, and runs a few projects alongside: essays, talks, a reading circle and two trips.

## Try this
1. Open three or four notes, then go back to the Home page. **Continue working** and **Related notes** fill in from what you opened.
2. Switch between **Grid** and **Rows** in the page header.
3. Open the pages in the page menu: Projects, Library, People, Places, Gallery and Research. Each is a set of sections over one part of the vault.
4. On the **Projects** page, drag a card from Active to Done. Home Cards writes `status: done` into the note.
5. Right-click a card to pin it, snooze it or keep it out of Rediscover.
6. Open [[Library.base]]: the same notes in a Bases view, as cards and as a table.
7. Open Settings → Home Cards to change the sections, the card surface and the background.

## What is here
- **Library:** 25 novels and books with first-edition covers, a reading status and ratings.
- **People:** 28 writers, scientists and artists with portraits.
- **Places and Gallery:** 15 places and 14 paintings.
- **Projects:** 13 projects with status, area, due dates, progress and banners.
- **Research:** five hub notes, sources, research notes and a few unfinished stubs.
- **Meetings, Journal and Ideas:** dated notes for the sections that work with time.

The **People** and **Gallery** pages each carry a CSS class (`portraits` and `gallery-wall`) that the snippet `home-cards-demo.css` uses to give their covers a different shape. See [STYLING.md](https://github.com/ttangents/obsidian-home-cards/blob/main/docs/STYLING.md).

Every summary in this vault was written for it, from facts on Wikipedia. Every image is a public-domain work from Wikimedia Commons; [[Image credits]] lists them. Due dates and "this week" sections are relative to {TODAY.isoformat()}, the day the vault was built.
"""
add("", "Welcome", {"type": "Note", "created": day(30).isoformat()}, WELCOME, stamp(30, 8))

credits = json.load(open(os.path.join(IMAGES, "credits.json")))
lines = ["Every image in this vault is a lead image of an English Wikipedia article, hosted on Wikimedia Commons and marked public domain or CC0 there. Each was resized for this vault.", ""]
lines += ["| Image | Wikipedia article | Licence on Commons |", "| --- | --- | --- |"]
used = set()
for (fm, _b, _m) in notes.values():
    for k in ("portrait", "cover", "banner"):
        v = fm.get(k)
        if v:
            used.add(v[2:-2][:-4])
for key in sorted(used):
    c = credits[key]
    lines.append(f"| `{key}.jpg` | [{c['title']}](https://en.wikipedia.org/wiki/{c['title'].replace(' ', '_')}) | [{c['licence']}]({c['page']}) |")
add("", "Image credits", {"type": "Note", "created": day(30).isoformat()}, "\n".join(lines), stamp(30, 8))

# ----------------------------------------------------------- link check
for path, (fm, _b, _m) in notes.items():
    if fm.get("known for"):
        fm["known for"] = [link(k) if k in titles else k for k in fm["known for"]]
    if fm.get("artist") and fm["artist"][2:-2] not in titles:
        fm["artist"] = fm["artist"][2:-2]
import re  # noqa: E402
missing = {}
for path, (fm, body, _m) in notes.items():
    text = body + json.dumps(fm, ensure_ascii=False)
    for target in re.findall(r"\[\[([^\]|#]+)", text):
        if target.endswith((".jpg", ".base")):
            continue
        if target not in titles:
            missing.setdefault(target, []).append(path)

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


os.makedirs(OUT)
stamps = []
for path, (fm, body, mtime) in notes.items():
    full = os.path.join(OUT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w") as f:
        f.write(frontmatter(fm) + "\n" + body.strip() + "\n")
    ts = mtime.timestamp()
    os.utime(full, (ts, ts))
    stamps.append(f"{path}\t{datetime.fromtimestamp(ts, timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}")

att = os.path.join(OUT, "Attachments")
os.makedirs(att)
for key in sorted(used):
    shutil.copy2(os.path.join(IMAGES, key + ".jpg"), att)

# Bases
open(os.path.join(OUT, "Library.base"), "w").write("""filters:
  and:
    - file.inFolder("Library")
views:
  - type: home-cards
    name: Library as cards
    groupBy:
      property: status
      direction: ASC
  - type: table
    name: Library table
    order:
      - file.name
      - author
      - year
      - status
      - rating
""")
open(os.path.join(OUT, "Gallery.base"), "w").write("""filters:
  and:
    - file.inFolder("Gallery")
views:
  - type: home-cards
    name: By movement
    order:
      - artist
      - year
      - museum
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

# ------------------------------------------------------------ settings
obs = os.path.join(OUT, ".obsidian")
os.makedirs(os.path.join(obs, "snippets"))
json.dump({"alwaysUpdateLinks": True, "attachmentFolderPath": "Attachments"}, open(os.path.join(obs, "app.json"), "w"), indent=2)
json.dump({"enabledCssSnippets": ["home-cards-demo"]}, open(os.path.join(obs, "appearance.json"), "w"), indent=2)
json.dump(["home-cards"], open(os.path.join(obs, "community-plugins.json"), "w"), indent=2)
json.dump({k: True for k in ["file-explorer", "global-search", "switcher", "graph", "backlink", "outgoing-link", "tag-pane",
                             "page-preview", "properties", "bases", "command-palette", "outline", "bookmarks", "daily-notes",
                             "templates", "file-recovery", "word-count"]},
          open(os.path.join(obs, "core-plugins.json"), "w"), indent=2)
json.dump({"folder": "Journal", "format": "YYYY-MM-DD"}, open(os.path.join(obs, "daily-notes.json"), "w"), indent=2)
open(os.path.join(obs, "snippets", "home-cards-demo.css"), "w").write("""/* Home Cards demo: shapes for two pages, by the CSS class each page carries.
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

plugdir = os.path.join(obs, "plugins", "home-cards")
os.makedirs(plugdir)
for f in ("main.js", "manifest.json", "styles.css"):
    shutil.copy2(os.path.join(PLUGIN, f), plugdir)
version = json.load(open(os.path.join(PLUGIN, "manifest.json")))["version"]
_n = [0]


def sec(kind, title="", count=8, image="none", conditions=(), fields=(), strategy="forgotten", css="", **kw):
    _n[0] += 1
    s = {"id": kw.pop("id", f"demo{_n[0]}"), "title": title, "kind": kind, "count": count, "enabled": True,
         "propertyKey": "", "propertyValue": "", "sortKey": "", "sortDir": "desc", "tag": "", "strategy": strategy,
         "filterTags": [], "filterProps": [], "filterFolders": [],
         "conditions": [{"property": p, "op": o, "value": v} for (p, o, v) in conditions],
         "fields": list(fields), "image": image, "query": "", "note": "", "relation": "", "cssClass": css}
    s.update(kw)
    return s


def page(pid, name, scope, sections, css=""):
    sc = {"kind": "all", "folder": "", "tag": "", "propertyKey": "", "propertyValue": ""}
    sc.update(scope)
    return {"id": pid, "name": name, "scope": sc, "sections": sections, "cssClass": css}


open_ = ("status", "is-not", "done")
home = [
    sec("pinned", count=4, id="pinned"),
    sec("continue", count=6, id="continue"),
    sec("recent-modified", "Due this week", 6, "thumbnail", [("due", "next-days", "7"), open_], ["status", "due"], id="due"),
    sec("recent-modified", "Overdue", 6, "thumbnail", [("due", "before-today", ""), open_], ["status", "due"], id="overdue"),
    sec("property", "Reading now", 4, "cover", [("status", "is", "reading")], ["author", "year"], propertyKey="type", propertyValue="Book", id="reading"),
    sec("related", count=6, id="related"),
    sec("recent-modified", "Captured this week", 6, "none", [("created", "last-days", "7"), ("type", "is-not", "Journal")], ["type", "created"], id="captured"),
    sec("rediscover", count=3, strategy="gems", id="gems"),
    sec("rediscover", count=3, strategy="on-this-day", id="onthisday"),
]
pages = [
    page("page-projects", "Projects", {"kind": "property", "propertyKey": "type", "propertyValue": "Project"}, [
        sec("recent-modified", "Active", 8, "cover", [("status", "is", "active")], ["area", "due"]),
        sec("recent-modified", "Waiting", 8, "cover", [("status", "is", "waiting")], ["area", "due"]),
        sec("recent-modified", "Someday", 8, "cover", [("status", "is", "someday")], ["area"]),
        sec("recent-modified", "Done", 8, "thumbnail", [("status", "is", "done")], ["area", "due"]),
    ]),
    page("page-library", "Library", {"kind": "folder", "folder": "Library"}, [
        sec("recent-modified", "Reading", 8, "cover", [("status", "is", "reading")], ["author", "year"]),
        sec("recent-modified", "Up next", 8, "cover", [("status", "is", "unread")], ["author", "year"]),
        sec("recent-modified", "Loved", 8, "cover", [("rating", "gte", "5")], ["author", "rating"]),
        sec("recent-modified", "Finished", 12, "thumbnail", [("status", "is", "finished")], ["author", "rating"]),
        sec("recent-modified", "Abandoned", 4, "thumbnail", [("status", "is", "abandoned")], ["author"]),
    ]),
    page("page-people", "People", {"kind": "folder", "folder": "People"}, [
        sec("most-linked", "Writers", 8, "cover", [("field", "is", "Literature")], ["born", "died"]),
        sec("most-linked", "Scientists", 8, "cover", [("field", "is", "Science")], ["born", "died"]),
        sec("most-linked", "Artists", 8, "cover", [("field", "is", "Art")], ["born", "died"]),
    ], css="portraits"),
    page("page-places", "Places", {"kind": "folder", "folder": "Places"}, [
        sec("recent-modified", "Been there", 8, "cover", [("visited", "is", "true")], ["country", "kind"]),
        sec("recent-modified", "On the list", 8, "cover", [("visited", "is", "false")], ["country", "kind"]),
    ]),
    page("page-gallery", "Gallery", {"kind": "folder", "folder": "Gallery"}, [
        sec("recent-modified", "Seen in person", 8, "cover", [("seen", "is", "true")], ["artist", "museum"]),
        sec("recent-modified", "Still to see", 8, "cover", [("seen", "is", "false")], ["artist", "museum"]),
    ], css="gallery-wall"),
    page("page-research", "Research", {"kind": "folder", "folder": "Research"}, [
        sec("rediscover", "", 6, strategy="hubs"),
        sec("most-linked", "Most linked", 6, "none", [], ["type"]),
        sec("property", "Unread sources", 8, "none", [("status", "is", "unread")], ["year", "topic"], propertyKey="type", propertyValue="Source"),
        sec("property", "Sources without a summary", 8, "none", [("summary", "missing", "")], ["year"], propertyKey="type", propertyValue="Source"),
        sec("rediscover", "", 6, strategy="unfinished"),
    ]),
]
data = {
    "version": 2, "sections": home, "pages": pages, "dedupe": True, "rediscoverMonths": 6,
    "greetingEnabled": True, "greetingOccasions": True, "greetingName": "", "showNoteCount": True,
    "openOnStartup": True, "showReleaseNotes": True, "lastShownVersion": version, "defaultView": "grid",
    "cardMinWidth": 262, "cardSurface": "flat", "background": "plain", "accentRubrics": True, "typeProperty": "type",
    "showGlyph": True, "typifyIcons": False, "showRubric": True, "showTags": True, "maxTags": 3, "showDeks": True,
    "dekLines": 3, "showFileSize": False, "imageProperties": "cover, portrait, banner", "summaryProperty": "summary",
    "boilerplateOpeners": "this note, this document, this page", "titlePrefixes": "", "stripTrailingDates": True,
    "customBackgrounds": [], "marks": {"pinned": C.PINNED, "snoozed": {}, "quiet": []},
}
json.dump(data, open(os.path.join(plugdir, "data.json"), "w"), indent=2)

for p in C.PINNED:
    assert p in notes, p
# Some copies and syncs drop modification times; this list restores them:
#   while IFS=$'\t' read -r p t; do touch -d "$t" "$p"; done < ../mtimes.tsv
open(os.path.join(os.path.dirname(OUT.rstrip("/")), "mtimes.tsv"), "w").write("\n".join(stamps) + "\n")
print(f"{len(notes)} notes, {len(used)} images, built for {TODAY}")
if missing:
    print("Unresolved links:")
    for t, where in sorted(missing.items()):
        print(f"  {t}  <- {', '.join(where[:3])}")
