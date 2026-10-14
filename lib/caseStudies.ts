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
    slug: "dealer-command-centre",
    sector: "Used vehicle dealership",
    title: "A dealership command centre, built and independently reviewed in about 70 minutes",
    teaser:
      "Stock, costs, sales, aged-stock alerts, reports and a plain-English assistant for a 4x4 yard, phone first. 23 parallel jobs, 598 tests passing and 8 independent reviews, start to finish in about 70 minutes.",
    cover: "/case-studies/dealer-app-overview.webp",
    coverAlt: "The dealership overview on a phone: active stock, stock cost and listed value",
    facts: [
      ["About 70 min", "from the first job starting (15:36) to the reviewed build (16:46), 14 October 2026"],
      ["23", "jobs run in parallel: 4 discovery, 10 builders, 8 reviewers and 1 lead"],
      ["598 / 598", "automated tests passing"],
      ["12 ms", "to list 10,000 vehicles (slowest 5% of runs, one database measurement)"],
    ],
    brief:
      "A 4x4 yard needed one place to see every car, what it really cost, what it is worth and which ones are sitting too long, usable from a phone on the lot.",
    built: [
      "Every vehicle in one searchable list: make, VIN or stock number, with filters for status and age. On a phone, the tables turn into cards.",
      "A cost ledger for each car (purchase, repairs, detailing) with price history and true gross profit, shown as incomplete when a cost is missing instead of guessed.",
      "Aged-stock alerts at 30, 60 and 90 days and beyond, each with a suggested next step, plus acknowledge and snooze.",
      "A sale flow that cannot record the same sale twice, even with a double tap or two people at once.",
      "Reports on margin, turnover and stock age, with CSV import and export.",
      "A rule-based assistant: ask in plain words, it proposes the change, and nothing happens until the owner confirms.",
      "Individual logins with owner, manager and read-only roles, a tamper-evident audit log and a tested backup and restore.",
    ],
    speed:
      "The first job started at 15:36 and the reviewed build was finished at 16:46. Discovery, ten builders and eight reviewers ran side by side, and a single lead merged the work with zero merge conflicts. The owner's real stock was pulled from the yard's public listings in the same window.",
    cost:
      "No extra spend. The build ran inside flat-rate AI subscriptions that were already paid for. Usage was not metered separately for this build, so no per-build dollar figure is claimed. Each yard's data is kept separate from every other account.",
    tested:
      "598 automated tests pass. Then eight separate reviewers, each working from a fresh copy, checked security, the money and aging maths, race conditions, real browser use on desktop and phone, accessibility, the visual design and the acceptance rules. They found 1 critical and 9 high-priority issues, and all ten were fixed before the demo. The aging maths matched an independent calculation with zero mismatches.",
    shots: [
      { src: "/case-studies/dealer-app-overview.webp", alt: "Overview: active stock, stock cost and listed value at a glance" },
      { src: "/case-studies/dealer-app-alerts.webp", alt: "Stock alerts: a car flagged at 150 days, with the next step" },
      { src: "/case-studies/dealer-app-inventory.webp", alt: "Inventory as phone cards: cost, asking price, margin and age" },
      { src: "/case-studies/dealer-app-vehicle.webp", alt: "One vehicle: status, actions and photos" },
      { src: "/case-studies/dealer-app-reports.webp", alt: "Reports: sales by date range, aging and capital" },
      { src: "/case-studies/dealer-app-assistant.webp", alt: "The assistant proposing a price change for the owner to confirm" },
    ],
  },
  {
    slug: "trading-app",
    sector: "Education and practice trading",
    title: "A full trading-education app, idea to working product in one morning",
    teaser:
      "A 200-lesson course, live charts, an AI tutor on every screen and a Telegram bot. Built and tested in about three and a half hours, inside a flat monthly AI subscription.",
    cover: "/case-studies/trading-app-chart.webp",
    coverAlt: "Live coin chart with price, liquidity and candles",
    facts: [
      ["3.5 hours", "from first idea (05:10) to the finished app (08:40), 7 October 2026"],
      ["56", "commits in that window, all on the record"],
      ["250 / 250", "automated tests passing"],
      ["About 6%", "of one week of a flat-rate AI subscription"],
    ],
    brief:
      "A personal build, made as a gift: a phone-first app to learn trading safely, with practice money only: a course, live charts, an AI tutor and a Telegram bot, simple enough to use on a lunch break.",
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
      "Every change had to pass the test gate before it landed. Then a headless phone browser tapped through every tab at two screen sizes, opened the AI tutor and checked for a real answer. That pass caught two layout bugs (overlapping chat buttons and an overlapping price label), and both were fixed in the code the same morning.",
    shots: [
      { src: "/case-studies/trading-app-petal.webp", alt: "The AI tutor answering a question about the chart on screen" },
      { src: "/case-studies/trading-app-chart.webp", alt: "Live coin chart: price, liquidity, buys and sells, candles" },
      { src: "/case-studies/trading-app-lesson.webp", alt: "A course lesson on brokers and US regulation" },
    ],
  },
];

export function getCase(slug: string): CaseStudy | undefined {
  return CASES.find((c) => c.slug === slug);
}
