import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComparisonRace {
  race_date: string;
  race_name: string;
  race_type: string;
  is_today: boolean;
  is_past: boolean;
  owners: OwnerRaceData[];
}

export interface OwnerRaceData {
  name: string;
  count: number;
  riders: string[];
}

export interface ComparisonData {
  owners: string[];
  races: ComparisonRace[];
  totals: Record<string, number>;
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

function parseLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    const record: Record<string, string> = {};
    headers.forEach((h, i) => {
      record[h] = values[i] ?? "";
    });
    return record;
  });
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

function getDataDir(): string {
  if (process.env.LINEUP_DATA_DIR) return process.env.LINEUP_DATA_DIR;
  return path.join(process.cwd(), "data");
}

/**
 * Load Andy's per-race racing riders from race_lineups_2026.csv (same source
 * as the Lineup Planner). Returns a map: race_name → rider_name[].
 * Only riders with assignment === "starter" are counted as racing.
 */
function loadAndyLineupPlan(dataDir: string): Map<string, string[]> {
  const lineupPath = path.join(dataDir, "race_lineups_2026.csv");
  if (!fs.existsSync(lineupPath)) return new Map();

  const rows = parseCSV(fs.readFileSync(lineupPath, "utf-8"));
  const raceRiders = new Map<string, string[]>();

  for (const row of rows) {
    const raceName = row.race_name;
    const riderName = row.rider_name;
    const assignment = row.role_race; // "starter" or "bench"
    if (assignment === "starter" && raceName && riderName) {
      if (!raceRiders.has(raceName)) raceRiders.set(raceName, []);
      raceRiders.get(raceName)!.push(riderName);
    }
  }

  return raceRiders;
}

export function loadComparisonData(): ComparisonData {
  const dataDir = getDataDir();
  const csvPath = path.join(dataDir, "squad_comparison_2026.csv");

  if (!fs.existsSync(csvPath)) {
    return { owners: [], races: [], totals: {} };
  }

  const rows = parseCSV(fs.readFileSync(csvPath, "utf-8"));
  if (rows.length === 0) {
    return { owners: [], races: [], totals: {} };
  }

  // Discover owner names from column headers (e.g., "Andy_count", "Tom_count")
  const owners: string[] = [];
  const sampleHeaders = Object.keys(rows[0]);
  for (const h of sampleHeaders) {
    if (h.endsWith("_count")) {
      owners.push(h.replace("_count", ""));
    }
  }

  // Load Andy's lineup plan so his data matches the Lineup Planner tab
  const andyLineup = loadAndyLineupPlan(dataDir);

  const today = new Date().toISOString().split("T")[0];
  const totals: Record<string, number> = {};
  for (const owner of owners) totals[owner] = 0;

  const races: ComparisonRace[] = rows.map((row) => {
    const ownerData: OwnerRaceData[] = owners.map((owner) => {
      // For Andy: use the lineup plan data (consistent with Lineup Planner)
      if (owner === "Andy" && andyLineup.has(row.race_name)) {
        const riders = andyLineup.get(row.race_name)!;
        const count = riders.length;
        totals[owner] += count;
        return { name: owner, count, riders };
      }
      const count = parseInt(row[`${owner}_count`] || "0", 10);
      const ridersStr = row[`${owner}_riders`] || "";
      const riders = ridersStr ? ridersStr.split("|") : [];
      totals[owner] += count;
      return { name: owner, count, riders };
    });

    return {
      race_date: row.race_date,
      race_name: row.race_name,
      race_type: row.race_type,
      is_today: row.race_date === today,
      is_past: row.race_date < today,
      owners: ownerData,
    };
  });

  return { owners, races, totals };
}
