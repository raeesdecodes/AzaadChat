import { encryptToken, decryptToken } from '../lib/crypto';

process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ?? '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const sample = 'EAABwzLixnjYBO-page-token-sample';
const enc = encryptToken(sample);

if (enc === sample) throw new Error('FAIL: plaintext stored as-is');
if (!enc.startsWith('v1:')) throw new Error('FAIL: missing payload prefix');
if (decryptToken(enc) !== sample) throw new Error('FAIL: roundtrip mismatch');

let tamperRejected = false;
try {
  decryptToken(`${enc.slice(0, -2)}AA`);
} catch {
  tamperRejected = true;
}
if (!tamperRejected) throw new Error('FAIL: tampered payload accepted');

const second = encryptToken(sample);
if (second === enc) throw new Error('FAIL: IV reuse (identical ciphertexts)');

console.log('crypto smoke OK: encrypt/decrypt roundtrip, tamper reject, unique IVs');
