import { notFound } from "next/navigation";
import { submissionCheckBetaEnabled } from "@/lib/submission/beta";
import SubmissionCheckWorkspace from "@/app/components/submission/SubmissionCheckWorkspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Submission Check sample (beta) · Bidlyze" };

export default function SubmissionCheckDemoPage() {
  if (!submissionCheckBetaEnabled()) notFound();
  return <SubmissionCheckWorkspace demo />;
}
