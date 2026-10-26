/**
 * Release notes, and the rule for when the home page announces them.
 *
 * After an update, the home page shows a one-line notice that opens these
 * notes; the reader closes it, or reads them, once. A version marker
 * records the newest release the reader has seen. It lives in two places:
 *
 * - data.json, so a reader who syncs settings sees the notice on one
 *   device, not on each;
 * - local storage, so a stale data.json arriving by sync, or a device
 *   still on an older Home Cards that drops the key when it saves, cannot
 *   bring the notice back here.
 *
 * The plugin reads the later of the two. A new install records its version
 * and announces nothing; a downgrade announces nothing and leaves the
 * marker where it is. With announcements turned off, the marker still
 * advances, so turning them on again does not replay every skipped release.
 *
 * Writing a release: the newest entry comes first, and its version must
 * match manifest.json (the tests check). Items are plain sentences: what
 * changed and where to find it, with no claims about how good it is. A
 * release of small fixes sets `announce: false`; its notes still show in
 * the What's new window.
 *
 * Pure: no App, no I/O.
 */

export interface ReleaseNote {
  version: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** One sentence, shown in the home page's notice and atop the release's notes. */
  headline: string;
  /** False for a release that should not announce itself on the home page. */
  announce: boolean;
  new?: readonly string[];
  improved?: readonly string[];
  changed?: readonly string[];
  fixed?: readonly string[];
  /**
   * What a release adds for readers who also use another of the author's
   * plugins. The window introduces that plugin and links to its page, so
   * the notes never assume the reader has it.
   */
  worksWith?: {
    plugin: string;
    /** The plugin's page in Obsidian's community directory. */
    url: string;
    /** What the plugin does, after its name: "which links notes both ways". */
    about: string;
    items: readonly string[];
  };
}

/** The groups a release's items fall into, in the order they show. */
export const RELEASE_GROUPS = [
  { key: "new", label: "New" },
  { key: "improved", label: "Improved" },
  { key: "changed", label: "Changed" },
  { key: "fixed", label: "Fixed" },
] as const satisfies readonly { key: keyof ReleaseNote; label: string }[];

/** Where every release, with its files, lives. */
export const RELEASES_URL = "https://github.com/ttangents/obsidian-home-cards/releases";

/** Releases shown when the reader opens What's new with nothing unseen. */
export const RECENT_RELEASES = 5;

