import nodemailer from "nodemailer";
import prisma from "../config/prisma";
import {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  FEEDBACK_RECIPIENT_EMAIL,
} from "../utils/constants";
import { feedbackEmailHtml, feedbackEmailText } from "../utils/emailTemplates";

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

class FeedbackService {
  public async submit(data: {
    userId?: string;
    handle?: string;
    message: string;
  }) {
    const feedback = await prisma.feedback.create({
      data: {
        userId: data.userId,
        handle: data.handle,
        message: data.message,
      },
    });

    this.sendEmail(
      feedback.id,
      data.handle,
      data.message,
      feedback.createdAt,
    ).catch((err) => console.error("[Feedback] Email send failed:", err));

    return feedback;
  }

  private async sendEmail(
    id: string,
    handle: string | undefined,
    message: string,
    createdAt: Date,
  ) {
    await transporter.sendMail({
      from: `"ATARA Feedback" <${SMTP_USER}>`,
      to: FEEDBACK_RECIPIENT_EMAIL,
      subject: `[Beta Feedback] from ${handle ? `@${handle}` : "anonymous"}`,
      text: feedbackEmailText(id, handle, message),
      html: feedbackEmailHtml(id, handle, message, createdAt),
    });
  }
}

export const feedbackService = new FeedbackService();
