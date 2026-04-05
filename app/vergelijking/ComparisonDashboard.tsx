"use client";

import { useState } from "react";
import type { ComparisonData, ComparisonRace, OwnerRaceData } from "@/lib/comparison-data";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function badgeClass(type: string): string {
  switch (type) {
    case "monument":
      return "badge badge-monument";
    case "wt":
      return "badge badge-wt";
    default:
      return "badge badge-nwt";
  }
}

function formatDate(d: string): string {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("nl-BE", { day: "numeric", month: "short" });
}

/** Find the max count across all owners in a race */
function maxCount(race: ComparisonRace): number {
  return Math.max(...race.owners.map((o) => o.count), 0);
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function OwnerSummaryCard({ name, total, rank }: { name: string; total: number; rank: number }) {
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "";
  return (
    <div className={`comp-summary-card ${rank === 1 ? "comp-summary-leader" : ""}`}>
      <span className="comp-summary-rank">{medal || `#${rank}`}</span>
      <span className="comp-summary-name">{name}</span>
      <span className="comp-summary-total">{total} renners</span>
    </div>
  );
}

function RaceRow({
  race,
  isExpanded,
  onToggle,
}: {
  race: ComparisonRace;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const max = maxCount(race);

  return (
    <>
      <tr
        className={`comp-row ${race.is_past ? "comp-row-past" : ""} ${race.is_today ? "comp-row-today" : ""}`}
        onClick={onToggle}
        style={{ cursor: "pointer" }}
      >
        <td className="comp-cell-race">
          <span className={badgeClass(race.race_type)}>{race.race_type === "monument" ? "M" : race.race_type === "wt" ? "WT" : "NWT"}</span>
          <span className="comp-race-name">{race.race_name}</span>
          <span className="comp-race-date">{formatDate(race.race_date)}</span>
        </td>
        {race.owners.map((o) => (
          <td
            key={o.name}
            className={`comp-cell-count ${o.count === max && max > 0 ? "comp-cell-best" : ""} ${o.count === 0 ? "comp-cell-zero" : ""}`}
          >
            {o.count}
          </td>
        ))}
        <td className="comp-cell-expand">{isExpanded ? "▲" : "▼"}</td>
      </tr>
      {isExpanded && (
        <tr className="comp-detail-row">
          <td colSpan={race.owners.length + 2}>
            <div className="comp-detail-grid">
              {race.owners.map((o) => (
                <OwnerRiderList key={o.name} owner={o} isBest={o.count === max && max > 0} />
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function OwnerRiderList({ owner, isBest }: { owner: OwnerRaceData; isBest: boolean }) {
  return (
    <div className={`comp-rider-list ${isBest ? "comp-rider-list-best" : ""}`}>
      <h4>
        {owner.name} <span className="comp-rider-count">({owner.count})</span>
      </h4>
      {owner.riders.length === 0 ? (
        <p className="comp-no-riders">Geen renners</p>
      ) : (
        <ul>
          {owner.riders.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function ComparisonDashboard({ data }: { data: ComparisonData }) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  if (data.races.length === 0) {
    return <p style={{ padding: "2rem", textAlign: "center" }}>Geen vergelijkingsdata beschikbaar.</p>;
  }

  const toggleRow = (idx: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // Sort owners by total descending for the summary
  const ranked = [...data.owners]
    .map((name) => ({ name, total: data.totals[name] ?? 0 }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="comp-dashboard">
      <h1 className="comp-title">Vergelijking — Wielermanager 2026</h1>
      <p className="comp-subtitle">Renners per race op basis van PCS startlijsten</p>

      {/* Summary cards */}
      <div className="comp-summary-bar">
        {ranked.map((o, i) => (
          <OwnerSummaryCard key={o.name} name={o.name} total={o.total} rank={i + 1} />
        ))}
      </div>

      {/* Comparison table */}
      <div className="comp-table-wrap">
        <table className="comp-table">
          <thead>
            <tr>
              <th className="comp-th-race">Race</th>
              {data.owners.map((name) => (
                <th key={name} className="comp-th-owner">
                  {name}
                </th>
              ))}
              <th className="comp-th-expand"></th>
            </tr>
          </thead>
          <tbody>
            {data.races.map((race, idx) => (
              <RaceRow
                key={race.race_date + race.race_name}
                race={race}
                isExpanded={expandedRows.has(idx)}
                onToggle={() => toggleRow(idx)}
              />
            ))}
          </tbody>
          <tfoot>
            <tr className="comp-footer-row">
              <td className="comp-cell-race"><strong>Totaal</strong></td>
              {data.owners.map((name) => (
                <td key={name} className="comp-cell-count comp-cell-total">
                  <strong>{data.totals[name]}</strong>
                </td>
              ))}
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
