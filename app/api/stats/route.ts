import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongo";

type LatestCandidate = {
  collection: string;
  eventAt: string;
  eventType: "update" | "insert";
  document: Record<string, unknown>;
};

type CollectionDetail = {
  collection: string;
  count: number;
  latestUpdatedAt: string | null;
  latestInsertedAt: string | null;
  latestDocumentId: string;
  latestEventType: "update" | "insert" | "unknown";
  latestFields: Record<string, unknown>;
  recentChanges: Array<{
    eventAt: string;
    eventType: "update" | "insert";
    documentId: string;
    fields: Record<string, unknown>;
  }>;
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

function toIsoOrNull(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function objectIdTimestamp(value: unknown): string | null {
  const raw = String(value || "");
  if (!/^[a-f\d]{24}$/i.test(raw)) {
    return null;
  }
  const seconds = Number.parseInt(raw.slice(0, 8), 16);
  if (Number.isNaN(seconds)) {
    return null;
  }
  return new Date(seconds * 1000).toISOString();
}

function pickLatestFields(document: Record<string, unknown>): Record<string, unknown> {
  const preferredKeys = [
    "race_id",
    "stage_id",
    "rider_id",
    "team_id",
    "race_name",
    "stage_name",
    "rider_name",
    "team_name",
    "year",
    "position",
    "manager_points",
    "updated_at",
  ];

  const out: Record<string, unknown> = {};
  for (const key of preferredKeys) {
    if (key in document) {
      out[key] = document[key];
    }
  }

  if (!Object.keys(out).length) {
    for (const [key, value] of Object.entries(document)) {
      if (key === "_id") {
        continue;
      }
      if (typeof value === "object" && value !== null) {
        out[key] = "[object]";
      } else {
        out[key] = value;
      }
      if (Object.keys(out).length >= 12) {
        break;
      }
    }
  }

  return out;
}

export async function GET() {
  try {
    const db = await getDb();

    let totalEntries = 0;
    let latest: LatestCandidate | null = null;
    const collections: CollectionDetail[] = [];

    for (const name of collectionNames) {
      const col = db.collection(name);
      const count = await col.countDocuments();
      totalEntries += count;

      const latestUpdatedDoc = await col.findOne({}, { sort: { updated_at: -1 } });
      const latestInsertedDoc = await col.findOne({}, { sort: { _id: -1 } });

      const latestUpdatedAt = toIsoOrNull(latestUpdatedDoc?.updated_at);
      const latestInsertedAt = objectIdTimestamp(latestInsertedDoc?._id);
      const latestDoc = latestUpdatedDoc ?? latestInsertedDoc;
      const latestDocumentId = latestDoc?._id ? String(latestDoc._id) : "-";

      const recentUpdatedDocs = await col.find({}, { sort: { updated_at: -1 }, limit: 5 }).toArray();
      const recentInsertedDocs = await col.find({}, { sort: { _id: -1 }, limit: 5 }).toArray();

      const recentChangesByKey = new Map<string, {
        eventAt: string;
        eventType: "update" | "insert";
        documentId: string;
        fields: Record<string, unknown>;
      }>();

      for (const doc of recentUpdatedDocs) {
        const eventAt = toIsoOrNull(doc?.updated_at);
        if (!eventAt) {
          continue;
        }
        const documentId = doc?._id ? String(doc._id) : "-";
        recentChangesByKey.set(`${documentId}:update`, {
          eventAt,
          eventType: "update",
          documentId,
          fields: pickLatestFields(doc as Record<string, unknown>),
        });
      }

      for (const doc of recentInsertedDocs) {
        const eventAt = objectIdTimestamp(doc?._id);
        if (!eventAt) {
          continue;
        }
        const documentId = doc?._id ? String(doc._id) : "-";
        recentChangesByKey.set(`${documentId}:insert`, {
          eventAt,
          eventType: "insert",
          documentId,
          fields: pickLatestFields(doc as Record<string, unknown>),
        });
      }

      const recentChanges = Array.from(recentChangesByKey.values())
        .sort((a, b) => toTimestamp(b.eventAt) - toTimestamp(a.eventAt))
        .slice(0, 8);

      const latestEventType: "update" | "insert" | "unknown" = latestUpdatedAt
        ? "update"
        : latestInsertedAt
          ? "insert"
          : "unknown";

      collections.push({
        collection: name,
        count,
        latestUpdatedAt,
        latestInsertedAt,
        latestDocumentId,
        latestEventType,
        latestFields: latestDoc ? pickLatestFields(latestDoc as Record<string, unknown>) : {},
        recentChanges,
      });

      const eventAt = latestUpdatedAt || latestInsertedAt;
      if (!latestDoc || !eventAt) {
        continue;
      }

      const candidate: LatestCandidate = {
        collection: name,
        eventAt,
        eventType: latestUpdatedAt ? "update" : "insert",
        document: latestDoc as Record<string, unknown>,
      };

      if (!latest || toTimestamp(candidate.eventAt) > toTimestamp(latest.eventAt)) {
        latest = candidate;
      }
    }

    return NextResponse.json({
      totalEntries,
      latestEntry: latest,
      collections,
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
