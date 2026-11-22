// The address customers write to (beta access, support, data requests).
//
// 22 Nov 2026: bidlyze.com has NO mail (MX) record, so mail to support@bidlyze.com
// cannot be delivered. Either set up mail for the domain, or set
// NEXT_PUBLIC_SUPPORT_EMAIL in Vercel to a mailbox that works, then redeploy.
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@bidlyze.com";

/** mailto: link to the support address, with an optional subject and body. */
export function supportMailto(subject = "", body = "") {
  const q = [subject && `subject=${encodeURIComponent(subject)}`, body && `body=${encodeURIComponent(body)}`].filter(Boolean).join("&");
  return `mailto:${SUPPORT_EMAIL}${q ? `?${q}` : ""}`;
}
