import type { CSSProperties, PointerEvent } from "react";

type GlyphShape = "orbit" | "squircle" | "diamond" | "hex" | "capsule" | "shard" | "arch" | "spire";
type GlyphSymbol = "spark" | "flame" | "cloud" | "wave" | "bolt" | "drop" | "moon" | "eye" | "pixels" | "signal" | "comet" | "crown";
type GlyphTone = "lime" | "mint" | "amber" | "rose" | "violet" | "cyan" | "slate" | "cream" | "ember" | "moss";

type GlyphParts = {
  shape: GlyphShape;
  symbol: GlyphSymbol;
  containerColor: string;
  symbolColor: string;
};

const shapes: GlyphShape[] = ["orbit", "squircle", "diamond", "hex", "capsule", "shard", "arch", "spire"];
const symbols: GlyphSymbol[] = ["spark", "flame", "cloud", "wave", "bolt", "drop", "moon", "eye", "pixels", "signal", "comet", "crown"];

const toneMap: Record<GlyphTone, { main: string; ink: string }> = {
  lime: { main: "#9bd21d", ink: "#f4f0d8" },
  mint: { main: "#54d89b", ink: "#f4f0d8" },
  amber: { main: "#e6b84c", ink: "#fff3c4" },
  rose: { main: "#df6b8f", ink: "#fff0f5" },
  violet: { main: "#9b7cf0", ink: "#f5f0ff" },
  cyan: { main: "#54bddd", ink: "#effbff" },
  slate: { main: "#8f9680", ink: "#f4f0d8" },
  cream: { main: "#f4f0d8", ink: "#11140f" },
  ember: { main: "#f06c2f", ink: "#fff3e8" },
  moss: { main: "#6c8d3d", ink: "#f4f0d8" },
};

const shapeNames: Record<GlyphShape, string> = {
  orbit: "Орбита",
  squircle: "Скругленный квадрат",
  diamond: "Ромб",
  hex: "Шестиугольник",
  capsule: "Капсула",
  shard: "Осколок",
  arch: "Арка",
  spire: "Шпиль",
};

const symbolNames: Record<GlyphSymbol, string> = {
  spark: "Искра",
  flame: "Пламя",
  cloud: "Облако",
  wave: "Волна",
  bolt: "Молния",
  drop: "Капля",
  moon: "Луна",
  eye: "Око",
  pixels: "Пиксели",
  signal: "Сигнал",
  comet: "Комета",
  crown: "Корона",
};

const fallbackGlyph: GlyphParts = {
  shape: "orbit",
  symbol: "cloud",
  containerColor: "9bd21d",
  symbolColor: "f4f0d8",
};

const shapeAliases: Record<string, GlyphShape> = {
  orb: "orbit",
  core: "spire",
};

const symbolAliases: Record<string, GlyphSymbol> = {
  leaf: "drop",
  pixel: "pixels",
  ring: "signal",
};

const hexPattern = /^[0-9a-f]{6}$/i;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeHex(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  const clean = value.replace("#", "");
  return hexPattern.test(clean) ? clean.toLowerCase() : fallback;
}

function toHex(value: string) {
  return `#${value}`;
}

function rgbToHex(r: number, g: number, b: number) {
  return [r, g, b].map((part) => clamp(Math.round(part), 0, 255).toString(16).padStart(2, "0")).join("");
}

function hexToRgb(value: string) {
  const clean = normalizeHex(value, fallbackGlyph.containerColor);
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHsv(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;

  if (delta !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    if (max === bn) h = 60 * ((rn - gn) / delta + 4);
  }

  return {
    h: h < 0 ? h + 360 : h,
    s: max === 0 ? 0 : delta / max,
    v: max,
  };
}

function hsvToRgb(h: number, s: number, v: number) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  return {
    r: (r + m) * 255,
    g: (g + m) * 255,
    b: (b + m) * 255,
  };
}

function hexToHsv(value: string) {
  const rgb = hexToRgb(value);
  return rgbToHsv(rgb.r, rgb.g, rgb.b);
}

