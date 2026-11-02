# Pick quality, 2026-11-02 (branch sika/pick-quality-2026-11-02)

30 realistic trade-counter recommend asks, run through the full session brain (brain.ask), before (base 1f36f8c67) and after. "Pick" is the "My pick" lead product and its quoted reason. A row with no pick stays a clarifying question, an info page, or a tie card; the reason is then not a pick reason.

| Measure | Before | After |
|---|---|---|
| asks that end in a My pick lead (of 30) | 22 | 24 |
| picks whose quoted reason is under 5 words | 4 | 0 |
| picks whose quoted reason is a label or heading (not a sentence, includes the under 5 word ones) | 11 | 5 |

Method: reason word count from the quoted headline; "label or heading" = under 5 words, or no verb and no full stop (heading style, e.g. "Areas Suitable for interior and exterior applications"). Computed from the saved run output on 2026-11-02; reproduce with the ask list below and the ask harness.

What changed (advisor.js, chat.js, session.js, know.js)
- The quoted reason is the best full published sentence for the user's own condition words (name of the product ignored first, then counted at 0.4 if only the name matches). Category labels are used only when no sentence exists.
- Label-only evidence scores below a real sentence (a label scores 0.5, rising to 0.9 when several distinct labels hit).
- Ties go to the product whose sentence covers more of the user's conditions, then to the one with more documentation hits.
- Primary use: a fitting or accessory (pipe, flashing, decor profile), a fire rated sealant, or a pool or static product is marked down when the job did not name that part or place.
- "what sealant should I use ..." and "which X should I buy" now count as a recommend ask; a reply that narrows a clarifying question always ends in a My pick.
- Windscreen removal and cut-out asks go to Sika's two published removal procedures, with the plain line that no Sika product removes a windscreen. Honeycomb panel asks go to the Honeycomb Panels page.

