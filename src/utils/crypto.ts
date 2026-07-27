/**
 * Secure client-side encryption using Web Crypto API (AES-GCM + PBKDF2).
 */

// Helper to convert string to ArrayBuffer
const textToBuffer = (text: string): Uint8Array => new TextEncoder().encode(text);

// Helper to convert ArrayBuffer to string
const bufferToText = (buffer: ArrayBuffer): string => new TextDecoder().decode(buffer);

// Convert a byte array to hex string
const bufferToHex = (buffer: ArrayBuffer): string => {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

// Convert hex string to byte array
const hexToBuffer = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
};

/**
 * Encrypts a string of text using a password/passphrase
 */
export async function encryptText(text: string, password: string): Promise<string> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const passwordBuffer = textToBuffer(password);
  
  // Import the password as a raw key
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive an AES-GCM key from the password + salt
  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const textBuffer = textToBuffer(text);

  // Encrypt the text
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    key,
    textBuffer
  );

  // Combine salt, iv, and encrypted content into a single package
  const saltHex = bufferToHex(salt);
  const ivHex = bufferToHex(iv);
  const encryptedHex = bufferToHex(encrypted);

  return `${saltHex}:${ivHex}:${encryptedHex}`;
}

/**
 * Decrypts text encrypted by encryptText
 */
export async function decryptText(encryptedPackage: string, password: string): Promise<string> {
  try {
    const parts = encryptedPackage.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted package format');
    }

    const salt = hexToBuffer(parts[0]);
    const iv = hexToBuffer(parts[1]);
    const encrypted = hexToBuffer(parts[2]);

    const passwordBuffer = textToBuffer(password);

    // Import the password as a raw key
    const baseKey = await window.crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // Derive the same AES-GCM key using the salt
    const key = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    // Decrypt the content
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      encrypted
    );

    return bufferToText(decrypted);
  } catch (err) {
    throw new Error('Decryption failed. Please check your master password / passphrase.');
  }
}

/**
 * A fast, lightweight visual fingerprint generator for SSH keys (simulating MD5/SHA256 fingerprint)
 */
export function generateKeyFingerprint(keyText: string): string {
  // Simple deterministic hash based on text
  let hash1 = 0;
  let hash2 = 0;
  for (let i = 0; i < keyText.length; i++) {
    const char = keyText.charCodeAt(i);
    hash1 = (hash1 * 31 + char) % 4294967296;
    hash2 = (hash2 * 37 + char) % 4294967296;
  }
  
  const part1 = hash1.toString(16).padStart(8, '0');
  const part2 = hash2.toString(16).padStart(8, '0');
  
  // Format as standard SHA256 fingerprint structure
  const combined = (part1 + part2).toUpperCase();
  const pairs = [];
  for (let i = 0; i < combined.length; i += 2) {
    pairs.push(combined.substring(i, i + 2));
  }
  return `SHA256:${pairs.join(':').substring(0, 47)}`;
}
