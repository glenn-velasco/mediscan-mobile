import QRCode from 'qrcode';

/** Generates the boolean module matrix for a QR code — pure JS, no native rendering dependency. */
export function createQrMatrix(text: string): boolean[][] {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'L' });
  const { size, data } = qr.modules;

  const matrix: boolean[][] = [];
  for (let row = 0; row < size; row++) {
    const rowValues: boolean[] = [];
    for (let col = 0; col < size; col++) {
      rowValues.push(data[row * size + col] === 1);
    }
    matrix.push(rowValues);
  }
  return matrix;
}

/**
 * Builds a single SVG path covering every dark module, merging horizontally-adjacent modules into
 * one rect command per run instead of one per module — for a realistic ~250-350 char emergency
 * summary this is a ~50x50 module matrix, which used to mean 2500+ individual native Views (slow
 * to mount/unmount on navigation); rendered as one <Path> in a single <Svg> instead.
 */
export function buildQrPath(matrix: boolean[][], moduleSize: number): string {
  let d = '';
  for (let row = 0; row < matrix.length; row++) {
    let col = 0;
    while (col < matrix[row].length) {
      if (!matrix[row][col]) {
        col++;
        continue;
      }
      const startCol = col;
      while (col < matrix[row].length && matrix[row][col]) col++;
      const runLength = col - startCol;
      const x = startCol * moduleSize;
      const y = row * moduleSize;
      const width = runLength * moduleSize;
      d += `M${x},${y}h${width}v${moduleSize}h${-width}z`;
    }
  }
  return d;
}
