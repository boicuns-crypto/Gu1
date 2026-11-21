/**
 * Zero-dependency binary Protobuf Wire Format encoder/decoder for Baidu CarLife messages.
 */

export const WIRE_TYPE_VARINT = 0;
export const WIRE_TYPE_FIXED64 = 1;
export const WIRE_TYPE_LENGTH_DELIMITED = 2;
export const WIRE_TYPE_FIXED32 = 5;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8');

export class ProtoWireReader {
  private pos: number;
  private readonly limit: number;
  public lastFieldNumber = 0;
  public lastWireType = 0;

  constructor(private readonly data: Uint8Array, offset = 0, length = data.length) {
    this.pos = offset;
    this.limit = Math.min(data.length, offset + length);
  }

  hasRemaining(): boolean {
    return this.pos < this.limit;
  }

  readTag(): boolean {
    if (this.pos >= this.limit) return false;
    const tag = this.readRawVarint32();
    if (tag === 0) return false;
    this.lastFieldNumber = tag >>> 3;
    this.lastWireType = tag & 0x07;
    return true;
  }

  readVarint32(): number {
    return this.readRawVarint32();
  }

  readString(): string {
    const len = this.readRawVarint32();
    if (len <= 0 || this.pos + len > this.limit) return '';
    const slice = this.data.subarray(this.pos, this.pos + len);
    this.pos += len;
    return textDecoder.decode(slice);
  }

  readBytes(): Uint8Array {
    const len = this.readRawVarint32();
    if (len <= 0 || this.pos + len > this.limit) return new Uint8Array(0);
    const out = this.data.slice(this.pos, this.pos + len);
    this.pos += len;
    return out;
  }

  skipField(): void {
    switch (this.lastWireType) {
      case WIRE_TYPE_VARINT:
        this.readRawVarint64();
        break;
      case WIRE_TYPE_FIXED64:
        this.pos = Math.min(this.pos + 8, this.limit);
        break;
      case WIRE_TYPE_LENGTH_DELIMITED: {
        const len = this.readRawVarint32();
        if (len > 0) this.pos = Math.min(this.pos + len, this.limit);
        break;
      }
      case WIRE_TYPE_FIXED32:
        this.pos = Math.min(this.pos + 4, this.limit);
        break;
      default:
        this.pos = this.limit;
        break;
    }
  }

  private readRawVarint32(): number {
    let result = 0;
    let shift = 0;
    while (shift < 32 && this.pos < this.limit) {
      const b = this.data[this.pos++];
      result |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) return result | 0;
      shift += 7;
    }
    return result | 0;
  }

  private readRawVarint64(): bigint {
    let result = 0n;
    let shift = 0n;
    while (shift < 64n && this.pos < this.limit) {
      const b = BigInt(this.data[this.pos++]);
      result |= (b & 0x7fn) << shift;
      if ((b & 0x80n) === 0n) return result;
      shift += 7n;
    }
    return result;
  }
}

export class ProtoWireWriter {
  private readonly chunks: number[] = [];

  writeVarintField(fieldNumber: number, value: number): this {
    this.writeTag(fieldNumber, WIRE_TYPE_VARINT);
    this.writeRawVarint32(value);
    return this;
  }

  writeStringField(fieldNumber: number, value: string): this {
    if (!value) return this;
    const bytes = textEncoder.encode(value);
    this.writeTag(fieldNumber, WIRE_TYPE_LENGTH_DELIMITED);
    this.writeRawVarint32(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      this.chunks.push(bytes[i]);
    }
    return this;
  }

  writeBytesField(fieldNumber: number, value: Uint8Array): this {
    if (value.length === 0) return this;
    this.writeTag(fieldNumber, WIRE_TYPE_LENGTH_DELIMITED);
    this.writeRawVarint32(value.length);
    for (let i = 0; i < value.length; i++) {
      this.chunks.push(value[i]);
    }
    return this;
  }

  toByteArray(): Uint8Array {
    return new Uint8Array(this.chunks);
  }

  private writeTag(fieldNumber: number, wireType: number): void {
    this.writeRawVarint32((fieldNumber << 3) | wireType);
  }

  private writeRawVarint32(value: number): void {
    let v = value >>> 0;
    while (true) {
      if ((v & ~0x7f) === 0) {
        this.chunks.push(v & 0xff);
        return;
      } else {
        this.chunks.push((v & 0x7f) | 0x80);
        v >>>= 7;
      }
    }
  }
}

export interface CarlifeProtocolVersion {
  majorVersion: number;
  minorVersion: number;
}

