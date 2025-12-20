/**
 * @fileoverview Checksum utilities for migration integrity verification.
 * @module migrator/utils/checksum
 */

import { createHash } from 'node:crypto';

/**
 * Calculates a checksum for migration content.
 *
 * @param content - The content to hash
 * @param algorithm - Hash algorithm (default: 'sha256')
 * @returns Formatted checksum string with algorithm prefix
 */
export function calculateChecksum(content: string, algorithm = 'sha256'): string {
  const hash = createHash(algorithm);
  hash.update(content);
  return `${algorithm}:${hash.digest('hex')}`;
}

/**
 * Parses a checksum string into algorithm and hash components.
 *
 * @param checksum - Checksum string in format "algorithm:hash"
 * @returns Object with algorithm and hash properties
 */
export function parseChecksum(checksum: string): { algorithm: string; hash: string } {
  const parts = checksum.split(':');
  if (parts.length === 2) {
    return { algorithm: parts[0], hash: parts[1] };
  }
  // Legacy format: assume sha256
  return { algorithm: 'sha256', hash: checksum };
}

/**
 * Verifies that content matches an expected checksum.
 *
 * @param content - The content to verify
 * @param expectedChecksum - The expected checksum
 * @returns True if checksums match
 */
export function verifyChecksum(content: string, expectedChecksum: string): boolean {
  const { algorithm } = parseChecksum(expectedChecksum);
  const actualChecksum = calculateChecksum(content, algorithm);
  return actualChecksum === expectedChecksum;
}
