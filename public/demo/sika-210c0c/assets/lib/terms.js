// Wording required wherever a quantity or quote is shown (the client's terms of sale: descriptions are approximate, the data sheet carries the binding conditions).
export const estimateNote = (cfg) => `Estimate only, not an offer. Quantities, not prices. Confirm with the product data sheet and ${cfg && cfg.company ? cfg.company.short : 'the company'} Technical Services before ordering.`;
