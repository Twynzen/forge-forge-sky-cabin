/**
 * Pairing codes — short, human-typeable, case-insensitive.
 * Shown on phone OR terminal so the other side can join.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

export function generatePairingCode(length = 6): string {
  let out = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}

export function normalizePairingCode(code: string): string {
  return code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/[O]/g, "0")
    .replace(/[IL]/g, "1");
}

export function formatPairingCode(code: string): string {
  const n = normalizePairingCode(code);
  if (n.length <= 3) return n;
  return `${n.slice(0, 3)}-${n.slice(3)}`;
}
