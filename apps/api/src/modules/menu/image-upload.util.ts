import { BadRequestException } from "@nestjs/common";
import sharp from "sharp";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

function isPng(buffer: Buffer) {
  return buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
}

function isJpeg(buffer: Buffer) {
  return buffer.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE);
}

function isWebp(buffer: Buffer) {
  return (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

function isSvg(buffer: Buffer) {
  const prefix = buffer.subarray(0, 256).toString("utf8").trimStart().toLowerCase();
  return prefix.startsWith("<svg") || prefix.startsWith("<?xml");
}

export interface NormalizedMenuImage {
  buffer: Buffer;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  extension: ".png" | ".jpg" | ".webp";
}

export async function normalizeMenuImageUpload(buffer: Buffer): Promise<NormalizedMenuImage> {
  if (!buffer.length) {
    throw new BadRequestException("Image file is empty");
  }

  if (isSvg(buffer)) {
    throw new BadRequestException("SVG uploads are not allowed");
  }

  let target: NormalizedMenuImage["contentType"];
  if (isPng(buffer)) target = "image/png";
  else if (isJpeg(buffer)) target = "image/jpeg";
  else if (isWebp(buffer)) target = "image/webp";
  else throw new BadRequestException("Unsupported image format");

  try {
    const image = sharp(buffer, {
      failOn: "error",
      limitInputPixels: 4096 * 4096,
      animated: false,
    });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error("Missing image dimensions");
    }

    if (target === "image/png") {
      return {
        buffer: await image.png().toBuffer(),
        contentType: "image/png",
        extension: ".png",
      };
    }
    if (target === "image/webp") {
      return {
        buffer: await image.webp({ quality: 90 }).toBuffer(),
        contentType: "image/webp",
        extension: ".webp",
      };
    }
    return {
      buffer: await image.jpeg({ quality: 90, mozjpeg: true }).toBuffer(),
      contentType: "image/jpeg",
      extension: ".jpg",
    };
  } catch {
    throw new BadRequestException("Invalid image data");
  }
}
