/**
 * The handshake with another of the author's plugins, as the Vibes
 * standard for integrations between the plugins sets it out.
 *
 * A partner plugin announces its API on `<id>:ready`, sends it again when
 * a plugin triggers `<id>:request`, and says it is gone on `<id>:unload`;
 * some also report `<id>:changed`. Home Cards listens first and asks
 * second, so it connects whichever plugin loads first. Each partner's
 * module (relate.ts, pagewise.ts) names its events and supplies the check
 * that turns what arrives into an API Home Cards can use.
 *
 * A partner can be in one of three states. Absent: not running, or gone.
 * Present: it announced an API at a version Home Cards knows, with every
 * method Home Cards calls. Incompatible: it runs, but what it announced is
 * not that; Home Cards says so where the partner's feature would appear
 * and logs the mismatch once.
 *
 * Pure: it reaches the workspace's events only through the bus it is given.
 */

import type { EventRef } from "obsidian";

/** The event names in one partner's contract. */
export interface PartnerEvents {
  readonly ready: string;
  readonly request: string;
  readonly unload: string;
  readonly changed?: string;
}

/**
 * What Home Cards knows of a partner plugin now. An incompatible partner's
 * `version` is the contract version it announced, when it announced one.
 */
export type PartnerState<Api> =
  | { readonly kind: "absent" }
  | { readonly kind: "present"; readonly api: Api }
  | { readonly kind: "incompatible"; readonly version: unknown };

/** The part of Obsidian's `Events` the handshake uses; the workspace is one. */
export interface EventBus {
  on(name: string, callback: (...data: unknown[]) => unknown): EventRef;
  trigger(name: string, ...data: unknown[]): void;
}

export interface PartnerOptions<Api> {
  /** The partner's name, as the log line shows it. */
  name: string;
  events: PartnerEvents;
  /** The API when the first argument of `ready` is one Home Cards can use, else null. */
  accept: (value: unknown) => Api | null;
  /** Called when the state changes; never for the same API announced again. */
  onState: (state: PartnerState<Api>) => void;
  /** Called when the partner reports `changed` while it is present. */
  onChanged?: () => void;
  /** Releases each listener when Home Cards unloads: the plugin's `registerEvent`. */
  register: (ref: EventRef) => void;
  /** Where the one line about an incompatible partner goes. */
  warn?: (message: string) => void;
}

/** The contract version a partner announced: from its first argument, or the first later one that names one. */
function announcedVersion(args: readonly unknown[]): unknown {
  for (const value of args) {
    if (typeof value === "object" && value !== null && "version" in value) return value.version;
  }
  return undefined;
}

/**
 * Listen for a partner on `bus`, then ask it to announce itself. Returns a
 * function that reads the current state.
 */
export function connectPartner<Api>(bus: EventBus, options: PartnerOptions<Api>): () => PartnerState<Api> {
  const { name, events, accept, onState, onChanged, register, warn } = options;
  let state: PartnerState<Api> = { kind: "absent" };
  let warned = false;

  const set = (next: PartnerState<Api>) => {
    state = next;
    onState(next);
  };

  register(
    bus.on(events.ready, (...args: unknown[]) => {
      const api = accept(args[0]);
      if (api) {
        if (state.kind === "present" && state.api === api) return;
        set({ kind: "present", api });
        return;
      }
      const version = announcedVersion(args);
      if (!warned) {
        warned = true;
        warn?.(`Home Cards: the installed ${name} offers an interface this version of Home Cards does not support (version ${String(version)}).`);
      }
      if (state.kind === "incompatible" && state.version === version) return;
      set({ kind: "incompatible", version });
    })
  );
  register(
    bus.on(events.unload, () => {
      if (state.kind !== "absent") set({ kind: "absent" });
    })
  );
  const changed = events.changed;
  if (changed && onChanged) {
    register(
      bus.on(changed, () => {
        if (state.kind === "present") onChanged();
      })
    );
  }
  bus.trigger(events.request);
  return () => state;
}
