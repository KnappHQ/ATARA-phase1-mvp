/**
 * What leaves the phone in a crash report.
 *
 * Sentry records breadcrumbs for every API call and console line, and error
 * messages quote the URL that failed. Those carry payment-link tokens, wallet
 * addresses and transaction hashes, the @handle being paid, emails, and search
 * queries in query strings. Each is replaced before the report is sent; what
 * remains is enough to see which screen or endpoint broke.
 */
export const scrubText = (text: string): string =>
  text
    .replace(/(https?:\/\/[^\s"'?#]+)[?#][^\s"']*/gi, "$1")
    .replace(/(\/(?:check-handle|resolve|handle)\/)[^/?#\s"']+/gi, "$1[handle]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/(0x)?[0-9a-fA-F]{32,}/g, "[redacted]");

const MAX_DEPTH = 5;

export const scrubValue = (value: unknown, depth = 0): unknown => {
  if (typeof value === "string") return scrubText(value);
  if (depth >= MAX_DEPTH || value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, depth + 1));
  }
  const scrubbed: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    scrubbed[key] = scrubValue(item, depth + 1);
  }
  return scrubbed;
};

interface ScrubbableBreadcrumb {
  message?: string;
  data?: { [key: string]: unknown };
}

export const scrubBreadcrumb = <T extends ScrubbableBreadcrumb>(
  breadcrumb: T,
): T => ({
  ...breadcrumb,
  ...(breadcrumb.message !== undefined && {
    message: scrubText(breadcrumb.message),
  }),
  ...(breadcrumb.data !== undefined && {
    data: scrubValue(breadcrumb.data) as T["data"],
  }),
});

interface ScrubbableEvent {
  message?: string;
  exception?: { values?: { value?: string }[] };
  request?: {
    url?: string;
    query_string?: unknown;
    data?: unknown;
    cookies?: unknown;
    headers?: unknown;
  };
  breadcrumbs?: ScrubbableBreadcrumb[];
  user?: { id?: string | number } & Record<string, unknown>;
  extra?: Record<string, unknown>;
}

/**
 * Only free-text fields are scrubbed: the event's own ids (event, trace, span)
 * are long hex too, and Sentry needs them intact.
 */
export const scrubEvent = <T extends ScrubbableEvent>(event: T): T => {
  if (typeof event.message === "string") {
    event.message = scrubText(event.message);
  }
  for (const exception of event.exception?.values ?? []) {
    if (typeof exception.value === "string") {
      exception.value = scrubText(exception.value);
    }
  }
  if (event.request) {
    if (event.request.url) event.request.url = scrubText(event.request.url);
    delete event.request.query_string;
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.headers;
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb);
  }
  if (event.user) {
    event.user = (event.user.id !== undefined
      ? { id: event.user.id }
      : {}) as T["user"];
  }
  if (event.extra) {
    event.extra = scrubValue(event.extra) as T["extra"];
  }
  return event;
};
