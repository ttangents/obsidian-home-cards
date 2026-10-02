/**
 * The masthead greeting: contextual, a little dry, and always in Latin
 * script. Greetings from other languages appear romanized ("Namaste",
 * "Konnichiwa"), so the masthead keeps one typographic voice whatever the
 * theme's fonts cover.
 *
 * Two sources share this module. The built-in list below always works.
 * On macOS, Apple Intelligence can write a fresh line instead; this module
 * supplies its prompt (`greetingPrompt`) and vets its reply
 * (`cleanModelGreeting`), and platform/greeting-source.ts runs it.
 *
 * Templates may carry `{name}` where the reader's name reads naturally.
 * `withName` fills it, or drops it cleanly when no name is set. A short
 * salutation without the token ("Good morning") gets ", name" appended;
 * a longer line without it stands alone.
 *
 * Pure: callers pass the Date, and tests pass the rng too.
 */

// ---------------------------------------------------------------- context

export type PartOfDay = "night" | "early" | "morning" | "midday" | "afternoon" | "evening" | "late";

const PARTS: readonly { part: PartOfDay; from: number; label: string }[] = [
  { part: "night", from: 0, label: "the small hours of the night" },
  { part: "early", from: 5, label: "early morning" },
  { part: "morning", from: 8, label: "morning" },
  { part: "midday", from: 12, label: "around lunchtime" },
  { part: "afternoon", from: 14, label: "afternoon" },
  { part: "evening", from: 17, label: "evening" },
  { part: "late", from: 21, label: "late evening" },
];

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function partOf(hour: number): (typeof PARTS)[number] {
  let found = PARTS[0];
  for (const p of PARTS) if (hour >= p.from) found = p;
  return found;
}

// ------------------------------------------------------------ occasions

interface Occasion {
  month: number; // 1-12
  day: number;
  name: string;
  texts: readonly string[];
}

/**
 * Fixed-date days only. Movable feasts (Easter, Diwali, Eid, Lunar New
 * Year) are absent on purpose: skipping them beats guessing them wrongly.
 * These follow a largely Western calendar, so a setting turns them off.
 */
const OCCASIONS: readonly Occasion[] = [
  {
    month: 1, day: 1, name: "New Year's Day",
    texts: ["Happy New Year", "Bonne année", "Feliz año nuevo", "New year, same brilliant vault", "Fresh calendar, {name}"],
  },
  {
    month: 2, day: 14, name: "Valentine's Day",
    texts: ["Happy Valentine's Day", "Love letters count as notes", "Be mine, {name}. Says your vault"],
  },
  { month: 3, day: 14, name: "Pi Day", texts: ["Happy Pi Day", "Happy 3.14159", "An irrational amount of notes"] },
  { month: 3, day: 17, name: "St. Patrick's Day", texts: ["Happy St. Patrick's Day", "Sláinte", "Luck of the Irish, {name}"] },
  {
    month: 4, day: 1, name: "April Fools' Day",
    texts: ["Trust nothing today", "Happy April Fools'", "All your notes are gone. Kidding."],
  },
  { month: 4, day: 22, name: "Earth Day", texts: ["Happy Earth Day", "Paperless since forever"] },
  { month: 4, day: 23, name: "World Book Day", texts: ["Happy World Book Day", "Read anything good, {name}?"] },
  { month: 5, day: 4, name: "Star Wars Day", texts: ["May the Fourth be with you", "These are the notes you're looking for"] },
  { month: 5, day: 25, name: "Towel Day", texts: ["Happy Towel Day", "Don't panic", "Know where your towel is, {name}?"] },
  { month: 10, day: 31, name: "Halloween", texts: ["Happy Halloween", "Boo", "Spooky notes ahead, {name}", "Trick or treat?"] },
  { month: 12, day: 24, name: "Christmas Eve", texts: ["Merry Christmas Eve", "Not long now, {name}"] },
  {
    month: 12, day: 25, name: "Christmas Day",
    texts: ["Merry Christmas", "Joyeux Noël", "Feliz Navidad", "Buon Natale", "Season's greetings, {name}"],
  },
  { month: 12, day: 31, name: "New Year's Eve", texts: ["Happy New Year's Eve", "See you next year", "Last notes of the year, {name}"] },
];

