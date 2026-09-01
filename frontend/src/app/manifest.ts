import type { MetadataRoute } from "next";
import { SITE } from "@/constants/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "systems-lab",
    name: `${SITE.name} - ${SITE.tagline}`,
    short_name: SITE.name,
    description: SITE.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#121211",
    theme_color: "#121211",
    categories: ["developer", "productivity", "utilities"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
    ],
    shortcuts: [
      { name: "Backup history", url: "/backups" },
      { name: "Analytics", url: "/analytics" },
      { name: "Live monitor", url: "/live" },
    ],
  };
}
