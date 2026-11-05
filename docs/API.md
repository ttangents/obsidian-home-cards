# Home Cards for plugin developers

Home Cards shares its background patterns with other plugins. If your plugin draws a page, a panel or a canvas, it can offer readers the same thirteen patterns they know from Home Cards, plus any pictures they added there. Pagewise uses this to paint the space around its pages.

You need Home Cards 1.36.0 or later. Your plugin never imports Home Cards, so it keeps working when Home Cards is missing or turned off. In that case your backgrounds menu is empty.

## How the two plugins find each other

Home Cards talks through four workspace events:

| Event | Who sends it | What it carries |
|---|---|---|
| `home-cards:ready` | Home Cards, once Obsidian's layout is ready, and again whenever asked | The API object for version 1 |
| `home-cards:request` | Your plugin, to ask Home Cards to send `home-cards:ready` again | Nothing |
| `home-cards:unload` | Home Cards, first thing when it unloads | Nothing |
| `home-cards:changed` | Home Cards, when the reader adds, removes or renames a picture, or changes its fade | Nothing |

Listen first, then ask. That way the two plugins connect whichever one loads first.

## Connect in a few lines

```ts
import { Events, Plugin } from "obsidian";

interface HomeCardsBackground {
  id: string;
  label: string;
  light: string;
  dark: string;
  veil: { light: number; dark: number };
}

interface HomeCardsApi {
  version: number;
  backgrounds(): HomeCardsBackground[];
}

export default class MyPlugin extends Plugin {
  private homeCards: HomeCardsApi | null = null;
  private backgrounds: HomeCardsBackground[] = [];

  onload(): void {
    // Obsidian's Workspace type lists only its own events, so talk to it as plain Events.
    const bus: Events = this.app.workspace;
    this.registerEvent(bus.on("home-cards:ready", (api: unknown) => this.attach(api)));
    this.registerEvent(bus.on("home-cards:unload", () => this.detach()));
    this.registerEvent(bus.on("home-cards:changed", () => this.reload()));
    bus.trigger("home-cards:request");
  }

  private attach(api: unknown): void {
    if (api === this.homeCards) return; // Same object as before: nothing to do.
    const candidate = api as Partial<HomeCardsApi> | null;
    if (candidate?.version !== 1 || typeof candidate.backgrounds !== "function") {
      // Home Cards is installed, but with a version this plugin doesn't know.
      // Say so once where your backgrounds would appear.
      this.detach();
      return;
    }
    this.homeCards = candidate as HomeCardsApi;
    this.reload();
  }

  private detach(): void {
    this.homeCards = null;
    this.backgrounds = [];
    // Repaint without a pattern here.
  }

  private reload(): void {
    try {
      this.backgrounds = this.homeCards?.backgrounds() ?? [];
    } catch {
      this.backgrounds = [];
    }
    // Repaint, and refresh any menu that lists the backgrounds.
  }
}
```

## What `backgrounds()` gives you

`backgrounds()` returns a fresh list each time you call it. The thirteen built-in patterns come first, then every picture the reader added, in the same order as Home Cards' own picker. Plain isn't in the list, because plain is just no background at all.

Each entry looks like this:

| Field | What it holds |
|---|---|
| `id` | The pattern's id, such as `diamonds` or `leaves`, or a picture's id, which starts with `custom-`. Store this to remember the reader's choice. |
| `label` | The name Home Cards shows in its picker, such as "Diamonds" |
| `light`, `dark` | The image for light themes and for dark themes. Patterns come as `data:image/webp` URLs. Pictures come as `app://` URLs, the same for both themes. |
| `veil.light`, `veil.dark` | How much of the theme's background Home Cards lays over the image, from 0 to 1, so the pattern stays gentle behind the content |

The URLs are safe to drop straight into CSS. Home Cards escapes quotes, parentheses, backslashes and spaces in them, so a vault named "Notes (work)" works fine.

## Paint a background

Home Cards draws each pattern tile 400 CSS pixels wide, under a veil of the theme's background color. You can do the same with four custom properties and a little CSS, and the stylesheet then follows light and dark themes by itself:

```ts
function paint(el: HTMLElement, bg: HomeCardsBackground | null): void {
  el.toggleClass("my-plugin-patterned", bg !== null);
  if (!bg) return;
  el.setCssProps({
    "--my-tile-light": `url("${bg.light}")`,
    "--my-tile-dark": `url("${bg.dark}")`,
    "--my-veil-light": `${Math.round(bg.veil.light * 100)}%`,
    "--my-veil-dark": `${Math.round(bg.veil.dark * 100)}%`,
  });
}
```

```css
.my-plugin-patterned {
  --my-tile: var(--my-tile-light);
  --my-veil: var(--my-veil-light);
  --my-veil-color: color-mix(in srgb, var(--background-primary) var(--my-veil), transparent);
  background-image: linear-gradient(var(--my-veil-color), var(--my-veil-color)), var(--my-tile);
  background-size: auto, 400px auto;
}
.theme-dark .my-plugin-patterned {
  --my-tile: var(--my-tile-dark);
  --my-veil: var(--my-veil-dark);
}
```

Want the pattern quieter than Home Cards draws it? Raise the veil. Pagewise draws patterns at 60% of Home Cards' strength, because people read a page for longer than they glance at a card.

## Home Cards' promises

For version 1:

1. Home Cards freezes the API object, and every `home-cards:ready` carries the same object until Home Cards reloads. If you already hold it, you can skip setting up again.
2. `backgrounds()` never throws. If listing fails, it logs one warning and returns an empty list.
3. After `home-cards:unload`, the object you hold returns an empty list, and Home Cards sends no more events from it.
4. Version 1 only grows, by optional additions. A change that could break you would arrive as version 2, next to version 1.

## Try it out

- Turn Home Cards off and on in Settings → Community plugins. Your patterns should leave and come back, and the reader's choice should return with them.
- Add a picture in Settings → Home Cards → Your backgrounds, and watch for `home-cards:changed`.
- Switch your theme between light and dark, and check that the tile switches too.

Plugins using this today: [Pagewise](https://github.com/ttangents/obsidian-pagewise). Questions or ideas? [Open an issue](https://github.com/ttangents/obsidian-home-cards/issues).
