/**
 * Lightweight pure TypeScript QR Code matrix generator (supports Byte Mode & ECC L/M).
 * Self-contained without external dependencies for offline rendering.
 */

// Reed-Solomon Galois Field tables for GF(256)
const GF256_EXP = new Array<number>(512);
const GF256_LOG = new Array<number>(256);

(function initGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF256_EXP[i] = x;
    GF256_EXP[i + 255] = x;
    GF256_LOG[x] = i;
    x = (x << 1) ^ (x & 0x80 ? 0x11d : 0);
  }
  GF256_LOG[0] = 0;
})();

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return GF256_EXP[GF256_LOG[x] + GF256_LOG[y]];
}

function polyMul(p1: number[], p2: number[]): number[] {
  const res = new Array<number>(p1.length + p2.length - 1).fill(0);
  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      res[i + j] ^= gfMul(p1[i], p2[j]);
    }
  }
  return res;
}

function getGeneratorPoly(degree: number): number[] {
  let g = [1];
  for (let i = 0; i < degree; i++) {
    g = polyMul(g, [1, GF256_EXP[i]]);
  }
  return g;
}

function calculateEcc(data: number[], eccLen: number): number[] {
  const gen = getGeneratorPoly(eccLen);
  const msg = [...data, ...new Array<number>(eccLen).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const factor = msg[i];
    if (factor !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], factor);
      }
    }
  }
  return msg.slice(data.length);
}

// Version capacities (Version 1-7 Byte mode ECC L)
const VERSION_SPECS = [
  { version: 1, size: 21, total: 26, data: 19, ecc: 7 },
  { version: 2, size: 25, total: 44, data: 34, ecc: 10 },
  { version: 3, size: 29, total: 70, data: 55, ecc: 15 },
  { version: 4, size: 33, total: 100, data: 80, ecc: 20 },
  { version: 5, size: 37, total: 134, data: 108, ecc: 26 },
  { version: 6, size: 41, total: 172, data: 136, ecc: 18 },
  { version: 7, size: 45, total: 196, data: 156, ecc: 20 },
];

export function generateQrMatrix(text: string): boolean[][] {
  const bytes: number[] = [];
  const encoder = new TextEncoder();
  const encoded = encoder.encode(text);
  for (let i = 0; i < encoded.length; i++) {
    bytes.push(encoded[i]);
  }

  const spec = VERSION_SPECS.find(s => s.data >= bytes.length + 3) || VERSION_SPECS[VERSION_SPECS.length - 1];
  const { size, data: maxData, ecc: eccCount } = spec;

  // Encode byte mode
  const bits: number[] = [];
  const appendBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };

  appendBits(0b0100, 4); // Byte mode indicator
  appendBits(bytes.length, 8); // Character count indicator
  for (let i = 0; i < bytes.length; i++) {
    appendBits(bytes[i], 8);
  }
  appendBits(0, Math.min(4, maxData * 8 - bits.length)); // Terminator

  while (bits.length % 8 !== 0) bits.push(0);

  const dataCodewords = new Array<number>(maxData).fill(0);
  for (let i = 0; i < bits.length / 8; i++) {
    let byteVal = 0;
    for (let j = 0; j < 8; j++) byteVal = (byteVal << 1) | bits[i * 8 + j];
    dataCodewords[i] = byteVal;
  }

  // Pad bytes (0xEC, 0x11)
  const pad = [0xec, 0x11];
  let padIdx = 0;
  for (let i = Math.floor(bits.length / 8); i < maxData; i++) {
    dataCodewords[i] = pad[padIdx++ % 2];
  }

  const ecc = calculateEcc(dataCodewords, eccCount);
  const allCodewords = [...dataCodewords, ...ecc];

  // Initialize Matrix
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));

  // Finder Patterns
  const placeFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
          matrix[nr][nc] = r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        } else {
          matrix[nr][nc] = false; // Separator
        }
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Timing Patterns
  for (let i = 8; i < size - 8; i++) {
    if (matrix[6][i] === null) matrix[6][i] = i % 2 === 0;
    if (matrix[i][6] === null) matrix[i][6] = i % 2 === 0;
  }

  // Dark module
  matrix[size - 8][8] = true;

  // Format info area reservation
  for (let i = 0; i < 9; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
  }
  for (let i = size - 8; i < size; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
  }

  // Data placement
  let codewordIdx = 0;
  let bitIdx = 7;
  let dir = -1; // Upwards
  let col = size - 1;

  while (col > 0) {
    if (col === 6) col--; // Skip vertical timing
    for (let rowStep = 0; rowStep < size; rowStep++) {
      const row = dir === -1 ? size - 1 - rowStep : rowStep;
      for (let c = 0; c < 2; c++) {
        const currCol = col - c;
        if (matrix[row][currCol] === null) {
          let bit = false;
          if (codewordIdx < allCodewords.length) {
            bit = ((allCodewords[codewordIdx] >> bitIdx) & 1) === 1;
            bitIdx--;
            if (bitIdx < 0) {
              bitIdx = 7;
              codewordIdx++;
            }
          }
          // Mask pattern 0: (row + col) % 2 == 0
          const mask = (row + currCol) % 2 === 0;
          matrix[row][currCol] = mask ? !bit : bit;
        }
      }
    }
    dir = -dir;
    col -= 2;
  }

  // Format Info for Mask 0 + ECC L (0x77C4 format bits)
  const formatBits = 0x77c4; // Precomputed Mask 0 ECC L with BCH
  for (let i = 0; i < 15; i++) {
    const bit = ((formatBits >> i) & 1) === 1;
    if (i < 6) matrix[8][i] = bit;
    else if (i < 8) matrix[8][i + 1] = bit;
    else matrix[8][size - 15 + i] = bit;

    if (i < 8) matrix[size - 1 - i][8] = bit;
    else matrix[14 - i][8] = bit;
  }

  return matrix.map(row => row.map(cell => Boolean(cell)));
}
