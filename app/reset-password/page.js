import ResetPasswordClient from "./ResetPasswordClient";

export const metadata = {
  title: "Bidlyze",
  description: "Set a new password for your Bidlyze account.",
  // The address can briefly hold a one-time reset token: never send it on as a referrer, never index the page.
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return <ResetPasswordClient />;
}
