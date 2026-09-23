# Home Cards

A configurable start page for an Obsidian vault. Home Cards opens a view of sections, each a set of note cards drawn from recency, a property, a tag or the link graph. The active theme supplies every color, typeface and spacing value; the plugin adds only the background pattern and card surface a user picks in settings.

## Features

- **Sections.** Recently opened, created or modified; notes by property (with an optional value) or by tag; most and least linked. Each section takes its own card count, sort key and include-filters on tags, properties and folders, in Notebook Navigator's pattern syntax.
- **Cards.** A cleaned headline, the note's type and tags as pills, its opening sentence (or a `summary` property), and a footer with the value the section sorts on.
- **Two layouts.** A reflowing grid and a compact list of rows, switched from the header.
- **A Bases view.** "Home cards" appears as a view type in any base (Obsidian 1.10+), rendering the query's groups as card sections.
- **A contextual greeting.** It follows the local time of day and calendar, with greetings from other languages in Latin script.

## Commands

- **Home Cards: Open** reveals the Home view, opening it in a new tab if needed.
- **Home Cards: Recompose** redraws every open Home and Bases view.

## Architecture

The source divides into four layers. Each imports only from the layers above it; the views and settings tab also hold a type-only reference to the plugin class.

| Layer | Directory | Responsibility |
| --- | --- | --- |
| Settings | `src/settings/` | The schema, defaults and choice registries (`schema.ts`), and the normalizer that turns untrusted `data.json` into valid settings (`normalize.ts`). No imports from Obsidian. |
| Compose | `src/compose/` | Ranking, filtering, text extraction, the card model and the dek cache. Type-only imports from Obsidian; no DOM. |
| Render | `src/render/` | The Home view, the Bases view, and the card DOM they share. |
| Settings tab | `src/settings-tab/` | The settings UI, built from the schema's registries. |

`src/main.ts` wires the layers together and owns persistence. Settings edits go through two methods: `touch()` records an edit and writes once edits stop, for keystrokes and sliders; `commit()` writes at once, for structural changes. Either one redraws every open view after the write.

The test suite enforces the layering: it bundles the tested code with `obsidian` marked external, and the `obsidian` package ships no runtime code, so a runtime import in `settings/` or `compose/` fails to load. A separate test checks each layer's imports.

### Styles

`styles.css` is generated. Edit the partials in `styles/`, which `scripts/build-css.mjs` concatenates in filename order. Background tiles live in `assets/tiles/` as PNGs; the build inlines them as data URLs, because Obsidian loads a plugin's stylesheet with no asset path. The build refuses to write a stylesheet with unbalanced braces or a placeholder that names a missing tile.

To add a background pattern, add `<id>-light.png` and `<id>-dark.png` to `assets/tiles/`, declare the two variables and one selector in `styles/10-backgrounds.css`, and add the entry to `BACKGROUNDS` in `src/settings/schema.ts`. The tests fail if any of the three is missing.

## Development

```sh
npm install
npm run build   # styles.css, type check, main.js
npm test        # type-checks the tests, then runs them
npm run dev     # rebuilds main.js on save
```

Copy `main.js`, `styles.css` and `manifest.json` into `<vault>/.obsidian/plugins/home-cards/`, then reload Obsidian.
