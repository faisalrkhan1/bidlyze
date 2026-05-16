import { Resend } from "resend";

let _resend;
function getResend() {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM_EMAIL = "Bidlyze <noreply@bidlyze.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://bidlyze.com";

function baseLayout(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bidlyze</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#111111;border-radius:16px;border:1px solid #1e1e1e;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 24px 32px;border-bottom:1px solid #1e1e1e;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:36px;height:36px;background-color:#10b981;border-radius:8px;text-align:center;vertical-align:middle;">
                    <span style="color:#ffffff;font-weight:bold;font-size:16px;line-height:36px;">B</span>
                  </td>
                  <td style="padding-left:12px;">
                    <span style="color:#ffffff;font-size:18px;font-weight:600;letter-spacing:-0.02em;">Bidlyze</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #1e1e1e;">
              <p style="margin:0;font-size:12px;color:#525252;line-height:1.5;">
                You're receiving this because you have a Bidlyze account.<br>
                <a href="${APP_URL}/dashboard" style="color:#10b981;text-decoration:none;">Open Dashboard</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildAnalysisSummaryEmail({ projectName, bidScore, recommendation, summary, analysisId }) {
  const scoreColor = bidScore >= 70 ? "#10b981" : bidScore >= 40 ? "#eab308" : "#ef4444";
  const recColor = recommendation === "BID" ? "#10b981" : "#ef4444";
  const viewUrl = `${APP_URL}/analysis/${analysisId}`;

  const subject = `Bidlyze Analysis: ${projectName} — Score: ${bidScore}/100`;

  const html = baseLayout(`
    <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">
      Analysis Complete
    </h1>
    <p style="margin:0 0 24px 0;font-size:14px;color:#a3a3a3;line-height:1.5;">
      Your tender analysis for <strong style="color:#ffffff;">${projectName}</strong> is ready.
    </p>

    <!-- Score Card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;border-radius:12px;border:1px solid #262626;margin-bottom:20px;">
      <tr>
        <td style="padding:24px;text-align:center;" width="50%">
          <p style="margin:0 0 4px 0;font-size:12px;color:#737373;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Bid Score</p>
          <p style="margin:0;font-size:36px;font-weight:700;color:${scoreColor};line-height:1.2;">${bidScore}</p>
          <p style="margin:4px 0 0 0;font-size:12px;color:#525252;">out of 100</p>
        </td>
        <td style="padding:24px;text-align:center;border-left:1px solid #262626;" width="50%">
          <p style="margin:0 0 4px 0;font-size:12px;color:#737373;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Recommendation</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px auto 0 auto;">
            <tr>
              <td style="background-color:${recColor}20;border-radius:8px;padding:6px 16px;">
                <span style="color:${recColor};font-size:18px;font-weight:700;">${recommendation}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Summary -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;border-radius:12px;border:1px solid #262626;margin-bottom:24px;">
      <tr>
        <td style="padding:20px;">
          <p style="margin:0 0 8px 0;font-size:12px;color:#737373;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Project Summary</p>
          <p style="margin:0;font-size:14px;color:#d4d4d4;line-height:1.6;">${summary}</p>
        </td>
      </tr>
    </table>

    <!-- CTA Button -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <a href="${viewUrl}" style="display:inline-block;background-color:#10b981;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:12px;">
            View Full Analysis
          </a>
        </td>
      </tr>
    </table>
  `);

  return { subject, html };
}

export function buildUsageWarningEmail({ usageCount, limit }) {
  const remaining = limit - usageCount;
  const subject = `You have ${remaining} analysis${remaining !== 1 ? "es" : ""} remaining this month`;

  const html = baseLayout(`
    <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">
      Usage Update
    </h1>
    <p style="margin:0 0 24px 0;font-size:14px;color:#a3a3a3;line-height:1.5;">
      You've used <strong style="color:#ffffff;">${usageCount} of ${limit}</strong> free analyses this month.
    </p>

    <!-- Usage Bar -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;border-radius:12px;border:1px solid #262626;margin-bottom:24px;">
      <tr>
        <td style="padding:24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
            <tr>
              <td style="font-size:14px;color:#d4d4d4;font-weight:600;">${usageCount} / ${limit} used</td>
              <td align="right" style="font-size:14px;color:#eab308;font-weight:600;">${remaining} remaining</td>
            </tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background-color:#262626;border-radius:6px;height:10px;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="width:${Math.round((usageCount / limit) * 100)}%;height:10px;">
                  <tr>
                    <td style="background-color:#eab308;border-radius:6px;height:10px;"></td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 24px 0;font-size:14px;color:#a3a3a3;line-height:1.6;">
      ${
        process.env.PAYMENTS_ENABLED === "true"
          ? "Upgrade to Pro for higher monthly limits, priority support, and advanced features."
          : "Bidlyze is in pre-launch and paid plans are not yet open. Join the Pro waitlist for early-bird pricing when they go live."
      }
    </p>

    <!-- CTA Button -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <a href="${APP_URL}/pricing" style="display:inline-block;background-color:#10b981;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:12px;">
            ${process.env.PAYMENTS_ENABLED === "true" ? "Upgrade to Pro" : "Join Pro Waitlist"}
          </a>
        </td>
      </tr>
    </table>
  `);

  return { subject, html };
}

export function buildWelcomeEmail() {
  const subject = "Welcome to Bidlyze — Start analyzing your first tender";

  const html = baseLayout(`
    <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">
      Welcome to Bidlyze
    </h1>
    <p style="margin:0 0 24px 0;font-size:14px;color:#a3a3a3;line-height:1.6;">
      Your account is ready. You can now analyze tender documents with AI and make smarter bid decisions in seconds.
    </p>

    <!-- What you can do -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;border-radius:12px;border:1px solid #262626;margin-bottom:20px;">
      <tr>
        <td style="padding:24px;">
          <p style="margin:0 0 16px 0;font-size:13px;color:#737373;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Here is what you can do</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:8px 0;font-size:14px;color:#d4d4d4;border-bottom:1px solid #262626;">Upload a PDF, DOCX, or TXT tender document</td></tr>
            <tr><td style="padding:8px 0;font-size:14px;color:#d4d4d4;border-bottom:1px solid #262626;">Get compliance analysis, risk assessment, and bid scoring</td></tr>
            <tr><td style="padding:8px 0;font-size:14px;color:#d4d4d4;border-bottom:1px solid #262626;">Compare tender amendments side-by-side</td></tr>
            <tr><td style="padding:8px 0;font-size:14px;color:#d4d4d4;">Generate tailored proposal sections with AI</td></tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 24px 0;font-size:14px;color:#a3a3a3;line-height:1.6;">
      You have <strong style="color:#ffffff;">3 free analyses per month</strong> to start. Upload your first tender and see the results in under 60 seconds.
    </p>

    <!-- CTA Button -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <a href="${APP_URL}/upload" style="display:inline-block;background-color:#10b981;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:12px;">
            Analyze Your First Tender
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:24px 0 0 0;font-size:13px;color:#525252;line-height:1.5;">
      Need help? Reply to this email or reach us at <a href="mailto:support@bidlyze.com" style="color:#10b981;text-decoration:none;">support@bidlyze.com</a>
    </p>
  `);

  return { subject, html };
}

export async function sendEmail({ to, subject, html }) {
  try {
    const { data, error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("Email send error:", err);
    return { success: false, error: err.message };
  }
}