function hsvToHex(h: number, s: number, v: number) {
  const rgb = hsvToRgb(h, s, v);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

export function createGlyphValue(parts: GlyphParts) {
  return `glyph:${parts.shape}:${parts.symbol}:${normalizeHex(parts.containerColor, fallbackGlyph.containerColor)}:${normalizeHex(parts.symbolColor, fallbackGlyph.symbolColor)}`;
}

export function isGlyphValue(value: string) {
  return value.startsWith("glyph:");
}

export function parseGlyphValue(value: string): GlyphParts {
  const [, rawShape, rawSymbol, rawContainerColor, rawSymbolColor] = value.split(":");
  const shape = shapeAliases[rawShape] ?? rawShape;
  const symbol = symbolAliases[rawSymbol] ?? rawSymbol;
  const legacyTone = toneMap[rawContainerColor as GlyphTone];
  const fallbackContainer = legacyTone?.main.replace("#", "") ?? fallbackGlyph.containerColor;
  const fallbackSymbol = legacyTone?.ink.replace("#", "") ?? fallbackGlyph.symbolColor;

  return {
    shape: shapes.includes(shape as GlyphShape) ? (shape as GlyphShape) : fallbackGlyph.shape,
    symbol: symbols.includes(symbol as GlyphSymbol) ? (symbol as GlyphSymbol) : fallbackGlyph.symbol,
    containerColor: normalizeHex(rawContainerColor, fallbackContainer),
    symbolColor: normalizeHex(rawSymbolColor, fallbackSymbol),
  };
}

export function glyphLabel(value: string) {
  const glyph = parseGlyphValue(value);
  return `${shapeNames[glyph.shape]}, ${symbolNames[glyph.symbol]}, #${glyph.containerColor.toUpperCase()}, #${glyph.symbolColor.toUpperCase()}`;
}

function maskStyle(url: string, color: string): CSSProperties {
  return {
    backgroundColor: color,
    WebkitMaskImage: `url(${url})`,
    maskImage: `url(${url})`,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskSize: "contain",
    maskSize: "contain",
  };
}

export function GlyphMark({
  value,
  size = 56,
  className = "",
}: {
  value: string;
  size?: number;
  className?: string;
  inset?: number;
}) {
  const glyph = parseGlyphValue(value);
  const containerColor = toHex(glyph.containerColor);
  const symbolColor = toHex(glyph.symbolColor);

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-[inherit] ${className}`}
      style={{ width: size, height: size, "--glyph-glow": `${containerColor}66` } as CSSProperties}
      aria-label={glyphLabel(value)}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 block drop-shadow-[0_0_18px_var(--glyph-glow)]"
        style={maskStyle(`/glyph-kit/shapes/shape-${glyph.shape}.svg`, containerColor)}
      />
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 block h-[62%] w-[62%] -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_3px_8px_var(--glyph-glow)]"
        style={maskStyle(`/glyph-kit/symbols/symbol-${glyph.symbol}.svg`, symbolColor)}
      />
    </span>
  );
}

function mutateGlyph(value: string, patch: Partial<GlyphParts>) {
  return createGlyphValue({ ...parseGlyphValue(value), ...patch });
}

function ColorControl({
  title,
  value,
  onChange,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const hsv = hexToHsv(value);
  const hueColor = `hsl(${hsv.h} 100% 50%)`;
  const moveSquare = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const s = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const v = 1 - clamp((event.clientY - rect.top) / rect.height, 0, 1);
    onChange(hsvToHex(hsv.h, s, v));
  };
  const moveHue = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const h = clamp((event.clientX - rect.left) / rect.width, 0, 1) * 360;
    onChange(hsvToHex(h, hsv.s, hsv.v));
  };

  return (
    <div>
      <div className="mb-2 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{title}</div>
      <div className="rounded-[18px] border border-[var(--line)] bg-[var(--panel)] p-3">
        <div className="mb-3 flex items-center gap-3">
          <span className="h-9 w-12 rounded-full border border-[var(--line)]" style={{ background: toHex(value) }} />
          <span className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">#{value}</span>
        </div>
        <div
          role="slider"
          tabIndex={0}
          aria-label={`${title}: насыщенность и яркость`}
          aria-valuetext={`#${value}`}
          className="relative h-36 cursor-crosshair overflow-hidden rounded-[14px] border border-[var(--line)]"
          style={{
            background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), ${hueColor}`,
          }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            moveSquare(event);
          }}
          onPointerMove={(event) => {
            if (event.buttons === 1) moveSquare(event);
          }}
        >
          <span
            className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.65),0_2px_8px_rgba(0,0,0,0.45)]"
            style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: toHex(value) }}
          />
        </div>
        <div
          role="slider"
          tabIndex={0}
          aria-label={`${title}: оттенок`}
          aria-valuetext={`${Math.round(hsv.h)} градусов`}
          className="relative mt-3 h-4 cursor-pointer rounded-full border border-[var(--line)]"
          style={{
            background: "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
          }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            moveHue(event);
          }}
          onPointerMove={(event) => {
            if (event.buttons === 1) moveHue(event);
          }}
        >
          <span
            className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.65),0_2px_8px_rgba(0,0,0,0.45)]"
            style={{ left: `${(hsv.h / 360) * 100}%`, background: hueColor }}
          />
        </div>
      </div>
    </div>
  );
}

export function GlyphMarkPicker({
  value,
  onSelect,
  compact = false,
}: {
  value: string;
  onSelect: (value: string) => void;
  compact?: boolean;
}) {
  const current = parseGlyphValue(value);

  return (
    <div className="rounded-[24px] border border-[var(--line)] bg-[var(--panel-soft)] p-4">
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-[24px] border border-[var(--line)] bg-[var(--panel)] shadow-[0_0_32px_-18px_var(--glyph-glow)]">
          <GlyphMark value={value} size={60} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--text)]">Личный знак GLYPH</div>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            Комбинация контейнера, символа и двух цветов. Это не картинка, а личный знак, собранный из ваших SVG-заготовок.
          </p>
          <div className="mt-2 text-xs text-[var(--accent)]">{glyphLabel(value)}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-4">
        <div>
          <div className="mb-2 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Контейнер</div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {shapes.map((shape) => (
              <button
                key={shape}
                type="button"
                onClick={() => onSelect(mutateGlyph(value, { shape }))}
                className={`grid h-12 place-items-center rounded-[16px] border transition ${current.shape === shape ? "border-[var(--accent)] bg-[var(--accent)]/14" : "border-[var(--line)] bg-[var(--panel)] hover:bg-white/[0.04]"}`}
                title={shapeNames[shape]}
              >
                <GlyphMark value={mutateGlyph(value, { shape })} size={34} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Символ</div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {symbols.map((symbol) => (
              <button
                key={symbol}
                type="button"
                onClick={() => onSelect(mutateGlyph(value, { symbol }))}
                className={`grid h-12 place-items-center rounded-[16px] border transition ${current.symbol === symbol ? "border-[var(--accent)] bg-[var(--accent)]/14" : "border-[var(--line)] bg-[var(--panel)] hover:bg-white/[0.04]"}`}
                title={symbolNames[symbol]}
              >
                <GlyphMark value={mutateGlyph(value, { symbol })} size={34} />
              </button>
            ))}
          </div>
        </div>

        <div className={`grid gap-4 ${compact ? "" : "sm:grid-cols-2"}`}>
          <ColorControl
            title="Цвет контейнера"
            value={current.containerColor}
            onChange={(containerColor) => onSelect(mutateGlyph(value, { containerColor }))}
          />
          <ColorControl
            title="Цвет символа"
            value={current.symbolColor}
            onChange={(symbolColor) => onSelect(mutateGlyph(value, { symbolColor }))}
          />
        </div>
      </div>
    </div>
  );
}

export const defaultUserGlyph = createGlyphValue({
  shape: "orbit",
  symbol: "cloud",
  containerColor: "9bd21d",
  symbolColor: "f4f0d8",
});

export const defaultClanGlyph = createGlyphValue({
  shape: "hex",
  symbol: "spark",
  containerColor: "6c8d3d",
  symbolColor: "f4f0d8",
});
