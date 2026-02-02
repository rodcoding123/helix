export interface KeyDerivationConfig {
  algorithm: 'pbkdf2';
  hash: 'sha256';
  iterations: number; // 600,000 recommended by OWASP 2023
  saltLength: number; // 128 bits
  keyLength: number; // 256 bits = 32 bytes
}

export interface EncryptionContext {
  userId: string;
  keyVersion: number;
  derivationMethod: 'pbkdf2-sha256';
  saltHex: string;
  nonce: string; // For GCM mode
}
