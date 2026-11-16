import { ImageResponse } from "next/og";

export const alt = "Tweetdle: guess who tweeted it. Five tweets, one author, five guesses.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#f4f1ea";
const INK = "#161616";
const MUTED = "#6b6760";
const ACCENT = "#9c2a1f";

/** Loads a Google font as TTF for the image (the site's own serif). Falls back to the default font. */
async function loadFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      // A non-browser User-Agent gets plain TTF files, which the image renderer can read.
      await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}`, {
        headers: { "User-Agent": "node" },
      })
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

/** The link preview shown when tweetdle.com is pasted into chats and social apps. */
export default async function OpengraphImage() {
  const serif = await loadFont("Source Serif Pro", 700);
  const serifStyle = serif ? { fontFamily: "Serif" } : {};
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BG,
          color: INK,
          padding: "64px 80px",
          borderBottom: `16px solid ${ACCENT}`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ ...serifStyle, fontSize: 44, letterSpacing: -1 }}>Tweetdle</div>
          <div style={{ ...serifStyle, fontSize: 104, letterSpacing: -3, marginTop: 24, lineHeight: 1 }}>
            Who tweeted this?
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            background: "#ffffff",
            border: `3px solid ${INK}`,
            padding: "28px 32px",
            fontSize: 34,
            lineHeight: 1.35,
          }}
        >
          <div style={{ display: "flex", fontSize: 22, color: MUTED, letterSpacing: 2, marginBottom: 10 }}>TWEET 1 OF 5</div>
          <div style={{ display: "flex" }}>
            Five real tweets. One mystery author. Five guesses. A new one every day.
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, color: MUTED }}>
          <span>tweetdle.com</span>
          <span style={{ color: ACCENT, fontWeight: 700 }}>Play today&apos;s puzzle →</span>
        </div>
      </div>
    ),
    serif ? { ...size, fonts: [{ name: "Serif", data: serif, weight: 700, style: "normal" }] } : size,
  );
}
