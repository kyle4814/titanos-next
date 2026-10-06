// The case studies library: one entry per real build. Every figure here must be traceable to the
// build's git log or a dated usage reading, and client names stay out (screenshots are redacted).
export type CaseShot = { src: string; alt: string };
export type CaseStudy = {
  slug: string;
  sector: string;
  title: string;
  teaser: string;
  cover: string;
  coverAlt: string;
  facts: [string, string][];
  brief: string;
  built: string[];
  speed: string;
  cost: string;
  tested: string;
  shots: CaseShot[];
};

export const CASES: CaseStudy[] = [
  {
    slug: "trading-app",
    sector: "Education and practice trading",
    title: "A full trading-education app, idea to working product in one morning",
    teaser:
      "A 200-lesson course, live charts, an AI tutor on every screen and a Telegram bot. Built and tested in about three and a half hours, inside a flat monthly AI subscription.",
    cover: "/case-studies/trading-app-chart.png",
    coverAlt: "Live coin chart with price, liquidity and candles",
    facts: [
      ["3.5 hours", "from first idea (05:10) to the finished app (08:40), 7 October 2026"],
      ["56", "commits in that window, all on the record"],
      ["250 / 250", "automated tests passing"],
      ["About 6%", "of one week of a flat-rate AI subscription"],
    ],
    brief:
      "A phone-first app to learn trading safely, with practice money only: a course, live charts, an AI tutor and a Telegram bot, simple enough to use on a lunch break.",
    built: [
      "A 200-lesson trading course with server-scored quizzes, progress and badges. Each lesson was checked by a second, separate fact-checking agent.",
      "An AI tutor on every screen, from a floating chat bubble that knows what you are looking at (a lesson, a chart or a practice round).",
      "Live coin and currency charts with drawings, indicators and a practice-money trade journal.",
      "A Telegram bot: account linking, lesson reminders and signal alerts with one-tap practice trades.",
      "A gamified garden that grows from learning habits, with levels, seasons and streaks.",
    ],
    speed:
      "The idea came up at 05:10 and the first commit landed at 05:41. By 08:40 the app had 56 commits and 14 features, each built on its own branch and merged into one product. That is about one commit every three minutes.",
    cost:
      "No extra spend. The build ran inside a flat-rate AI subscription that was already paid for (about US$200 a month), and it used about 6% of one week's allowance, going by the usage meter readings before and after. Pro rata, that is roughly US$3 of the subscription. Hosting runs on Cloudflare's free tier, so the running cost is $0.",
    tested:
      "Every change had to pass the test gate before it landed. Then a headless phone browser tapped through every tab at two screen sizes, opened the AI tutor and checked for a real answer. That pass caught two layout bugs (overlapping chat buttons and an overlapping price label), and both were fixed before the client saw them.",
    shots: [
      { src: "/case-studies/trading-app-petal.png", alt: "The AI tutor answering a question about the chart on screen" },
      { src: "/case-studies/trading-app-chart.png", alt: "Live coin chart: price, liquidity, buys and sells, candles" },
      { src: "/case-studies/trading-app-lesson.png", alt: "A course lesson on brokers and US regulation" },
    ],
  },
];

export function getCase(slug: string): CaseStudy | undefined {
  return CASES.find((c) => c.slug === slug);
}
