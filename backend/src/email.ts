// Minimal email transport. Uses Resend if RESEND_API_KEY is set, otherwise
// logs to stdout (handy for dev / first-run on a host with no email yet).

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const FROM = process.env.EMAIL_FROM || "Redland CRM <onboarding@resend.dev>";
const RESEND_KEY = process.env.RESEND_API_KEY || "";

export async function sendEmail({ to, subject, html, text }: SendArgs): Promise<void> {
  if (!RESEND_KEY) {
    console.log("\n========== EMAIL (no RESEND_API_KEY set) ==========");
    console.log(`To:      ${to}`);
    console.log(`From:    ${FROM}`);
    console.log(`Subject: ${subject}`);
    console.log(text || html.replace(/<[^>]+>/g, ""));
    console.log("===================================================\n");
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, html, text }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("Resend send failed:", res.status, body);
  }
}

export function inviteEmail(opts: {
  fullName: string;
  appUrl: string;
  token: string;
  invitedBy?: string;
}) {
  const link = `${opts.appUrl.replace(/\/$/, "")}/accept-invite/${opts.token}`;
  return {
    subject: "You've been invited to Redland CRM",
    html: `<p>Hi ${escape(opts.fullName)},</p>
<p>${opts.invitedBy ? escape(opts.invitedBy) + " has invited you" : "You've been invited"} to join the <strong>Redland CRM &amp; Pipeline Tracker</strong>.</p>
<p>Click the link below to set your password and sign in. This link expires in 7 days.</p>
<p><a href="${link}" style="background:#8B1A1A;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">Accept Invitation</a></p>
<p style="color:#666;font-size:12px">Or paste this URL into your browser: ${link}</p>`,
  };
}

export function resetEmail(opts: { fullName: string; appUrl: string; token: string }) {
  const link = `${opts.appUrl.replace(/\/$/, "")}/reset-password/${opts.token}`;
  return {
    subject: "Reset your Redland CRM password",
    html: `<p>Hi ${escape(opts.fullName)},</p>
<p>We received a request to reset your Redland CRM password. Click the button below to set a new one. This link expires in 1 hour.</p>
<p><a href="${link}" style="background:#8B1A1A;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">Reset Password</a></p>
<p style="color:#666;font-size:12px">If you didn't request this, you can ignore the email. Or paste this URL into your browser: ${link}</p>`,
  };
}

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c)
  );
}
