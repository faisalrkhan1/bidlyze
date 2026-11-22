import { notFound } from "next/navigation";
import { submissionCheckBetaEnabled } from "@/lib/submission/beta";
import SubmissionCheckWorkspace from "@/app/components/submission/SubmissionCheckWorkspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "New check · Bidlyze" };

export default function NewCheckPage() {
  if (!submissionCheckBetaEnabled()) notFound();
  return <SubmissionCheckWorkspace startNew />;
}
