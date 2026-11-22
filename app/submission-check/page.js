import { notFound } from "next/navigation";
import { submissionCheckBetaEnabled } from "@/lib/submission/beta";
import SubmissionCheckHome from "@/app/components/submission/SubmissionCheckHome";

export const dynamic = "force-dynamic";
export const metadata = { title: "Submission Check (beta) · Bidlyze" };

// Beta: preview deployments and local development only (lib/submission/beta.js).
export default function SubmissionCheckPage() {
  if (!submissionCheckBetaEnabled()) notFound();
  return <SubmissionCheckHome />;
}
