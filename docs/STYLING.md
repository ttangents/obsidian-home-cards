# Styling Home Cards

Home Cards takes its fonts, colors and character from your Obsidian theme, and it should look right without any of what follows. This guide is for people who want to go further with a CSS snippet, for theme authors who want to support Home Cards deliberately, and for users of the Style Settings plugin.

Home Cards supports three things, and promises to keep them working across releases:

- the public tokens: the `--hc-*` custom properties listed below;
- the stable selectors and data attributes listed below;
- the CSS classes you give a page or a section yourself.

Everything else is an implementation detail and may change in any release. That covers properties that start with `--_hc-`, classes and attributes this guide does not list, the nesting of elements, and selectors that count elements, such as `:nth-child`.

## How the cascade works

```text
your Obsidian theme
  → Home Cards' own defaults
  → your choices in Settings → Home Cards
  → your theme, CSS snippets and Style Settings, through the public tokens
```

Home Cards never declares a public token. It reads each one where it uses it and falls back to its own default, so any value you set wins: on `.home-cards`, on `body`, on a page's or section's class, in light or dark mode only. You need no `!important` and no selector more specific than the examples here.

To add a snippet, save a `.css` file in your vault's `.obsidian/snippets` folder and turn it on in **Settings → Appearance → CSS snippets**.

## Public tokens

| Token | What it sets | Home Cards' default |
| --- | --- | --- |
| **Page** | | |
| `--hc-page-width` | The widest the page grows before it centers | `1440px` |
| `--hc-page-padding` | The page's margin at the top and sides | `32px`, `16px` on phones |
| **Rhythm** | | |
| `--hc-section-gap` | Space between sections | `40px` |
| `--hc-grid-gap` | Space between cards | `12px` |
| `--hc-card-min` | The narrowest a card may be; the grid fits as many as it can | Settings → Cards → Minimum card width |
| **Cards** | | |
| `--hc-card-padding` | Space inside a card | `16px` |
| `--hc-card-radius` | Corner radius of cards and other surfaces | the theme's `--radius-m` |
| `--hc-card-background` | Card fill | set by the card surface setting |
| `--hc-card-border` | Card edge color | set by the card surface setting |
| `--hc-card-border-hover` | Card edge color under the pointer | the theme's hover border |
| `--hc-card-shadow` | Card shadow at rest | none, or small for Elevated |
| `--hc-card-shadow-hover` | Card shadow under the pointer | a small shadow |
| `--hc-card-hover-background` | A tint laid over the card under the pointer | a faint tint |
| `--hc-card-lift` | How far a card moves under the pointer, as a `translate` value | `0 -1px` |
| **Text** | | |
| `--hc-section-title-size` | Section name size | the theme's `--h3-size` |
| `--hc-section-title-color` | Section name color | the theme's `--h2-color` |
| `--hc-title-size` | Card title size | `1.0625em` |
| `--hc-title-weight` | Card title weight | the theme's `--font-semibold` |
| `--hc-summary-size` | Size of a card's opening sentence | `0.875em` |
| `--hc-meta-size` | Size of tags and footers | the theme's `--font-ui-smaller` |
| `--hc-meta-color` | Color of tags and footers | between the theme's muted and faint text |
| **Images** | | |
| `--hc-thumb-size` | Thumbnail width and height in the grid | two title lines |
| `--hc-cover-ratio` | Cover shape, as an `aspect-ratio` value | `16 / 9` |
| **Focus** | | |
| `--hc-focus-ring` | The ring around a card with keyboard focus | the theme's `--interactive-accent` |

The two shadow tokens take one or more shadows. To turn a shadow off, use `0 0 transparent`: Home Cards draws the hover tint and the focus ring in the same `box-shadow`, so the value `none` would cancel them too.

Rows keep their own fixed proportions: in the rows layout, `--hc-thumb-size` and `--hc-cover-ratio` have no effect.

## Stable selectors

| Selector | What it is |
| --- | --- |
| `.home-cards` | The root of every Home Cards page, and of the Home cards view in a base |
| `.home-cards.hc-in-bases` | That root inside a base |
| `.hc-greeting` | The page title: the greeting, or the page's name |
| `.hc-section` | A section |
| `.hc-section-head` | A section's heading row |
| `.hc-grid` | The cards of a section, in either layout |
| `.hc-card` | A card, or a row in the rows layout |
| `.hc-title` | A card's title |
| `.hc-dek` | A card's opening sentence |
| `.hc-pill.is-type` | A card's type label |
| `.hc-pill.is-tag` | A tag on a card |
| `.hc-foot` | A card's footer |
| `.hc-cover` | A card's cover image box |
| `.hc-thumb` | A card's thumbnail, or the tile that stands in for a missing one |

## Data attributes

