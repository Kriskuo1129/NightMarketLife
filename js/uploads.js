export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = Object.freeze(["image/png", "image/jpeg", "image/webp"]);
export const CLOTHES_OUTPUT_WIDTH = 500;
export const CLOTHES_OUTPUT_HEIGHT = 640;
export const IMAGE_OUTPUT_QUALITY = 0.82;

export function validateImageFile(file) {
  if (!file || !ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return { ok: false, message: "請選擇 PNG、JPG 或 WEBP 圖片。" };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, message: "圖片不可超過 5 MB，請選擇較小的檔案。" };
  }
  return { ok: true, message: "" };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("圖片讀取失敗，請重試。"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("無法解析這張圖片，請換一個檔案。"));
    image.src = src;
  });
}

export function calculateCenterCrop(sourceWidth, sourceHeight, targetWidth = CLOTHES_OUTPUT_WIDTH, targetHeight = CLOTHES_OUTPUT_HEIGHT) {
  if (![sourceWidth, sourceHeight, targetWidth, targetHeight].every((value) => Number.isFinite(value) && value > 0)) {
    throw new TypeError("圖片裁切尺寸必須是正數。");
  }
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  if (sourceRatio > targetRatio) {
    const width = sourceHeight * targetRatio;
    return { x: (sourceWidth - width) / 2, y: 0, width, height: sourceHeight };
  }
  const height = sourceWidth / targetRatio;
  return { x: 0, y: (sourceHeight - height) / 2, width: sourceWidth, height };
}

function encodeCanvas(canvas) {
  const webp = canvas.toDataURL("image/webp", IMAGE_OUTPUT_QUALITY);
  if (webp.startsWith("data:image/webp")) return webp;
  const png = canvas.toDataURL("image/png");
  if (png.startsWith("data:image/png")) return png;
  throw new Error("圖片編碼失敗。");
}

export async function prepareUploadedImage(file, maxDimension = 512) {
  const validation = validateImageFile(file);
  if (!validation.ok) throw new Error(validation.message);
  const originalDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(originalDataUrl);
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("瀏覽器無法處理圖片，請重試。");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return encodeCanvas(canvas);
}

export async function processCustomClothesImage(file) {
  const validation = validateImageFile(file);
  if (!validation.ok) throw new Error(validation.message);
  const originalDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(originalDataUrl);
  const crop = calculateCenterCrop(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = CLOTHES_OUTPUT_WIDTH;
  canvas.height = CLOTHES_OUTPUT_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("瀏覽器無法處理圖片，請重試。");
  try {
    context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
    return encodeCanvas(canvas);
  } catch {
    throw new Error("衣服圖片裁切或編碼失敗，請換一張圖片後重試。");
  }
}
