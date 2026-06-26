import { ImageResponse } from "next/og";

export const alt = "Pipeline Pressure Test — score your open pipeline in seconds";
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
          justifyContent: "center",
          padding: 64,
          background: "linear-gradient(135deg, #ffffff 0%, #f0f4ff 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 28,
            fontWeight: 600,
            color: "#2563eb",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Pipeline Pressure Test
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 52,
            fontWeight: 700,
            color: "#0b1220",
            lineHeight: 1.15,
            maxWidth: 900,
          }}
        >
          Score your open pipeline in seconds
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 24,
            color: "#5b6573",
            maxWidth: 800,
          }}
        >
          0–100 health score · worst deals named · runs entirely in your browser
        </div>
        <div
          style={{
            marginTop: 48,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: "50%",
              border: "12px solid #16a34a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 48,
              fontWeight: 700,
              color: "#16a34a",
            }}
          >
            87
          </div>
          <div style={{ fontSize: 18, color: "#5b6573" }}>
            No signup · No upload · Client-side only
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
