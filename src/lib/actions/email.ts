/**
 * Email delivery for technician invitations.
 * Mirrors the sendSms pattern: if RESEND_API_KEY is not set the call
 * returns status:'simulated' so the invite flow degrades gracefully —
 * the admin sees credentials on screen and can share them manually.
 */

export interface SendEmailResult {
  status: 'sent' | 'simulated' | 'failed'
  message: string
}

export async function sendInviteEmail(
  toEmail: string,
  name: string,
  loginEmail: string,
  tempPassword: string,
  /**
   * Redacted body used for any server-side logging.
   * The real email (containing the password) is sent to the recipient;
   * this version is only for console/log output when simulating.
   */
  bodyForLog?: string
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@fieldcommand.app'

  if (!apiKey) {
    // Simulated mode — log the redacted version, never the real password
    console.log(
      `[EMAIL SIMULATED] To: ${toEmail}\n  ${bodyForLog ?? `Login: ${loginEmail} / Password: [redacted]`}`
    )
    return {
      status: 'simulated',
      message: 'Email not configured; share credentials manually',
    }
  }

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)

    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111;">
        <h2 style="margin-bottom:8px;">Welcome to FieldCommand, ${name}!</h2>
        <p style="color:#555;">Your account has been created. Use the credentials below to log in.</p>
        <table style="background:#f5f5f5;border-radius:8px;padding:16px;margin:16px 0;width:100%;">
          <tr>
            <td style="padding:4px 8px 4px 0;font-weight:600;white-space:nowrap;">Login Email</td>
            <td style="padding:4px 0;font-family:monospace;">${loginEmail}</td>
          </tr>
          <tr>
            <td style="padding:4px 8px 4px 0;font-weight:600;white-space:nowrap;">Temp Password</td>
            <td style="padding:4px 0;font-family:monospace;">${tempPassword}</td>
          </tr>
        </table>
        <p style="color:#888;font-size:13px;">
          You will be prompted to change your password on first login.
        </p>
      </div>
    `

    const { error } = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: 'Your FieldCommand account is ready',
      html,
    })

    if (error) {
      console.error('[sendInviteEmail] Resend error:', error)
      return { status: 'failed', message: `Email error: ${error.message}` }
    }

    return { status: 'sent', message: 'Invite email sent successfully' }
  } catch (err) {
    console.error('[sendInviteEmail] Unexpected error:', err)
    return {
      status: 'failed',
      message: `Email error: ${err instanceof Error ? err.message : 'Unknown error'}`,
    }
  }
}
