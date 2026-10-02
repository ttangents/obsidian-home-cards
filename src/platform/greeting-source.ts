/**
 * Where the masthead greeting comes from: the built-in list, or, when the
 * user allows it on a Mac, Apple Intelligence through a shortcut.
 *
 * The on-device model takes a second or two, so the plugin writes the
 * next greeting ahead of time and keeps it in this device's local storage
 * (never in data.json, which syncs). Each stored greeting is tied to the
 * date and part of day it was written for, so "Good morning" never
 * appears at night. Each one shows once.
 *
 * When no stored greeting fits, the view shows a list greeting at once and
 * `pick` hands back a promise for the model's line, which the view swaps
 * in if it arrives promptly.
 *
 * Failures stay quiet: the list covers every gap, and after an error the
 * source rests for ten minutes rather than starting a process on every
 * open.
 */

import type { App } from "obsidian";
import { cleanModelGreeting, greetingFor, greetingPrompt } from "../compose/greeting";
import type { HomeCardsSettings } from "../settings/schema";

/** How the source reaches the model; platform/shortcuts.ts in the app. */
export interface ModelRunner {
  supported(): boolean;
  run(shortcut: string, prompt: string): Promise<string>;
}

/** Device-local storage; the App's local storage in the plugin. */
export type LocalStore = Pick<App, "loadLocalStorage" | "saveLocalStorage">;

const STORE_KEY = "home-cards-next-greeting";
const REST_AFTER_ERROR_MS = 10 * 60_000;

interface Stored {
  slot: string;
  text: string;
}

export interface Picked {
  /** A template to show now; pass it through `withName`. */
  text: string;
  /** The model's line for this moment, when it is still being written. */
  later: Promise<string | null> | null;
}

/** Date plus part of day: the window a written greeting stays apt for. */
function slotOf(now: Date, occasions: boolean): string {
  const h = now.getHours();
  const part = h < 5 ? 0 : h < 8 ? 1 : h < 12 ? 2 : h < 14 ? 3 : h < 17 ? 4 : h < 21 ? 5 : 6;
  const date = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  return `${date}/${part}/${occasions ? "o" : "-"}`;
}

export class GreetingSource {
  private refilling: Promise<void> | null = null;
  private restUntil = 0;

  constructor(
    private readonly store: LocalStore,
    private readonly settings: () => HomeCardsSettings,
    private readonly model: ModelRunner
  ) {}

  private aiEnabled(): boolean {
    return this.settings().greetingAI && this.model.supported();
  }

  pick(now: Date): Picked {
    const s = this.settings();
    const text = greetingFor(now, { occasions: s.greetingOccasions });
    if (!this.aiEnabled()) return { text, later: null };

    const slot = slotOf(now, s.greetingOccasions);
    const ready = this.take(slot);
    if (ready) {
      void this.refill(now);
      return { text: ready, later: null };
    }
    const later = this.refill(now).then(() => {
      const fresh = this.take(slot);
      if (fresh) void this.refill(now);
      return fresh;
    });
    return { text, later };
  }

  /** Write a greeting for `now` and store it, unless one is on its way. */
  refill(now: Date): Promise<void> {
    if (!this.aiEnabled() || Date.now() < this.restUntil) return Promise.resolve();
    this.refilling ??= this.ask(now)
      .then((text) => {
        if (text) this.keep({ slot: slotOf(now, this.settings().greetingOccasions), text });
      })
      .catch((err: unknown) => {
        this.restUntil = Date.now() + REST_AFTER_ERROR_MS;
        console.warn("Home Cards: Apple Intelligence greeting unavailable;", err instanceof Error ? err.message : err);
      })
      .finally(() => {
        this.refilling = null;
      });
    return this.refilling;
  }

  /**
   * One run, straight through, for the settings tab's Test button.
   * Resolves with the cleaned greeting, or rejects with the reason.
   */
  async test(now = new Date()): Promise<string> {
    const text = await this.ask(now);
    if (!text) throw new Error("The model replied, but not with a short greeting.");
    this.restUntil = 0;
    return text;
  }

  private async ask(now: Date): Promise<string | null> {
    const s = this.settings();
    const prompt = greetingPrompt(now, { occasions: s.greetingOccasions });
    const reply = await this.model.run(s.greetingShortcut, prompt);
    return cleanModelGreeting(reply);
  }

  private take(slot: string): string | null {
    const stored = this.store.loadLocalStorage(STORE_KEY) as Partial<Stored> | null;
    if (!stored || stored.slot !== slot || typeof stored.text !== "string") return null;
    this.store.saveLocalStorage(STORE_KEY, null);
    return stored.text;
  }

  private keep(value: Stored): void {
    this.store.saveLocalStorage(STORE_KEY, value);
  }
}
