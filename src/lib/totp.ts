import { createHmac, randomBytes } from "node:crypto";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function createTotpSecret() {
  let bits = "";
  for (const byte of randomBytes(20)) bits += byte.toString(2).padStart(8, "0");
  let result = "";
  for (let index = 0; index < bits.length; index += 5) result += alphabet[parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  return result;
}

function decodeBase32(value: string) {
  const bits = value.replace(/=+$/g, "").toUpperCase().split("").map((char) => alphabet.indexOf(char).toString(2).padStart(5, "0")).join("");
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
}

export function verifyTotp(secret: string, input: string, window = 1) {
  const code = input.replace(/\D/g, "");
  if (code.length !== 6) return false;
  const key = decodeBase32(secret);
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let offset = -window; offset <= window; offset += 1) {
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(counter + offset));
    const digest = createHmac("sha1", key).update(buffer).digest();
    const position = digest[digest.length - 1] & 15;
    const number = ((digest[position] & 127) << 24) | (digest[position + 1] << 16) | (digest[position + 2] << 8) | digest[position + 3];
    if (String(number % 1_000_000).padStart(6, "0") === code) return true;
  }
  return false;
}
