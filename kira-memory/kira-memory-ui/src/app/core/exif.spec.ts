import {parseExifDate} from './exif';

/** A JPEG start with an APP1 Exif block: IFD0 → Exif IFD holding the given ASCII tags. */
function jpeg(tags: Record<number, string>, little = true): ArrayBuffer {
  const enc = (s: string) => [...s].map(c => c.charCodeAt(0)).concat(0);
  const tiff: number[] = [];
  const u16 = (v: number) => (little ? [v & 255, v >> 8] : [v >> 8, v & 255]);
  const u32 = (v: number) => (little ? [v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24] : [v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255]);
  const keys = Object.keys(tags).map(Number);
  const ifd0 = 8;
  const exifIfd = ifd0 + 2 + 12 + 4;
  let data = exifIfd + 2 + keys.length * 12 + 4;
  tiff.push(...(little ? [0x49, 0x49, 0x2a, 0] : [0x4d, 0x4d, 0, 0x2a]), ...u32(ifd0));
  tiff.push(...u16(1), ...u16(0x8769), ...u16(4), ...u32(1), ...u32(exifIfd), ...u32(0));
  const blobs: number[] = [];
  tiff.push(...u16(keys.length));
  for (const k of keys) {
    const bytes = enc(tags[k]);
    tiff.push(...u16(k), ...u16(2), ...u32(bytes.length), ...u32(data));
    blobs.push(...bytes);
    data += bytes.length;
  }
  tiff.push(...u32(0), ...blobs);
  const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, (exif.length + 2) >> 8, (exif.length + 2) & 255, ...exif, 0xff, 0xd9]).buffer;
}

const NOW = Date.parse('2026-11-26T00:00:00Z');

describe('parseExifDate', () => {
  it('reads DateTimeOriginal as Vietnam time when there is no offset', () => {
    expect(parseExifDate(jpeg({0x9003: '2018:06:14 19:30:00'}), NOW)).toBe(Date.parse('2018-06-14T19:30:00+07:00'));
  });

  it('uses OffsetTimeOriginal when the camera wrote one, in either byte order', () => {
    expect(parseExifDate(jpeg({0x9003: '2023:02:10 08:00:00', 0x9011: '+09:00'}, false), NOW))
      .toBe(Date.parse('2023-02-10T08:00:00+09:00'));
  });

  it('ignores missing, empty and nonsense dates', () => {
    expect(parseExifDate(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer, NOW)).toBeNull();
    expect(parseExifDate(jpeg({0x9003: '0000:00:00 00:00:00'}), NOW)).toBeNull();
    expect(parseExifDate(jpeg({0x9003: '2030:01:01 00:00:00'}), NOW)).toBeNull();
  });
});
