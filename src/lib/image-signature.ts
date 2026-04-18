export type DetectedImageFormat = "png" | "jpeg" | "gif" | "webp" | "heic" | null;

function hasBytes(buffer: Buffer, offset: number, bytes: number[]) {
  return bytes.every((value, index) => buffer[offset + index] === value);
}

export function detectImageFormat(buffer: Buffer): DetectedImageFormat {
  if (buffer.length >= 8 && hasBytes(buffer, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "png";
  }

  if (buffer.length >= 3 && hasBytes(buffer, 0, [0xff, 0xd8, 0xff])) {
    return "jpeg";
  }

  if (buffer.length >= 6) {
    const header = buffer.subarray(0, 6).toString("ascii");

    if (header === "GIF87a" || header === "GIF89a") {
      return "gif";
    }
  }

  if (buffer.length >= 12) {
    const riff = buffer.subarray(0, 4).toString("ascii");
    const webp = buffer.subarray(8, 12).toString("ascii");

    if (riff === "RIFF" && webp === "WEBP") {
      return "webp";
    }
  }

  if (buffer.length >= 12) {
    const boxType = buffer.subarray(4, 8).toString("ascii");
    const brand = buffer.subarray(8, 12).toString("ascii");

    if (boxType === "ftyp" && ["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) {
      return "heic";
    }
  }

  return null;
}
