const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL || 'MuniSolve ZA <noreply@munisolve.co.za>';

const sendVerificationEmail = async (toEmail, firstName, otp) => {
  const { error } = await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: 'Verify your MuniSolve ZA account',
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
          <tr><td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
              <!-- Header -->
              <tr>
                <td style="background:#0d3b5c;padding:28px 32px;">
                  <p style="margin:0;color:#e8b923;font-size:22px;font-weight:700;letter-spacing:-0.5px;">MuniSolve ZA</p>
                  <p style="margin:4px 0 0;color:rgba(255,255,255,0.6);font-size:13px;">Civic Infrastructure Platform</p>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding:36px 32px 28px;">
                  <p style="margin:0 0 8px;color:#0d3b5c;font-size:20px;font-weight:700;">Hi ${firstName},</p>
                  <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
                    Thanks for signing up. Use the verification code below to confirm your email address.
                    This code expires in <strong>15 minutes</strong>.
                  </p>
                  <!-- OTP Box -->
                  <div style="background:#f8fafc;border:2px dashed #cbd5e1;border-radius:10px;padding:24px;text-align:center;margin:0 0 24px;">
                    <p style="margin:0 0 6px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Your verification code</p>
                    <p style="margin:0;color:#0d3b5c;font-size:40px;font-weight:800;letter-spacing:10px;">${otp}</p>
                  </div>
                  <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">
                    If you didn&apos;t create a MuniSolve ZA account, you can safely ignore this email.
                    Do not share this code with anyone.
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0;">
                  <p style="margin:0;color:#94a3b8;font-size:12px;">
                    &copy; 2026 MuniSolve ZA &mdash; K-ONE IT Solutions &middot; Johannesburg, SA
                  </p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `,
  });

  if (error) {
    console.error('[EMAIL] Resend error:', error);
    throw new Error('Failed to send verification email.');
  }
};

module.exports = { sendVerificationEmail };
