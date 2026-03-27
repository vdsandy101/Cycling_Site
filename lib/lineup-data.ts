import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LineupRider {
  rider_name: string;
  rider_slug: string;
  team_name: string;
  predicted_score: number;
  original_role: "starter" | "bus";
  is_racing: boolean;
}

export interface SwapAction {
  rider_name: string;
  team_name: string;
  direction: "to_starter" | "to_bus";
}

export interface RaceCard {
  race_date: string;
  race_name: string;
  race_type: string;
  is_today: boolean;
  is_past: boolean;
  starters: LineupRider[];
  bus: LineupRider[];
  swaps: SwapAction[];
  total_racing: number;
}

// ---------------------------------------------------------------------------
// CSV parsing (handles quoted fields with commas)
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
// Data loading + sequential diff computation
// ---------------------------------------------------------------------------

function getDataDir(): string {
  if (process.env.LINEUP_DATA_DIR) return process.env.LINEUP_DATA_DIR;
  return path.join(process.cwd(), "data");
}

export function loadLineupData(): RaceCard[] {
  const dataDir = getDataDir();

  const squadCSV = fs.readFileSync(
    path.join(dataDir, "my_squad.csv"),
    "utf-8",
  );
  const lineupCSV = fs.readFileSync(
    path.join(dataDir, "race_lineups_2026.csv"),
    "utf-8",
  );

  const squadRows = parseCSV(squadCSV);
  const lineupRows = parseCSV(lineupCSV);

  // Squad lookup by slug
  const squadMap = new Map(
    squadRows.map((r) => [
      r.rider_slug,
      {
        rider_name: r.rider_name,
        rider_slug: r.rider_slug,
        team_name: r.team_name,
        predicted_score: parseFloat(r.predicted_score) || 0,
        role: r.role as "starter" | "bus",
      },
    ]),
  );

  // Group lineup rows by race_date (preserves insertion order)
  const raceGroups = new Map<string, Record<string, string>[]>();
  for (const row of lineupRows) {
    const key = row.race_date;
    if (!raceGroups.has(key)) raceGroups.set(key, []);
    raceGroups.get(key)!.push(row);
  }

  const today = new Date().toISOString().split("T")[0];

  // Track the 12 "starter-slot" rider slugs across races (sequential)
  let currentStarters = new Set(
    squadRows.filter((r) => r.role === "starter").map((r) => r.rider_slug),
  );

  const raceCards: RaceCard[] = [];

  for (const [raceDate, rows] of raceGroups) {
    const meta = rows[0];

    // Riders who are ON the startlist (role_race = "starter" in the CSV)
    const racingSet = new Set(
      rows.filter((r) => r.role_race === "starter").map((r) => r.rider_slug),
    );

    const allSlugs = rows.map((r) => r.rider_slug);
    const scoreMap = new Map(
      rows.map((r) => [r.rider_slug, parseFloat(r.predicted_score) || 0]),
    );
    const riderInfo = new Map(rows.map((r) => [r.rider_slug, r]));

    // ---------------------------------------------------------------
    // Compute the optimal 12 starters for this race
    // Rule: all racing riders must be in starters (earn points).
    //       Fill remaining slots with non-racing riders, preferring
    //       those already in starters (minimises physical swaps).
    // ---------------------------------------------------------------
    const optimal = new Set<string>();

    for (const slug of racingSet) optimal.add(slug);

    // Edge case: >12 racing riders — keep top 12 by score
    if (optimal.size > 12) {
      const sorted = [...optimal].sort(
        (a, b) => (scoreMap.get(b) || 0) - (scoreMap.get(a) || 0),
      );
      optimal.clear();
      sorted.slice(0, 12).forEach((s) => optimal.add(s));
    }

    // Fill remaining slots
    if (optimal.size < 12) {
      const nonRacing = allSlugs
        .filter((s) => !racingSet.has(s))
        .sort((a, b) => {
          // Prefer riders already in starters (fewer physical swaps)
          const aIn = currentStarters.has(a) ? 0 : 1;
          const bIn = currentStarters.has(b) ? 0 : 1;
          if (aIn !== bIn) return aIn - bIn;
          return (scoreMap.get(b) || 0) - (scoreMap.get(a) || 0);
        });
      for (const slug of nonRacing) {
        if (optimal.size >= 12) break;
        optimal.add(slug);
      }
    }

    // ---------------------------------------------------------------
    // Sequential diff: what changed vs last race's 12 starters?
    // ---------------------------------------------------------------
    const swaps: SwapAction[] = [];

    for (const slug of currentStarters) {
      if (!optimal.has(slug)) {
        const info = riderInfo.get(slug);
        swaps.push({
          rider_name: info?.rider_name || slug,
          team_name: info?.team_name || "",
          direction: "to_bus",
        });
      }
    }
    for (const slug of optimal) {
      if (!currentStarters.has(slug)) {
        const info = riderInfo.get(slug);
        swaps.push({
          rider_name: info?.rider_name || slug,
          team_name: info?.team_name || "",
          direction: "to_starter",
        });
      }
    }

    // ---------------------------------------------------------------
    // Build rider lists for UI
    // ---------------------------------------------------------------
    const buildRider = (slug: string): LineupRider => {
      const info = riderInfo.get(slug);
      const sq = squadMap.get(slug);
      return {
        rider_name: info?.rider_name || sq?.rider_name || slug,
        rider_slug: slug,
        team_name: info?.team_name || sq?.team_name || "",
        predicted_score: scoreMap.get(slug) || sq?.predicted_score || 0,
        original_role: (sq?.role || "starter") as "starter" | "bus",
        is_racing: racingSet.has(slug),
      };
    };

    const starters = [...optimal]
      .map(buildRider)
      .sort((a, b) => {
        if (a.is_racing !== b.is_racing) return a.is_racing ? -1 : 1;
        return b.predicted_score - a.predicted_score;
      });

    const bus = allSlugs
      .filter((s) => !optimal.has(s))
      .map(buildRider)
      .sort((a, b) => b.predicted_score - a.predicted_score);

    raceCards.push({
      race_date: raceDate,
      race_name: meta.race_name,
      race_type: meta.race_type,
      is_today: raceDate === today,
      is_past: raceDate < today,
      starters,
      bus,
      swaps,
      total_racing: racingSet.size,
    });

    // Advance sequential tracker
    currentStarters = new Set(optimal);
  }

  return raceCards;
}