export const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    version: "1.34.2",
    date: "2026-10-26",
    headline: "Fixes for synced settings and for tags, and a much smaller stylesheet.",
    announce: false,
    fixed: [
      "A card dropped on a tag section, or moved there, keeps the note's other tags, including numbers such as 2024 and tags written on one line with commas.",
      "Settings that sync brings from another device stay as they arrive: this device no longer writes its older copy over them after a snooze ends or while a page or section editor is open.",
      "A device still on an older Home Cards opens settings saved by a newer one read-only, with a notice, and leaves them unchanged.",
      "Closing a folder page's settings without changing anything no longer adds the folder to Settings → Pages.",
      "If Relate fails, only the section that asked it is empty; the rest of the page still shows.",
    ],
    improved: [
      "A Home tab in the background waits until you show it before it redraws, so typing in a note stays quick with several Home tabs open.",
    ],
    changed: [
      "The stylesheet shrinks from 1.8 MB to 49 KB. The background patterns now load with the plugin's code, so Obsidian no longer reads them in every window at startup.",
    ],
  },
  {
    version: "1.34.1",
    date: "2026-10-25",
    headline: "Each release's files now carry a GitHub attestation of the source they were built from.",
    announce: false,
    changed: [
      "A GitHub workflow now builds each release from its tagged source and attests main.js, manifest.json and styles.css, so anyone can verify that the files they install came from this repository.",
    ],
  },
  {
    version: "1.34.0",
    date: "2026-10-25",
    headline: "Themes, CSS snippets and Style Settings can now restyle Home Cards through a documented interface.",
    announce: false,
    new: [
      "A page or a section can carry CSS classes of your own, under Advanced in its editor, so a snippet can give it a look of its own.",
      "Styling Home Cards, a guide in the project's docs folder, lists the custom properties, selectors and data attributes that stay stable across releases, with recipes.",
      "With the Style Settings plugin installed, Settings → Style Settings → Home Cards adjusts page width, spacing, corners, type sizes and images.",
    ],
  },
  {
    version: "1.33.1",
    date: "2026-10-22",
    headline: "A note page's title shows it opens the note in the theme's link color.",
    announce: false,
    changed: [
      "Under the pointer, the title of a note's page takes the theme's link hover color in place of an underline, which clears the last warning from Obsidian's automated review.",
    ],
  },
  {
    version: "1.33.0",
    date: "2026-10-22",
    headline: "Every note now has a page of its own, and Home Cards works with Relate, now in Community plugins.",
    announce: true,
    new: [
      "Each note now has a page that shows, as cards, the notes it links to and the notes that link to it. Right-click a note and choose Open Home Cards page, or run Open page for current note. Click the page's title to open the note.",
    ],
    improved: [
      "The page is quieter: patterns recede into texture, cards rest flat and lift slightly under the pointer, a card's type is its only shaped label, and the header groups the filter, the layout switch and the page actions.",
    ],
    fixed: [
      "Dropping a card on a section such as \"project is Q3 Plan\" used to replace all of the note's projects. Now the note keeps its other projects and gains the new one. Moving a card between two such sections still swaps one project for the other.",
    ],
    worksWith: {
      plugin: "Relate",
      url: "https://community.obsidian.md/plugins/relate",
      about: "which links notes both ways and can search by meaning",
      items: [
        "A section can list the results of a Relate search, such as \"notes of Q3 Plan this week\", and each card says why it is there.",
        "A note's page gives each of the note's relationships a section of its own, and lists the notes closest in meaning.",
        "Related to recent work names the relationship behind each card, such as \"Q3 Plan's notes\". Rediscover gains Similar but unlinked.",
      ],
    },
  },
  {
    version: "1.32.2",
    date: "2026-10-21",
    headline: "Republishes 1.32.1 with its plugin files attached.",
    announce: false,
    fixed: [
      "The 1.32.1 release went out without its plugin files, so Obsidian could not install it. This release carries the same code with the files attached.",
    ],
  },
  {
    version: "1.32.1",
    date: "2026-10-21",
    headline: "Pinned sections lead the page and stay hidden until you pin a note.",
    announce: false,
    changed: [
      "A Pinned section always comes first on its page, wherever it sits in the section list, and claims its notes before any other section. It stays hidden while you have no pins.",
    ],
    improved: [
      "Home Cards lays out card headers and image rows with simpler styles, which clear the warnings from Obsidian's automated review. Cards look as they did in 1.32.0.",
    ],
  },
  {
    version: "1.32.0",
    date: "2026-10-20",
    headline:
      "You can pin, snooze and move cards, and sections can show cover images and filter notes by their property values.",
    announce: true,
    new: [
      "Conditions: a section can keep only the notes whose properties pass a test, such as \"due is in the next 7 days\", \"status is active\" or \"rating is at least 4\". Each property offers only the tests that suit its values.",
      "Card fields and images: each section picks the properties its cards show, and whether they show a cover, a thumbnail or no image. Home Cards finds the image in the properties you name in settings, then in the note's first embedded image.",
      "Pins and snoozes: pin a note from its card menu, from any file menu in Obsidian or with the \"Pin or unpin the current note\" command, and a Pinned section keeps it in view. Snooze hides a card for a week or a month.",
      "Continue working: a section that groups the notes you opened lately into work sessions, newest first.",
      "Related to recent work: a section of notes that link to, or share links and tags with, the notes you opened lately.",
      "Rediscover strategies: a Rediscover section can draw forgotten notes, forgotten gems, unfinished thoughts, notes from this week in earlier years, sleeping hubs or old friends. \"Don't rediscover\" in a card's menu keeps a note out.",
      "Create and move: a section that names exact values, such as \"status is active\", has a + button that creates a note with those values. Drag a card onto that section, or choose Move to in the card's menu, to give the note those values.",
      "Keyboard: / goes to the filter box, the arrow keys or j and k move between cards, Enter opens a card, Space previews it and p pins it.",
      "What's new: this notice appears on the home page after an update. Settings → Home Cards turns it off and opens past release notes.",
    ],
    improved: [
      "Home Cards now uses only Obsidian's public API, which makes it less likely to break when Obsidian updates.",
      "Cover images crop from the top, so book titles and faces stay in view.",
      "Cards with thumbnails line up across a row: the pills, summaries and footers start at the same height whatever the length of the titles. In the rows layout, images sit in a column of their own.",
      "Settings from earlier versions load unchanged, and every new section type starts switched off.",
    ],
  },
  {
    version: "1.31.0",
    date: "2026-10-17",
    headline: "Give a folder, a tag or a property its own page, with its own command and its own sections.",
    announce: true,
    new: [
      "Pages: a page has a name and a scope: a folder, a tag, a property or the whole vault. It shows the home page's sections, or sections of its own, in a tab of its own.",
      "Each page gets a command that takes a hotkey. \"Open a page\" lists them all, and obsidian://home-cards?page=Name links open a page from a note, a shortcut or a launcher.",
      "A folder's context menu opens a page for that folder, and the page follows the folder when you rename it.",
      "Backgrounds of your own: add an image as a repeating pattern or as a single picture, and set how far it fades. Home Cards keeps the image in its own folder, outside the vault.",
      "A new note from a tag or property page carries that tag or property.",
    ],
    fixed: [
      "A tab's title now changes when you rename its page.",
      "Opening a page that is already open now switches to its tab.",
    ],
  },
  {
    version: "1.29.1",
    date: "2026-10-15",
    headline: "Removes the Apple Intelligence greeting.",
    announce: false,
    changed: [
      "The Apple Intelligence greeting needed file and shell access, so it is gone. The built-in greetings remain.",
    ],
  },
  {
    version: "1.29.0",
    date: "2026-10-14",
    headline: "Settings use Obsidian's own rows and appear in its settings search.",
    announce: false,
    improved: [
      "Settings use Obsidian's own rows and appear in its settings search. You drag sections to reorder them, and each has a switch and an editor.",
    ],
    fixed: [
      "Previewing a card from the keyboard no longer raises an error.",
      "Held-back and filtered cards now stay hidden in the rows layout.",
    ],
  },
];

