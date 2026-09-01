export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = Object.freeze(["image/png", "image/jpeg", "image/webp"]);

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
  return canvas.toDataURL("image/webp", 0.82);
}
