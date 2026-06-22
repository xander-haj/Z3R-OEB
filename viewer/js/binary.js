/**
 * Small binary helpers for source-backed overworld rendering.
 */

export function readUint16LE(bytes, offset) {
  return (bytes[offset] || 0) | ((bytes[offset + 1] || 0) << 8);
}

export function read4BppPixel(plane1, plane2, col) {
  let pixel = (plane1 >> col) & 1;
  pixel |= ((plane1 >> (8 + col)) & 1) << 1;
  pixel |= ((plane2 >> col) & 1) << 2;
  pixel |= ((plane2 >> (8 + col)) & 1) << 3;
  return pixel;
}

export function decompressLz(source, offsetEndian = "little") {
  const output = [];
  let cursor = 0;
  while (cursor < source.length) {
    let command = source[cursor];
    cursor += 1;
    if (command === 0xff) {
      return Uint8Array.from(output);
    }
    let length;
    if ((command & 0xe0) !== 0xe0) {
      length = (command & 0x1f) + 1;
      command &= 0xe0;
    } else {
      length = source[cursor] + ((command & 3) << 8) + 1;
      cursor += 1;
      command = (command << 3) & 0xe0;
    }
    cursor = decodeCommand(source, output, cursor, command, length, offsetEndian);
  }
  throw new Error("Compressed stream ended before 0xff terminator");
}

function decodeCommand(source, output, cursor, command, length, offsetEndian) {
  if (command === 0) {
    for (let i = 0; i < length; i += 1) {
      output.push(source[cursor + i] || 0);
    }
    return cursor + length;
  }
  if (command & 0x80) {
    let offset = offsetEndian === "big"
      ? ((source[cursor] || 0) << 8) | (source[cursor + 1] || 0)
      : (source[cursor] || 0) | ((source[cursor + 1] || 0) << 8);
    for (let i = 0; i < length; i += 1) {
      output.push(output[offset] || 0);
      offset += 1;
    }
    return cursor + 2;
  }
  if (!(command & 0x40)) {
    for (let i = 0; i < length; i += 1) {
      output.push(source[cursor] || 0);
    }
    return cursor + 1;
  }
  if (!(command & 0x20)) {
    for (let i = 0; i < length; i += 1) {
      output.push(i & 1 ? source[cursor + 1] || 0 : source[cursor] || 0);
    }
    return cursor + 2;
  }
  let value = source[cursor] || 0;
  for (let i = 0; i < length; i += 1) {
    output.push(value);
    value = (value + 1) & 0xff;
  }
  return cursor + 1;
}

export function expand3To4Low(vram, wordOffset, source, tileCount = 64) {
  let src = 0;
  let dst = wordOffset;
  for (let tile = 0; tile < tileCount; tile += 1) {
    for (let row = 0; row < 8; row += 1) {
      vram[dst] = readUint16LE(source, src);
      src += 2;
      dst += 1;
    }
    for (let row = 0; row < 8; row += 1) {
      vram[dst] = source[src] || 0;
      src += 1;
      dst += 1;
    }
  }
}

export function expand3To4High(vram, wordOffset, source, tileCount = 64) {
  let src = 0;
  let dst = wordOffset;
  const mergedRows = new Uint8Array(8);
  for (let tile = 0; tile < tileCount; tile += 1) {
    for (let row = 7; row >= 0; row -= 1) {
      const word = readUint16LE(source, src);
      mergedRows[row] = (word | (word >> 8)) & 0xff;
      vram[dst] = word;
      src += 2;
      dst += 1;
    }
    for (let row = 7; row >= 0; row -= 1) {
      const value = source[src] || 0;
      vram[dst] = value | ((mergedRows[row] | value) << 8);
      src += 1;
      dst += 1;
    }
  }
}
