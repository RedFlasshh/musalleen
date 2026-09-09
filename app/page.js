"use client";

// Placeholder shell for Phase 1 (infra scaffolding) — proves the app-router
// setup, safe-area handling, and font/theme tokens work end-to-end before
// Phase 2 (auth + counter) replaces this with the real app. Not the final UI.

const C = {
  bg: "#0B1917", surface: "#122622", ivory: "#F4EFE2",
  gold: "#C9A24B", goldBright: "#E8CD86", muted: "#8BA79A",
};

export default function Home() {
  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.ivory, position: "relative" }}>
      <div
        style={{
          maxWidth: 420,
          margin: "0 auto",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "calc(40px + env(safe-area-inset-top)) 24px calc(40px + env(safe-area-inset-bottom))",
        }}
      >
        <div className="amiri" style={{ fontSize: 34, color: C.goldBright, lineHeight: 1.8, marginBottom: 10 }}>
          اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ
        </div>
        <div className="display" style={{ fontSize: 36, fontWeight: 600, marginBottom: 8 }}>
          Musalleen
        </div>
        <div style={{ fontSize: 13, color: C.muted, letterSpacing: 1, lineHeight: 1.6 }}>
          Those Who Send Blessings Upon the Prophet ﷺ
        </div>
        <div style={{ marginTop: 28, fontSize: 12.5, color: C.muted, lineHeight: 1.6 }}>
          Core counter and sign-in land in Phase 2.
        </div>
      </div>
    </div>
  );
}
