// Inverse photographic registration. Keep the original photograph unchanged;
// sample only the paper surface into a flat material before GPU upload/export.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function curve(points, u) {
  for (let i = 1; i < points.length; i++) {
    if (u <= points[i][0]) {
      const [a, b] = [points[i - 1], points[i]], t = (u - a[0]) / (b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * t;
    }
  }
  return points[points.length - 1][1];
}

export function cardPhotoSample(u, v, registration, out = [0, 0]) {
  const [width, height] = registration.output_px;
  const [left, right] = registration.paper_x_px;
  const top = curve(registration.paper_top_px, u), bottom = curve(registration.paper_bottom_px, u);
  let x = left + (right - left) * u, y = top + (bottom - top) * v;
  // The physical die-cut hole is circular. Its photographed ellipse is a second
  // registration landmark, not a dark disk to paste onto the paper. Correct its
  // local projection smoothly so the real geometric opening has no photo halo.
  const hole = registration.hole;
  if (hole) {
    const dx = (u * width - hole.flat_center_px[0]) / hole.flat_radius_px;
    const dy = (v * height - hole.flat_center_px[1]) / hole.flat_radius_px;
    const radius = Math.hypot(dx, dy), t = clamp((radius - 1.25) / 1.75, 0, 1);
    const weight = 1 - t * t * (3 - 2 * t), m = hole.photo_radius_matrix_px;
    const hx = hole.photo_center_px[0] + m[0] * dx + m[1] * dy;
    const hy = hole.photo_center_px[1] + m[2] * dx + m[3] * dy;
    x += (hx - x) * weight; y += (hy - y) * weight;
  }
  out[0] = x; out[1] = y; return out;
}

export function rectifyCardPhoto(texture, registration, makeCanvas = () => document.createElement('canvas')) {
  if (!registration) return texture;
  const source = texture.image, [width, height] = registration.output_px;
  if (source.width !== registration.source_px[0] || source.height !== registration.source_px[1]) {
    throw new Error('Backing-card photograph dimensions do not match its registration');
  }
  const canvas = makeCanvas(); canvas.width = source.width; canvas.height = source.height;
  const context = canvas.getContext('2d', {willReadFrequently: true}); context.drawImage(source, 0, 0);
  const input = context.getImageData(0, 0, source.width, source.height).data;
  canvas.width = width; canvas.height = height;
  const result = context.createImageData(width, height), output = result.data, point = [0, 0];
  for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
    cardPhotoSample((col + .5) / width, (row + .5) / height, registration, point);
    const x = clamp(point[0], 0, source.width - 1), y = clamp(point[1], 0, source.height - 1);
    const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(x0 + 1, source.width - 1), y1 = Math.min(y0 + 1, source.height - 1);
    const tx = x - x0, ty = y - y0, a = (y0 * source.width + x0) * 4, b = (y0 * source.width + x1) * 4;
    const c = (y1 * source.width + x0) * 4, d = (y1 * source.width + x1) * 4, at = (row * width + col) * 4;
    for (let k = 0; k < 4; k++) output[at + k] =
      (input[a + k] * (1 - tx) + input[b + k] * tx) * (1 - ty) + (input[c + k] * (1 - tx) + input[d + k] * tx) * ty;
  }
  context.putImageData(result, 0, 0);
  texture.image = canvas; texture.needsUpdate = true;
  texture.userData = {...texture.userData, photoRectified: true, sourcePhoto: registration.source_photo};
  return texture;
}
