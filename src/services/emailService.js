import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT ?? 587),
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

export const sendExamInvite = async ({ candidateName, candidateEmail, examId, jobTitle, examUrl }) => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('[email] EMAIL_USER / EMAIL_PASS not set — skipping send, logging instead');
        console.log(`[email] To: ${candidateEmail} | Exam URL: ${examUrl}`);
        return { skipped: true, examUrl };
    }

    const from = process.env.EMAIL_FROM ?? process.env.EMAIL_USER;
    const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:auto">
      <h2>You've been invited to complete an L1 assessment</h2>
      <p>Hi ${candidateName},</p>
      <p>Congratulations on advancing to the L1 stage for the <strong>${jobTitle}</strong> role at Bourntec.</p>
      <p>Please complete the online assessment using the link below. You will have <strong>15 minutes</strong> and up to <strong>20 questions</strong>.</p>
      <p style="margin:24px 0">
        <a href="${examUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
          Start Assessment →
        </a>
      </p>
      <p style="color:#666;font-size:13px">The timer starts as soon as you open the link. Good luck!</p>
      <hr/>
      <p style="color:#999;font-size:11px">Bourntec ATS — This is an automated message.</p>
    </div>`;

    await transporter.sendMail({
        from,
        to: candidateEmail,
        subject: `L1 Assessment — ${jobTitle}`,
        html,
    });

    return { sent: true, examUrl };
};

export const sendJdShare = async ({ toEmails, jobTitle, jdText, applyUrl, includeJd, includeUploadLink, message, senderName }) => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('[email] EMAIL_USER / EMAIL_PASS not set — skipping send, logging instead');
        console.log(`[email] To: ${toEmails.join(', ')} | JD Share: ${jobTitle}`);
        return { skipped: true };
    }

    const from = process.env.EMAIL_FROM ?? process.env.EMAIL_USER;
    const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:auto">
      <h2>Job Opening: ${jobTitle}</h2>
      ${message ? `<p>${message.replace(/\n/g, '<br/>')}</p>` : ''}
      ${includeJd && jdText ? `<div style="white-space:pre-wrap;border:1px solid #f0f0f0;border-radius:6px;padding:12px 16px;background:#fafafa">${jdText}</div>` : ''}
      ${includeUploadLink ? `
      <p style="margin:24px 0">
        <a href="${applyUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
          Submit Candidates →
        </a>
      </p>` : ''}
      <hr/>
      <p style="color:#999;font-size:11px">Shared by ${senderName ?? 'Bourntec ATS'} — This is an automated message.</p>
    </div>`;

    await transporter.sendMail({
        from,
        to: from,
        bcc: toEmails,
        subject: `Job Opening — ${jobTitle}`,
        html,
    });

    return { sent: true, recipientCount: toEmails.length };
};
