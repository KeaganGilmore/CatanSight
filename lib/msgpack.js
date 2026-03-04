/**
 * Minimal MessagePack decoder for CatanSight.
 * Supports: nil, bool, int, float, string, binary, array, map, ext.
 * Reference: https://github.com/msgpack/msgpack/blob/master/spec.md
 */

window.CatanSight = window.CatanSight || {};

CatanSight.MsgPack = {
  decode(buffer) {
    const view = new DataView(buffer instanceof ArrayBuffer ? buffer : buffer.buffer);
    const bytes = new Uint8Array(buffer instanceof ArrayBuffer ? buffer : buffer.buffer);
    let offset = 0;

    function read() {
      const byte = bytes[offset++];

      // positive fixint (0x00 - 0x7f)
      if (byte <= 0x7f) return byte;

      // fixmap (0x80 - 0x8f)
      if (byte >= 0x80 && byte <= 0x8f) return readMap(byte & 0x0f);

      // fixarray (0x90 - 0x9f)
      if (byte >= 0x90 && byte <= 0x9f) return readArray(byte & 0x0f);

      // fixstr (0xa0 - 0xbf)
      if (byte >= 0xa0 && byte <= 0xbf) return readStr(byte & 0x1f);

      // negative fixint (0xe0 - 0xff)
      if (byte >= 0xe0) return byte - 256;

      switch (byte) {
        case 0xc0: return null;           // nil
        case 0xc1: return undefined;      // never used
        case 0xc2: return false;          // false
        case 0xc3: return true;           // true

        // bin
        case 0xc4: return readBin(readUint(1));
        case 0xc5: return readBin(readUint(2));
        case 0xc6: return readBin(readUint(4));

        // ext
        case 0xc7: { const n = readUint(1); const t = readInt8(); offset += n; return { _ext: t }; }
        case 0xc8: { const n = readUint(2); const t = readInt8(); offset += n; return { _ext: t }; }
        case 0xc9: { const n = readUint(4); const t = readInt8(); offset += n; return { _ext: t }; }

        // float
        case 0xca: return readFloat32();
        case 0xcb: return readFloat64();

        // uint
        case 0xcc: return readUint(1);
        case 0xcd: return readUint(2);
        case 0xce: return readUint(4);
        case 0xcf: return readUint64();

        // int
        case 0xd0: return readInt(1);
        case 0xd1: return readInt(2);
        case 0xd2: return readInt(4);
        case 0xd3: return readInt64();

        // fixext
        case 0xd4: { const t = readInt8(); offset += 1; return { _ext: t }; }
        case 0xd5: { const t = readInt8(); offset += 2; return { _ext: t }; }
        case 0xd6: { const t = readInt8(); offset += 4; return { _ext: t }; }
        case 0xd7: { const t = readInt8(); offset += 8; return { _ext: t }; }
        case 0xd8: { const t = readInt8(); offset += 16; return { _ext: t }; }

        // str
        case 0xd9: return readStr(readUint(1));
        case 0xda: return readStr(readUint(2));
        case 0xdb: return readStr(readUint(4));

        // array
        case 0xdc: return readArray(readUint(2));
        case 0xdd: return readArray(readUint(4));

        // map
        case 0xde: return readMap(readUint(2));
        case 0xdf: return readMap(readUint(4));

        default: return undefined;
      }
    }

    function readUint(n) {
      let val = 0;
      for (let i = 0; i < n; i++) {
        val = (val << 8) | bytes[offset++];
      }
      return val >>> 0;
    }

    function readInt(n) {
      const val = readUint(n);
      const bits = n * 8;
      return val >= (1 << (bits - 1)) ? val - (1 << bits) : val;
    }

    function readInt8() {
      const val = bytes[offset++];
      return val >= 128 ? val - 256 : val;
    }

    function readUint64() {
      const hi = readUint(4);
      const lo = readUint(4);
      return hi * 0x100000000 + lo;
    }

    function readInt64() {
      const hi = view.getInt32(offset); offset += 4;
      const lo = view.getUint32(offset); offset += 4;
      return hi * 0x100000000 + lo;
    }

    function readFloat32() {
      const val = view.getFloat32(offset);
      offset += 4;
      return val;
    }

    function readFloat64() {
      const val = view.getFloat64(offset);
      offset += 8;
      return val;
    }

    function readStr(len) {
      const strBytes = bytes.subarray(offset, offset + len);
      offset += len;
      // Use TextDecoder for proper UTF-8
      return new TextDecoder("utf-8").decode(strBytes);
    }

    function readBin(len) {
      const bin = bytes.slice(offset, offset + len);
      offset += len;
      return bin;
    }

    function readArray(len) {
      const arr = [];
      for (let i = 0; i < len; i++) {
        arr.push(read());
      }
      return arr;
    }

    function readMap(len) {
      const obj = {};
      for (let i = 0; i < len; i++) {
        const key = read();
        const val = read();
        obj[key] = val;
      }
      return obj;
    }

    return read();
  }
};
