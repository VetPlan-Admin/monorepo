import type { Metadata } from "next";
import { RadiographPlanner } from "@/components/canvas/radiograph-planner";

export const metadata: Metadata = {
  title: "Surgical planner · Vet Plan",
};

export default function PlannerPage() {
  return <RadiographPlanner />;
}