| # | Ask | Before: pick and quoted reason | After: pick and quoted reason |
|---|---|---|---|
| 1 | What sealant should I use around a bath | no pick (Products whose own published text documents a fit, in the or) | SikaSeal Kitchen and Bathroom: "SikaSeal Kitchen and Bathroom is a one-component, neutral curing, low odour silicone sealant with excellent adhesion." |
| 2 | Best sealant for a bathroom | SikaSeal-190 N Silicone: "Kitchens & Bathrooms" | SikaSeal Kitchen and Bathroom: "SikaSeal Kitchen and Bathroom is a one-component, neutral curing, low odour silicone sealant with excellent adhesion." |
| 3 | Recommend a sealant for a shower leak | SikaSeal Kitchen and Bathroom: "Bathrooms" | SikaSeal Kitchen and Bathroom: "SikaSeal Kitchen and Bathroom cures through the absorption of atmospheric moisture to give a tough but flexible waterproof seal." |
| 4 | What should I use to fix a leaking shower | no pick (From Sika Australia's published page "Leaking shower: How to) | no pick (From Sika Australia's published page "Leaking shower: How to) |
| 5 | Recommend a waterproofing membrane for a balcony | Davco K10 Rapid: "Areas Suitable for interior and exterior applications" | Davco K10 Rapid: "Areas Suitable for interior and exterior applications" |
| 6 | What do I use to waterproof a balcony before tiling | Davco K10 Rapid: "Areas Suitable for interior and exterior applications" | Davco K10 Rapid: "Areas Suitable for interior and exterior applications" |
| 7 | My roof is leaking, what should I use | S-Pipe Flashing PVC: "S-Pipe Flashing PVC is a prefabricated pipe/vent flashing, based on a polyvinyl chloride (PVC) multi-layer, roof waterproofing membrane containing ult" | Sarnafil G 476-15 (CN_GB): "Sarnafil G 476-15 (CN_GB) (thickness 1,5 mm) is a multi-layer, synthetic roof waterproofing membrane based on polyvinyl chloride (PVC) with an inlay o" |
| 8 | Recommend a roof leak sealant | Sikalastic-622 Excel Top PLUS: "Sikalastic-622 Excel Top PLUS is a single component, aliphatic, moisture cured, elastomeric polyurethane coating for use as an exposed trafficable wea" | SikaSeal Roof & Gutter: "SikaSeal Roof & Gutter cures through the absorption of atmospheric moisture to give a tough but flexible waterproof seal." |
| 9 | What should I use to repair a leaking metal roof | Ormonoid Bitkote No.3: "Sealing of tree wounds" | Sarnafil G 476-15 (CN_GB): "Sarnafil G 476-15 (CN_GB) (thickness 1,5 mm) is a multi-layer, synthetic roof waterproofing membrane based on polyvinyl chloride (PVC) with an inlay o" |
| 10 | Best coating for a garage floor | Sikafloor-376: "Crack bridging, trafficable, wearing layer" | Sikafloor-376: "Crack bridging, trafficable, wearing layer" |
| 11 | Recommend a garage floor coating | Sikafloor MultiDur ES-14: "Good chemical and mechanical resistance" | Sikafloor MultiDur ES-14: "Good chemical and mechanical resistance" |
| 12 | What should I use for a pool | no pick (Which part of the pool? Tap one, or tell me in your own word) | no pick (Which part of the pool? Tap one, or tell me in your own word) |
| 13 | Best waterproofing for a swimming pool | SikaCeram Sealing Membrane A: "Swimming pools (10 m depth maximum)" | SikaCeram Sealing Membrane A: "SikaCeram Sealing Membrane A is a flexible waterproofing and decoupling membrane used for waterproofing walls, floors under tiles in wet rooms, swimmi" |
| 14 | Recommend a sealant for a facade joint | Sikasil-670 Fire: "Masking It is recommended to use masking tape where neat or exact joint lines are required." | Sikasil-670 Fire: "Masking It is recommended to use masking tape where neat or exact joint lines are required." |
| 15 | What sealant for expansion joints in a concrete facade | no pick (Products whose own published text documents a fit, in the or) | no pick (Products whose own published text documents a fit, in the or) |
| 16 | Best glue for gluing timber | no pick (What is the timber job? Tap one, or tell me in your own word) | no pick (What is the timber job? Tap one, or tell me in your own word) |
| 17 | What adhesive should I use for timber flooring | no pick (Products whose own published text documents a fit, in the or) | SikaBond T-55 J: "SikaBond T-55 J is designed for full surface wood floor bonding of solid and engineered wood floors and subfloors." |
| 18 | Recommend an adhesive for tiles on plywood | SikaTile-400 EVO PRO: "Timber and particleboard flooring over-sheeted with ceramic tile underlay or a suitable reinforced screed" | SikaTile-400 EVO PRO: "Timber and particleboard flooring over-sheeted with ceramic tile underlay or a suitable reinforced screed" |
| 19 | What should I use to fix tiles on plywood | no pick (Two products tie on what the data sheets say: SikaTile-400 E) | no pick (Two products tie on what the data sheets say: SikaTile-510 M) |
| 20 | Recommend something to fix a crack in a concrete slab | Sika Concrete Fix: "Concrete elements" | Sika Concrete Fix: "Can be used on damp concrete" |
| 21 | Best crack repair for a slab | Sikadur-55 SLV: " Sikadur 55 SLV structurally repairs cracked concrete." | Sikadur-55 SLV: " Sikadur 55 SLV structurally repairs cracked concrete." |
| 22 | What should I use for a wet area wall | SikaTile-110 Secure Proof: "A premium performance, flexible class III, ready to use, water based polyurethane waterproofing membrane designed for internal and external areas incl" | SikaTile-110 Secure Proof: "A premium performance, flexible class III, ready to use, water based polyurethane waterproofing membrane designed for internal and external areas incl" |
| 23 | Best sealant for mould resistant kitchen | Davco N Silicone: "▪ Neutral cure ▪ Excellent adhesion to most common construction materials such as: glass, enamel, ceramics, tiles, most metal*, most plastic, rubber, " | Davco N Silicone: "Davco N Silicone is easy to apply and cures with atmospheric moisture to form a high performance tough flexible mould resistant waterproof seal." |
| 24 | Recommend a sealant for an exterior window | Sikasil-670 Fire: "Sikasil-670 Fire is designed for fire rated movement and connection joints on porous and non-porous substrates for interior and exterior applications." | Sikasil-702: "Sikasil-702 is a premium grade one-component neutral curing silicone sealant with good adhesion, elasticity and weatherability for all trade and home " |
| 25 | What is the best adhesive for bonding metal to concrete | SikaBond FoamFix+: "Good adhesion to concrete, bituminous substrates, wood, brickwork, plaster, metal and PVC" | SikaBond-105 ContactFix: "Suitable substrates are timber, rubber sheets, plastic laminates, fabric, cloth backed and polyester backed vinyl, MDF, particleboard, concrete, glass" |
| 26 | Best product for trafficable car park deck waterproofing | no pick (What is the deck job?) | no pick (What is the deck job?) |
| 27 | Recommend a grout for under a baseplate | SikaGrout GP AU: "For precision grouting, SikaGrout-212HP is recommended." | SikaGrout GP AU: "When carrying out baseplate grouting, ensure sufficient pressure head is maintained for uninterrupted mortar flow." |
| 28 | What should I use to repair concrete spalling | Sika MonoTop-436 N: "Suitable for restoration work by recasting (Principle 3, method 3.2 of EN 1504-9).Repair of spalling and damaged concrete in buildings, bridges, infra" | Sika MonoTop-352 NFG: "Repair of spalling and damaged concrete in buildings, bridges, infrastructure and superstructure works." |
| 29 | Best primer for a concrete floor before levelling | Sikafloor-08 Primer: "Can be applied on interior or exterior concrete" | Sikafloor-08 Primer: "Can be applied on interior or exterior concrete" |
| 30 | Recommend a flexible adhesive for a shower screen | Sika Showerbond: "Sika Showerbond is used for bonding acrylic plastic shower linings to suitable wall linings and bonding acrylic shower trays to suitable flooring." | Sika Showerbond: "Sika Showerbond is used for bonding acrylic plastic shower linings to suitable wall linings and bonding acrylic shower trays to suitable flooring." |

Not fixed, said plainly
- Garage floor and balcony picks still quote a feature label ("Crack bridging, trafficable, wearing layer", "Areas Suitable for interior and exterior applications"): for those products the published pages hold no fuller sentence that matches the user's words, so the label is all there is to quote. Nothing was invented.
- SikaSeal Kitchen and Bathroom is quoted by its description sentence because the page's bathroom wording is only in its name and short usage labels.
- 6 of the 30 asks still do not end in a pick: three ask a clarifying question first (pool, timber glue, car park deck), one is a tie card (tiles on plywood), one is an info page (leaking shower), and one (expansion joints in a concrete facade) returns the fit list without a pick lead. The last one is open: not investigated in this pass.
