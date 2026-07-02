const citationsHeadingPattern = /^##\s+citations\s*$/im;
const nextHeadingPattern = /^##\s+/m;

const markdownLinkPattern = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const autolinkPattern = /<(https?:\/\/[^>\s]+)>/g;
const bareUrlPattern = /(?<![("'[])(https?:\/\/[^\s<>)]+)/g;

function isHttpUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

export function extractOkfCitationsSection(body: string): string | null {
  const match = body.match(citationsHeadingPattern);
  if (!match || match.index === undefined) {
    return null;
  }

  const start = match.index + match[0].length;
  const remainder = body.slice(start);
  const nextHeading = remainder.search(nextHeadingPattern);
  const section = (nextHeading === -1 ? remainder : remainder.slice(0, nextHeading)).trim();
  return section.length > 0 ? section : null;
}

export function extractCitationUrls(sectionText: string): string[] {
  const urls = new Set<string>();

  for (const match of sectionText.matchAll(markdownLinkPattern)) {
    const target = match[1]?.trim() ?? '';
    if (isHttpUrl(target)) {
      urls.add(target);
    }
  }

  for (const match of sectionText.matchAll(autolinkPattern)) {
    const url = match[1]?.trim() ?? '';
    if (url.length > 0) {
      urls.add(url);
    }
  }

  for (const match of sectionText.matchAll(bareUrlPattern)) {
    const url = match[0]?.trim() ?? '';
    if (url.length > 0) {
      urls.add(url);
    }
  }

  return [...urls];
}

export function extractOkfCitationUrlsFromBody(body: string): string[] {
  const section = extractOkfCitationsSection(body);
  if (!section) {
    return [];
  }
  return extractCitationUrls(section);
}
