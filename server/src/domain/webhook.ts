import crypto from 'node:crypto';
import { isIP } from 'node:net';

export const WEBHOOK_EVENTS = [
  'report.created',
  'report.assigned',
  'report.status_changed',
  'report.merged',
  'report.unmerged',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export function signWebhook(secret: string, timestamp: string, body: string): string {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export function subscriptionWantsEvent(events: string, event: string): boolean {
  const list = String(events ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return list.includes('*') || list.includes(event);
}

export function serializeEvents(events: string[]): string {
  return [...new Set(events.map((value) => value.trim()).filter(Boolean))].join(',');
}

export type WebhookUrlResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'INVALID_URL' | 'HTTPS_REQUIRED' | 'CREDENTIALS_NOT_ALLOWED' | 'PORT_NOT_ALLOWED' | 'PRIVATE_HOST' | 'PRIVATE_ADDRESS' };

const PRIVATE_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa'];
const PRIVATE_NAMES = new Set(['localhost', 'metadata.google.internal', 'metadata']);

function blockedIpv4(address: string): boolean {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return true;
  const [a, b] = octets;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

function expandIpv6(address: string): number[] | null {
  let value = address.toLowerCase();
  const zone = value.indexOf('%');
  if (zone !== -1) value = value.slice(0, zone);

  const lastColon = value.lastIndexOf(':');
  const tail = value.slice(lastColon + 1);
  if (tail.includes('.')) {
    const octets = tail.split('.').map(Number);
    if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
    value = `${value.slice(0, lastColon + 1)}${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
  }

  const halves = value.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...rest]
    .map((group) => (/^[0-9a-f]{1,4}$/.test(group) ? parseInt(group, 16) : NaN));
  if (groups.length !== 8 || groups.some(Number.isNaN)) return null;
  return groups;
}

export function isBlockedAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return blockedIpv4(address);
  if (version === 6) {
    const groups = expandIpv6(address);
    if (!groups) return true;

    const mapped = groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
    if (mapped) {
      const high = groups[6];
      const low = groups[7];
      return blockedIpv4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
    }

    const unspecified = groups.every((group) => group === 0);
    const loopback = groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1;
    const uniqueLocal = (groups[0] & 0xfe00) === 0xfc00;
    const linkLocal = (groups[0] & 0xffc0) === 0xfe80;
    const multicast = (groups[0] & 0xff00) === 0xff00;
    const discardOnly = groups[0] === 0x0100 && groups.slice(1, 4).every((group) => group === 0);
    if (unspecified || loopback || uniqueLocal || linkLocal || multicast || discardOnly) return true;

    // Outside 2000::/3 is reserved or special-purpose; only global unicast is deliverable.
    return (groups[0] & 0xe000) !== 0x2000;
  }
  return true;
}

export function parseWebhookUrl(raw: string): WebhookUrlResult {
  let url: URL;
  try {
    url = new URL(String(raw).trim());
  } catch {
    return { ok: false, reason: 'INVALID_URL' };
  }

  if (url.protocol !== 'https:') return { ok: false, reason: 'HTTPS_REQUIRED' };
  if (url.username || url.password) return { ok: false, reason: 'CREDENTIALS_NOT_ALLOWED' };
  if (url.port !== '' && url.port !== '443') return { ok: false, reason: 'PORT_NOT_ALLOWED' };

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (PRIVATE_NAMES.has(hostname) || PRIVATE_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    return { ok: false, reason: 'PRIVATE_HOST' };
  }

  if (isIP(hostname) && isBlockedAddress(hostname)) {
    return { ok: false, reason: 'PRIVATE_ADDRESS' };
  }

  return { ok: true, url: url.toString() };
}
