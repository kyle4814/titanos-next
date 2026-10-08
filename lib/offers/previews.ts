// Sample previews for the finished products. Every preview is an ILLUSTRATIVE SAMPLE built on an invented
// business: it shows the shape of the deliverable, never a real company's result. Price stays in offers.json.
export type Preview = { caption: string; head: string[]; rows: string[][]; foot: string };

const SAMPLE = "Illustrative sample on an invented business. Your report uses your own public records, dated and sourced.";

export const PREVIEWS: Record<string, Preview> = {
  "portfolio-watch": {
    caption: SAMPLE,
    head: ["Holding", "SPF", "DKIM", "DMARC policy", "Change since last month"],
    rows: [
      ["Harbour Freight Co", "Pass", "Pass", "Reject", "Held"],
      ["Northgate Dental Group", "Pass", "UNKNOWN", "None", "Slipped: DMARC policy removed"],
      ["Bluegum Logistics", "Pass", "Pass", "Quarantine", "Improved: moved from none"],
    ],
    foot: "A failed lookup is marked UNKNOWN, never guessed. Red cells come with three fix lines for the holding's own IT provider.",
  },
  "tender-intelligence-radar": {
    caption: SAMPLE,
    head: ["Competitor", "Contracts won", "Largest award", "Next expiry"],
    rows: [
      ["Sample Services Pty Ltd", "6 in 12 months", "Sourced from AusTender", "Dated in the report"],
      ["Example Facilities Group", "3 in 12 months", "Sourced from AusTender", "Dated in the report"],
    ],
    foot: "Every row links to the public award notice it came from. Awarded contracts are intelligence, not an open tender.",
  },
  "bid-pack": {
    caption: SAMPLE,
    head: ["Section", "What is in it", "Status"],
    rows: [
      ["Response to criteria", "Draft answers in your voice, built from your answers", "For your review"],
      ["Compliance checklist", "Every mandatory item from the request, ticked or flagged", "Ready"],
      ["Pricing schedule", "Filled from your numbers; you confirm each line", "For your review"],
    ],
    foot: "You review and submit. We never submit for you.",
  },
  "privacy-adm-fix": {
    caption: SAMPLE,
    head: ["Where we looked", "What we found", "Suggested wording"],
    rows: [
      ["Your live privacy policy", "No statement about automated decisions", "A plain paragraph for your lawyer to check"],
      ["Collection notice", "Purpose listed, decision use not listed", "One added sentence"],
    ],
    foot: "General information as we read the Privacy Act amendments, not legal advice. Have your own lawyer approve the final wording.",
  },
  "instant-email-domain-check": {
    caption: SAMPLE,
    head: ["Check", "Result", "What to do"],
    rows: [
      ["SPF record", "Present", "Nothing"],
      ["DMARC policy", "None", "Publish a monitoring record, then tighten"],
      ["Look-alike risk", "UNKNOWN", "Re-run, lookup timed out"],
    ],
    foot: "Public DNS records only. Nothing is scanned or touched.",
  },
  "incumbent-brief": {
    caption: SAMPLE,
    head: ["Question", "Answer in the brief"],
    rows: [
      ["Who holds the contract now?", "Named supplier, with the award notice linked"],
      ["What were they paid?", "Value and date from the public record"],
      ["How has this buyer awarded before?", "Past awards by this buyer, newest first"],
    ],
    foot: "One brief per tender you name. Sources linked on every line.",
  },
  "funder-fit-dossier": {
    caption: SAMPLE,
    head: ["Block", "Source", "Ready to paste"],
    rows: [
      ["Financial story, last three years", "Charity regulator filings", "Yes"],
      ["Funders who gave to similar groups", "Public grant records", "Yes"],
      ["Gaps to explain in the application", "Our reading of the filings", "For you to check"],
    ],
    foot: "Sourced blocks for your own application. You write and submit.",
  },
  "trade-panel-pack": {
    caption: SAMPLE,
    head: ["Panel document", "How we prepare it"],
    rows: [
      ["Capability statement", "Drafted from your answers, one page"],
      ["Insurance and licence schedule", "Laid out for you to attach your certificates"],
      ["Safety and quality summary", "Plain wording from your own processes"],
    ],
    foot: "You review and submit. Nothing is lodged on your behalf.",
  },
  "scam-shield-for-tradies": {
    caption: SAMPLE,
    head: ["Month", "Could someone fake your email?", "Customer notice"],
    rows: [
      ["This month", "Yes, DMARC not set", "Ready to paste into your invoices"],
      ["After the fix", "Much harder, re-checked", "Updated"],
    ],
    foot: "Public records only. Your IT provider or email host keeps control of the changes.",
  },
  "subbie-finder": {
    caption: SAMPLE,
    head: ["Head contractor", "Contract", "Near you", "Why ring now"],
    rows: [
      ["Example Builders Pty Ltd", "Public award notice linked", "Within your area", "Work not yet staffed"],
      ["Sample Civil Group", "Public award notice linked", "Within your area", "Starts soon"],
    ],
    foot: "One email a week. You make the call; we send nothing on your behalf.",
  },
};
