# Home Cards

Home Cards gives your vault a start page that shows what is worth your attention now: the work you were in the middle of, what is due, notes related to what you are doing, and notes you have drifted away from. Each section is a set of note cards drawn from ordinary notes, their properties, tags and links, so a reading list, a project board or a people directory needs no special note types. Your theme sets the colors, fonts and spacing.

![Home Cards in grid view, light mode](docs/grid-light.webp)

## Features

- **Sections.** Each section has a source and optional filters and conditions:
  - **Sources:** recently opened, created or modified; notes by property (with an optional value) or by tag; most and least linked; Pinned; Continue working; Related to recent work; and Rediscover.
  - **Filters and conditions:** filters on tags, properties and folders, and typed conditions such as "due is today", "due is before today", "due is in the next 7 days", "rating is at least 4" or "modified is older than 90 days". A note must meet every condition.
- **Continue working.** Shows the notes from your latest work session on this device, the notes you edited during it, then the session before. Opens with no gap longer than 45 minutes form one session. Each card says how it belongs, such as "Opened 43 minutes ago".
- **Related to recent work.** Shows notes linked to what you opened most recently, or sharing links or tags with it. Each card names its strongest connection, such as "Linked from AWS notes" or "3 shared links with Vendor scorecard".
- **Rediscover.** Six strategies, each a plain rule whose card says what chose it:
  - Forgotten notes (untouched for months, in a new order each day)
  - Forgotten gems (untouched but still linked to)
  - Unfinished thoughts (short and barely linked)
  - On this day (created or last edited in this week of an earlier year)
  - Sleeping hubs (many links, long untouched)
  - Old friends (opened often, not lately)
- **Card fields and images.** Each section can show up to three properties in its cards' footers, such as "Active · Leslie · Due Friday" or "David Deutsch · Rating 5 · Reading", and can show a thumbnail or a cover. Images come from the properties named in Settings (`cover, image` by default), or else the note's first embedded image, and only from your vault. A note without an image gets a tile with its initial, so the cards of a section line up, and the rows layout shows every section's images as small squares beside the title.
- **Pins and snooze.** Pin a note to Home from its card's menu, any note menu in Obsidian, or the command palette, and a Pinned section lists your pins. A Pinned section always comes first on its page, wherever it sits in the list, and stays hidden until you pin something. Snooze a card for a week or a month, or tell Rediscover to pass a note over. Home Cards keeps these marks in its own settings and leaves your notes unchanged.
- **Create and move notes.** A section that states exact values offers + in its heading to create a note with them; examples are a property with a value ("type is Book"), a single tag, a single folder path, or a condition such as "status is waiting". Drag a card onto such a section, or choose **Move to** in the card's menu, to give the note those values. A project board then needs only Active, Waiting and Done sections. When the property holds a list, such as the projects a note belongs to, a card dropped from a section that states no value for it keeps its other values and gains the new one, and a card moved between two such sections swaps one value for the other. The section shows the change before you drop, and Home Cards makes it through Obsidian's own frontmatter editing. **Set a property…** in the card menu sets any property.
- **Keyboard.** On a page:
  - <kbd>/</kbd> filters the cards.
  - <kbd>j</kbd> and <kbd>k</kbd> or the arrow keys move between cards.
  - <kbd>Enter</kbd> opens a card; with <kbd>Cmd</kbd> or <kbd>Ctrl</kbd> it opens in a new tab.
  - <kbd>Space</kbd> previews a card.
  - <kbd>p</kbd> pins or unpins a card.
