export const feedbackEmailHtml = (
  id: string,
  handle: string | undefined,
  message: string,
  createdAt: Date = new Date(),
): string => {
  const displayHandle = handle ? `@${handle}` : "anonymous";
  const escapedMessage = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
          <tr>
            <td style="padding-bottom:28px;">
              <span style="font-size:18px;font-weight:700;color:#f7f7f3;letter-spacing:4px;">ATARA</span>
            </td>
          </tr>
          <tr>
            <td style="background:#111;border:1px solid rgba(255,255,255,0.07);border-top:2px solid #3c83f6;border-radius:12px;padding:32px;">
              <p style="margin:0 0 24px;font-size:16px;font-weight:600;color:#f7f7f3;">New feedback</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="padding-bottom:12px;">
                    <span style="font-size:11px;color:rgba(247,247,243,0.35);text-transform:uppercase;letter-spacing:1px;">Handle</span><br/>
                    <span style="font-size:14px;color:#f7f7f3;font-weight:500;">${displayHandle}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:12px;">
                    <span style="font-size:11px;color:rgba(247,247,243,0.35);text-transform:uppercase;letter-spacing:1px;">Submitted</span><br/>
                    <span style="font-size:13px;color:rgba(247,247,243,0.55);">${createdAt.toUTCString()}</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <span style="font-size:11px;color:rgba(247,247,243,0.35);text-transform:uppercase;letter-spacing:1px;">ID</span><br/>
                    <span style="font-size:12px;color:rgba(247,247,243,0.35);font-family:monospace;">${id}</span>
                  </td>
                </tr>
              </table>
              <div style="height:1px;background:rgba(255,255,255,0.06);margin-bottom:24px;"></div>
              <p style="margin:0 0 10px;font-size:11px;color:rgba(247,247,243,0.35);text-transform:uppercase;letter-spacing:1px;">Message</p>
              <div style="border-left:2px solid #3c83f6;padding-left:16px;">
                <p style="margin:0;font-size:14px;line-height:1.75;color:rgba(247,247,243,0.75);">${escapedMessage}</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding-top:24px;text-align:center;">
              <p style="margin:0;font-size:11px;color:rgba(247,247,243,0.2);">© 2025 ATARA LTD</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

export const feedbackEmailText = (
  id: string,
  handle: string | undefined,
  message: string,
): string => {
  const displayHandle = handle ? `@${handle}` : "anonymous";
  return [
    "ATARA — New Feedback",
    "",
    `Handle : ${displayHandle}`,
    `Date   : ${new Date().toUTCString()}`,
    `ID     : ${id}`,
    "",
    message,
  ].join("\n");
};
