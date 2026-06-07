export interface ParsedSearchTokens {
  plainTerms: string[];
  hashtags: string[];
}

export function parseSearchTokens(rawSearch: string): ParsedSearchTokens {
  const normalizedTokens = rawSearch
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map(token => token.replace(/^[^\w#]+|[^\w]+$/g, ''))
    .filter(Boolean);

  const plainTerms = Array.from(new Set(normalizedTokens.filter(token => !token.startsWith('#'))));
  const hashtags = Array.from(
    new Set(
      normalizedTokens
        .filter(token => token.startsWith('#'))
        .map(token => token.slice(1))
        .filter(Boolean)
    )
  );

  return { plainTerms, hashtags };
}
