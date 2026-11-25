const HEAD_BYTES = 512 * 1024;
const VIETNAM = '+07:00';

/**
 * When the photo was really taken, from its EXIF DateTimeOriginal (JPEG, and HEIC/AVIF that keep EXIF near the start).
 * Returns epoch ms, or null when there is no usable date.
 * shortcut: only scans the first 512 KB; a HEIC that stores EXIF at the end falls back to the file date.
 */
export async function exifTakenAt(file: Blob): Promise<number | null> {
  try {
    return parseExifDate(await file.slice(0, HEAD_BYTES).arrayBuffer());
  } catch {
    return null;
  }
}

export function parseExifDate(buffer: ArrayBuffer, now = Date.now()): number | null {
  const bytes = new Uint8Array(buffer);
  const tiff = findTiff(bytes);
  if (tiff < 0) return null;
  const view = new DataView(buffer);
  const little = bytes[tiff] === 0x49;
  const u16 = (at: number) => view.getUint16(at, little);
  const u32 = (at: number) => view.getUint32(at, little);
  const ascii = (entry: number) => {
    const count = u32(entry + 4);
    const at = count > 4 ? tiff + u32(entry + 8) : entry + 8;
    let s = '';
    for (let i = 0; i < count && bytes[at + i]; i++) s += String.fromCharCode(bytes[at + i]);
    return s;
  };
  const entries = (ifd: number) => {
    const out = new Map<number, number>();
    if (ifd + 2 > bytes.length) return out;
    const n = u16(ifd);
    for (let i = 0; i < n && ifd + 2 + i * 12 + 12 <= bytes.length; i++) out.set(u16(ifd + 2 + i * 12), ifd + 2 + i * 12);
    return out;
  };

  const ifd0 = entries(tiff + u32(tiff + 4));
  const exifPointer = ifd0.get(0x8769);
  const exif = exifPointer === undefined ? new Map<number, number>() : entries(tiff + u32(exifPointer + 8));
  // DateTimeOriginal, then DateTimeDigitized, then the file's DateTime.
  const dateEntry = exif.get(0x9003) ?? exif.get(0x9004) ?? ifd0.get(0x0132);
  if (dateEntry === undefined) return null;
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(ascii(dateEntry));
  if (!m) return null;
  const offsetEntry = exif.get(0x9011);
  const offset = offsetEntry !== undefined && /^[+-]\d{2}:\d{2}$/.test(ascii(offsetEntry)) ? ascii(offsetEntry) : VIETNAM;
  // Cameras write local time; without an offset tag we assume the photo was taken in Vietnam.
  const time = Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${offset}`);
  // Unset camera clocks write 0000:00:00 or 1970; a date in the future is just as wrong.
  return Number.isNaN(time) || time < Date.UTC(1990, 0, 1) || time > now + 86_400_000 ? null : time;
}

/** Offset of the TIFF header that follows "Exif\0\0" (JPEG APP1 and the HEIC Exif item both use that marker). */
function findTiff(b: Uint8Array): number {
  for (let i = 0; i + 10 < b.length; i++) {
    if (b[i] === 0x45 && b[i + 1] === 0x78 && b[i + 2] === 0x69 && b[i + 3] === 0x66 && b[i + 4] === 0 && b[i + 5] === 0) {
      const t = i + 6;
      if ((b[t] === 0x49 && b[t + 1] === 0x49 && b[t + 2] === 0x2a && b[t + 3] === 0)
        || (b[t] === 0x4d && b[t + 1] === 0x4d && b[t + 2] === 0 && b[t + 3] === 0x2a)) return t;
    }
  }
  return -1;
}
