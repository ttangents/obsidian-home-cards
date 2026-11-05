/**
 * Home Cards' own API, version 1: it lends the background patterns, and the
 * images the reader added, to other plugins. Pagewise paints them behind its
 * pages for readers who install both plugins (Pagewise D29). The contract is
 * API.md in Home Cards' Vibes folder; test/contract/home-cards-api.json pins
 * its literals.
 *
 * Home Cards is the provider in the family handshake of the Vibes standard:
 * `home-cards:ready` carries the frozen API once the layout is ready and again
 * on every `home-cards:request`; `home-cards:unload` goes first in `onunload`;
 * `home-cards:changed` says the list of backgrounds changed. After unload the
 * API is inert, and `backgrounds()` returns an empty list.
 *
 * Pure: it reaches the workspace's events only through the bus it is given,
 * and main.ts hands it the patterns and images to lend.
 */

import type { EventRef } from "obsidian";
import type { EventBus } from "./partner";

/** The API version this Home Cards serves. */
export const HOME_CARDS_API_VERSION = 1;

/** The workspace events in Home Cards' contract. */
export const HOME_CARDS_EVENTS = {
  ready: "home-cards:ready",
  request: "home-cards:request",
  unload: "home-cards:unload",
  changed: "home-cards:changed",
} as const;

/** One background as version 1 hands it over. */
export interface ApiBackground {
  id: string;
  label: string;
  /** The image for light themes and for dark themes: a data URL or an `app://` URL. */
  light: string;
  dark: string;
  /** Home Cards' veil for each theme, from 0 to 1: the share of the theme background laid over the image. */
  veil: { light: number; dark: number };
}

/** Version 1 of Home Cards' API. */
export interface HomeCardsApi {
  readonly version: 1;
  /** Every built-in pattern, then every added image, in the background picker's order. */
  backgrounds(): ApiBackground[];
}

/** A built-in pattern as main.ts knows it: its tiles from the bundle and its veils in percent. */
export interface PatternSource {
  id: string;
  label: string;
  tiles: { readonly light: string; readonly dark: string } | undefined;
  veil: { readonly light: number; readonly dark: number } | undefined;
}

/** An image the reader added: the URL Obsidian serves it from, and its fade in percent. */
export interface ImageSource {
  id: string;
  label: string;
  url: string;
  fade: number;
}

/** A percentage as a share from 0 to 1, rounded to three places. */
function share(percent: number): number {
  const clamped = Math.min(100, Math.max(0, percent));
  return Math.round(clamped * 10) / 1000;
}

/**
 * The URL with every character that could end a CSS `url()` value written as
 * a percent escape: quotes, backslashes, parentheses and white space. Obsidian
 * serves `app://` URLs decoded, so the escaped URL loads the same file, and a
 * vault named "Notes (work)" still passes a consumer's check.
 */
export function cssSafeUrl(url: string): string {
  return url.replace(/[\s"'()\\]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`);
}

/**
 * The list `backgrounds()` returns: each pattern with both tiles and both
 * veils, then each added image, which serves both themes and is veiled by its
 * own fade. A pattern missing a tile or a veil is left out.
 */
export function listBackgrounds(patterns: readonly PatternSource[], images: readonly ImageSource[]): ApiBackground[] {
  const list: ApiBackground[] = [];
  for (const { id, label, tiles, veil } of patterns) {
    if (!tiles || !veil) continue;
    list.push({ id, label, light: tiles.light, dark: tiles.dark, veil: { light: share(veil.light), dark: share(veil.dark) } });
  }
  for (const { id, label, url, fade } of images) {
    const safe = cssSafeUrl(url);
    const veil = share(fade);
    list.push({ id, label, light: safe, dark: safe, veil: { light: veil, dark: veil } });
  }
  return list;
}

type Warn = (message: string, detail?: unknown) => void;

/**
 * Announces Home Cards' API and keeps it inert after unload. main.ts calls
 * `listen` in `onload`, `ready` once the layout is ready, `changed` when the
 * added images change, and `unload` first in `onunload`.
 */
export class ApiProvider {
  private live = false;
  private gone = false;
  private warned = false;

  /** The one API object every `ready` carries until Home Cards reloads. */
  readonly api: HomeCardsApi;

  constructor(
    private readonly bus: EventBus,
    list: () => ApiBackground[],
    private readonly warn: Warn = (message, detail) => console.warn(message, detail ?? "")
  ) {
    this.api = Object.freeze({
      version: HOME_CARDS_API_VERSION,
      backgrounds: (): ApiBackground[] => {
        if (this.gone) return [];
        try {
          return list();
        } catch (error) {
          if (!this.warned) {
            this.warned = true;
            this.warn("Home Cards: could not list its backgrounds for another plugin.", error);
          }
          return [];
        }
      },
    });
  }

  /** Answer requests; the caller passes its `registerEvent`. */
  listen(register: (ref: EventRef) => void): void {
    register(
      this.bus.on(HOME_CARDS_EVENTS.request, () => {
        if (this.live) this.announce();
      })
    );
  }

  /** The API is usable: announce it now, and on every request from here on. */
  ready(): void {
    if (this.gone || this.live) return;
    this.live = true;
    this.announce();
  }

  /** The list of backgrounds changed. */
  changed(): void {
    if (this.live) this.bus.trigger(HOME_CARDS_EVENTS.changed);
  }

  /** Home Cards is unloading: say so, and make the API inert. */
  unload(): void {
    if (this.gone) return;
    this.gone = true;
    this.live = false;
    this.bus.trigger(HOME_CARDS_EVENTS.unload);
  }

  private announce(): void {
    this.bus.trigger(HOME_CARDS_EVENTS.ready, this.api);
  }
}

/** A key that changes whenever an added image's place in `backgrounds()` changes. */
export function imagesKey(images: readonly { id: string; label: string; file: string; fade: number }[]): string {
  return JSON.stringify(images.map(({ id, label, file, fade }) => [id, label, file, fade]));
}
