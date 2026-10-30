// csv.js: the rule ledger CSV builder. Pure functions, no DOM, so the node tests run the same code the browser runs.
export const COLUMNS = ['id', 'product_id', 'product', 'type', 'rule', 'quote', 'source_url', 'source_page', 'read_date', 'status', 'signed_by', 'signed_on', 'comment'];
export const toCsv = (rows) => { const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"'; return [COLUMNS.join(',')].concat(rows.map((r) => COLUMNS.map((c) => q(r[c])).join(','))).join('\r\n') + '\r\n'; };
