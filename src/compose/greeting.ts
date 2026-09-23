/**
 * The masthead greeting: contextual, a little quirky, and always in
 * Latin script. Multilingual greetings appear romanized ("Namaste",
 * "Shalom"), so the masthead keeps one typographic voice whatever the
 * theme's fonts cover.
 *
 * An occasion pins the greeting outright, matched against the LOCAL date
 * so Christmas is the 25th where the user is. Otherwise the pool is the
 * local time-of-day bucket plus all-hours greetings, with Friday and
 * weekend extras. Movable feasts (Easter, Diwali, Eid) are absent on
 * purpose: skipping them beats guessing them wrongly.
 *
 * Pure: callers pass the Date, and tests pass the rng too.
 */

interface Occasion {
  month: number; // 1-12
  day: number;
  texts: readonly string[];
}

const OCCASIONS: readonly Occasion[] = [
  { month: 1, day: 1, texts: ["Happy New Year", "Bonne année", "Feliz año nuevo"] },
  { month: 2, day: 14, texts: ["Happy Valentine's Day"] },
  { month: 3, day: 14, texts: ["Happy Pi Day", "Happy 3.14159"] },
  { month: 3, day: 17, texts: ["Happy St. Patrick's Day", "Sláinte"] },
  { month: 4, day: 1, texts: ["Trust nothing today", "Happy April Fools'"] },
  { month: 5, day: 4, texts: ["May the Fourth be with you"] },
  { month: 5, day: 25, texts: ["Happy Towel Day", "Don't panic"] },
  { month: 10, day: 31, texts: ["Happy Halloween", "Boo"] },
  { month: 12, day: 24, texts: ["Merry Christmas Eve"] },
  { month: 12, day: 25, texts: ["Merry Christmas", "Joyeux Noël", "Feliz Navidad"] },
  { month: 12, day: 31, texts: ["Happy New Year's Eve", "See you next year"] },
];

const ANYTIME = [
  "Hello", "Hola", "Bonjour", "Ciao", "Namaste", "Salaam", "Shalom",
  "Konnichiwa", "Ni hao", "Annyeong", "Sawasdee", "Selamat", "Habari",
  "Aloha", "Kia ora", "G'day", "Howdy", "Hej", "Servus", "Salut",
  "Welcome back",
];

const BY_HOUR: readonly { from: number; to: number; texts: readonly string[] }[] = [
  {
    from: 5,
    to: 12,
    texts: [
      "Good morning", "Buongiorno", "Guten Morgen", "Buenos días", "Bom dia",
      "Ohayō", "Rise and shine", "Top of the morning", "Suprabhat", "Coffee first",
    ],
  },
  {
    from: 12,
    to: 17,
    texts: ["Good afternoon", "Buenas tardes", "Bon après-midi", "Guten Tag", "Boa tarde"],
  },
  {
    from: 17,
    to: 22,
    texts: ["Good evening", "Bonsoir", "Guten Abend", "Buonasera", "Boa noite", "Shubh sandhya"],
  },
];

const LATE_NIGHT = [
  "Burning the midnight oil", "Still up", "The vault never sleeps",
  "Good night owl", "Up late",
];

const FRIDAY = ["Happy Friday", "Nearly the weekend"];
const WEEKEND = ["Happy weekend", "Easy does it"];

function pick<T>(list: readonly T[], rng: () => number): T {
  return list[Math.floor(rng() * list.length) % list.length];
}

/** The greeting for a moment in local time, before the name is attached. */
export function greetingFor(now: Date, rng: () => number = Math.random): string {
  const occasion = OCCASIONS.find(
    (o) => o.month === now.getMonth() + 1 && o.day === now.getDate()
  );
  if (occasion) return pick(occasion.texts, rng);

  const hour = now.getHours();
  const bucket = BY_HOUR.find((b) => hour >= b.from && hour < b.to)?.texts ?? LATE_NIGHT;
  const day = now.getDay();
  const pool = [
    ...bucket,
    ...ANYTIME,
    ...(day === 5 ? FRIDAY : []),
    ...(day === 0 || day === 6 ? WEEKEND : []),
  ];
  return pick(pool, rng);
}
