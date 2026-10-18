import type { Metadata } from "next";
import { NewCaseScreen } from "@vet-plan/app";

export const metadata: Metadata = {
  title: "New case · Vet Plan",
};

export default function NewCasePage() {
  return <NewCaseScreen />;
}
