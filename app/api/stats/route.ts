import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongo";

type LatestCandidate = {
  collection: string;
  updatedAt: string;
  document: Record<string, unknown>;
};

const collectionNames = [
  process.env.MONGODB_RACES_COLLECTION || "races",
  process.env.MONGODB_STAGES_COLLECTION || "stages",
  process.env.MONGODB_RIDERS_COLLECTION || "riders",
  process.env.MONGODB_TEAMS_COLLECTION || "teams",
  process.env.MONGODB_RACE_RESULTS_COLLECTION || "race_results",
  process.env.MONGODB_STAGE_RESULTS_COLLECTION || "stage_results",
  process.env.MONGODB_STARTLISTS_COLLECTION || "startlists",
];

function toTimestamp(value: unknown): number {
  if (!value) return 0;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export async function GET() {
  try {
    const db = await getDb();

    let totalEntries = 0;
    let latest: LatestCandidate | null = null;

    for (const name of collectionNames) {
      const col = db.collection(name);
      const count = await col.countDocuments();
      totalEntries += count;

      const latestDoc = await col.findOne({}, { sort: { updated_at: -1 } });
      const updatedAt = latestDoc?.updated_at ? String(latestDoc.updated_at) : "";

      if (!latestDoc || !updatedAt) {
        continue;
      }

      const candidate: LatestCandidate = {
        collection: name,
        updatedAt,
        document: latestDoc as Record<string, unknown>,
      };

      if (!latest || toTimestamp(candidate.updatedAt) > toTimestamp(latest.updatedAt)) {
        latest = candidate;
      }
    }

    return NextResponse.json({
      totalEntries,
      latestEntry: latest,
      checkedCollections: collectionNames,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Could not load stats",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
