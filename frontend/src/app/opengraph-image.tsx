import { ImageResponse } from "next/og";
import { SITE } from "@/constants/site";

export const runtime = "edge";
export const alt = `${SITE.name} - ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Social card. Rendered with the Meridian palette and the same masthead
 * rhythm the application uses: eyebrow, display title, supporting line.
 * Fonts fall back to the platform serif because edge rendering cannot load the
 * variable font used in the app.
 */
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#121211",
        backgroundImage:
          "radial-gradient(circle at 85% -10%, rgba(139,124,255,0.20), transparent 620px)",
        padding: "72px 80px",
        color: "#f5f3ee",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: 44,
            borderRadius: 10,
            border: "1px solid rgba(139,124,255,0.32)",
            background: "rgba(139,124,255,0.10)",
            color: "#a396ff",
            fontSize: 20,
          }}
        >
          SL
        </div>
        <div
          style={{
            fontSize: 15,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: "#8f8b83",
          }}
        >
          {SITE.author}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            fontSize: 92,
            lineHeight: 1,
            letterSpacing: -3,
            fontFamily: "Georgia, serif",
          }}
        >
          {SITE.name}
        </div>
        <div
          style={{
            fontSize: 30,
            lineHeight: 1.4,
            color: "#b7b3aa",
            maxWidth: 820,
          }}
        >
          {SITE.tagline}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid #2e2e2b",
          paddingTop: 28,
          fontSize: 20,
          color: "#8f8b83",
        }}
      >
        <span>github.mishrashardendu22.is-a.dev</span>
        <span style={{ color: "#a396ff" }}>Backup telemetry, live</span>
      </div>
    </div>,
    size,
  );
}
