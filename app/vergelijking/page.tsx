import { loadComparisonData } from "@/lib/comparison-data";
import ComparisonDashboard from "./ComparisonDashboard";

export const dynamic = "force-dynamic";

export default function VergelijkingPage() {
  const data = loadComparisonData();
  return <ComparisonDashboard data={data} />;
}
