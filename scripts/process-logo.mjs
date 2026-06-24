#!/usr/bin/env node
// One-off logo asset processing: takes the source ChatGPT-generated PNG (white
// background, icon + wordmark combined), makes the white background transparent,
// isolates just the icon glyph (the wordmark stays as real CSS text elsewhere, for
// accessibility/retina-sharpness/dark-mode reasons), and exports the sizes the app
// actually needs. Not part of the app build — run once, output committed to public/.
import sharp from 'sharp'
import { writeFileSync } from 'node:fs'

const SRC = '/Users/kumardyutit/Downloads/ChatGPT Image Jun 24, 2026, 10_21_09 AM.png'
const OUT_DIR = '/Users/kumardyutit/Showcase/casefile/public'

async function makeTransparent(inputBuffer) {
  const img = sharp(inputBuffer).ensureAlpha()
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  for (let i = 0; i < width * height; i++) {
    const idx = i * channels
    const r = data[idx], g = data[idx + 1], b = data[idx + 2]
    // Soft threshold: how "white" is this pixel (0 = not white at all, 1 = pure white).
    // Scales alpha down smoothly near the background instead of a hard cutoff, so
    // anti-aliased edges on the gradient icon/sparkle don't get a jagged cutout.
    const whiteness = Math.min(r, g, b) / 255
    const minWhitenessToFade = 0.82
    if (whiteness > minWhitenessToFade) {
      const fade = (whiteness - minWhitenessToFade) / (1 - minWhitenessToFade)
      data[idx + 3] = Math.round(data[idx + 3] * (1 - fade))
    }
  }
  return sharp(data, { raw: { width, height, channels } }).png()
}

async function main() {
  const srcBuffer = await sharp(SRC).toBuffer()

  // Manually verified by visually inspecting crops of the source image (1536x1024):
  // the icon glyph sits entirely within x=0..555; the wordmark "Showcase" starts
  // immediately after.
  //
  // Order matters here: trim() relies on color/contrast against the background to
  // find content bounds, which works reliably on the clean white-background source.
  // Doing it AFTER the alpha-fade step instead produced "bad extract area" --
  // trim() got confused once large swaths of the image already had partially-faded
  // alpha, apparently finding no content with enough contrast left to bound. So:
  // extract + trim first on the original white-bg image, THEN make transparent.
  // Note: chaining .extract().trim() directly in one pipeline produced "bad extract
  // area" in this sharp version -- materializing to a buffer between the two steps
  // (rather than one continuous pipeline) avoids whatever internal bounds
  // miscomputation that chain triggers.
  const splitX = 555
  const srcMeta = await sharp(srcBuffer).metadata()
  const extracted = await sharp(srcBuffer)
    .extract({ left: 0, top: 0, width: Math.min(splitX, srcMeta.width), height: srcMeta.height })
    .toBuffer()
  const iconOnWhite = await sharp(extracted).trim({ threshold: 10 }).toBuffer()
  const iconRegion = await (await makeTransparent(iconOnWhite)).toBuffer()

  // Master icon, square canvas, generous padding so it never looks cramped at small
  // sizes. fit:'contain' with a transparent background does the centering+padding
  // math in one safe step rather than computing extend() offsets by hand.
  const iconMeta = await sharp(iconRegion).metadata()
  const padded = Math.round(Math.max(iconMeta.width, iconMeta.height) * 1.35)
  const masterIcon = await sharp(iconRegion)
    .resize(padded, padded, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(512, 512)
    .png()
    .toBuffer()
  writeFileSync(`${OUT_DIR}/logo-icon.png`, masterIcon)

  for (const size of [32, 64, 192]) {
    const resized = await sharp(masterIcon).resize(size, size).png().toBuffer()
    writeFileSync(`${OUT_DIR}/logo-icon-${size}.png`, resized)
  }

  // Apple touch icon: opaque background throughout (transparency renders inconsistently
  // on iOS home screens), a dark backing matching the app's actual dark theme rather
  // than plain white. flatten() fills the icon's own transparent pixels with the dark
  // color FIRST -- extend() alone only pads new pixels around the existing image, it
  // does not fill transparency already inside it, which left a transparent hole in an
  // earlier version of this script.
  const appleIcon = await sharp(masterIcon)
    .resize(140, 140)
    .flatten({ background: '#0a0a0f' })
    .extend({ top: 20, bottom: 20, left: 20, right: 20, background: '#0a0a0f' })
    .png()
    .toBuffer()
  writeFileSync(`${OUT_DIR}/apple-icon.png`, appleIcon)

  // Full lockup (icon + real wordmark area) kept too, in case a future marketing
  // surface wants the combined raster instead of icon+CSS-text. Same trim-before-
  // transparency ordering as above.
  const fullOnWhite = await sharp(srcBuffer).trim({ threshold: 10 }).toBuffer()
  const fullLockupSharp = await makeTransparent(fullOnWhite)
  const fullLockup = await fullLockupSharp.toBuffer()
  writeFileSync(`${OUT_DIR}/logo-full.png`, fullLockup)

  console.log('Done. Wrote logo-icon.png (512), logo-icon-{32,64,192}.png, apple-icon.png, logo-full.png to', OUT_DIR)
}

main().catch((e) => { console.error(e); process.exit(1) })