function occasionOn(now: Date): Occasion | undefined {
  return OCCASIONS.find((o) => o.month === now.getMonth() + 1 && o.day === now.getDate());
}

// ------------------------------------------------------------ the list

/** Salutations from around the world, good at any hour. */
const SALUTATIONS = [
  "Hello", "Hi there", "Hey", "Welcome back", "Hola", "Bonjour", "Ciao", "Olá", "Hallo", "Hej",
  "Moin", "Servus", "Salut", "Ahoj", "Szia", "Tere", "Merhaba", "Yassou", "Dia dhuit", "Namaste",
  "Namaskar", "Vanakkam", "Sat sri akal", "Salaam", "Shalom", "Habari", "Jambo", "Sawubona",
  "Konnichiwa", "Ni hao", "Annyeong", "Sawasdee", "Xin chào", "Kumusta", "Mabuhay", "Selamat datang",
  "Aloha", "Kia ora", "G'day", "Howdy",
];

/** Longer lines, good at any hour. */
const ANYTIME = [
  "Good to see you, {name}",
  "Back for more, {name}?",
  "Your notes missed you",
  "Everything is where you left it",
  "Ready when you are, {name}",
  "What are we thinking about today?",
  "Another idea worth writing down?",
  "Pick up where you left off",
  "The cards are dealt, {name}",
  "Fresh page, familiar notes",
];

const BY_PART: Record<PartOfDay, readonly string[]> = {
  night: [
    "Still up, {name}?",
    "The vault never sleeps",
    "Good night, owl",
    "It's late. Or early.",
    "Sleep is overrated, apparently",
    "Shh, the notes are sleeping",
    "Burning the midnight oil",
  ],
  early: [
    "Good morning",
    "Rise and shine",
    "Early start, {name}",
    "Up with the birds",
    "Coffee first, then ideas",
    "Before the inbox wakes up",
    "Ohayō",
    "Bom dia",
  ],
  morning: [
    "Good morning",
    "Buongiorno",
    "Guten Morgen",
    "Buenos días",
    "Bom dia",
    "Suprabhat",
    "Selamat pagi",
    "Top of the morning",
    "Morning, {name}. Coffee in hand?",
    "A clear head and a clean page",
    "Morning pages, anyone?",
  ],
  midday: [
    "Good afternoon",
    "Bon appétit, {name}",
    "Lunch break reading?",
    "Halfway through the day",
    "Midday check-in, {name}",
    "Buon pranzo",
  ],
  afternoon: [
    "Good afternoon",
    "Buenas tardes",
    "Boa tarde",
    "Guten Tag",
    "Selamat sore",
    "Tea time, {name}?",
    "Afternoon slump? Not here",
    "Second wind incoming",
    "The afternoon is young",
  ],
  evening: [
    "Good evening",
    "Bonsoir",
    "Guten Abend",
    "Buonasera",
    "Boa noite",
    "Shubh sandhya",
    "Selamat malam",
    "Winding down, {name}?",
    "One more thought before dinner",
    "The day's notes are in",
  ],
  late: [
    "Evening, {name}. Still at it?",
    "Just one more note",
    "Night owl hours",
    "Burning the midnight oil",
    "Late one, {name}",
    "Good night",
  ],
};

const BY_WEEKDAY: readonly (readonly string[])[] = [
  ["Lazy Sunday", "Sunday thinking", "Easy does it, {name}"],
  ["Happy Monday. Mostly.", "Monday again, {name}", "Fresh week, fresh notes"],
  ["Tuesday, the quiet achiever", "Happy Tuesday"],
  ["Halfway there, {name}", "Happy hump day"],
  ["Nearly Friday", "Thursday: Friday's opening act"],
  ["Happy Friday", "Nearly the weekend", "Friday at last, {name}"],
  ["Happy Saturday", "Saturday, no meetings", "Weekend mode, {name}"],
];

/** Lines that only make sense in the first days of a month. */
function monthStart(now: Date): string[] {
  if (now.getDate() > 3) return [];
  const month = MONTHS[now.getMonth()];
  const lines = [`${month} already, {name}?`];
  if (now.getMonth() === 0) lines.push("New year, same great vault");
  if (now.getMonth() === 6) lines.push("Halfway through the year, {name}");
  if (now.getMonth() === 11) lines.push("Last month of the year, {name}");
  return lines;
}

