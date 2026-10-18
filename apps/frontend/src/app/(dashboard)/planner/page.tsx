import { Suspense } from "react";
import type { Metadata } from "next";
import { RadiographPlanner } from "@/components/canvas/radiograph-planner";

export const metadata: Metadata = {
  title: "Surgical planner · Vet Plan",
};

export default function PlannerPage() {
  // The planner reads ?case= and ?plan= (useSearchParams), which needs a Suspense boundary
  return (
    <Suspense fallback={<div className="h-dvh bg-neutral-950" />}>
      <RadiographPlanner />
    </Suspense>
  );
}
