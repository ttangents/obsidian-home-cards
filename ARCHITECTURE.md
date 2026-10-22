# Home Cards architecture

Home Cards answers one question: what in this vault is worth the reader's attention now? It answers it with ordinary notes, their properties, tags, links and folders, and what Home Cards observes of the reader's activity. It invents no object types and stores no copy of the vault.

This document records the rules the code follows, the shape that results, and the work deliberately left undone.

## Rules

**Public API only.** Home Cards calls only what Obsidian's `obsidian.d.ts` declares public. It reads no private members, patches no prototypes, and queries no element that Obsidian or another plugin owns. When Obsidian offers no clean API for a feature, Home Cards goes without the feature.

**Vault data stays canonical.** Notes, properties, tags, links and folders are the source of truth. Home Cards writes to a note only when the reader asks for a change it can name, such as creating a note with a section's facts, setting a property or moving a card. Every write goes through `FileManager.processFrontMatter` or `Vault.create`, and the code never builds YAML text.

**Facts about a note belong in the note; preferences about presenting it belong in Home Cards.** A note's status, due date and cover image are facts. A pin, a snooze or "don't rediscover" is presentation state, so it lives in `data.json` and leaves the note untouched.

**Integrations go through public APIs or shared vault data.** Home Cards reaches another plugin only through an API that plugin documents, or through vault data both understand. Relate is the model: it hands its documented API over public workspace events (`relate:ready`, answered on `relate:request`; `relate:changed`; `relate:unload`), `compose/relate.ts` checks the contract version and every method before use, and each Relate call is guarded so a failure empties one section. Sources and strategies that need Relate carry `needs: "relate"` in their registries; the editor offers them only while Relate runs, and stored settings keep them when it does not. The Typify icon reader predates this rule. It stays because it is opt-in, read-only and fails to nothing, and it sits alone in `src/compose/legacy-typify.ts`, marked as a pattern not to copy.

**Omission beats compromise.** A feature that needs a private API waits until Obsidian offers a public one.

### Enforcement

`eslint.config.mjs` refuses `any`, `@ts-ignore` and its relatives, double casts, and `document` queries. `test/architecture.test.ts` checks four things:

- Lower layers never import from higher ones.
- No source file names a private Obsidian member, such as the view registry, tab headers, a view's title element, other plugins' instances or the internal settings and commands objects.
- Only the legacy module and the backgrounds store read the configuration folder.
- No code contains a YAML front matter string.

## Layers

Each layer imports only from the layers above it, and `settings/` and `compose/` import Obsidian for types only.

| Layer | Directory | Holds |
| --- | --- | --- |
| Settings | `src/settings/` | The schema and registries, the normalizer for untrusted `data.json`, folder path rules, page rules, release notes and the rule for announcing them |
| Compose | `src/compose/` | The domain: selection, ranking, projection, marks, activity, sessions, relationships, templates. Pure functions over a vault snapshot |
| Render | `src/render/` | The page view, the Bases view, card DOM, card actions, pickers, keyboard, the update notice and release notes window |
| Settings tab | `src/settings-tab/` | The settings tab and its editors |
| Wiring | `src/main.ts` | Lifecycle, events, commands, persistence |

Home Cards touches Obsidian in three places, each kept small:

- **Reads.** `compose/vault.ts` holds `VaultSnapshot`, the one view of the vault that ranking sees. It holds the page's notes, metadata lookups, the link graph (built once per compose), image resolution through `getFirstLinkpathDest` and `getResourcePath`, and the activity facts.
- **Writes.** `render/actions.ts` and `render/property-picker.ts` hold note creation, template application and property setting.
- **Events and hosting.** `main.ts` registers the views, commands, file menus, the `obsidian://home-cards` handler and the listeners for vault renames and deletions.

## The four concepts

**Selection** decides which notes belong in a section. A page's scope narrows the vault to a folder, tag or property. A section's source ranks or selects, including the Pinned, Continue working, Related to recent work and Rediscover strategy sources. Its include-filters use Notebook Navigator's idiom. Its typed conditions (`compose/conditions.ts`) test properties and file dates with operators that fit each value type. Marks then remove snoozed notes, and quiet notes in Rediscover. Obsidian publishes no property-type API, so types are read from values.

**Projection** decides how a note appears. The card model (`compose/card.ts`) takes a section's chosen fields (`compose/projection.ts`) and image mode (`compose/images.ts`). Fields read by the kind of value, never by a property's name. Images come from the configured properties, then the note's first embed, and only from the vault; Home Cards never loads a web address.

**Interaction** decides what the reader can do, and each action names its effect:

