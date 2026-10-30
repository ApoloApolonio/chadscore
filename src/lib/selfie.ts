export const MAX_SELFIE_BYTES = 5 * 1024 * 1024;
export const SELFIE_ACCEPT = "image/jpeg,image/png,image/webp";

/** Valida o arquivo localmente; não identifica rostos nem envia dados. */
export async function validateSelfieFile(file: File): Promise<void> {
  if (!SELFIE_ACCEPT.split(",").includes(file.type)) {
    throw new Error("Escolha uma imagem JPG, PNG ou WebP.");
  }
  if (file.size === 0) {
    throw new Error("O arquivo está vazio. Escolha outra imagem.");
  }
  if (file.size > MAX_SELFIE_BYTES) {
    throw new Error("A imagem deve ter no máximo 5 MB.");
  }

  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const matches = (signature: number[], offset = 0) =>
    signature.every((byte, index) => bytes[offset + index] === byte);
  const validHeader =
    (file.type === "image/jpeg" && matches([0xff, 0xd8, 0xff])) ||
    (file.type === "image/png" &&
      matches([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    (file.type === "image/webp" &&
      matches([0x52, 0x49, 0x46, 0x46]) &&
      matches([0x57, 0x45, 0x42, 0x50], 8));

  if (!validHeader) {
    throw new Error("O conteúdo do arquivo não corresponde ao formato informado.");
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => {
      throw new Error("Não foi possível ler essa imagem. Escolha outra selfie.");
    });
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error("Não foi possível ler essa imagem. Escolha outra selfie.");
    }
    if (image.naturalWidth * image.naturalHeight > 16_000_000) {
      throw new Error("Use uma imagem de até 16 megapixels para o processamento local.");
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}