| Attribute | On | Values |
| --- | --- | --- |
| `data-view` | `.home-cards` | `grid`, `rows` |
| `data-surface` | `.home-cards` | `flat`, `elevated`, `frosted` |
| `data-pattern` | `.home-cards` | a pattern's id, or `custom` for your own image; absent on a plain background |
| `data-page` | `.home-cards` | `home`, `page` for a page you made, `note` for a note's page |
| `data-kind` | `.hc-section` | the section's source: `recent-opened`, `recent-created`, `recent-modified`, `property`, `tag`, `most-linked`, `least-linked`, `rediscover`, `pinned`, `continue`, `related`, `relate`, `links-out`, `links-in`, `relationship`, `similar` |

Light and dark mode come from Obsidian itself: `.theme-light .home-cards` and `.theme-dark .home-cards`.

## Classes for a page or a section

A page you made, and any section, can carry up to three CSS classes of your own. Set them under **Advanced → CSS class** in the page's or the section's editor. Home Cards adds a page's classes to its `.home-cards` root and a section's classes to its `.hc-section`.

A class name must be a valid CSS identifier of at most 40 characters. Names that start with `hc-`, `is-`, `mod-` or `theme-` belong to Home Cards and Obsidian, so Home Cards ignores them, and the field says which names it will use as you type. The fields take class names and nothing else: no styles, selectors or markup.

```css
/* A page with the class "reading-room": narrow cards with tall covers. */
.home-cards.reading-room {
  --hc-card-min: 180px;
  --hc-cover-ratio: 2 / 3;
}

/* A section with the class "featured": a stronger edge. */
.hc-section.featured {
  --hc-card-border: var(--interactive-accent);
}
```

## Recipes

Each recipe is a starting point, and they combine.

```css
/* Minimal: no shadows or lift, sharper corners, quieter metadata. */
.home-cards {
  --hc-card-shadow: 0 0 transparent;
  --hc-card-shadow-hover: 0 0 transparent;
  --hc-card-lift: none;
  --hc-card-radius: 3px;
  --hc-meta-color: var(--text-faint);
}

/* Editorial: more air between sections, a wider page, larger section names. */
.home-cards {
  --hc-page-width: 1680px;
  --hc-section-gap: 56px;
  --hc-section-title-size: var(--h2-size);
}

/* Compact: tighter cards and smaller thumbnails. */
.home-cards {
  --hc-card-padding: 12px;
  --hc-grid-gap: 8px;
  --hc-section-gap: 28px;
  --hc-thumb-size: 32px;
}

/* Gallery: narrow cards with portrait covers, in the grid. */
.home-cards[data-view="grid"] {
  --hc-card-min: 200px;
  --hc-cover-ratio: 2 / 3;
}

/* Glass: more of the background through Frosted cards. */
.home-cards[data-surface="frosted"] {
  --hc-card-background: color-mix(in srgb, var(--background-primary) 35%, transparent);
}

/* Accent: section names and focus in the theme's accent. */
.home-cards {
  --hc-section-title-color: var(--text-accent);
  --hc-focus-ring: var(--text-accent);
}

/* Different cards in dark mode only. */
.theme-dark .home-cards {
  --hc-card-background: var(--background-secondary-alt);
}

/* A taller cover on the Pinned section only. */
.hc-section[data-kind="pinned"] {
  --hc-cover-ratio: 4 / 3;
}
```

## For theme authors

Your theme's variables already reach Home Cards: it builds every color, face, size and radius from Obsidian's own variables, such as `--background-secondary`, `--text-muted`, `--h3-size` and `--radius-m`. A theme that sets those well needs nothing more.

To give Home Cards a treatment of its own, set public tokens on `.home-cards`, in either mode or both. Keep to the tokens, selectors and attributes in this guide, and your theme keeps working as Home Cards changes.

- **Keep the states apart.** Hover changes a card's tint, edge, shadow and position; keyboard focus draws a ring. Give `--hc-focus-ring` a color that stands out from the card and its hover.
- **Keep the controls.** Style the cards, sections and type. Hiding or moving the header's buttons, the fold chevrons or the See more buttons takes away functions readers rely on.
- **Check both layouts.** Test the grid and the rows layout, with images and without, on a plain background and on a pattern, in light and dark mode.

## Style Settings

With the [Style Settings](https://github.com/mgmeyers/obsidian-style-settings) plugin installed, **Settings → Style Settings → Home Cards** offers sliders for a few of the public tokens: page width, the space between sections and between cards, corner radius, card padding, a switch that keeps cards still on hover, the sizes of section names, card titles and metadata, thumbnail size, and cover shape. Style Settings sets a token only once you change its control, so untouched controls leave Home Cards and your theme in charge. Home Cards works the same without Style Settings.
