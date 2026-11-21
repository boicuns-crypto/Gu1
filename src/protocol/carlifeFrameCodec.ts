import {
  CarLifeChannelId,
  CarLifeChannelInfo,
  CarLifeMsgType,
  MEDIA_HEADER_SIZE,
  MAX_FRAME_PAYLOAD_SIZE,
  STANDARD_HEADER_SIZE,
  channelFromId,
  channelInfo,
  formatHex32,
  isCarLifeServiceId,
  serviceTypeName,
} from './carlifeConstants';
import { CarlifeMusicInitProto } from './carlifeWireProtobuf';

export interface CarLifeHeader {
  channel: CarLifeChannelId;
  rawChannelId: number;
  payloadLength: number;
  timestamp: number;
  includeOuterTimestamp: boolean;
}

export interface CarLifeFrame {
  header: CarLifeHeader;
  payload: Uint8Array;
}

export interface CarLifeCommandMessage {
  serviceType: number;
  serviceName: string;
  body: Uint8Array;
}

export function getHeaderSizeBytes(header: CarLifeHeader): number {
  return header.includeOuterTimestamp ? MEDIA_HEADER_SIZE : STANDARD_HEADER_SIZE;
}

export function getTotalFrameBytes(frame: CarLifeFrame): number {
  return getHeaderSizeBytes(frame.header) + frame.payload.length;
}

export function getChannelInfo(channelId: CarLifeChannelId): CarLifeChannelInfo {
  return channelInfo(channelId);
}