// --------------------------------------------------------------- versions

/** A version's numbers, or null when it is not a plain "1.2.3" version. */
export function parseVersion(version: string): [number, number, number] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Below zero when `a` is older than `b`. A version that does not parse is older than any that does. */
export function compareVersions(a: string, b: string): number {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) return (x ? 1 : 0) - (y ? 1 : 0);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

/** The later of two markers; "" when neither is a version. */
export function laterVersion(a: string, b: string): string {
  const later = compareVersions(a, b) >= 0 ? a : b;
  return parseVersion(later) ? later.trim() : "";
}

// ------------------------------------------------------------------ notes

/** Releases after `seen`, up to and including `current`, newest first. */
export function notesSince(seen: string, current: string, notes: readonly ReleaseNote[] = RELEASE_NOTES): ReleaseNote[] {
  return notes.filter((n) => compareVersions(n.version, seen) > 0 && compareVersions(n.version, current) <= 0);
}

/** The latest releases up to `current`, for What's new opened by hand. */
export function recentNotes(current: string, notes: readonly ReleaseNote[] = RELEASE_NOTES): ReleaseNote[] {
  return notes.filter((n) => compareVersions(n.version, current) <= 0).slice(0, RECENT_RELEASES);
}

export interface UpdateCheck {
  /** The installed version, from the manifest. */
  current: string;
  /** The newest release the reader has seen: the later of the synced and local markers. */
  seen: string;
  /** True when Home Cards has no stored settings: a new install. */
  firstRun: boolean;
  /** The reader's "Announce updates" setting. */
  enabled: boolean;
}

/**
 * What to do at startup:
 * - "none": leave everything as it is;
 * - "record": mark the current version seen, quietly;
 * - "announce": show the notice for these releases.
 */
export type UpdateDecision = { kind: "none" } | { kind: "record" } | { kind: "announce"; notes: ReleaseNote[] };

export function checkForUpdate(check: UpdateCheck, notes: readonly ReleaseNote[] = RELEASE_NOTES): UpdateDecision {
  const { current, seen } = check;
  if (!parseVersion(current)) return { kind: "none" };
  if (check.firstRun) return { kind: "record" };
  // Same version, or a downgrade: the marker stays at the newest seen.
  if (parseVersion(seen) && compareVersions(current, seen) <= 0) return { kind: "none" };
  if (!check.enabled) return { kind: "record" };
  // Settings from before the marker existed: the reader has seen every
  // release but this one.
  const unseen = parseVersion(seen) ? notesSince(seen, current, notes) : notesSince("", current, notes).slice(0, 1);
  return unseen.some((n) => n.announce) ? { kind: "announce", notes: unseen } : { kind: "record" };
}

/** The notice's lead: the newest release's version, and how many came with it. */
export function announcementTitle(notes: readonly ReleaseNote[]): string {
  const newest = notes[0];
  if (!newest) return "";
  const earlier = notes.length - 1;
  return earlier > 0
    ? `Home Cards ${newest.version}, with ${earlier} earlier ${earlier === 1 ? "release" : "releases"}`
    : `Home Cards ${newest.version}`;
}
