import { ImageResponse } from "next/og";
import { GlyphIconArt } from "./icon-art";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<GlyphIconArt size={size.width} />, size);
}
