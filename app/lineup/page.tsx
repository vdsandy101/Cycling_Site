import { loadLineupData } from "@/lib/lineup-data";
import RaceDashboard from "./RaceDashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Wielermanager 2026 — Lineup Planner",
};

export default function LineupPage() {
  const races = loadLineupData();
  return <RaceDashboard races={races} />;
}
