import { notFound } from "next/navigation";
import { submissionCheckBetaEnabled } from "@/lib/submission/beta";
import SubmissionCheckHistory from "@/app/components/submission/SubmissionCheckHistory";

export const dynamic = "force-dynamic";
export const metadata = { title: "History · Bidlyze" };

export default function HistoryPage() {
  if (!submissionCheckBetaEnabled()) notFound();
  return <SubmissionCheckHistory />;
}
