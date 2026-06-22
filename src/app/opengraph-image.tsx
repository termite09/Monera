import { ImageResponse } from "next/og";

// Open Graph / Twitter share image for the whole site. Next renders this at build
// time and injects the og:image + twitter:image tags automatically, so any link to
// mymonera.com gets a real card instead of a bare grey box.
export const alt =
  "Monera — private budgeting for Revolut, stored in your own Google Drive";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          background: "#1C3557", // --primary
          color: "#FFFFFF",
          padding: "80px",
          fontFamily: "serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 42, opacity: 0.9, marginBottom: 36 }}>
          Monera
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 78,
            fontWeight: 600,
            lineHeight: 1.08,
            maxWidth: 940,
            letterSpacing: -1,
          }}
        >
          Finally know where your money goes.
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 34,
            opacity: 0.82,
            marginTop: 28,
            maxWidth: 900,
            fontFamily: "sans-serif",
          }}
        >
          Private budgeting for Revolut — stored in your own Google Drive.
        </div>
        <div style={{ display: "flex", gap: 18, marginTop: 52, fontFamily: "sans-serif" }}>
          {["Free", "Open-source", "No bank login"].map((t) => (
            <div
              key={t}
              style={{
                display: "flex",
                border: "2px solid rgba(255,255,255,0.4)",
                borderRadius: 999,
                padding: "10px 26px",
                fontSize: 27,
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
