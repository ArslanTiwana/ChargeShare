import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const fromEmail = process.env.RESEND_FROM_EMAIL || 'ChargeShare <noreply@chargeshare.pk>';
const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function sendVerificationEmail(email: string, rawToken: string): Promise<void> {
  const verifyUrl = `${appUrl}/auth/verify-email?token=${rawToken}&email=${encodeURIComponent(email)}`;

  if (!resend) {
    console.log('\n-----------------------------------------------------------');
    console.log(`[DEV EMAIL] Verification email to: ${email}`);
    console.log(`[DEV EMAIL] Link: ${verifyUrl}`);
    console.log('-----------------------------------------------------------\n');
    return;
  }

  try {
    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: 'Verify your ChargeShare account',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Welcome to ChargeShare!</h2>
          <p>Please click the button below to verify your email address and activate your account:</p>
          <p><a href="${verifyUrl}" style="display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Verify Email</a></p>
          <p>Or copy and paste this link in your browser: <br>${verifyUrl}</p>
          <p>This link will expire in 24 hours.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Failed to send verification email via Resend:', err);
  }
}

export async function sendPasswordResetEmail(email: string, rawToken: string): Promise<void> {
  const resetUrl = `${appUrl}/auth/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;

  if (!resend) {
    console.log('\n-----------------------------------------------------------');
    console.log(`[DEV EMAIL] Password reset email to: ${email}`);
    console.log(`[DEV EMAIL] Link: ${resetUrl}`);
    console.log('-----------------------------------------------------------\n');
    return;
  }

  try {
    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: 'Reset your ChargeShare password',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Password Reset Request</h2>
          <p>We received a request to reset your ChargeShare account password. Click the link below to set a new password:</p>
          <p><a href="${resetUrl}" style="display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a></p>
          <p>Or copy and paste this link in your browser: <br>${resetUrl}</p>
          <p>This link will expire in 1 hour. If you did not request this, you can safely ignore this email.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Failed to send password reset email via Resend:', err);
  }
}