function pick<T>(list: readonly T[], rng: () => number): T {
  return list[Math.floor(rng() * list.length) % list.length];
}

export interface GreetingOptions {
  /** Let fixed-date holidays pin the greeting. */
  occasions: boolean;
  rng: () => number;
}

/**
 * A greeting template for a moment in local time, from the built-in list.
 * Pass the result through `withName` before display.
 */
export function greetingFor(now: Date, options: Partial<GreetingOptions> = {}): string {
  const { occasions = true, rng = Math.random } = options;
  const occasion = occasions ? occasionOn(now) : undefined;
  if (occasion) return pick(occasion.texts, rng);

  const pool = [
    ...BY_PART[partOf(now.getHours()).part],
    ...BY_WEEKDAY[now.getDay()],
    ...monthStart(now),
    ...SALUTATIONS,
    ...ANYTIME,
  ];
  return pick(pool, rng);
}

/** Every template the list could ever produce, for the tests. */
export function allListGreetings(): string[] {
  const months = MONTHS.map((m) => `${m} already, {name}?`);
  return [
    ...OCCASIONS.flatMap((o) => o.texts),
    ...Object.values(BY_PART).flat(),
    ...BY_WEEKDAY.flat(),
    ...months,
    "New year, same great vault",
    "Halfway through the year, {name}",
    "Last month of the year, {name}",
    ...SALUTATIONS,
    ...ANYTIME,
  ];
}

// --------------------------------------------------------------- names

const NAME = "{name}";

/** Fill the name slot, or drop it cleanly when no name is set. */
export function withName(template: string, name: string): string {
  const n = name.trim();
  if (template.includes(NAME)) {
    if (n) return template.replace(NAME, n);
    return template
      .replace(/,\s*\{name\}/, "")
      .replace(/\{name\},\s*/, "")
      .replace(/\s*\{name\}/, "")
      .trim();
  }
  // A short salutation takes the name; a sentence stands on its own.
  const short = template.split(/\s+/).length <= 3 && !/[.?!]$/.test(template);
  return n && short ? `${template}, ${n}` : template;
}

// ---------------------------------------------------- Apple Intelligence

/**
 * The prompt for the on-device model. It carries the date, time and any
 * fixed-date occasion, and nothing from the vault.
 */
export function greetingPrompt(now: Date, options: { occasions: boolean }): string {
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const when = `${WEEKDAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}, ${hh}:${mm} (${partOf(now.getHours()).label})`;
  const occasion = options.occasions ? occasionOn(now) : undefined;
  return [
    "Write one greeting for the top of a personal notes app's home page.",
    `It is ${when}.`,
    occasion ? `Today is ${occasion.name}.` : "",
    "Keep it between 1 and 7 words, in English, warm and a little dry or funny.",
    "It may use a greeting word from another language, written in Latin letters, such as Namaste or Hola.",
    "If it reads naturally, write {name} once where the reader's name goes.",
    "No emoji, no quotation marks, no hashtags, no other names.",
    "Reply with the greeting only.",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Latin letters (with diacritics), digits, spaces and plain punctuation. */
const ALLOWED = /^[\p{Script=Latin}\p{N}\p{Zs}.,!?'’:;\-{}]+$/u;

/**
 * Vet a model reply: first line, wrapping quotes and labels removed,
 * trailing full stop dropped. Returns null for anything that does not
 * look like a short greeting, so the caller falls back to the list.
 */
export function cleanModelGreeting(raw: string): string | null {
  const line = raw.split(/\r?\n/).map((l) => l.trim()).find(Boolean);
  if (!line) return null;
  let text = line
    .replace(/^(greeting|here'?s? (is )?(a|your) greeting)\s*:\s*/i, "")
    .replace(/^["'“‘`]+|["'”’`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  // One trailing full stop goes; an ellipsis stays.
  if (text.endsWith(".") && !text.endsWith("..")) text = text.slice(0, -1);
  text = text.replace(/\{\s*name\s*\}/gi, NAME);
  if (!text || text.length > 60 || text.split(" ").length > 10) return null;
  if (!ALLOWED.test(text)) return null;
  // Braces only as the one name slot.
  if (text.replace(NAME, "").includes("{") || text.replace(NAME, "").includes("}")) return null;
  return text;
}
