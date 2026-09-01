/**
 * Regenerates every derived icon from the one source mark.
 *
 *     node scripts/generate-icons.mjs
 *
 * Run it after replacing public/assets/logo_silomis_icon.png — nothing else
 * reads that file to build the favicons, so without this they silently keep
 * showing the previous brand in browser tabs and on home screens, which is the
 * one place a stale asset is most visible and least likely to be noticed.
 *
 * Everything below is derived, so nothing here should ever be hand-edited:
 *   src/app/favicon.ico        16/32/48/64 in one container, for the tab strip
 *   src/app/icon.png           Next's own <link rel="icon"> at 512
 *   src/app/apple-icon.png     iOS home screen, 180, opaque
 *   public/icons/icon-{192,512}.png  manifest, purpose "any"
 *   public/icons/maskable-512.png    manifest, purpose "maskable"
 */
import sharp from "sharp";
import { writeFile, mkdir } from "node:fs/promises";

const SRC = "public/assets/logo_silomis_icon.png";
/** iOS and Android launchers composite an icon over their own background —
 *  black on iOS — so anything they own has to carry its own opaque one. */
const OPAQUE_BG = { r: 255, g: 255, b: 255, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/** The source is exported with a few transparent pixels of slack around the
 *  art. Measuring it means every size below pads from the mark itself rather
 *  than from whatever margin that particular export happened to leave. */
async function trimmed(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, minY = info.height, maxX = -1, maxY = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * info.channels + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error(`${file} is fully transparent`);
  return sharp(file)
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .png()
    .toBuffer();
}

/**
 * The mark centred in a square canvas, scaled so it occupies `coverage` of the
 * side. Kept as one helper because every output below is that same operation
 * with different numbers — the differences are all about who crops the result.
 */
async function square(art, size, coverage, background) {
  const inner = Math.round(size * coverage);
  let pipeline = sharp(art).resize(inner, inner, { fit: "inside", background: TRANSPARENT });
  // Under ~48px the downscale blurs the sandal inside the S into a grey smear
  // and the two stop reading as separate shapes. A mild unsharp pass costs
  // nothing at these sizes and buys back the edge between them.
  if (size <= 48) pipeline = pipeline.sharpen({ sigma: 0.6, m1: 0.6, m2: 2 });
  const scaled = await pipeline.toBuffer();
  const { width, height } = await sharp(scaled).metadata();
  return sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: scaled, left: Math.round((size - width) / 2), top: Math.round((size - height) / 2) }])
    // Palette encoding only from 128px up. The mark is flat vector colour, so
    // 256 entries cost about one unit of channel error on visible pixels and
    // take the 512s from 190KB to 68KB — but on a 16px tab icon there is no
    // size worth saving and every quantised pixel is a large part of the shape.
    .png(size >= 128 ? { compressionLevel: 9, palette: true } : { compressionLevel: 9 })
    .toBuffer();
}

/**
 * Packs PNGs into an .ico. Browsers read PNG-compressed entries, which is what
 * keeps a 64px favicon a few KB instead of the 16KB a raw BMP entry costs.
 *
 * Layout: a 6-byte ICONDIR, then one 16-byte ICONDIRENTRY per image, then the
 * PNG payloads. A side of 256 is written as 0 — the field is one byte.
 */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(images.length, 4);

  const directory = Buffer.alloc(16 * images.length);
  let offset = header.length + directory.length;
  images.forEach(({ size, data }, i) => {
    const e = i * 16;
    directory.writeUInt8(size >= 256 ? 0 : size, e);
    directory.writeUInt8(size >= 256 ? 0 : size, e + 1);
    directory.writeUInt8(0, e + 2); // palette size — 0 for truecolour
    directory.writeUInt8(0, e + 3); // reserved
    directory.writeUInt16LE(1, e + 4); // colour planes
    directory.writeUInt16LE(32, e + 6); // bits per pixel
    directory.writeUInt32LE(data.length, e + 8);
    directory.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });

  return Buffer.concat([header, directory, ...images.map((i) => i.data)]);
}

const art = await trimmed(SRC);
await mkdir("public/icons", { recursive: true });

const written = [];
const write = async (file, buf) => {
  await writeFile(file, buf);
  written.push(`${file}  ${(buf.length / 1024).toFixed(1)} KB`);
};

// Tab strip. No padding at all below 32px: the mark is a thin swoosh around a
// sandal, and at 16 square every pixel spent on margin is one it cannot spare.
const icoSizes = [16, 32, 48, 64];
const entries = [];
for (const size of icoSizes) {
  entries.push({ size, data: await square(art, size, size <= 32 ? 1 : 0.94, TRANSPARENT) });
}
await write("src/app/favicon.ico", ico(entries));

// Everything a browser scales down itself, so a little breathing room is safe.
await write("src/app/icon.png", await square(art, 512, 0.92, TRANSPARENT));
await write("public/icons/icon-192.png", await square(art, 192, 0.92, TRANSPARENT));
await write("public/icons/icon-512.png", await square(art, 512, 0.92, TRANSPARENT));

// iOS draws its own rounded-rect mask and no more, so 0.78 is only margin.
await write("src/app/apple-icon.png", await square(art, 180, 0.78, OPAQUE_BG));

// Android crops a maskable icon to a shape of the launcher's choosing, and the
// only region guaranteed to survive is the circle covering 80% of the side.
// The largest square inside that circle is 80/sqrt(2) ≈ 56.6% of the side.
await write("public/icons/maskable-512.png", await square(art, 512, 0.566, OPAQUE_BG));

console.log(written.join("\n"));
