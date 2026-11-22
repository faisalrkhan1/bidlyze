import { notFound } from "next/navigation";
import { submissionCheckBetaEnabled } from "@/lib/submission/beta";
import AccountPage from "@/app/components/submission/AccountPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account · Bidlyze" };

export default function Account() {
  if (!submissionCheckBetaEnabled()) notFound();
  return <AccountPage />;
}