export function parseCommandMessageOrNull(frame: CarLifeFrame): CarLifeCommandMessage | null {
  const payload = frame.payload;
  if (payload.length === 0) return null;

  if (payload.length < 4) {
    let padded = 0;
    for (let i = 0; i < payload.length; i++) {
      padded = (padded << 8) | payload[i];
    }
    return {
      serviceType: padded >>> 0,
      serviceName: serviceTypeName(padded),
      body: new Uint8Array(0),
    };
  }

  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const word0 = view.getUint32(0, false);

  if (payload.length >= 4 && payload.length <= 7) {
    return {
      serviceType: word0,
      serviceName: serviceTypeName(word0),
      body: payload.length > 4 ? payload.slice(4) : new Uint8Array(0),
    };
  }

  const u16MsgLen = view.getUint16(0, false);
  const u16Reserved = view.getUint16(2, false);
  const word1 = view.getUint32(4, false);
  const word2 = payload.length >= 12 ? view.getUint32(8, false) : 0;

  if (
    frame.header.channel === CarLifeChannelId.VIDEO &&
    payload.length >= 12 &&
    (word2 === CarLifeMsgType.MSG_VIDEO_DATA ||
      word2 === CarLifeMsgType.MSG_VIDEO_DATA_ALT ||
      word2 === CarLifeMsgType.MSG_VIDEO_HEARTBEAT ||
      word2 === CarLifeMsgType.MSG_VIDEO_HEARTBEAT_ALT)
  ) {
    const avail = payload.length - 12;
    const safeLen = word0 <= avail ? word0 : avail;
    return {
      serviceType: word2,
      serviceName: serviceTypeName(word2),
      body: safeLen > 0 ? payload.slice(12, 12 + safeLen) : new Uint8Array(0),
    };
  }

  if (
    frame.header.channel === CarLifeChannelId.MEDIA_AUDIO &&
    payload.length >= 12 &&
    (word2 === CarLifeMsgType.MSG_MEDIA_INIT ||
      word2 === CarLifeMsgType.MSG_MEDIA_STOP ||
      word2 === CarLifeMsgType.MSG_MEDIA_PAUSE ||
      word2 === CarLifeMsgType.MSG_MEDIA_RESUME_PLAY ||
      word2 === CarLifeMsgType.MSG_MEDIA_DATA)
  ) {
    const avail = payload.length - 12;
    const safeLen = word0 <= avail ? word0 : avail;
    return {
      serviceType: word2,
      serviceName: serviceTypeName(word2),
      body: safeLen > 0 ? payload.slice(12, 12 + safeLen) : new Uint8Array(0),
    };
  }

  const word0IsService = isCarLifeServiceId(word0) && u16MsgLen === 0x0001;
  const word1IsService = isCarLifeServiceId(word1);
  const word2IsService = payload.length >= 12 && isCarLifeServiceId(word2);
  const word3 = payload.length >= 16 ? view.getUint32(12, false) : 0;
  const word3IsService = payload.length >= 16 && isCarLifeServiceId(word3);

  if (word1IsService) {
    const avail = payload.length - 8;
    let safeLen = avail;
    if (u16Reserved === 0 && u16MsgLen <= avail) {
      safeLen = u16MsgLen;
    } else if (word0 <= avail) {
      safeLen = word0;
    }
    return {
      serviceType: word1,
      serviceName: serviceTypeName(word1),
      body: safeLen > 0 ? payload.slice(8, 8 + safeLen) : new Uint8Array(0),
    };
  }

  if (word0IsService && !word1IsService) {
    const body =
      word1 <= payload.length - 8 && (word1 === payload.length - 8 || word1 === 0)
        ? word1 > 0
          ? payload.slice(8, 8 + word1)
          : payload.slice(8)
        : payload.slice(4);
    return {
      serviceType: word0,
      serviceName: serviceTypeName(word0),
      body,
    };
  }

  if (word2IsService) {
    const avail = payload.length - 12;
    const innerU16Len = view.getUint16(4, false);
    const safeLen = innerU16Len <= avail ? innerU16Len : word1 <= avail ? word1 : avail;
    return {
      serviceType: word2,
      serviceName: serviceTypeName(word2),
      body: safeLen > 0 ? payload.slice(12, 12 + safeLen) : new Uint8Array(0),
    };
  }

  if (word3IsService) {
    const avail = payload.length - 16;
    const innerU16Len = view.getUint16(8, false);
    const safeLen = innerU16Len <= avail ? innerU16Len : avail;
    return {
      serviceType: word3,
      serviceName: serviceTypeName(word3),
      body: safeLen > 0 ? payload.slice(16, 16 + safeLen) : new Uint8Array(0),
    };
  }

  const chosenService = word1 !== 0 ? word1 : word2 !== 0 ? word2 : word3 !== 0 ? word3 : word0;
  const avail = payload.length - 8;
  const safeLen = u16MsgLen <= avail ? u16MsgLen : avail;
  return {
    serviceType: chosenService,
    serviceName: serviceTypeName(chosenService),
    body: safeLen > 0 ? payload.slice(8, 8 + safeLen) : new Uint8Array(0),
  };
}

