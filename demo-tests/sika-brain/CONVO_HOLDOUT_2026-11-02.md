# Blind holdout conversation bank, baseline 2026-11-02

Bank: `convo_holdout.json` (150 rows: 120 single-turn + 30 multi-turn scripts). Written fresh from four personas (tiler on a phone, first-time DIY renovator, hardware staffer, site supervisor) without reading `convo_bank.json`, `gen_convo_bank.mjs` or the 2026-11-02 convo score report. Every 4th single row has deliberate typos. Product names checked against `data/products.json`. Expectations are the scorer's class checks plus a few `room` props; no `has` props, so "answered" means the right card shape, not verified content.

Run: `node convo_score.mjs --bank convo_holdout.json [--json out.json] [--md]` (report only, exit 0). Also in `run_all.sh`.

Rule: do NOT tune against this bank. Use it to confirm gains on `convo_bank.json` generalise. Overfit signal = tuned bank rises while this one stays flat.

## Baseline on 2e8900c64

Total 103/150 (68.7%).

| class | pass | rate |
|---|---|---|
| social | 7/16 | 43.8% |
| clarify | 10/19 | 52.6% |
| pick | 13/26 | 50.0% |
| answer | 27/32 | 84.4% |
| honest-no | 14/14 | 100.0% |
| compare | 10/16 | 62.5% |
| quantity | 22/27 | 81.5% |

By persona: tiler 30/40, diy 30/38, staff 21/36, supervisor 22/36.

Caveat: honest-no at 100% is a lenient check (any "price/published" wording passes), so it is not strong evidence.

## Top failure patterns (rows failing; a row can hit more than one)

1. not-found-card, 17 (social 9, answer 3, clarify 2, pick 2, compare 1). Greetings and meta questions fall to "Not in the published documentation": "cheers legend that helps heaps", "hello? is anyone there lol", "are you a real person or a bot", "how do i use this", "hey team". Also staff phrasing: "customer here wanting help", "shelf life of Davco Ultraflex, customer asking", "Sika Boom G against Sika Boom AP".
2. vague-answered-instead-of-clarified, 7: "whats the go with waterproofing", "theres a crack in the wall, help", "lady asking about grout but cant say what for" get a range list or a single product instead of a clarifier.
3. pick-got-unranked-list, 5 (+4 pick-no-My-pick-lead): "which sealant for the kitchen bench to splashback join, just one thanks", "which concrete repair mortar for a spalled column, vertical, pick one", "what is the go to epoxy for anchoring bars" return "This is not a claim that one is the best" lists. Pick total fail 13/26.
4. compare-not-side-by-side, 5: "SikaBond Instant Nails vs Sikaflex 118 Extreme Grab" returns one product; "MonoTop 723 N compared to 412 NFG" returns a matching-lines card; the script "how does it stack up against K10 Plus" loses the previous product ("it").
5. quantity-clarifier-no-number, 4 (+1 quantity-no-number): volume or thickness asks ("2 m3 pour how many bags", "Sikadur 33 15 m2", "Sikalastic 888 120 m2 litres") get a clarifier even when area is given; "10 window frames" of foam gets no count.

Also: answer-got-clarifier-loop 2 ("how long til i can grout after fixing wall tiles", "SikaBond Instant Nails outdoors"); lost-the-room 2 (multi-turn "which adhesive would u pick" after "shower" re-asks "Which one first?"; podium slab context lost to Waterbar).

IDs per pattern are in the `--json` output (`patterns[].ids`).
