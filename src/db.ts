import { mkdirSync } from "node:fs";

import Database from "better-sqlite3";

mkdirSync("data", { recursive: true });

const db = new Database("data/stats.db");
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS totals (
    id               INTEGER PRIMARY KEY CHECK (id = 1),
    farm             INTEGER NOT NULL DEFAULT 0,
    farmAttempts     INTEGER NOT NULL DEFAULT 0,
    farmSuccesses    INTEGER NOT NULL DEFAULT 0,
    steal            INTEGER NOT NULL DEFAULT 0,
    stealAttempts    INTEGER NOT NULL DEFAULT 0,
    stealSuccesses   INTEGER NOT NULL DEFAULT 0,
    rankups          INTEGER NOT NULL DEFAULT 0,
    prestiges        INTEGER NOT NULL DEFAULT 0
  );
  INSERT OR IGNORE INTO totals (id) VALUES (1);

  CREATE TABLE IF NOT EXISTS daily (
    date             TEXT    NOT NULL PRIMARY KEY,
    farm             INTEGER NOT NULL DEFAULT 0,
    farmAttempts     INTEGER NOT NULL DEFAULT 0,
    farmSuccesses    INTEGER NOT NULL DEFAULT 0,
    steal            INTEGER NOT NULL DEFAULT 0,
    stealAttempts    INTEGER NOT NULL DEFAULT 0,
    stealSuccesses   INTEGER NOT NULL DEFAULT 0,
    rankups          INTEGER NOT NULL DEFAULT 0,
    prestiges        INTEGER NOT NULL DEFAULT 0
  );
`);

export interface StatsRow {
  farm: number;
  farmAttempts: number;
  farmSuccesses: number;
  steal: number;
  stealAttempts: number;
  stealSuccesses: number;
  rankups: number;
  prestiges: number;
}

export const ZERO_STATS: StatsRow = {
  farm: 0,
  farmAttempts: 0,
  farmSuccesses: 0,
  steal: 0,
  stealAttempts: 0,
  stealSuccesses: 0,
  rankups: 0,
  prestiges: 0,
};

const updateTotals = db.prepare(`
  UPDATE totals SET
    farm             = farm             + @farm,
    farmAttempts     = farmAttempts     + @farmAttempts,
    farmSuccesses    = farmSuccesses    + @farmSuccesses,
    steal            = steal            + @steal,
    stealAttempts    = stealAttempts    + @stealAttempts,
    stealSuccesses   = stealSuccesses   + @stealSuccesses,
    rankups          = rankups          + @rankups,
    prestiges        = prestiges        + @prestiges
  WHERE id = 1
`);

const upsertDaily = db.prepare(`
  INSERT INTO daily (date, farm, farmAttempts, farmSuccesses, steal, stealAttempts, stealSuccesses, rankups, prestiges)
  VALUES (@date, @farm, @farmAttempts, @farmSuccesses, @steal, @stealAttempts, @stealSuccesses, @rankups, @prestiges)
  ON CONFLICT(date) DO UPDATE SET
    farm             = farm             + excluded.farm,
    farmAttempts     = farmAttempts     + excluded.farmAttempts,
    farmSuccesses    = farmSuccesses    + excluded.farmSuccesses,
    steal            = steal            + excluded.steal,
    stealAttempts    = stealAttempts    + excluded.stealAttempts,
    stealSuccesses   = stealSuccesses   + excluded.stealSuccesses,
    rankups          = rankups          + excluded.rankups,
    prestiges        = prestiges        + excluded.prestiges
`);

export function record(d: StatsRow): void {
  const date = new Date().toISOString().slice(0, 10);
  updateTotals.run(d);
  upsertDaily.run({ ...d, date });
}

const getTotalsStmt = db.prepare(
  "SELECT farm, farmAttempts, farmSuccesses, steal, stealAttempts, stealSuccesses, rankups, prestiges FROM totals WHERE id = 1",
);
const getDailyStmt = db.prepare(
  "SELECT farm, farmAttempts, farmSuccesses, steal, stealAttempts, stealSuccesses, rankups, prestiges FROM daily WHERE date = ?",
);

export function getTotals(): StatsRow {
  return (getTotalsStmt.get() as StatsRow | undefined) ?? { ...ZERO_STATS };
}

export function getToday(): StatsRow {
  const date = new Date().toISOString().slice(0, 10);
  return (getDailyStmt.get(date) as StatsRow | undefined) ?? { ...ZERO_STATS };
}

process.on("exit", () => {
  db.close();
});
