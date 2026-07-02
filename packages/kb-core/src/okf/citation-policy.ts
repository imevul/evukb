export type CitationUrlPolicyResult = {
  allowed: boolean;
  reason?: string;
};

function isPrivateIpv4(part: number[]): boolean {
  if (part.length !== 4) {
    return false;
  }
  const [a = -1, b = -1] = part;
  if (a === 10) {
    return true;
  }
  if (a === 127) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 0) {
    return true;
  }
  return false;
}

function parseIpv4(value: string): number[] | null {
  const parts = value.split('.');
  if (parts.length !== 4) {
    return null;
  }
  const numbers: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) {
      return null;
    }
    const parsed = Number.parseInt(part, 10);
    if (parsed < 0 || parsed > 255) {
      return null;
    }
    numbers.push(parsed);
  }
  return numbers;
}

function isBlockedIpv6(value: string): boolean {
  const normalized = value.toLowerCase();
  if (normalized === '::1' || normalized === '::') {
    return true;
  }
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true;
  }
  if (normalized.startsWith('fe80:')) {
    return true;
  }
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    const ipv4 = parseIpv4(mapped);
    return ipv4 ? isPrivateIpv4(ipv4) : false;
  }
  return false;
}

function isBlockedHostname(hostname: string): CitationUrlPolicyResult | null {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.localhost')) {
    return { allowed: false, reason: 'localhost hostnames are blocked' };
  }
  if (lower.endsWith('.local')) {
    return { allowed: false, reason: '.local hostnames are blocked' };
  }
  if (lower === 'metadata.google.internal' || lower.endsWith('.internal')) {
    return { allowed: false, reason: 'internal hostnames are blocked' };
  }
  return null;
}

function isBlockedIpLiteral(hostname: string): CitationUrlPolicyResult | null {
  if (hostname.includes(':')) {
    if (isBlockedIpv6(hostname)) {
      return { allowed: false, reason: 'private or link-local IPv6 addresses are blocked' };
    }
    return null;
  }

  const ipv4 = parseIpv4(hostname);
  if (!ipv4) {
    return null;
  }
  if (isPrivateIpv4(ipv4)) {
    return { allowed: false, reason: 'private or link-local IPv4 addresses are blocked' };
  }
  return null;
}

export function evaluateCitationUrlPolicy(rawUrl: string): CitationUrlPolicyResult {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { allowed: false, reason: 'invalid URL' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { allowed: false, reason: 'only http and https URLs are allowed' };
  }

  if (parsed.username || parsed.password) {
    return { allowed: false, reason: 'URLs with credentials are blocked' };
  }

  const hostname = parsed.hostname;
  const blockedHostname = isBlockedHostname(hostname);
  if (blockedHostname) {
    return blockedHostname;
  }

  const blockedIp = isBlockedIpLiteral(hostname);
  if (blockedIp) {
    return blockedIp;
  }

  return { allowed: true };
}
