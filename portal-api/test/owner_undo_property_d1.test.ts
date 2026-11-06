// F173: the F95 undo/auto-fix property suite, unchanged, run against D1OwnerStore (FakeD1: real SQLite, real migrations, FKs on).
// node --test gives each file its own process, so setting the env var here cannot leak into the memory run.
process.env.UNDO_STORE = "d1";
await import("./owner_undo_property.test.ts");
