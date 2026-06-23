import { Resend } from "resend";
import prisma from "../config/prisma";
import {
  FEEDBACK_FROM_EMAIL,
  FEEDBACK_RECIPIENT_EMAIL,
  RESEND_API_KEY,
  NODE_ENV,
} from "../utils/constants";
import { feedbackEmailHtml, feedbackEmailText } from "../utils/emailTemplates";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

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
    ).catch((err) => {
      if (NODE_ENV !== "production") {
        console.error("[Feedback] Email send failed:", err);
      }
    });

    return feedback;
  }

  private async sendEmail(
    id: string,
    handle: string | undefined,
    message: string,
    createdAt: Date,
  ) {
    if (!resend) {
      throw new Error("Missing RESEND_API_KEY");
    }

    if (!FEEDBACK_RECIPIENT_EMAIL) {
      throw new Error("Missing FEEDBACK_RECIPIENT_EMAIL");
    }

    const { error } = await resend.emails.send({
      from: `ATARA <${FEEDBACK_FROM_EMAIL}>`,
      to: [FEEDBACK_RECIPIENT_EMAIL],
      subject: `[Beta Feedback] from ${handle ? `@${handle}` : "anonymous"}`,
      text: feedbackEmailText(id, handle, message),
      html: feedbackEmailHtml(id, handle, message, createdAt),
    });

    if (error) {
      throw new Error(error.message);
    }
  }
}

export const feedbackService = new FeedbackService();