export const CarlifeProtocolVersionProto = {
  encode(v: CarlifeProtocolVersion = { majorVersion: 2, minorVersion: 0 }): Uint8Array {
    return new ProtoWireWriter()
      .writeVarintField(1, v.majorVersion)
      .writeVarintField(2, v.minorVersion)
      .toByteArray();
  },
  decode(bytes: Uint8Array): CarlifeProtocolVersion {
    let majorVersion = 1;
    let minorVersion = 0;
    const reader = new ProtoWireReader(bytes);
    while (reader.readTag()) {
      switch (reader.lastFieldNumber) {
        case 1:
          majorVersion = reader.readVarint32();
          break;
        case 2:
          minorVersion = reader.readVarint32();
          break;
        default:
          reader.skipField();
          break;
      }
    }
    return { majorVersion, minorVersion };
  },
};

export const CarlifeProtocolVersionMatchStatusProto = {
  MATCH_SUCCESS: 1,
  MATCH_FAILED: 2,
  encode(matchStatus = 1): Uint8Array {
    return new ProtoWireWriter().writeVarintField(1, matchStatus).toByteArray();
  },
  decode(bytes: Uint8Array): { matchStatus: number } {
    let matchStatus = 1;
    const reader = new ProtoWireReader(bytes);
    while (reader.readTag()) {
      if (reader.lastFieldNumber === 1) {
        matchStatus = reader.readVarint32();
      } else {
        reader.skipField();
      }
    }
    return { matchStatus };
  },
};

export interface CarlifeDeviceInfo {
  os: string;
  board: string;
  bootloader: string;
  brand: string;
  cpuAbi: string;
  cpuAbi2: string;
  device: string;
  display: string;
  fingerprint: string;
  hardware: string;
  host: string;
  cid: string;
  manufacturer: string;
  model: string;
  product: string;
  serial: string;
  codename: string;
  incremental: string;
  release: string;
  sdk: string;
  sdkInt: number;
  token: string;
  btaddress: string;
}

export const DEFAULT_S26U_DEVICE_INFO: CarlifeDeviceInfo = {
  os: 'Android',
  board: 'sun',
  bootloader: 'S948BXXU1',
  brand: 'samsung',
  cpuAbi: 'arm64-v8a',
  cpuAbi2: '',
  device: 'e3q',
  display: 'UP1A.260205.001',
  fingerprint: 'samsung/e3qxeea/e3q:16/UP1A/S948B:user/release-keys',
  hardware: 'qcom',
  host: 'SWDD6501',
  cid: 'S26U-CARLIFE',
  manufacturer: 'samsung',
  model: 'SM-S948B',
  product: 'e3qxeea',
  serial: 'R5CW90S26U',
  codename: 'REL',
  incremental: 'S948BXXU1',
  release: '16',
  sdk: '36',
  sdkInt: 36,
  token: '',
  btaddress: '00:11:22:33:FF:EE',
};

export const CarlifeDeviceInfoProto = {
  encode(info: CarlifeDeviceInfo = DEFAULT_S26U_DEVICE_INFO): Uint8Array {
    return new ProtoWireWriter()
      .writeStringField(1, info.os)
      .writeStringField(2, info.board)
      .writeStringField(3, info.bootloader)
      .writeStringField(4, info.brand)
      .writeStringField(5, info.cpuAbi)
      .writeStringField(6, info.cpuAbi2)
      .writeStringField(7, info.device)
      .writeStringField(8, info.display)
      .writeStringField(9, info.fingerprint)
      .writeStringField(10, info.hardware)
      .writeStringField(11, info.host)
      .writeStringField(12, info.cid)
      .writeStringField(13, info.manufacturer)
      .writeStringField(14, info.model)
      .writeStringField(15, info.product)
      .writeStringField(16, info.serial)
      .writeStringField(17, info.codename)
      .writeStringField(18, info.incremental)
      .writeStringField(19, info.release)
      .writeStringField(20, info.sdk)
      .writeVarintField(21, info.sdkInt)
      .writeStringField(22, info.token)
      .writeStringField(23, info.btaddress)
      .toByteArray();
  },

  encodeMinimal(info: CarlifeDeviceInfo = DEFAULT_S26U_DEVICE_INFO): Uint8Array {
    return new ProtoWireWriter().writeStringField(1, info.os || 'Android').toByteArray();
  },

  decode(bytes: Uint8Array): CarlifeDeviceInfo {
    let os = '';
    let board = '';
    let brand = '';
    let device = '';
    let manufacturer = '';
    let model = '';
    let release = '';
    let sdkInt = 0;
    let btaddress = '';
    const reader = new ProtoWireReader(bytes);
    while (reader.readTag()) {
      switch (reader.lastFieldNumber) {
        case 1:
          os = reader.readString();
          break;
        case 2:
          board = reader.readString();
          break;
        case 4:
          brand = reader.readString();
          break;
        case 7:
          device = reader.readString();
          break;
        case 13:
          manufacturer = reader.readString();
          break;
        case 14:
          model = reader.readString();
          break;
        case 19:
          release = reader.readString();
          break;
        case 21:
          sdkInt = reader.readVarint32();
          break;
        case 23:
          btaddress = reader.readString();
          break;
        default:
          reader.skipField();
          break;
      }
    }
    return {
      ...DEFAULT_S26U_DEVICE_INFO,
      os: os || 'Linux-MQB',
      board: board || 'Jetta-VS7-MIB',
      brand,
      device,
      manufacturer: manufacturer || 'FAW-VW / Jetta',
      model: model || 'VS7 Head Unit',
      release,
      sdkInt,
      btaddress,
    };
  },
};

