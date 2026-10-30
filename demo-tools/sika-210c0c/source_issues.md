# Things I noticed in your published documents while building the preview

Prepared by Kyle Deligny, TITANOS, 30 October 2026, for Nick Collett and the technical team. Public pages and public PDFs only, read on 30 October 2026.

While I read the data sheets and product pages to build the product portal preview, I found a few places where the printed value looks like a typing slip, and some links that no longer open. I am listing them in case they are useful to your technical team. The preview shows every value exactly as printed, with a small flag, and never corrects anything.

## 1. Printed values that may be typing slips (9 products, 12 places)

| Product | Data sheet edition | Where | As printed | Why it looks odd |
|---|---|---|---|---|
| Davco Supamastic | March 2025, Version 01.03 | clause 4.2, Consumption, [page 1](https://aus.sika.com/content/dam/dms/au01/f/davco-supamastic.pdf#page=1) | A 15 Pail will cover approximately 11m² | The pail size has no unit (the 4 Litre pail on the same line covers about 3m²). |
| Davco Superfine White Grout | December 2025, Version 01.01 | clause 4.3, Tile size row, [page 2](https://aus.sika.com/content/dam/dms/au01/5/davco-superfine-whitegrout.pdf#page=2) | 10x50x6mm | The first tile size is possibly 50x50x6mm. |
| LANKO 701 Duragrout | May 2025, Version 01.01 | clause 4.4, Number of bags per m3, [page 2](https://aus.sika.com/content/dam/dms/au01/c/lanko-701-duragrout.pdf#page=2) | ~ 98 (yield about 10 L per 20 kg bag) | A yield of about 10 L per bag would be 100 bags per m3 (1000 divided by 10) and the sheet prints about 98. |
| Sika Primer-3 N | July 2025, Version 01.03 | clause 5.2, Ambient air temperature, [page 1](https://aus.sika.com/content/dam/dms/au01/4/sika_primer-3_n.pdf#page=1) | Maximum +5°C, Minimum +40°C | The maximum and minimum look swapped. |
| Sika Primer-3 N | July 2025, Version 01.03 | clause 5.3, Substrate temperature, [page 1](https://aus.sika.com/content/dam/dms/au01/4/sika_primer-3_n.pdf#page=1) | Maximum +5°C, Minimum +40°C | The maximum and minimum look swapped. |
| Sika ViscoCrete-190 SC | April 2023, Version 01.02 | clause 2.5, Specific gravity, [page 1](https://aus.sika.com/content/dam/dms/au01/4/sika_viscocrete_-190sc.pdf#page=1) | 1.06 litre/kg approx. | Density or specific gravity printed per kilogram (litre/kg) rather than per litre. |
| Sikafloor-264 | April 2023, Version 08.05 | clause 4.15, Maximum air humidity, [page 4](https://aus.sika.com/content/dam/dms/au01/x/sikafloor_-264.pdf#page=4) | 85% r.h. | The data sheet gives two different limits for this condition (80 % r.h. on page 3, 85 % r.h. on page 4). |
| Sikafloor-264 | April 2023, Version 08.05 | clause 5.3, Relative air humidity, [page 3](https://aus.sika.com/content/dam/dms/au01/x/sikafloor_-264.pdf#page=3) | 80 % r.h. max. | The data sheet gives two different limits for this condition (80 % r.h. on page 3, 85 % r.h. on page 4). |
| Sikafloor-264 | April 2023, Version 08.05 | clause 5.7, Maximum air humidity, [page 4](https://aus.sika.com/content/dam/dms/au01/x/sikafloor_-264.pdf#page=4) | 85% r.h. | The data sheet gives two different limits for this condition (80 % r.h. on page 3, 85 % r.h. on page 4). |
| Sikafloor-4020 FiberLevel | April 2023, Version 03.01 | clause 5.2, Ambient air temperature, [page 2](https://aus.sika.com/content/dam/dms/au01/e/sikafloor_-4020_fiberlevel.pdf#page=2) | +5 ºC min / -35 ºC max. | A maximum of -35 ºC is below the minimum of +5 ºC, and the limitations on the same sheet say 35°C. |
| Sikafloor Level TOP | October 2026, Version 04.10 | clause 2.4, Density, [page 1](https://aus.sika.com/content/dam/dms/au01/i/sikafloor_level_top.pdf#page=1) | 1.24kg/m³ | A decimal value below 5 with kg/m3 (a density of this size is normally printed in kg/l or g/cm3; kg/m3 values run in the hundreds or thousands). |
| Sikafloor Level Ultra | March 2025, Version 02.10 | clause 2.5, Density, [page 1](https://aus.sika.com/content/dam/dms/au01/n/sikafloor_level_ultra.pdf#page=1) | 1.24kg/m³ | A decimal value below 5 with kg/m3 (a density of this size is normally printed in kg/l or g/cm3; kg/m3 values run in the hundreds or thousands). |

The two humidity limits on Sikafloor-264 and the swapped maximum and minimum on Sika Primer-3 N are the ones I would look at first, because a tiler or applicator could act on them.

## 2. Links on your own product pages that return "not found" today (26)

Each link below sits on a product page on aus.sika.com and returned HTTP 404 when I checked on 30 October 2026, on every address form I tried (with and without /content/ in the path). Two of them are the data sheets for Davco Powder Mastic and Davco PrimeX.

| Product page | Document title | Type |
|---|---|---|
| [Davco Powder Mastic](https://aus.sika.com/en/construction/tile-stone-installationsystems/tile-adhesives/davco-powder-mastic.html) | Davco Powder Mastic | Product Data Sheet (PDS) |
| [Davco PrimeX](https://aus.sika.com/en/construction/tile-stone-installationsystems/primers-additives/davco-primex.html) | Davco PrimeX | Product Data Sheet (PDS) |
| [Sika Confibre 19F](https://aus.sika.com/en/construction/concrete/fibres/sika-confibre-19f.html) | SDS SikaÂ® Confibre 19F | Safety Data Sheet (SDS) |
| [Sika Injection-306](https://aus.sika.com/en/construction/waterproofing/injections-and-hydrophilicsystems/sika-injection-306.html) | SDS SikaÂ® Injection-306 Part A | Safety Data Sheet (SDS) |
| [Sika MultiSeal BT](https://aus.sika.com/en/construction/sealants-adhesives/tapes-sealing/sika-multiseal-bt.html) | Sika MultiSeal-BT AP SDS | Document |
| [Sika Primer-210](https://aus.sika.com/en/industry/building-components/windows/sika-primer-210.html) | Sika® Primer-210 | Product Data Sheet (PDS) |
| [Sika Sigunit L-5401 AF](https://aus.sika.com/en/construction/concrete/admixture-technology/concrete-accelerators/sika-sigunit-l-5401af.html) | Sigaunit L-5401 AF | Document |
| [Sikadur-53](https://aus.sika.com/en/construction/grouts-anchoring/epoxy-grouts/sikadur-53.html) | SikadurÂ®-53 Part B | Safety Data Sheet (SDS) |
| [Sikaflex-212 FC](https://aus.sika.com/en/industry/transportation/interior-exteriorsealing/sikaflex-212-fc.html) | SDS SikaflexÂ®-212 FC | Safety Data Sheet (SDS) |
| [Sikaflex-591](https://aus.sika.com/en/industry/marine/leisure-boats-andyachts/interior-sealing/sikaflex-591.html) | SDS SikaflexÂ®-591 | Safety Data Sheet (SDS) |
| [Sikafloor-160](https://aus.sika.com/en/construction/flooring/resin-flooring/epoxy-flooring-productssystems/epoxy-flooring-products/sikafloor-160.html) | SDS Sikafloor®-160/161/263 SL/264/264 T Part B | Safety Data Sheet (SDS) |
| [Sikafloor-160](https://aus.sika.com/en/construction/flooring/resin-flooring/epoxy-flooring-productssystems/epoxy-flooring-products/sikafloor-160.html) | SDS Sikafloor®-160/161/264 Part B | Safety Data Sheet (SDS) |
| [Sikafloor-160](https://aus.sika.com/en/construction/flooring/resin-flooring/epoxy-flooring-productssystems/epoxy-flooring-products/sikafloor-160.html) | SDS Sikafloor®-160/264 Part B | Safety Data Sheet (SDS) |
| [Sikafloor-304 W](https://aus.sika.com/en/construction/flooring/resin-flooring/polyurethane-flooringproductssystems/polyurethane-flooringproducts/sikafloor-304-w.html) | SDS Sikafloor®-304 W/305 W/306 W Part B | Safety Data Sheet (SDS) |
| [Sikafloor-31 PurCem](https://aus.sika.com/en/construction/flooring/resin-flooring/purcem-flooring-productssystems/purcem-flooring-products/sikafloor-31-purcem.html) | SDS SikafloorÂ®-31/29 PurCemÂ® Part C | Safety Data Sheet (SDS) |
| [Sikafloor Marine-530](https://aus.sika.com/en/industry/marine/shipbuilding-and-offshore/decorative-floorsinternal/epoxy-smooth/sikafloor-marine-530.html) | SDS SikafloorÂ® Marine-530 Part A | Safety Data Sheet (SDS) |
| [Sikagard-63 N](https://aus.sika.com/en/construction/concrete-repair-protection/protective-coatingslinings/sikagard-63-n.html) | SDS SikagardÂ®-63 N Part A | Safety Data Sheet (SDS) |
| [Sikagard-680 S Betoncolor](https://aus.sika.com/en/construction/concrete-repair-protection/protective-coatingslinings/sikagard-680-s-betoncolor.html) | SDS SikagardÂ®-680 S Betoncolor colorless | Safety Data Sheet (SDS) |
| [Sikagard-700 S](https://aus.sika.com/en/construction/concrete-repair-protection/corrosion-management/protective-coatingssilaneimpregnations/sikagard-700-s.html) | Sikagard®-700 S | Product Data Sheet (PDS) |
| [SikaGrout UW](https://aus.sika.com/en/construction/grouts-anchoring/cementitious-grouts/sikagrout-uw.html) | SDS SikaGroutÂ® UW | Safety Data Sheet (SDS) |
| [SikaGunite GP](https://aus.sika.com/en/construction/concrete-repair-protection/concrete-repair-mortars/cementitious-repairmortars/sikagunite-gp.html) | SDS SikaGuniteÂ® GP | Safety Data Sheet (SDS) |
| [Sikalastic-827 HT](https://aus.sika.com/en/construction/waterproofing/bridge-deck-waterproofingsystems/sikalastic-827-ht.html) | Sikalastic-827HT | Document |
| [SikaProof Bentonite](https://aus.sika.com/en/construction/waterproofing/basement-sheet-membranes/sikaproof-bentonite.html) | SDS SikaProof Bentonite | Safety Data Sheet (SDS) |
| [SikaSwell P Profiles](https://aus.sika.com/en/construction/waterproofing/injections-and-hydrophilicsystems/sikaswell-p-profiles.html) | SikaSwell-Profile PDS | Document |
| [SikaSwell P Profiles](https://aus.sika.com/en/construction/waterproofing/injections-and-hydrophilicsystems/sikaswell-p-profiles.html) | SikaSwell-Profile SDS | Document |
| [SikaTop Armatec-110 EpoCem](https://aus.sika.com/en/construction/concrete-repair-protection/concrete-repair-mortars/steel-reinforcmentprimers/sikatop-armatec-110epocem.html) | SDS SikaTopÂ® ArmatecÂ®-110 EpoCemÂ® Part A | Safety Data Sheet (SDS) |

## 3. A note on safety data sheet versions

Some products have more than one safety data sheet revision published. For example the Davco Ceramacrete SDS dated 04.03.2025 lists H350 and the one dated 31.10.2025 does not. The preview always quotes the latest revision for the product name and shows its revision date and version on every safety answer.

Kyle Deligny
TITANOS, kyle@titanos.tech
