import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import sharp from "sharp";
import { normalizeMenuImageUpload } from "./image-upload.util.js";

async function rejects(buffer: Buffer) {
  await assert.rejects(() => normalizeMenuImageUpload(buffer), BadRequestException);
}

async function main() {
  const PNG_1X1 = await sharp({
    create: {
      width: 1,
      height: 1,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  }).png().toBuffer();

  const normalized = await normalizeMenuImageUpload(PNG_1X1);
  assert.equal(normalized.contentType, "image/png");
  assert.equal(normalized.extension, ".png");
  assert.ok(normalized.buffer.length > 0);

  await rejects(Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>", "utf8"));
  await rejects(Buffer.from("not really an image", "utf8"));

  console.log("menu image upload validation tests passed");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