- **One note, one section.** By default, a note appears only in the first section that claims it, so the page does not repeat itself. Section order sets which section wins.
- **Cards.** Each card shows the note's title, its type and tags, its first sentence (or a `summary` property), and a footer. The footer says why the card is there, then shows the section's fields or the value the section sorts on.
- **Header actions.** New note creates a note where Obsidian's settings put new notes. Rediscover opens a random note you haven't changed in months.
- **Card actions.** Right-click a card for Obsidian's file menu and Home Cards' own actions. Hold Cmd or Ctrl over a card for a preview, through the Page Preview core plugin. A middle click opens a new tab.
- **Fold and see more.** Click a section heading to fold it; the chevron at its end shows the state, and the page remembers it. "See more" under a section shows further matches, one section's worth at a time, up to three times; "Show fewer" puts them back.
- **Two layouts.** A grid of cards and a compact list of rows, switched from the header.
- **A page for each note.** Right-click a note and choose **Open Home Cards page**, or run **Open page for current note**, to see what the note links to and what links to it, as cards.
- **Pages.** A page shows the notes of one folder, one tag or one property, or of the whole vault, under the home page's sections or sections of its own. Make one with **Create a page** or in **Settings → Home Cards → Pages**. Each page opens in its own tab, from a command named for it (give it a hotkey in Obsidian's Hotkeys settings), from **Open a page**, or from a link such as `obsidian://home-cards?page=Reading`. A folder needs no setup: right-click it and choose **Open Home Cards page**. A page about a folder follows the folder when you rename or move it. **New note** on a tag or property page starts the note with that tag or property, so it appears on the page.
- **Background patterns.** Thirteen tiled patterns, each with a light and a dark version that follows the theme. Pick one in settings or from the swatch button in the header, which applies it as you click.
- **Your own backgrounds.** Add a PNG, JPEG, WebP or GIF from **Settings → Home Cards → Your backgrounds**, as a repeating pattern or a single picture, with a fade that sets how much of the theme's background covers it. Home Cards keeps a resized copy in its own plugin folder, so your vault gains no files or folders. Up to twelve images.
- **A Bases view.** Any base can show its results as "Home cards", with one section per group. A base takes any filter Bases offers, and it is a file in your vault; a Home Cards page is not.
- **What's new.** After an update, a line at the top of the home page names the new version and opens its release notes. Close it, or read the notes, and it goes away on every device that syncs your settings. **Settings → Home Cards → What's new** shows the notes for recent releases at any time, and **Announce updates** turns the line off.
- **A greeting.** About 180 built-in greetings follow your local time of day, the day of the week and, optionally, fixed-date holidays, some in other languages, always in Latin script.

![Rows view, dark mode](docs/rows-dark.webp)

## Quick start

1. Install and enable Home Cards, then click the grid icon in the ribbon, or run **Home Cards: Open** from the command palette.
2. The first page shows four sections that work in any vault: recently opened, recently created, most linked and least linked.
3. To add a section for your own notes, open **Settings → Home Cards**, press **+** next to **Sections**, and set the source to **By property** or **By tag**.
4. For a page that follows your work, add sections with the sources **Pinned**, **Continue working** and **Related to recent work**, and give a section conditions such as "due is in the next 7 days".
5. If your notes record their kind in a property other than `type`, set **Cards → Type property** to that property.
6. Turn on **Open on startup** to make Home Cards your start page.

## Installation

Search for **Home Cards** under **Settings → Community plugins → Browse**, then install and enable it.

