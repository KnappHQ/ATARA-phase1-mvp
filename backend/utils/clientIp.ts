import { isIPv4, isIPv6 } from "node:net";
import type { Request } from "express";

/**
 * The customer's public IP address, as MoonPay's IP matching needs it.
 *
 * MoonPay hashes the IP it observes when the widget loads and compares the hash,
 * as an exact string, with `allowedIpAddress` in the signed URL. So the address
 * hashed here must be written exactly the way MoonPay writes it:
 *   - IPv4: dotted quad, no leading zeros (203.0.113.42);
 *   - IPv6: RFC 5952 (lowercase, :: compression, no leading zeros);
 *   - IPv4-mapped IPv6 (::ffff:203.0.113.42): unmapped to plain IPv4;
 *   - no port, no brackets.
 * See https://dev.moonpay.com/widget/on-ramp/customization/ip-matching
 *
 * The address comes only from the request the backend received, through the
 * proxies it trusts (see `resolveClientIp`), never from a value the app sends.
 */

export type IpFamily = "ipv4" | "ipv6";

const strictIpv4 = (value: string): string | null => {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  for (const part of parts) {
    // No sign, no hex, no leading zeros: "010" is ambiguous (octal in some parsers).
    if (!/^(0|[1-9]\d{0,2})$/.test(part) || Number(part) > 255) return null;
  }
  return parts.join(".");
};

/** RFC 5952 text of an IPv6 address. The WHATWG URL serializer implements the same rules. */
const canonicalIpv6 = (value: string): string | null => {
  if (!isIPv6(value)) return null;
  try {
    const host = new URL(`http://[${value}]/`).hostname;
    return host.slice(1, -1).toLowerCase();
  } catch {
    return null;
  }
};

/** Removes brackets, a port and a zone id; null when nothing like an address is left. */
const stripDecorations = (raw: string): string | null => {
  let value = raw.trim();
  if (!value) return null;
  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    if (end < 0) return null;
    const rest = value.slice(end + 1);
    if (rest && !/^:\d{1,5}$/.test(rest)) return null;
    value = value.slice(1, end);
  } else if (/^\d{1,3}(\.\d{1,3}){3}:\d{1,5}$/.test(value)) {
    value = value.slice(0, value.lastIndexOf(":"));
  }
  // A zone id ("fe80::1%en0") names a local interface: never a public address.
  if (value.includes("%")) return null;
  return value;
};

/** The canonical text MoonPay compares against, or null when `raw` is not one IP address. */
export const canonicalizeIp = (raw: unknown): string | null => {
  if (typeof raw !== "string" || raw.length > 100) return null;
  const value = stripDecorations(raw);
  if (!value) return null;
  if (isIPv4(value)) return strictIpv4(value);
  if (/^[\d.]+$/.test(value)) return null;
  const v6 = canonicalIpv6(value);
  if (!v6) return null;
  // IPv4-mapped (::ffff:a.b.c.d, serialized as ::ffff:xxxx:xxxx): unmap to IPv4.
  const mapped = v6.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mapped) {
    const high = parseInt(mapped[1], 16);
    const low = parseInt(mapped[2], 16);
    return [high >> 8, high & 255, low >> 8, low & 255].join(".");
  }
  return v6;
};

export const ipFamily = (canonical: string): IpFamily => (canonical.includes(":") ? "ipv6" : "ipv4");

const ipv4ToInt = (ip: string) => ip.split(".").reduce((n, part) => n * 256 + Number(part), 0);
const inV4 = (ip: string, base: string, bits: number) => {
  const size = 2 ** (32 - bits);
  return Math.floor(ipv4ToInt(ip) / size) === Math.floor(ipv4ToInt(base) / size);
};

const V4_NOT_PUBLIC: Array<[string, number]> = [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, incl. Cloudflare's pseudo IPv4 and broadcast
];

/** Expands a canonical IPv6 address to eight 16-bit groups. */
const ipv6Groups = (ip: string): number[] => {
  const [head, tail] = ip.split("::");
  const parse = (part: string | undefined) => (part ? part.split(":").map((g) => parseInt(g, 16)) : []);
  const front = parse(head);
  const back = tail === undefined ? [] : parse(tail);
  return [...front, ...new Array(8 - front.length - back.length).fill(0), ...back];
};

/**
 * True for an address that can be a customer's address on the internet. A
 * private, loopback, link-local, carrier-NAT or documentation address cannot be
 * what MoonPay sees, so hashing it would only make the widget fail.
 */
export const isPublicIp = (canonical: string): boolean => {
  if (ipFamily(canonical) === "ipv4") return !V4_NOT_PUBLIC.some(([base, bits]) => inV4(canonical, base, bits));
  const g = ipv6Groups(canonical);
  if (g.length !== 8) return false;
  if (g.every((x) => x === 0)) return false; // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return false; // ::1
  if ((g[0] & 0xfe00) === 0xfc00) return false; // fc00::/7 unique local
  if ((g[0] & 0xffc0) === 0xfe80) return false; // fe80::/10 link-local
  if ((g[0] & 0xff00) === 0xff00) return false; // multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return false; // documentation
  if (g[0] === 0x0064 && g[1] === 0xff9b) return false; // NAT64 well-known prefix
  // Only global unicast (2000::/3) is a customer's address.
  return (g[0] & 0xe000) === 0x2000;
};

/**
 * Where the backend reads the customer's IP from.
 *  - "forwarded" (default): Express's `req.ip`, which with `app.set("trust proxy", 1)`
 *    is the address the one proxy in front of the service (Render) appended to
 *    X-Forwarded-For. A value the client put in X-Forwarded-For itself is ignored.
 *  - "true-client-ip": the True-Client-IP header MoonPay recommends. Only safe once
 *    it is verified that the proxy overwrites it (otherwise any client can set it):
 *    see docs/ONRAMP_AND_PAYMENTS.md, "Checking the IP source on Render".
 */
export type ClientIpSource = "forwarded" | "true-client-ip";

export const clientIpSource = (value: string | undefined): ClientIpSource =>
  value?.trim().toLowerCase() === "true-client-ip" ? "true-client-ip" : "forwarded";

const header = (req: Pick<Request, "headers">, name: string): string | undefined => {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
};

export interface ObservedIp {
  ip: string;
  family: IpFamily;
}

/**
 * The customer's public IP for this request, canonical, or null when the trusted
 * source gives no public address. Never reads the body, a query parameter, or a
 * header the configuration does not trust.
 */
export const resolveClientIp = (
  req: Pick<Request, "ip" | "headers">,
  source: ClientIpSource,
): ObservedIp | null => {
  const raw = source === "true-client-ip" ? header(req, "true-client-ip") : req.ip;
  const ip = canonicalizeIp(raw);
  if (!ip || !isPublicIp(ip)) return null;
  return { ip, family: ipFamily(ip) };
};

/**
 * What each possible source says for this request, for the authenticated person's
 * own check of the proxy setup. Values are canonicalized; nothing is logged.
 */
export const describeIpSources = (req: Pick<Request, "ip" | "headers">) => {
  const forwarded = (header(req, "x-forwarded-for") ?? "").split(",").map((part) => part.trim()).filter(Boolean);
  return {
    expressIp: canonicalizeIp(req.ip),
    trueClientIp: canonicalizeIp(header(req, "true-client-ip")),
    forwardedForFirst: canonicalizeIp(forwarded[0]),
    forwardedForLast: canonicalizeIp(forwarded[forwarded.length - 1]),
    forwardedForCount: forwarded.length,
  };
};
