import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GLYPH",
    short_name: "GLYPH",
    description: "Минималистичная социальная платформа с лентой, кланами, уведомлениями и профилями.",
    start_url: "/",
    display: "standalone",
    background_color: "#111111",
    theme_color: "#84b82c",
    lang: "ru",
    icons: [
      {
        src: "/icon?size=192",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon?size=512",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
