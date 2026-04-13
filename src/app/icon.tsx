import { ImageResponse } from "next/og";
import { GlyphIconArt } from "./icon-art";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<GlyphIconArt size={size.width} />, size);
}
