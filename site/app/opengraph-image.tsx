import { ImageResponse } from "next/og";

export const alt = "birdsEye - see a whole codebase at one glance";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#171512",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(600px 400px at 20% 0%, rgba(217,119,87,0.22), transparent)",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="52" height="52" viewBox="16 19 208 208">
            <path
              transform="translate(0 8)"
              d="M120 52C129 54 133 66 134 82C150 92 186 116 210 146C213 150 211 154 206 153C176 150 150 140 133 128C132 145 128 164 120 178C112 164 108 145 107 128C90 140 64 150 34 153C29 154 27 150 30 146C54 116 90 92 106 82C107 66 111 54 120 52Z"
              fill="#d97757"
            />
          </svg>
          <span style={{ fontSize: 34, color: "#ece7dc", fontWeight: 600 }}>birdsEye</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <span
            style={{
              fontSize: 76,
              lineHeight: 1.05,
              color: "#ece7dc",
              letterSpacing: "-0.02em",
              maxWidth: 900,
            }}
          >
            See a whole codebase{" "}
            <span style={{ color: "#d97757", fontStyle: "italic" }}>at one glance</span>
          </span>
          <span style={{ fontSize: 28, color: "#a49b8c", maxWidth: 820 }}>
            A Claude Code plugin. One command, one HTML file: the modules, routes and specs
            of a repo, mapped.
          </span>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          {["#d97757", "#a9b764", "#e3a857", "#b58bd4", "#e0708a"].map((c) => (
            <div key={c} style={{ width: 16, height: 16, borderRadius: 999, background: c }} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
