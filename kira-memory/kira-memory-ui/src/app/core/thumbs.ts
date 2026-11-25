export interface Prepared { thumb: Blob; width: number | null; height: number | null; }

const MAX = 480;

/**
 * Builds the JPEG thumbnail in the browser (it decodes more formats than the server could) and reads the size.
 * Files the browser cannot decode (e.g. HEIC outside Safari) get a drawn placeholder instead.
 */
export async function prepare(file: File): Promise<Prepared> {
  try {
    if (file.type.startsWith('video/')) return await fromVideo(file);
    const bitmap = await createImageBitmap(file);
    const result = {thumb: await draw(bitmap, bitmap.width, bitmap.height), width: bitmap.width, height: bitmap.height};
    bitmap.close();
    return result;
  } catch {
    return {thumb: await placeholder(), width: null, height: null};
  }
}

async function fromVideo(file: File): Promise<Prepared> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = url;
    await new Promise<void>((ok, fail) => { video.onloadeddata = () => ok(); video.onerror = () => fail(); });
    video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
    await new Promise<void>(ok => { video.onseeked = () => ok(); });
    return {thumb: await draw(video, video.videoWidth, video.videoHeight), width: video.videoWidth, height: video.videoHeight};
  } finally {
    URL.revokeObjectURL(url);
  }
}

function draw(source: CanvasImageSource, w: number, h: number): Promise<Blob> {
  const scale = Math.min(1, MAX / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return toJpeg(canvas);
}

function placeholder(): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 240;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#ffd6df';
  c.fillRect(0, 0, 240, 240);
  c.fillStyle = '#e11d48';
  c.translate(120, 128);
  c.beginPath();
  c.moveTo(0, 40);
  c.bezierCurveTo(-70, -5, -35, -60, 0, -25);
  c.bezierCurveTo(35, -60, 70, -5, 0, 40);
  c.fill();
  return toJpeg(canvas);
}

function toJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((ok, fail) => canvas.toBlob(b => (b ? ok(b) : fail(new Error('thumbnail'))), 'image/jpeg', 0.82));
}
