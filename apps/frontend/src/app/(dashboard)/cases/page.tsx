import type { Metadata } from "next";
import { CasesScreen } from "@vet-plan/app";

export const metadata: Metadata = {
  title: "Cases · Vet Plan",
};

export default function CasesPage() {
  return <CasesScreen />;
}