To install a release by hand, copy `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/ttangents/obsidian-home-cards/releases/latest) into `<vault>/.obsidian/plugins/home-cards/`, then reload Obsidian and enable Home Cards.

Home Cards requires Obsidian 1.13.1 or later and works on desktop and mobile.

## Settings

Every setting appears in Obsidian's settings search.

- **General:** whether the home page opens at startup, the layout it opens in, whether a note may appear in more than one section, and how long a note must sit untouched before Rediscover offers it.
- **General** also clears snoozes and passed-over notes, turns update announcements on or off, and opens the release notes.
- **Sections:** the sections, in page order. Drag a row to reorder it, use its toggle to show or hide it, and press its pencil to edit its source, card count, filters, conditions, sort order, card fields and image.
- **Pages:** the pages you made. Each row opens the page or edits its name, what it is about, and whether it has sections of its own. A folder you never customized still opens a page, so it has no row here.
- **Cards:** the corner glyph, the type label and the property it reads, the image properties, tags, the opening sentence and its length, and file size.
- **Card text:** the summary property, and the openings and title prefixes Home Cards passes over.
- **Appearance:** minimum card width, card surface (Flat, Elevated or Frosted) and background pattern.
- **Your backgrounds:** the images you added. Each has a name and a fade; deleting a row deletes its stored copy.
- **Header:** the greeting and your name, holiday greetings, and the note count.

### Styling with CSS

Home Cards has a small, documented styling interface for CSS snippets, themes and the Style Settings plugin: public `--hc-*` tokens for spacing, cards, type and images, a few stable selectors and data attributes, and an optional CSS class on any page or section, under **Advanced** in its editor. [Styling Home Cards](docs/STYLING.md) lists them, with recipes, and explains what stays stable across releases.

### Works with Relate

Home Cards works well with [Relate](https://community.obsidian.md/plugins/relate), my other plugin, which links notes both ways and can search by meaning. Install it from **Settings → Community plugins → Browse**. You don't need it to use Home Cards. If you use both:

- A section can list the results of a Relate search, such as `notes of Q3 Plan this week`, and each card says why it is there, down to the chain of links that connects it.
- A note's page gives each of the note's relationships a section of its own, then lists the links no relationship covers, then the notes closest in meaning.
- **Related to recent work** names the relationship behind each card, such as "Q3 Plan's notes", and adds notes close in meaning to what you opened.
- **Rediscover** gains **Similar but unlinked**: notes close in meaning to the ones you opened most recently, with no link between them, that you have not opened lately.

These options appear only while Relate is running. If you turn Relate off, a section that uses it keeps its settings and says it needs Relate, and the rest of the page works as before.

### Optional: Typify icons

If you use the [Typify](https://community.obsidian.md/plugins/typify) plugin, set **Cards → Glyph** to **Icon from Typify**. Home Cards then reads Typify's icon settings and shows the icon for each note's type. Home Cards only reads Typify's settings file, and only while this option is on. Without Typify, the option falls back to each note's initial letter.

## Commands

- **Home Cards: Open** shows the home page, opening it in a new tab if needed.
- **Home Cards: Recompose** redraws every open home page and Home cards base view.
- **Home Cards: Open page for current folder** opens the page for the folder of the note you are reading. It appears when that note sits in a folder.
- **Home Cards: Open page for a folder** lists every folder and opens the one you choose.
- **Home Cards: Open page for current note** opens a page of what the note you are reading links to and what links to it. **Open Home Cards page** in a note's menu does the same.
- **Home Cards: Open a page** lists the home page and your pages, and opens the one you choose.
- **Home Cards: Create a page** opens the page editor, then the new page.
- **Home Cards: Open [name] page** exists for each page you made, and takes a hotkey.
- **Home Cards: Pin or unpin the current note** pins the note you are reading to Home.
- **Home Cards: Show what's new** opens the release notes.

### Links

`obsidian://home-cards` opens the home page. `obsidian://home-cards?page=Reading` opens the page named Reading, and `obsidian://home-cards?folder=Projects/Clients` opens a folder's page, and `obsidian://home-cards?note=Atlas` opens a note's page. A link that names nothing that exists shows a notice and does nothing else.

## Privacy and access

Home Cards makes no network requests, works with no files outside your vault, sends no data anywhere, shows no ads and needs no account. It reads your notes' metadata and the first paragraph of each note it shows. Card images come only from your vault; Home Cards passes over a property that holds a web address.

On each device, Home Cards keeps four things in Obsidian's local storage, outside your synced settings:

- the paths of the last 100 notes you opened;
- a log of when you opened notes over the last 30 days, at most 500 entries, with a visit count for up to 2,000 notes; Continue working, Related to recent work and Old friends read this log, and the log follows renames and forgets deleted notes;
- which sections you folded;
- the newest release whose notes you have seen, so an older settings file arriving by sync cannot announce it again.

Pins, snoozes and passed-over notes sit in Home Cards' settings file, never in your notes, as does the newest release you have seen announced. The release notes ship inside the plugin; the What's new window loads nothing from the web, and its one link opens the releases page in your browser. Home Cards changes a note only when you ask it to, with + on a section, a drop, **Move to** or **Set a property…**, and it makes the change through Obsidian.

