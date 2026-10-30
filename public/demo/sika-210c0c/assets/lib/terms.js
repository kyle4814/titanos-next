// Wording required wherever a quantity or quote is shown (the client's terms of sale: descriptions are approximate, the data sheet carries the binding conditions).
export const estimateNote = (cfg) => `This is an estimate, not an offer. It gives quantities only. Confirm with the product data sheet and ${cfg && cfg.company ? cfg.company.short : 'the company'} Technical Services.`;
