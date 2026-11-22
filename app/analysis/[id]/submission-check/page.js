import { notFound } from "next/navigation";
import { submissionCheckBetaEnabled } from "@/lib/submission/beta";
import SubmissionCheckWorkspace from "@/app/components/submission/SubmissionCheckWorkspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Submission Check (beta) · Bidlyze" };

export default async function AnalysisSubmissionCheckPage({ params }) {
  if (!submissionCheckBetaEnabled()) notFound();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) notFound();
  return <SubmissionCheckWorkspace analysisId={id} />;
}