When you add a background image, Home Cards decodes it, scales it down, and saves a copy without its metadata (such as camera and location) in a `backgrounds` folder inside its own plugin folder. It creates that folder with the first image and removes it with the last. Your original file stays where it is, and your vault's notes and attachments stay untouched.

With **Icon from Typify** on, Home Cards also reads the Typify plugin's settings file in your vault's configuration folder.

When the Relate plugin is running, Home Cards asks it for searches, relationships and similar notes through the interface Relate offers to other plugins. Home Cards itself sends nothing anywhere. If you set Relate to use your own embedding server, Relate sends the text of your searches and notes to that server.

## Architecture

[ARCHITECTURE.md](ARCHITECTURE.md) records the rules the code follows (public Obsidian API only, vault data canonical, Home Cards state apart from note facts), the four concepts the features are built from, what is stored where, and what is deliberately deferred.

The source divides into four layers. Each imports only from the layers above it; the views and settings tab also hold a type-only reference to the plugin class.

| Layer | Directory | Responsibility |
| --- | --- | --- |
| Settings | `src/settings/` | The schema, defaults and choice registries (`schema.ts`), the normalizer that turns untrusted `data.json` into valid settings (`normalize.ts`), the folder path rules (`folders.ts`), the rules for named pages (`pages.ts`) and the custom-background rules (`custom-background.ts`). No imports from Obsidian. |
| Compose | `src/compose/` | The domain: selection (filters and typed conditions), ranking, Rediscover strategies, sessions, related-note scoring, the card model and its fields and images, marks, note templates, the activity log, the dek cache and the open history. A compose can be limited to a page's scope: a folder, a tag or a property. Type-only imports from Obsidian; no DOM. |
| Render | `src/render/` | The home page view (which also draws every other page), the Bases view, the card DOM they share, the card actions and note changes, the page and property pickers, keyboard navigation, and the storage of added background images. |
| Settings tab | `src/settings-tab/` | The settings tab, declared through Obsidian's settings definitions, and the editors it opens: sections and their conditions, pages and backgrounds. |

`src/main.ts` wires the layers together and owns persistence. Settings edits go through two methods: `touch()` records an edit and writes once edits stop, for keystrokes and sliders; `commit()` writes at once, for structural changes. After a write, the plugin fires a refresh event; each open view subscribes to it and redraws.

Each compose takes one snapshot of the vault: one file listing and at most one pass over the link table, shared by every section.

The test suite enforces the layering: it bundles the tested code with `obsidian` marked external, and the `obsidian` package ships no runtime code, so a runtime import in `settings/` or `compose/` fails to load. A separate test checks each layer's imports.

### Styles

`styles.css` is generated. Edit the partials in `styles/`, which `scripts/build-css.mjs` concatenates in filename order. Background tiles live in `assets/tiles/` as WebP files, each a seamless repeat 800px wide that the page draws at 400 CSS pixels under a per-tile veil of the theme background (the `--_hc-veil-<id>` variables in `styles/10-backgrounds.css`); the build inlines them as data URLs, because Obsidian loads a plugin's stylesheet with no asset path. The build refuses to write a stylesheet with unbalanced braces or a placeholder that names a missing tile.

To add a background pattern, add `<id>-light.webp` and `<id>-dark.webp` to `assets/tiles/`, declare the two variables and one selector in `styles/10-backgrounds.css`, and add the entry to `BACKGROUNDS` in `src/settings/schema.ts`. The tests fail if any of the three is missing.

Custom properties named `--hc-*` are the public styling contract in [docs/STYLING.md](docs/STYLING.md); Home Cards reads them and never declares them. Its own defaults and plumbing use `--_hc-*`. The tests fail if the styles read a public token the guide does not document, or declare one outside the Style Settings layer in `styles/95-style-settings.css`.

## Development

```sh
npm install
npm run build   # styles.css, type check, Obsidian's lint rules, main.js
npm test        # type-checks the tests, then runs them
npm run dev     # rebuilds main.js on save
```

`npm run lint` applies [Obsidian's review rules](https://github.com/obsidianmd/eslint-plugin), the checks the community directory runs on each release, to every file in the repository. See [RELEASING.md](RELEASING.md) for the release steps.

## License

[MIT](LICENSE)
