import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "teammaker.lol — Balanced In-House Team Generator";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0d0f17",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Background grid pattern */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(200,149,42,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(200,149,42,0.04) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Glow */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 600,
            height: 300,
            background: "radial-gradient(ellipse, rgba(200,149,42,0.12) 0%, transparent 70%)",
          }}
        />

        {/* Role icons row */}
        <div
          style={{
            display: "flex",
            gap: 24,
            marginBottom: 48,
            opacity: 0.5,
          }}
        >
          {["▲", "◆", "●", "★", "♦"].map((icon, i) => (
            <div
              key={i}
              style={{
                width: 48,
                height: 48,
                borderRadius: 8,
                border: "1px solid rgba(200,149,42,0.3)",
                background: "rgba(200,149,42,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#c8952a",
                fontSize: 20,
              }}
            >
              {icon}
            </div>
          ))}
        </div>

        {/* Main title */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 0,
            marginBottom: 20,
          }}
        >
          <span
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: "#e8eaf0",
              letterSpacing: "-2px",
            }}
          >
            teammaker
          </span>
          <span
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: "#c8952a",
              letterSpacing: "-2px",
            }}
          >
            .lol
          </span>
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 24,
            color: "rgba(200,210,230,0.55)",
            textAlign: "center",
            maxWidth: 680,
            lineHeight: 1.4,
          }}
        >
          Balanced team generator for League of Legends in-house games
        </div>

        {/* Bottom badge */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 20px",
            borderRadius: 999,
            border: "1px solid rgba(200,149,42,0.25)",
            background: "rgba(200,149,42,0.07)",
          }}
        >
          <span style={{ fontSize: 14, color: "#c8952a", fontWeight: 600 }}>
            Rank-aware · Role-aware · Constraint-supported
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
