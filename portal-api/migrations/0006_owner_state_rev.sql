-- F185 (C3 undo state CAS). ADDITIVE only. NOT applied anywhere (GATE5). Numbered above 0005_owner_d1.
-- A per-domain state revision: the owner engine writes with UPDATE ... WHERE rev = ? so two Worker isolates cannot lose each other's update.
-- Existing rows start at 0; the code treats 0 as "never CAS-written". SQLite/D1 ADD COLUMN with a constant default is metadata-only.
ALTER TABLE owner_state ADD COLUMN rev INTEGER NOT NULL DEFAULT 0;
