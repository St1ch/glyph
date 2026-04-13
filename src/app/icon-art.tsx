type GlyphIconArtProps = {
  size: number;
};

export function GlyphIconArt({ size }: GlyphIconArtProps) {
  const outerInset = Math.round(size * 0.065);
  const frameInset = Math.round(size * 0.11);
  const glowSize = Math.round(size * 0.34);
  const glowOffset = Math.round(size * 0.09);
  const markSize = Math.round(size * 0.48);
  const cutInset = Math.round(markSize * 0.24);
  const openingWidth = Math.round(markSize * 0.34);
  const openingHeight = Math.round(markSize * 0.26);
  const openingTop = Math.round(markSize * 0.12);
  const barWidth = Math.round(markSize * 0.34);
  const barHeight = Math.round(markSize * 0.14);
  const barRight = Math.round(markSize * 0.13);
  const barTop = Math.round(markSize * 0.5);
  const accentDot = Math.round(size * 0.085);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        alignItems: "center",
        justifyContent: "center",
        background: "#171717",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: outerInset,
          display: "flex",
          borderRadius: Math.round(size * 0.24),
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: glowOffset,
          left: glowOffset,
          width: glowSize,
          height: glowSize,
          display: "flex",
          borderRadius: 9999,
          background: "rgba(132,184,44,0.24)",
        }}
      />

      <div
        style={{
          position: "absolute",
          right: Math.round(size * 0.12),
          bottom: Math.round(size * 0.12),
          width: accentDot,
          height: accentDot,
          display: "flex",
          borderRadius: 9999,
          background: "rgba(243,241,234,0.22)",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: frameInset,
          display: "flex",
          borderRadius: Math.round(size * 0.2),
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      />

      <div
        style={{
          position: "relative",
          width: markSize,
          height: markSize,
          display: "flex",
          borderRadius: Math.round(markSize * 0.32),
          background: "#f3f1ea",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: cutInset,
            display: "flex",
            borderRadius: Math.round(markSize * 0.2),
            background: "#171717",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 0,
            top: openingTop,
            width: openingWidth,
            height: openingHeight,
            display: "flex",
            background: "#171717",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: barRight,
            top: barTop,
            width: barWidth,
            height: barHeight,
            display: "flex",
            borderRadius: 9999,
            background: "#84b82c",
          }}
        />
      </div>
    </div>
  );
}
