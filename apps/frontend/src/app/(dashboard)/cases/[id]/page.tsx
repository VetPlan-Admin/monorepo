import { Suspense } from "react";
import type { Metadata } from "next";
import { WebCaseDetail } from "@/components/cases/web-case-detail";

export const metadata: Metadata = {
  title: "Case · Vet Plan",
};

export default function CaseDetailPage({ params }: PageProps<"/cases/[id]">) {
  // params is request data under Cache Components, so it resolves behind a boundary
  return (
    <Suspense fallback={<div className="flex-1 bg-brand-purple" />}>
      <CaseDetail params={params} />
    </Suspense>
  );
}

async function CaseDetail({ params }: Pick<PageProps<"/cases/[id]">, "params">) {
  const { id } = await params;
  return <WebCaseDetail caseId={id} />;
}
