/**
 * Utilidades para manejo de JIDs (identificadores de WhatsApp/WebSocket).
 */

export function onlyDigits(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

export function toJid(msisdn: string): string {
  return `${onlyDigits(msisdn)}@s.whatsapp.net`;
}

export function phoneFromAny(candidate: unknown): string | null {
  if (!candidate) return null;
  const str = String(candidate);
  if (str.includes("@lid")) return null;
  const digits = onlyDigits(str.split("@")[0]);
  return digits.length >= 7 ? digits : null;
}

export function getRealPhoneFromCtx(ctx: Record<string, unknown>): string {
  const candidates = [
    ctx.senderPn,
    ctx.remoteJidAlt,
    ctx.remoteJid,
    ctx.from,
    ctx.key && (ctx.key as Record<string, unknown>).remoteJid,
  ];
  for (const c of candidates) {
    const phone = phoneFromAny(c);
    if (phone) return phone;
  }
  return onlyDigits(String(ctx.from ?? ""));
}

export function getRealJidFromCtx(ctx: Record<string, unknown>): string {
  return toJid(getRealPhoneFromCtx(ctx));
}

export function ensureJid(input: string): string {
  if (input.includes("@")) return input;
  return toJid(input);
}
