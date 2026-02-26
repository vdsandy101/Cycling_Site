"use client";

import { useEffect, useMemo, useState } from "react";

type StatsResponse = {
  totalEntries: number;
  checkedCollections: string[];
  latestEntry: {
    collection: string;
    eventAt: string;
    eventType: "update" | "insert";
    document: Record<string, unknown>;
  } | null;
  collections: Array<{
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
  }>;
  error?: string;
  details?: string;
};

function getEntryLabel(document: Record<string, unknown>) {
  return (
    (document.race_id as string | undefined) ||
    (document.stage_id as string | undefined) ||
    (document.rider_id as string | undefined) ||
    (document.team_id as string | undefined) ||
    "onbekende id"
  );
}

export default function HomePage() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<string>("all");

  useEffect(() => {
    async function loadStats() {
      try {
        const response = await fetch("/api/stats", { cache: "no-store" });
        const result = (await response.json()) as StatsResponse;

        if (!response.ok) {
          throw new Error(result.details || result.error || "Onbekende fout");
        }

        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Onbekende fout");
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  const formattedDate = useMemo(() => {
    if (!data?.latestEntry?.eventAt) return "-";
    return new Date(data.latestEntry.eventAt).toLocaleString("nl-NL", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }, [data]);

  const latestFieldsText = useMemo(() => {
    if (!data?.latestEntry?.document) return "-";
    const fields = Object.entries(data.latestEntry.document)
      .filter(([key]) => ["race_id", "stage_id", "rider_id", "team_id", "race_name", "stage_name", "rider_name", "team_name", "year", "position", "manager_points", "updated_at"].includes(key))
      .slice(0, 12);

    if (!fields.length) return "Geen herkenbare velden";

    return fields
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join("\n");
  }, [data]);

  const formatDate = (value: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleString("nl-NL", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  const filteredCollections = useMemo(() => {
    if (!data?.collections) {
      return [];
    }

    if (selectedCollection === "all") {
      return data.collections;
    }

    return data.collections.filter((item) => item.collection === selectedCollection);
  }, [data, selectedCollection]);

  return (
    <main className="container">
      <h1>Cycling Database Dashboard</h1>

      {loading && <p>Data laden...</p>}

      {error && <p className="error">Kon stats niet ophalen: {error}</p>}

      {!loading && !error && data && (
        <section className="grid">
          <article className="card">
            <h2>Totale entries</h2>
            <p className="value">{data.totalEntries}</p>
          </article>

          <article className="card">
            <h2>Laatst toegevoegde entry</h2>
            {data.latestEntry ? (
              <>
                <p><strong>Collectie:</strong> {data.latestEntry.collection}</p>
                <p><strong>Type:</strong> {data.latestEntry.eventType}</p>
                <p><strong>ID:</strong> {getEntryLabel(data.latestEntry.document)}</p>
                <p><strong>Toegevoegd/updated:</strong> {formattedDate}</p>
                <p><strong>Exacte velden:</strong></p>
                <pre className="fieldsPreview">{latestFieldsText}</pre>
              </>
            ) : (
              <p>Geen entry gevonden.</p>
            )}
          </article>

          <article className="card span2">
            <h2>Per collectie: wat is laatst aangepast?</h2>
            <label className="filterLabel" htmlFor="collection-filter">
              Collectie filter
            </label>
            <select
              id="collection-filter"
              className="collectionSelect"
              value={selectedCollection}
              onChange={(event) => setSelectedCollection(event.target.value)}
            >
              <option value="all">Alle collecties</option>
              {data.collections.map((item) => (
                <option key={item.collection} value={item.collection}>
                  {item.collection}
                </option>
              ))}
            </select>

            {!filteredCollections.length ? (
              <p>Geen collectie-data gevonden.</p>
            ) : (
              <div className="collectionList">
                {filteredCollections.map((item) => (
                  <div key={item.collection} className="collectionItem">
                    <p><strong>{item.collection}</strong> ({item.count} entries)</p>
                    <p>Laatste type: {item.latestEventType}</p>
                    <p>Laatste update: {formatDate(item.latestUpdatedAt)}</p>
                    <p>Laatste insert: {formatDate(item.latestInsertedAt)}</p>
                    <p>Document ID: {item.latestDocumentId}</p>
                    <pre className="fieldsPreview">
                      {Object.entries(item.latestFields).length
                        ? Object.entries(item.latestFields).map(([key, value]) => `${key}: ${String(value)}`).join("\n")
                        : "Geen veld-preview"}
                    </pre>
                    <p><strong>Recent changes:</strong></p>
                    {!item.recentChanges.length ? (
                      <p>Geen recente changes gevonden.</p>
                    ) : (
                      <div className="changesList">
                        {item.recentChanges.map((change) => (
                          <div key={`${change.documentId}-${change.eventType}-${change.eventAt}`} className="changeItem">
                            <p>Type: {change.eventType}</p>
                            <p>Tijd: {formatDate(change.eventAt)}</p>
                            <p>Doc: {change.documentId}</p>
                            <pre className="fieldsPreview">
                              {Object.entries(change.fields).length
                                ? Object.entries(change.fields).map(([key, value]) => `${key}: ${String(value)}`).join("\n")
                                : "Geen veld-preview"}
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>
      )}
    </main>
  );
}
