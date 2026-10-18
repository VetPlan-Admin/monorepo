import { useLocalSearchParams } from "expo-router";
import { CaseDetailScreen } from "@vet-plan/app";

export default function CaseDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // The radiograph planner and report download are web-only for now
  return <CaseDetailScreen caseId={id} />;
}