- **Opening** follows `Keymap.isModEvent`.
- **The card menu** offers Obsidian's file menu plus pin, snooze, "don't rediscover", Move to and Set a property.
- **A complete section** creates notes from its + button and accepts dropped cards (see `sectionWrite` in `compose/templates.ts`). A section is complete when the facts it states as exact values are enough to make a note belong there. A section that states nothing exact, or that selects by activity, age, pins or links, accepts no changes.
- **Keyboard** controls run through the view's own `Scope`.

**Surface** decides where cards appear: the home page, named pages, and the Bases view. A page is a composition of sections over a scope. A whole-vault page with its own sections serves as a second home view. A note's page has no record: `compose/note-page.ts` makes its sections from the note's links, and from Relate's relationships when Relate runs, each time it is drawn. The Bases view shares card rendering but keeps Bases as its query engine, and Home Cards never uses Bases internally.

## State

| What | Where | Why there |
| --- | --- | --- |
| Settings, pages, sections | `data.json` | Configuration; syncs with the vault |
| Pins, snoozes, quiet notes | `data.json` (`marks`) | Presentation state; syncs, follows renames, leaves with deletions |
| Open history (paths) | Local storage, per device | Recently opened beyond Obsidian's last ten |
| Activity (timed opens, visit counts) | Local storage, per device | Obsidian keeps no history of opens. Capped at 30 days or 500 opens, plus visit counts for 2000 notes |
| Folded sections | Local storage, per device | A view preference |
| Newest release seen | `data.json` and local storage | Synced, so one device's dismissal holds on all; local, so a stale synced copy cannot announce a release again. The later of the two wins |
| Added background images | The plugin's own folder | Never the vault |

Sessions, relationships and every ranking are derived on demand from these records and the metadata cache. Home Cards stores nothing it can recompute.

`data.json` carries a `version`. The normalizer reads every earlier shape, so old settings load unchanged and every new source is opt-in.

## Visual system

Home Cards contributes layout and hierarchy; the active theme contributes faces, colors and character. Every value in `styles/` resolves to an Obsidian variable or to one of a few tokens declared at the top of `styles/00-base.css`, so a change to the rhythm or the hierarchy happens in one place.

- **Salience.** From most to least prominent: the page title, section names, card titles, images where a section shows them, summaries, metadata, controls, background. Section names use the theme's heading face at the third heading step, card titles the heading face just above body size and semibold, summaries the body face in muted text, and metadata a mix of muted and faint text that stays readable in light themes.
- **Rhythm.** Sections sit 40px apart, a heading 12px above its cards, cards 12px apart, and a card's own lines 8px apart.
- **Lines and corners.** Three line strengths: the theme's hairline at rest, its hover border, and the accent for keyboard focus. Three radii: surfaces, controls, and small labels and images.
- **Labels.** A card shows at most one shaped label, its type, as a small tinted rectangle. Tags and every other field are plain text.
- **Surfaces.** Flat is the reference: the theme's secondary color, a hairline, no shadow at rest, and a small shadow with a one-pixel lift on hover. Elevated and Frosted vary the material, never the behavior.
- **Modes.** Grid carries card surfaces and images. Rows carry none: hairlines divide them, the section is the container, and hover is a faint band.
- **Background.** Patterns are texture. Their veils keep under half of each tile's ink in light themes and half in dark ones; custom backgrounds keep the fade the reader sets.

## Performance

Each compose builds one snapshot. It reads the note list once, builds the link graph and link totals at most once, and shares them across sections. Card text loads lazily, only for visible cards, through a cache that invalidates on file modification. The activity log writes after opens settle, not on every open. Related-note scoring passes over neighbours with more than 50 links, which bounds its cost on large vaults. No background work runs while the vault is unchanged.

## Deferred

These ideas wait for a public API or for the primitives they need to mature.

- **A composed Today section.** It should combine Continue working, recent captures, neglected notes and Rediscover without repetition. The parts now exist, and it should follow once they have been in use.
- **Emerging hubs.** This needs link-count history, which Home Cards would have to collect and store. That much state is not justified yet.
- **Replacing the empty tab.** Obsidian offers no public mechanism for this.
- **Updating the title in the view's own header.** Obsidian writes it once and offers no public way to change it, so it reads "Home Cards" and the tab shows the page.
- **Bases-native value rendering on Bases cards.** Bases offers `Value.renderTo`, and the Bases view should adopt it when it gains configurable fields.
- **Pin until, reordering pins, section-chosen templates, wider vault search.** These are useful but not yet worth their interface.
- **Inline property controls on cards.** The card menu's Set a property and Move to cover this without adding visible controls.
- **Drag on touch screens.** HTML drag and drop does not reach them. Move to in the card menu covers it.
