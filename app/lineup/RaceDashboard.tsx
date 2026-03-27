"use client";

import { useState } from "react";
import type { RaceCard, SwapAction, LineupRider } from "@/lib/lineup-data";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function raceTypeBadgeClass(type: string): string {
  if (type === "Monument") return "badge badge-monument";
  if (type === "World Tour") return "badge badge-wt";
  return "badge badge-nwt";
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

function timeLabel(race: RaceCard): string {
  if (race.is_today) return "TODAY";
  if (race.is_past) return "Completed";
  const d = daysUntil(race.race_date);
  if (d === 1) return "Tomorrow";
  return `In ${d} days`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SwapBadge({ swap }: { swap: SwapAction }) {
  const isIn = swap.direction === "to_starter";
  return (
    <div className={`swap-row ${isIn ? "swap-in" : "swap-out"}`}>
      <span className="swap-icon">{isIn ? "↗" : "↘"}</span>
      <span className="swap-rider">{swap.rider_name}</span>
      <span className="swap-team">{swap.team_name}</span>
      <span className="swap-label">
        → {isIn ? "STARTERS" : "BUS"}
      </span>
    </div>
  );
}

function RiderRow({ rider, idx }: { rider: LineupRider; idx: number }) {
  return (
    <tr className={rider.is_racing ? "rider-racing" : "rider-idle"}>
      <td className="rider-idx">{idx}</td>
      <td className="rider-status">
        {rider.is_racing ? (
          <span className="dot dot-racing" title="Racing" />
        ) : (
          <span className="dot dot-idle" title="Not racing" />
        )}
      </td>
      <td className="rider-name">
        {rider.rider_name}
        {rider.original_role === "bus" && rider.is_racing && (
          <span className="from-bus-tag">bus</span>
        )}
      </td>
      <td className="rider-team">{rider.team_name}</td>
      <td className="rider-score">{rider.predicted_score.toFixed(1)}</td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Race card
// ---------------------------------------------------------------------------

function RaceCardView({
  race,
  isExpanded,
  onToggle,
  previousRaceName,
}: {
  race: RaceCard;
  isExpanded: boolean;
  onToggle: () => void;
  previousRaceName: string | null;
}) {
  const swapsIn = race.swaps.filter((s) => s.direction === "to_starter");
  const swapsOut = race.swaps.filter((s) => s.direction === "to_bus");
  const hasSwaps = race.swaps.length > 0;
  const racingStarters = race.starters.filter((r) => r.is_racing).length;

  return (
    <div
      className={`race-card ${race.is_today ? "race-today" : ""} ${race.is_past ? "race-past" : ""}`}
    >
      {/* Header — always visible */}
      <button className="race-header" onClick={onToggle} type="button">
        <div className="race-header-left">
          <span className={raceTypeBadgeClass(race.race_type)}>
            {race.race_type === "Niet WorldTour" ? "Non-WT" : race.race_type}
          </span>
          <h3 className="race-name">{race.race_name}</h3>
        </div>
        <div className="race-header-right">
          <span className="race-date">{formatDate(race.race_date)}</span>
          <span
            className={`race-time ${race.is_today ? "race-time-today" : ""}`}
          >
            {timeLabel(race)}
          </span>
          <span className="race-racing-count">
            {racingStarters}/{race.starters.length} racing
          </span>
          {hasSwaps && (
            <span className="race-swap-count">{race.swaps.length} swaps</span>
          )}
          <span className="expand-arrow">{isExpanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="race-body">
          {/* Swaps section */}
          {hasSwaps ? (
            <div className="swaps-section">
              <h4 className="swaps-title">
                Swaps
                {previousRaceName ? (
                  <span className="swaps-ref"> vs {previousRaceName}</span>
                ) : (
                  <span className="swaps-ref"> vs original squad</span>
                )}
              </h4>
              <div className="swaps-grid">
                {swapsIn.length > 0 && (
                  <div className="swaps-col">
                    <div className="swaps-col-header swaps-col-in">
                      Move to Starters
                    </div>
                    {swapsIn.map((s) => (
                      <SwapBadge key={s.rider_name} swap={s} />
                    ))}
                  </div>
                )}
                {swapsOut.length > 0 && (
                  <div className="swaps-col">
                    <div className="swaps-col-header swaps-col-out">
                      Move to Bus
                    </div>
                    {swapsOut.map((s) => (
                      <SwapBadge key={s.rider_name} swap={s} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="swaps-section swaps-none">
              <span>No changes needed</span>
              {previousRaceName && (
                <span className="swaps-ref"> — same setup as {previousRaceName}</span>
              )}
            </div>
          )}

          {/* Starters table */}
          <div className="lineup-section">
            <h4>
              Starters
              <span className="lineup-count">
                ({racingStarters} racing · {race.starters.length - racingStarters} idle)
              </span>
            </h4>
            <table className="rider-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th></th>
                  <th>Rider</th>
                  <th>Team</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {race.starters.map((r, i) => (
                  <RiderRow key={r.rider_slug} rider={r} idx={i + 1} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Bus table */}
          <details className="bus-details">
            <summary>
              Bus ({race.bus.length})
            </summary>
            <table className="rider-table rider-table-bus">
              <thead>
                <tr>
                  <th>#</th>
                  <th></th>
                  <th>Rider</th>
                  <th>Team</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {race.bus.map((r, i) => (
                  <RiderRow key={r.rider_slug} rider={r} idx={i + 1} />
                ))}
              </tbody>
            </table>
          </details>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------

interface Props {
  races: RaceCard[];
}

export default function RaceDashboard({ races }: Props) {
  const activeIdx = races.findIndex((r) => !r.is_past);
  const [expandedDate, setExpandedDate] = useState<string | null>(
    activeIdx >= 0 ? races[activeIdx].race_date : races[0]?.race_date ?? null,
  );

  const totalSwaps = races.reduce((sum, r) => sum + r.swaps.length, 0);
  const futureRaces = races.filter((r) => !r.is_past);

  return (
    <div className="lineup-dashboard">
      <header className="lineup-header">
        <h1>Wielermanager 2026</h1>
        <p className="lineup-subtitle">Race Lineup Planner</p>
      </header>

      {/* Summary bar */}
      <div className="summary-bar">
        <div className="summary-stat">
          <span className="summary-value">{races.length}</span>
          <span className="summary-label">Races</span>
        </div>
        <div className="summary-stat">
          <span className="summary-value">{futureRaces.length}</span>
          <span className="summary-label">Remaining</span>
        </div>
        <div className="summary-stat">
          <span className="summary-value">{totalSwaps}</span>
          <span className="summary-label">Total Swaps</span>
        </div>
        <div className="summary-stat">
          <span className="summary-value">12 / 8</span>
          <span className="summary-label">Starters / Bus</span>
        </div>
      </div>

      {/* Race cards */}
      <div className="race-list">
        {races.map((race, idx) => (
          <RaceCardView
            key={race.race_date}
            race={race}
            isExpanded={expandedDate === race.race_date}
            onToggle={() =>
              setExpandedDate((prev) =>
                prev === race.race_date ? null : race.race_date,
              )
            }
            previousRaceName={idx > 0 ? races[idx - 1].race_name : null}
          />
        ))}
      </div>
    </div>
  );
}
