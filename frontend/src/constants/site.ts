/**
 * Systems Lab site identity.
 *
 * Every brand string, canonical URL, and ecosystem link the product renders is
 * declared here exactly once. The values follow the `meridian-seo-standard`
 * contract: one canonical self-name per property, and a Person entity whose
 * `@id` is shared across every host in the ecosystem so search engines resolve
 * the four domains to a single author.
 */

export const SITE = {
  name: "Systems Lab",
  tagline: "GitHub backup monitoring and repository telemetry",
  description:
    "Systems Lab monitors automated GitHub repository backups: run health, archive sizes, execution logs, and a retrieval-augmented agent over the backup history.",
  url: "https://github.mishrashardendu22.is-a.dev",
  locale: "en_US",
  author: "Shardendu Mishra",
  repository:
    "https://github.com/MishraShardendu22/github-backup-automation-system",
} as const;

/** Shared across every property in the ecosystem. Do not fork this value. */
export const PERSON_ID = "https://mishrashardendu22.is-a.dev/#person";

export const ECOSYSTEM = {
  portfolio: "https://mishrashardendu22.is-a.dev",
  blog: "https://blogs.mishrashardendu22.is-a.dev",
  systemsLab: "https://github.mishrashardendu22.is-a.dev",
  links: "https://mishrashardendu22.is-a.dev/links",
  pixelArt: "https://pixel-art-8-bit.mishrashardendu22.is-a.dev",
  treasureHunt: "https://treasure-hunt.mishrashardendu22.is-a.dev",
} as const;

export const SAME_AS: readonly string[] = [
  "https://github.com/MishraShardendu22",
  "https://www.linkedin.com/in/shardendumishra22/",
  "https://twitter.com/Shardendu_M",
  ECOSYSTEM.portfolio,
  ECOSYSTEM.blog,
  ECOSYSTEM.systemsLab,
  ECOSYSTEM.pixelArt,
  ECOSYSTEM.treasureHunt,
];

/** Routes that are safe to expose to crawlers. */
export const PUBLIC_ROUTES = [
  { path: "/", changeFrequency: "hourly", priority: 1 },
  { path: "/backups", changeFrequency: "hourly", priority: 0.9 },
  { path: "/analytics", changeFrequency: "daily", priority: 0.8 },
  { path: "/analytics/runs", changeFrequency: "hourly", priority: 0.7 },
  { path: "/analytics/snapshots", changeFrequency: "daily", priority: 0.7 },
  { path: "/live", changeFrequency: "always", priority: 0.6 },
  { path: "/tools", changeFrequency: "weekly", priority: 0.5 },
  { path: "/tools/stats", changeFrequency: "daily", priority: 0.5 },
] as const;

/** Routes behind the agent login, or otherwise not worth indexing. */
export const PRIVATE_ROUTES = [
  "/ai",
  "/ai/",
  "/embeddings",
  "/search-playground",
] as const;

export function siteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE.url}/#website`,
        url: SITE.url,
        name: SITE.name,
        description: SITE.description,
        inLanguage: "en-US",
        publisher: { "@id": PERSON_ID },
      },
      {
        "@type": "Person",
        "@id": PERSON_ID,
        name: SITE.author,
        url: ECOSYSTEM.portfolio,
        jobTitle: "Software Developer and Engineer",
        sameAs: SAME_AS,
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE.url}/#application`,
        name: SITE.name,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web",
        description: SITE.description,
        url: SITE.url,
        author: { "@id": PERSON_ID },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
      },
    ],
  };
}
