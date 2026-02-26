"use client";

import { useEffect, useMemo, useState } from "react";

type StatsResponse = {
  totalEntries: number;
  checkedCollections: string[];
  latestEntry: {
    collection: string;
    updatedAt: string;
    document: Record<string, unknown>;
  } | null;
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
    if (!data?.latestEntry?.updatedAt) return "-";
    return new Date(data.latestEntry.updatedAt).toLocaleString("nl-NL", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }, [data]);

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
                <p><strong>ID:</strong> {getEntryLabel(data.latestEntry.document)}</p>
                <p><strong>Toegevoegd/updated:</strong> {formattedDate}</p>
              </>
            ) : (
              <p>Geen entry gevonden.</p>
            )}
          </article>
        </section>
      )}
    </main>
  );
}
