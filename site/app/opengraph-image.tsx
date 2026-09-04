import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "birdsEye - see how a repo fits together before you touch it";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* Satori, which renders this card, has no inline layout: every box is a flex
   container. Two consequences drive the whole structure below.

   1. Mixed content - a text node with a nested <span> for the accent - is laid
      out as one un-wrappable flex row, which is how the headline used to run
      straight off the right edge. So each line of the headline is its own row,
      and the break is authored rather than left to a wrap that never happens.
   2. Every element with children states display: flex explicitly.

   The fonts are vendored under assets/fonts because Satori will not reach for
   a webfont - without them the card falls back to whatever generic sans the
   renderer has, which is what made it read as somebody else's site. */

const FONT_DIR = join(process.cwd(), "assets", "fonts");
const font = (file: string) => readFile(join(FONT_DIR, file));

const INK = "#ece7dc";
const MUTED = "#a49b8c";
const FAINT = "#7d7466";
const CLAY = "#d97757";
const CANVAS = "#171512";

const NODE_HUES = ["#e3a857", "#d97757", "#b58bd4", "#a9b764"];

export default async function OgImage() {
  const [fraunces, frauncesItalic, outfit, outfitSemi] = await Promise.all([
    font("Fraunces-SemiBold.ttf"),
    font("Fraunces-SemiBoldItalic.ttf"),
    font("Outfit-Regular.ttf"),
    font("Outfit-SemiBold.ttf"),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: CANVAS,
          padding: 72,
          fontFamily: "Outfit",
        }}
      >
        {/* Satori sizes a gradient layer from width/height, not from inset - with
            inset alone this box collapses and the card renders flat. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: size.width,
            height: size.height,
            display: "flex",
            background:
              "radial-gradient(900px 560px at 12% -12%, rgba(217,119,87,0.26), rgba(23,21,18,0) 70%)",
          }}
        />

        {/* wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <svg width="44" height="44" viewBox="16 19 208 208">
            <path
              transform="translate(0 8)"
              d="M120 52C129 54 133 66 134 82C150 92 186 116 210 146C213 150 211 154 206 153C176 150 150 140 133 128C132 145 128 164 120 178C112 164 108 145 107 128C90 140 64 150 34 153C29 154 27 150 30 146C54 116 90 92 106 82C107 66 111 54 120 52Z"
              fill={CLAY}
            />
          </svg>
          <span style={{ fontSize: 30, fontFamily: "Outfit", fontWeight: 600, color: INK }}>
            birdsEye
          </span>
        </div>

        {/* headline - one flex row per line, so nothing has to wrap */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex" }}>
            <span
              style={{
                fontFamily: "Fraunces",
                fontSize: 76,
                lineHeight: 1.08,
                letterSpacing: "-0.02em",
                color: INK,
              }}
            >
              See how a repo fits together
            </span>
          </div>
          <div style={{ display: "flex" }}>
            <span
              style={{
                fontFamily: "Fraunces",
                fontStyle: "italic",
                fontSize: 76,
                lineHeight: 1.08,
                letterSpacing: "-0.02em",
                color: CLAY,
              }}
            >
              before you touch it
            </span>
          </div>
          {/* Broken by hand for the same reason as the headline: left to wrap,
              this lands a one- or two-word orphan on the last line. */}
          <div style={{ display: "flex", flexDirection: "column", marginTop: 30 }}>
            {[
              "One command turns any repo into an interactive flowchart of its",
              "modules, files, and dependencies. Local parse, no model, zero tokens.",
            ].map((line) => (
              <div key={line} style={{ display: "flex" }}>
                <span style={{ fontSize: 27, lineHeight: 1.5, color: MUTED }}>{line}</span>
              </div>
            ))}
          </div>
        </div>

        {/* the five node hues the map itself paints with, and the domain */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 12 }}>
            {NODE_HUES.map((c) => (
              <div
                key={c}
                style={{ width: 14, height: 14, borderRadius: 999, background: c }}
              />
            ))}
          </div>
          <span style={{ fontSize: 24, color: FAINT }}>birdseye.tamal.me</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Fraunces", data: fraunces, style: "normal", weight: 600 },
        { name: "Fraunces", data: frauncesItalic, style: "italic", weight: 600 },
        { name: "Outfit", data: outfit, style: "normal", weight: 400 },
        { name: "Outfit", data: outfitSemi, style: "normal", weight: 600 },
      ],
    },
  );
}