export interface CarlifeVideoEncoderInfo {
  width: number;
  height: number;
  frameRate: number;
}

export const CarlifeVideoEncoderInfoProto = {
  encode(v: CarlifeVideoEncoderInfo = { width: 1280, height: 720, frameRate: 30 }): Uint8Array {
    return new ProtoWireWriter()
      .writeVarintField(1, v.width)
      .writeVarintField(2, v.height)
      .writeVarintField(3, v.frameRate)
      .toByteArray();
  },
  decode(bytes: Uint8Array): CarlifeVideoEncoderInfo {
    let width = 0;
    let height = 0;
    let fps = 0;
    const reader = new ProtoWireReader(bytes);
    while (reader.readTag()) {
      switch (reader.lastFieldNumber) {
        case 1:
          width = reader.readVarint32();
          break;
        case 2:
          height = reader.readVarint32();
          break;
        case 3:
          fps = reader.readVarint32();
          break;
        default:
          reader.skipField();
          break;
      }
    }
    return {
      width: width >= 480 && width <= 3840 ? width : 1280,
      height: height >= 272 && height <= 2160 ? height : 720,
      frameRate: fps >= 15 && fps <= 60 ? fps : 30,
    };
  },
};

export const CarlifeVideoFrameRateProto = {
  encode(frameRate = 30): Uint8Array {
    return new ProtoWireWriter().writeVarintField(1, frameRate).toByteArray();
  },
  decode(bytes: Uint8Array): { frameRate: number } {
    let fps = 30;
    const reader = new ProtoWireReader(bytes);
    while (reader.readTag()) {
      if (reader.lastFieldNumber === 1) {
        fps = reader.readVarint32();
      } else {
        reader.skipField();
      }
    }
    return { frameRate: fps >= 15 && fps <= 60 ? fps : 30 };
  },
};

export const CarlifeModuleStatusProto = {
  encode(moduleId = 1, statusId = 0): Uint8Array {
    return new ProtoWireWriter()
      .writeVarintField(1, moduleId)
      .writeVarintField(2, statusId)
      .toByteArray();
  },
  decode(bytes: Uint8Array): { moduleId: number; statusId: number } {
    let moduleId = 1;
    let statusId = 0;
    const reader = new ProtoWireReader(bytes);
    while (reader.readTag()) {
      switch (reader.lastFieldNumber) {
        case 1:
          moduleId = reader.readVarint32();
          break;
        case 2:
          statusId = reader.readVarint32();
          break;
        default:
          reader.skipField();
          break;
      }
    }
    return { moduleId, statusId };
  },
};

export const CarlifeMusicInitProto = {
  DEFAULT_SAMPLE_RATE: 48_000,
  DEFAULT_CHANNEL_CONFIG: 2,
  DEFAULT_SAMPLE_FORMAT: 16,
  encode(
    sampleRate = 48_000,
    channelConfig = 2,
    sampleFormat = 16
  ): Uint8Array {
    return new ProtoWireWriter()
      .writeVarintField(1, sampleRate)
      .writeVarintField(2, channelConfig)
      .writeVarintField(3, sampleFormat)
      .toByteArray();
  },
  decode(bytes: Uint8Array): { sampleRate: number; channelConfig: number; sampleFormat: number } {
    let sampleRate = 48_000;
    let channelConfig = 2;
    let sampleFormat = 16;
    const reader = new ProtoWireReader(bytes);
    while (reader.readTag()) {
      switch (reader.lastFieldNumber) {
        case 1:
          sampleRate = reader.readVarint32();
          break;
        case 2:
          channelConfig = reader.readVarint32();
          break;
        case 3:
          sampleFormat = reader.readVarint32();
          break;
        default:
          reader.skipField();
          break;
      }
    }
    return { sampleRate, channelConfig, sampleFormat };
  },
};