export const CarLifeFrameCodec = {
  useNestedVideoMsgHeader: true,

  encodeHeader(header: CarLifeHeader): Uint8Array {
    const size = getHeaderSizeBytes(header);
    const out = new Uint8Array(size);
    const view = new DataView(out.buffer);
    view.setUint32(0, header.rawChannelId >>> 0, false);
    view.setUint32(4, header.payloadLength >>> 0, false);
    if (header.includeOuterTimestamp) {
      view.setUint32(8, (header.timestamp & 0x7fffffff) >>> 0, false);
    }
    return out;
  },

  encodeFrame(frame: CarLifeFrame): Uint8Array {
    const normalizedHeader: CarLifeHeader =
      frame.header.payloadLength !== frame.payload.length
        ? { ...frame.header, payloadLength: frame.payload.length }
        : frame.header;
    const headerBytes = this.encodeHeader(normalizedHeader);
    const out = new Uint8Array(headerBytes.length + frame.payload.length);
    out.set(headerBytes, 0);
    out.set(frame.payload, headerBytes.length);
    return out;
  },

  decodeBaseHeader(bytes: Uint8Array, offset = 0): CarLifeHeader {
    if (bytes.length - offset < STANDARD_HEADER_SIZE) {
      throw new Error(
        `Insufficient bytes for base header: required=${STANDARD_HEADER_SIZE}, available=${bytes.length - offset}`
      );
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, STANDARD_HEADER_SIZE);
    const rawChannelId = view.getUint32(0, false);
    const payloadLength = view.getUint32(4, false);
    const info = channelFromId(rawChannelId);
    if (!info) {
      throw new Error(`Unknown CarLife channel ID: ${formatHex32(rawChannelId)}`);
    }
    if (payloadLength > MAX_FRAME_PAYLOAD_SIZE) {
      throw new Error(`Invalid CarLife payload length=${payloadLength} on channel=${info.key}`);
    }
    return {
      channel: info.id,
      rawChannelId,
      payloadLength,
      timestamp: 0,
      includeOuterTimestamp: info.hasTimestampHeader,
    };
  },

  decodeHeader(bytes: Uint8Array, offset = 0): CarLifeHeader {
    const base = this.decodeBaseHeader(bytes, offset);
    if (!base.includeOuterTimestamp) return base;
    if (bytes.length - offset < MEDIA_HEADER_SIZE) {
      throw new Error(
        `Channel ${base.channel} requires a 12-byte header, got ${bytes.length - offset} bytes`
      );
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset + STANDARD_HEADER_SIZE, 4);
    const timestamp = view.getUint32(0, false);
    return { ...base, timestamp };
  },

  decodeFrame(rawBytes: Uint8Array, offset = 0): CarLifeFrame {
    const base = this.decodeBaseHeader(rawBytes, offset);
    const availableAfter8 = rawBytes.length - offset - STANDARD_HEADER_SIZE;

    if (
      base.channel === CarLifeChannelId.VIDEO &&
      base.payloadLength >= 12 &&
      availableAfter8 === base.payloadLength
    ) {
      const innerView = new DataView(
        rawBytes.buffer,
        rawBytes.byteOffset + offset + STANDARD_HEADER_SIZE,
        12
      );
      const nalSize = innerView.getUint32(0, false);
      const tsMs = innerView.getUint32(4, false);
      const serviceId = innerView.getUint32(8, false);
      if (
        nalSize === base.payloadLength - 12 &&
        (serviceId === CarLifeMsgType.MSG_VIDEO_DATA ||
          serviceId === CarLifeMsgType.MSG_VIDEO_DATA_ALT ||
          serviceId === CarLifeMsgType.MSG_VIDEO_HEARTBEAT ||
          serviceId === CarLifeMsgType.MSG_VIDEO_HEARTBEAT_ALT)
      ) {
        const payload = rawBytes.slice(
          offset + STANDARD_HEADER_SIZE,
          offset + STANDARD_HEADER_SIZE + base.payloadLength
        );
        return {
          header: { ...base, timestamp: tsMs, includeOuterTimestamp: false },
          payload,
        };
      }
    }

    if (
      base.channel === CarLifeChannelId.MEDIA_AUDIO &&
      base.payloadLength >= 12 &&
      availableAfter8 === base.payloadLength
    ) {
      const innerView = new DataView(
        rawBytes.buffer,
        rawBytes.byteOffset + offset + STANDARD_HEADER_SIZE,
        12
      );
      const bodyLen = innerView.getUint32(0, false);
      const tsSec = innerView.getUint32(4, false);
      const serviceId = innerView.getUint32(8, false);
      if (
        bodyLen === base.payloadLength - 12 &&
        (serviceId === CarLifeMsgType.MSG_MEDIA_INIT ||
          serviceId === CarLifeMsgType.MSG_MEDIA_STOP ||
          serviceId === CarLifeMsgType.MSG_MEDIA_PAUSE ||
          serviceId === CarLifeMsgType.MSG_MEDIA_RESUME_PLAY ||
          serviceId === CarLifeMsgType.MSG_MEDIA_DATA)
      ) {
        const payload = rawBytes.slice(
          offset + STANDARD_HEADER_SIZE,
          offset + STANDARD_HEADER_SIZE + base.payloadLength
        );
        return {
          header: { ...base, timestamp: tsSec, includeOuterTimestamp: false },
          payload,
        };
      }
    }

    const header = this.decodeHeader(rawBytes, offset);
    const headerSize = getHeaderSizeBytes(header);
    const availablePayload = rawBytes.length - offset - headerSize;
    if (availablePayload < header.payloadLength) {
      throw new Error(
        `Truncated CarLife frame on ${header.channel}: expected ${header.payloadLength}B, got ${availablePayload}B`
      );
    }
    const payload = rawBytes.slice(offset + headerSize, offset + headerSize + header.payloadLength);
    return { header, payload };
  },

  createCommandFrame(
    channel: CarLifeChannelId = CarLifeChannelId.CONTROL,
    serviceType: number,
    commandBody: Uint8Array = new Uint8Array(0)
  ): CarLifeFrame {
    const innerPayload = new Uint8Array(8 + commandBody.length);
    const view = new DataView(innerPayload.buffer);
    view.setUint16(0, commandBody.length & 0xffff, false);
    view.setUint16(2, 0x0000, false);
    view.setUint32(4, serviceType >>> 0, false);
    innerPayload.set(commandBody, 8);

    return {
      header: {
        channel,
        rawChannelId: channel,
        payloadLength: innerPayload.length,
        timestamp: 0,
        includeOuterTimestamp: false,
      },
      payload: innerPayload,
    };
  },

  createVideoHeartbeatFrame(timestampMs = Date.now() & 0x7fffffff): CarLifeFrame {
    const safeTs = timestampMs & 0x7fffffff;
    const innerHeartbeat = new Uint8Array(12);
    const view = new DataView(innerHeartbeat.buffer);
    view.setUint32(0, 0, false);
    view.setUint32(4, safeTs >>> 0, false);
    view.setUint32(8, CarLifeMsgType.MSG_VIDEO_HEARTBEAT, false);
    return {
      header: {
        channel: CarLifeChannelId.VIDEO,
        rawChannelId: CarLifeChannelId.VIDEO,
        payloadLength: innerHeartbeat.length,
        timestamp: safeTs,
        includeOuterTimestamp: false,
      },
      payload: innerHeartbeat,
    };
  },

  ensureAnnexBStartCode(nalData: Uint8Array): Uint8Array {
    if (
      nalData.length >= 4 &&
      nalData[0] === 0x00 &&
      nalData[1] === 0x00 &&
      nalData[2] === 0x00 &&
      nalData[3] === 0x01
    ) {
      return nalData;
    }
    if (nalData.length >= 3 && nalData[0] === 0x00 && nalData[1] === 0x00 && nalData[2] === 0x01) {
      const fixed = new Uint8Array(nalData.length + 1);
      fixed[0] = 0x00;
      fixed[1] = 0x00;
      fixed[2] = 0x00;
      fixed[3] = 0x01;
      fixed.set(nalData.subarray(3), 4);
      return fixed;
    }
    if (nalData.length > 4) {
      const avccLen =
        ((nalData[0] << 24) | (nalData[1] << 16) | (nalData[2] << 8) | nalData[3]) >>> 0;
      const nalHdr = nalData[4] & 0xff;
      const nalType = nalHdr & 0x1f;
      if (avccLen === nalData.length - 4 && (nalHdr & 0x80) === 0 && nalType >= 1 && nalType <= 12) {
        const fixed = nalData.slice();
        fixed[0] = 0x00;
        fixed[1] = 0x00;
        fixed[2] = 0x00;
        fixed[3] = 0x01;
        return fixed;
      }
    }
    const prefixed = new Uint8Array(4 + nalData.length);
    prefixed[0] = 0x00;
    prefixed[1] = 0x00;
    prefixed[2] = 0x00;
    prefixed[3] = 0x01;
    prefixed.set(nalData, 4);
    return prefixed;
  },

  splitAnnexBNalUnits(h264Buffer: Uint8Array): Uint8Array[] {
    if (h264Buffer.length === 0) return [];
    const starts: Array<{ startOffset: number; payloadOffset: number }> = [];
    let i = 0;
    while (i <= h264Buffer.length - 3) {
      if (h264Buffer[i] === 0x00 && h264Buffer[i + 1] === 0x00) {
        if (h264Buffer[i + 2] === 0x01) {
          starts.push({ startOffset: i, payloadOffset: i + 3 });
          i += 3;
          continue;
        } else if (h264Buffer[i + 2] === 0x00) {
          let j = i + 3;
          while (j < h264Buffer.length && h264Buffer[j] === 0x00) {
            j++;
          }
          if (j < h264Buffer.length && h264Buffer[j] === 0x01) {
            starts.push({ startOffset: i, payloadOffset: j + 1 });
            i = j + 1;
            continue;
          } else {
            i = j;
            continue;
          }
        }
      }
      i++;
    }

    if (starts.length > 0) {
      const result: Uint8Array[] = [];
      for (let idx = 0; idx < starts.length; idx++) {
        const payloadStart = starts[idx].payloadOffset;
        const payloadEnd = idx + 1 < starts.length ? starts[idx + 1].startOffset : h264Buffer.length;
        const payloadLen = payloadEnd - payloadStart;
        if (payloadLen <= 0) continue;
        const nal = new Uint8Array(4 + payloadLen);
        nal[0] = 0x00;
        nal[1] = 0x00;
        nal[2] = 0x00;
        nal[3] = 0x01;
        nal.set(h264Buffer.subarray(payloadStart, payloadEnd), 4);
        result.push(nal);
      }
      if (result.length > 0) return result;
    }

    return [this.ensureAnnexBStartCode(h264Buffer)];
  },

  containsSpsAndPps(h264Buffer: Uint8Array): boolean {
    if (h264Buffer.length < 10) return false;
    const nals = this.splitAnnexBNalUnits(h264Buffer);
    let hasSps = false;
    let hasPps = false;
    for (const nal of nals) {
      const nalType = nal.length > 4 ? nal[4] & 0x1f : 0;
      if (nalType === 7) hasSps = true;
      if (nalType === 8) hasPps = true;
      if (hasSps && hasPps) return true;
    }
    return false;
  },

  encodeAoAVideoFrame(
    h264Data: Uint8Array,
    timestampMs = Date.now() & 0x7fffffff
  ): CarLifeFrame {
    const annexBData = this.ensureAnnexBStartCode(h264Data);
    const safeTs = timestampMs & 0x7fffffff;
    const innerVideoMsg = new Uint8Array(12 + annexBData.length);
    const view = new DataView(innerVideoMsg.buffer);
    view.setUint32(0, annexBData.length, false);
    view.setUint32(4, safeTs >>> 0, false);
    view.setUint32(8, CarLifeMsgType.MSG_VIDEO_DATA, false);
    innerVideoMsg.set(annexBData, 12);

    return {
      header: {
        channel: CarLifeChannelId.VIDEO,
        rawChannelId: CarLifeChannelId.VIDEO,
        payloadLength: innerVideoMsg.length,
        timestamp: safeTs,
        includeOuterTimestamp: false,
      },
      payload: innerVideoMsg,
    };
  },

  createVideoFrame(
    nalData: Uint8Array,
    timestampMs = Date.now() & 0x7fffffff,
    nestedVideoMsgHeader?: boolean
  ): CarLifeFrame {
    const useNested = nestedVideoMsgHeader ?? CarLifeFrameCodec.useNestedVideoMsgHeader;
    if (useNested) {
      return this.encodeAoAVideoFrame(nalData, timestampMs);
    }
    const annexBData = this.ensureAnnexBStartCode(nalData);
    const safeTs = timestampMs & 0x7fffffff;
    return {
      header: {
        channel: CarLifeChannelId.VIDEO,
        rawChannelId: CarLifeChannelId.VIDEO,
        payloadLength: annexBData.length,
        timestamp: safeTs,
        includeOuterTimestamp: true,
      },
      payload: annexBData,
    };
  },

  createAoAMediaAudioFrame(
    serviceType: number,
    payload: Uint8Array = new Uint8Array(0),
    timestampSec = Math.floor(Date.now() / 1000) & 0x7fffffff
  ): CarLifeFrame {
    const safeTs = timestampSec & 0x7fffffff;
    const innerMsg = new Uint8Array(12 + payload.length);
    const view = new DataView(innerMsg.buffer);
    view.setUint32(0, payload.length, false);
    view.setUint32(4, safeTs >>> 0, false);
    view.setUint32(8, serviceType >>> 0, false);
    if (payload.length > 0) innerMsg.set(payload, 12);
    return {
      header: {
        channel: CarLifeChannelId.MEDIA_AUDIO,
        rawChannelId: CarLifeChannelId.MEDIA_AUDIO,
        payloadLength: innerMsg.length,
        timestamp: safeTs,
        includeOuterTimestamp: false,
      },
      payload: innerMsg,
    };
  },

  createMediaInitFrame(
    sampleRate = CarlifeMusicInitProto.DEFAULT_SAMPLE_RATE,
    channelConfig = CarlifeMusicInitProto.DEFAULT_CHANNEL_CONFIG,
    sampleFormat = CarlifeMusicInitProto.DEFAULT_SAMPLE_FORMAT
  ): CarLifeFrame {
    return this.createAoAMediaAudioFrame(
      CarLifeMsgType.MSG_MEDIA_INIT,
      CarlifeMusicInitProto.encode(sampleRate, channelConfig, sampleFormat)
    );
  },

  createMediaDataFrame(pcmBytes: Uint8Array): CarLifeFrame {
    return this.createAoAMediaAudioFrame(CarLifeMsgType.MSG_MEDIA_DATA, pcmBytes);
  },

  createMediaStopFrame(): CarLifeFrame {
    return this.createAoAMediaAudioFrame(CarLifeMsgType.MSG_MEDIA_STOP, new Uint8Array(0));
  },

  formatHexPreview(frame: CarLifeFrame, maxPayloadBytes = 16): string {
    const headerBytes = this.encodeHeader(frame.header);
    const toHex = (arr: Uint8Array) =>
      Array.from(arr)
        .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
        .join(' ');

    if (
      (frame.header.channel === CarLifeChannelId.VIDEO ||
        frame.header.channel === CarLifeChannelId.MEDIA_AUDIO) &&
      !frame.header.includeOuterTimestamp &&
      frame.payload.length >= 12
    ) {
      const outerHex = toHex(headerBytes);
      const inner12Hex = toHex(frame.payload.subarray(0, 12));
      const bodySize = frame.payload.length - 12;
      const sliceLen = Math.min(bodySize, maxPayloadBytes);
      const bodyHex =
        sliceLen > 0
          ? toHex(frame.payload.subarray(12, 12 + sliceLen)) +
            (bodySize > sliceLen ? ` … (+${bodySize - sliceLen}B)` : '')
          : '<empty>';
      return `HDR[${outerHex} | ${inner12Hex}] | PAYLOAD[${bodyHex}]`;
    }

    const headerHex = toHex(headerBytes);
    const effectiveMaxPayload =
      frame.header.channel === CarLifeChannelId.CONTROL ||
      frame.header.channel === CarLifeChannelId.TOUCH
        ? Math.max(maxPayloadBytes, 256)
        : maxPayloadBytes;
    const sliceLen = Math.min(frame.payload.length, effectiveMaxPayload);
    const payloadHex =
      sliceLen > 0
        ? toHex(frame.payload.subarray(0, sliceLen)) +
          (frame.payload.length > sliceLen ? ` … (+${frame.payload.length - sliceLen}B)` : '')
        : '<empty>';
    return `HDR[${headerHex}] | PAYLOAD[${payloadHex}]`;
  },
};
