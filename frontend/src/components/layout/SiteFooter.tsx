import { ECOSYSTEM, SITE } from "@/constants/site";

/**
 * Site-wide footer.
 *
 * This is the product's only crawlable outbound link surface, so every
 * ecosystem link carries real anchor text rather than an icon alone, and
 * first-party links use `rel="noopener"` without `noreferrer` so referral
 * attribution survives between the ecosystem domains.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="m-footer">
      <div className="m-footer__inner">
        <div className="m-footer__col">
          <span className="m-wordmark">
            <span className="m-wordmark__mark" aria-hidden="true">
              SL
            </span>
            <span className="m-wordmark__text">
              <span className="m-wordmark__name">{SITE.author}</span>
              <span className="m-wordmark__product">{SITE.name}</span>
            </span>
          </span>
          <p className="m-footer__note">
            {SITE.tagline}. Backup runs, archive telemetry, and an agent that
            can read the whole history.
          </p>
        </div>

        <nav className="m-footer__col" aria-label="Systems Lab">
          <h2 className="m-footer__heading">Systems Lab</h2>
          <a className="m-footer__link" href="/">
            Dashboard
          </a>
          <a className="m-footer__link" href="/backups">
            Backup history
          </a>
          <a className="m-footer__link" href="/analytics">
            Analytics
          </a>
          <a className="m-footer__link" href="/live">
            Live monitor
          </a>
        </nav>

        <nav className="m-footer__col" aria-label="Ecosystem">
          <h2 className="m-footer__heading">Ecosystem</h2>
          <a
            className="m-footer__link"
            href={ECOSYSTEM.portfolio}
            rel="noopener"
          >
            Shardendu Mishra
          </a>
          <a className="m-footer__link" href={ECOSYSTEM.blog} rel="noopener">
            Engineering Notes
          </a>
          <a className="m-footer__link" href={ECOSYSTEM.links} rel="noopener">
            All links
          </a>
        </nav>

        <nav className="m-footer__col" aria-label="Projects">
          <h2 className="m-footer__heading">Projects</h2>
          <a
            className="m-footer__link"
            href={ECOSYSTEM.pixelArt}
            rel="noopener"
          >
            Pixel Art 8-Bit
          </a>
          <a
            className="m-footer__link"
            href={ECOSYSTEM.treasureHunt}
            rel="noopener"
          >
            Treasure Hunt
          </a>
          <a
            className="m-footer__link"
            href={SITE.repository}
            target="_blank"
            rel="noopener"
          >
            Source on GitHub
          </a>
        </nav>
      </div>

      <div className="m-footer__bar">
        <div className="m-footer__bar-inner">
          <span>
            {year} {SITE.author}
          </span>
          <span>Part of the {SITE.author} product ecosystem</span>
        </div>
      </div>
    </footer>
  );
}
