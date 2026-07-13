import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * Chiffrement AES-256-GCM des secrets sensibles (clés API Vendus).
 * La clé maître vit dans MESA_ENCRYPTION_KEY (env Vercel), jamais en base ni au client.
 * Générer une clé : `openssl rand -base64 32`
 */

function masterKey(): Buffer {
  const raw = process.env.MESA_ENCRYPTION_KEY;
  if (!raw) throw new Error("MESA_ENCRYPTION_KEY manquante");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("MESA_ENCRYPTION_KEY doit être 32 octets encodés en base64");
  }
  return key;
}

/** Renvoie une chaîne `iv.tag.ciphertext` (chaque partie en base64). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("base64")).join(".");
}

/** Déchiffre une chaîne produite par encryptSecret. */
export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Format de secret chiffré invalide");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    masterKey(),
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
