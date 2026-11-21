import { CarLifeChannelId, CarLifeMsgType, formatHex32 } from './carlifeConstants';
import { CarLifeFrame, CarLifeFrameCodec, parseCommandMessageOrNull } from './carlifeFrameCodec';
import {
  CarlifeDeviceInfo,
  CarlifeDeviceInfoProto,
  CarlifeModuleStatusProto,
  CarlifeProtocolVersionMatchStatusProto,
  CarlifeProtocolVersionProto,
  CarlifeVideoEncoderInfoProto,
  CarlifeVideoFrameRateProto,
  DEFAULT_S26U_DEVICE_INFO,
  ProtoWireWriter,
} from './carlifeWireProtobuf';

export enum CarLifeSessionPhase {
  IDLE = 'IDLE',
  VERSION_MATCHED = 'VERSION_MATCHED',
  DEVICE_INFO_EXCHANGED = 'DEVICE_INFO_EXCHANGED',
  VIDEO_INITIALIZED = 'VIDEO_INITIALIZED',
  VIDEO_STREAMING = 'VIDEO_STREAMING',
  VIDEO_PAUSED = 'VIDEO_PAUSED',
}

export interface HandshakeTestProfileInfo {
  id: number;
  shortTitle: string;
  description: string;
}

export const HANDSHAKE_TEST_PROFILES: HandshakeTestProfileInfo[] = [
  {
    id: 1,
    shortTitle: 'Тест 1: Только MATCH_STATUS (Чистый минимум)',
    description: 'Отправить ТОЛЬКО 0x00010002 [08 01] и ждать RX от ГУ (без MD_INFO, Audio, Video, Screen).',
  },
  {
    id: 2,
    shortTitle: 'Тест 2: MATCH_STATUS + минимальный MD_INFO',
    description: 'Отправить 0x00010002 + короткий MD_INFO 0x00010004 (только os="Android", ~9B), без Audio/Screen.',
  },
  {
    id: 3,
    shortTitle: 'Тест 3: MATCH_STATUS + MD_INFO + BT_OOB_INFO',
    description: 'Отправить 0x00010002 + короткий MD_INFO (0x00010004) + пустой 0x00010006, без Audio/FG/Screen.',
  },
  {
    id: 4,
    shortTitle: 'Тест 4: Полный запуск (Audio + Video + FG + ScreenOn)',
    description:
      'Рабочий профиль по умолчанию: полный MD_INFO (0x00010004) + AUDIO_INIT (0x0003/0x0004) + INIT_DONE (0x00010008) + SCREEN_ON (0x00010018) + USERPRESENT (0x0001001A) + FOREGROUND (0x0001001B) + REQ_FG (0x00010038).',
  },
];

export interface CarLifeControlSessionState {
  phase: CarLifeSessionPhase;
  huProtocolMajor: number;
  huProtocolMinor: number;
  huDeviceInfo: CarlifeDeviceInfo | null;
  negotiatedVideoWidth: number;
  negotiatedVideoHeight: number;
  negotiatedFps: number;
  isHuScreenOn: boolean;
  isHuForeground: boolean;
  heartbeatCount: number;
  lastControlAction: string;
}

export interface ControlTransitionResult {
  updatedState: CarLifeControlSessionState;
  outboundFrames: CarLifeFrame[];
  summary: string;
}

export class CarLifeControlStateMachine {
  private sessionState: CarLifeControlSessionState;
  public preferredVideoWidth = 1280;
  public preferredVideoHeight = 720;
  public handshakeTestProfileId = 4;
  private readonly mobileDeviceInfo: CarlifeDeviceInfo = DEFAULT_S26U_DEVICE_INFO;

  constructor(preferredWidth = 1280, preferredHeight = 720, handshakeProfileId = 4) {
    this.preferredVideoWidth = preferredWidth;
    this.preferredVideoHeight = preferredHeight;
    this.handshakeTestProfileId = handshakeProfileId;
    this.sessionState = {
      phase: CarLifeSessionPhase.IDLE,
      huProtocolMajor: 0,
      huProtocolMinor: 0,
      huDeviceInfo: null,
      negotiatedVideoWidth: preferredWidth,
      negotiatedVideoHeight: preferredHeight,
      negotiatedFps: 30,
      isHuScreenOn: true,
      isHuForeground: true,
      heartbeatCount: 0,
      lastControlAction: 'Awaiting MSG_CMD_HU_PROTOCOL_VERSION (0x00018001)',
    };
  }

  get state(): CarLifeControlSessionState {
    return this.sessionState;
  }

  reset(): void {
    this.sessionState = {
      phase: CarLifeSessionPhase.IDLE,
      huProtocolMajor: 0,
      huProtocolMinor: 0,
      huDeviceInfo: null,
      negotiatedVideoWidth: this.preferredVideoWidth,
      negotiatedVideoHeight: this.preferredVideoHeight,
      negotiatedFps: 30,
      isHuScreenOn: true,
      isHuForeground: true,
      heartbeatCount: 0,
      lastControlAction: 'Awaiting MSG_CMD_HU_PROTOCOL_VERSION (0x00018001)',
    };
  }

  setPreferredResolution(width: number, height: number): void {
    const safeW = Math.min(3840, Math.max(480, width));
    const safeH = Math.min(2160, Math.max(272, height));
    this.preferredVideoWidth = safeW;
    this.preferredVideoHeight = safeH;
    this.sessionState = {
      ...this.sessionState,
      negotiatedVideoWidth: safeW,
      negotiatedVideoHeight: safeH,
    };
  }

  buildForegroundAndScreenOnFrames(): CarLifeFrame[] {
    return [
      CarLifeFrameCodec.createCommandFrame(CarLifeChannelId.CONTROL, CarLifeMsgType.MSG_CMD_SCREEN_ON),
      CarLifeFrameCodec.createCommandFrame(CarLifeChannelId.CONTROL, CarLifeMsgType.MSG_CMD_SCREEN_USERPRESENT),
      CarLifeFrameCodec.createCommandFrame(CarLifeChannelId.CONTROL, CarLifeMsgType.MSG_CMD_FOREGROUND),
      CarLifeFrameCodec.createCommandFrame(
        CarLifeChannelId.CONTROL,
        CarLifeMsgType.MSG_CMD_REQUEST_GO_TO_FOREGROUND
      ),
    ];
  }

  buildAutoVideoEncoderInitAndStartFrames(
    width = this.preferredVideoWidth,
    height = this.preferredVideoHeight,
    fps = 30,
    reason = 'Proactive Handshake on 0x00018001',
    includeForegroundAndScreenOn = true
  ): ControlTransitionResult {
    const safeW = Math.min(3840, Math.max(480, width));
    const safeH = Math.min(2160, Math.max(272, height));
    const safeFps = Math.min(60, Math.max(15, fps));
    this.preferredVideoWidth = safeW;
    this.preferredVideoHeight = safeH;

    const initDoneFrame = CarLifeFrameCodec.createCommandFrame(
      CarLifeChannelId.CONTROL,
      CarLifeMsgType.MSG_CMD_VIDEO_ENCODER_INIT_DONE,
      CarlifeVideoEncoderInfoProto.encode({ width: safeW, height: safeH, frameRate: safeFps })
    );
    const outbound = [
      initDoneFrame,
      ...(includeForegroundAndScreenOn ? this.buildForegroundAndScreenOnFrames() : []),
    ];

    const suffix = includeForegroundAndScreenOn
      ? ' + SCREEN_ON (0x00010018) + USERPRESENT (0x0001001A) + FOREGROUND (0x0001001B) + REQ_FG (0x00010038)'
      : '';
    const summary = `${reason} (${safeW}x${safeH}@${safeFps}fps) -> TX INIT_DONE (0x00010008)${suffix}`;
    this.sessionState = {
      ...this.sessionState,
      phase: CarLifeSessionPhase.VIDEO_STREAMING,
      negotiatedVideoWidth: safeW,
      negotiatedVideoHeight: safeH,
      negotiatedFps: safeFps,
      isHuForeground: includeForegroundAndScreenOn,
      isHuScreenOn: includeForegroundAndScreenOn,
      lastControlAction: summary,
    };
    return { updatedState: this.sessionState, outboundFrames: outbound, summary };
  }

  createHeartbeatFrame(timestampMs = Date.now() & 0x7fffffff): CarLifeFrame {
    const nextCount = this.sessionState.heartbeatCount + 1;
    this.sessionState = {
      ...this.sessionState,
      heartbeatCount: nextCount,
      lastControlAction: `TX MSG_VIDEO_HEARTBEAT (0x00020002) #${nextCount}`,
    };
    return CarLifeFrameCodec.createVideoHeartbeatFrame(timestampMs);
  }

  onControlFrame(frame: CarLifeFrame): ControlTransitionResult {
    const cmd = parseCommandMessageOrNull(frame);
    if (!cmd) {
      const hex = CarLifeFrameCodec.formatHexPreview(frame, 64);
      const note = `RX Control Frame (${frame.header.payloadLength + 8}B, Payload: ${frame.payload.length}B) ${hex}`;
      this.sessionState = { ...this.sessionState, lastControlAction: note };
      return { updatedState: this.sessionState, outboundFrames: [], summary: note };
    }

    switch (cmd.serviceType) {
      case CarLifeMsgType.MSG_CMD_HU_PROTOCOL_VERSION:
      case CarLifeMsgType.MSG_CMD_HU_PROTOCOL_VERSION_ALT:
        return this.handleProtocolVersion(cmd.body);
      case CarLifeMsgType.MSG_CMD_HU_INFO:
        return this.handleHuInfo(cmd.body);
      case CarLifeMsgType.MSG_CMD_HU_STATS_REQUEST: {
        const hex = CarLifeFrameCodec.formatHexPreview(frame, 256);
        const reply = CarLifeFrameCodec.createCommandFrame(
          CarLifeChannelId.CONTROL,
          CarLifeMsgType.MSG_CMD_MD_INFO
        );
        const summary = `AUTH / STATS_REQ (0x00018004) ${hex} -> TX Empty Response (0x00010004)`;
        this.sessionState = { ...this.sessionState, lastControlAction: summary };
        return { updatedState: this.sessionState, outboundFrames: [reply], summary };
      }
      case CarLifeMsgType.MSG_CMD_HU_BT_OOB_INFO:
      case CarLifeMsgType.MSG_CMD_HU_BT_OOB_INFO_ALT: {
        const reply = CarLifeFrameCodec.createCommandFrame(
          CarLifeChannelId.CONTROL,
          CarLifeMsgType.MSG_CMD_MD_BT_OOB_INFO
        );
        const summary =
          'RX MSG_CMD_HU_BT_OOB_INFO (0x00018005) -> TX MSG_CMD_MD_BT_OOB_INFO (0x00010006)';
        this.sessionState = { ...this.sessionState, lastControlAction: summary };
        return { updatedState: this.sessionState, outboundFrames: [reply], summary };
      }
      case CarLifeMsgType.MSG_CMD_VIDEO_ENCODER_INIT:
      case CarLifeMsgType.MSG_CMD_VIDEO_ENCODER_INIT_ALT:
        return this.handleVideoEncoderInit(cmd.body);
      case CarLifeMsgType.MSG_CMD_VIDEO_ENCODER_START:
      case CarLifeMsgType.MSG_CMD_VIDEO_ENCODER_START_ALT:
        return this.handleVideoEncoderStart(frame.payload.length + 8);
      case CarLifeMsgType.MSG_CMD_VIDEO_ENCODER_PAUSE:
      case CarLifeMsgType.MSG_CMD_VIDEO_ENCODER_PAUSE_ALT: {
        const summary = 'RX MSG_CMD_VIDEO_ENCODER_PAUSE -> H.264 Streaming Paused';
        this.sessionState = {
          ...this.sessionState,
          phase: CarLifeSessionPhase.VIDEO_PAUSED,
          lastControlAction: summary,
        };
        return { updatedState: this.sessionState, outboundFrames: [], summary };
      }
      case CarLifeMsgType.MSG_CMD_VIDEO_ENCODER_RESET: {
        const reply = CarLifeFrameCodec.createCommandFrame(
          CarLifeChannelId.CONTROL,
          CarLifeMsgType.MSG_CMD_VIDEO_ENCODER_INIT_DONE,
          CarlifeVideoEncoderInfoProto.encode({
            width: this.sessionState.negotiatedVideoWidth,
            height: this.sessionState.negotiatedVideoHeight,
            frameRate: this.sessionState.negotiatedFps,
          })
        );
        const summary = `RX MSG_CMD_VIDEO_ENCODER_RESET -> Re-sent INIT_DONE (${this.sessionState.negotiatedVideoWidth}x${this.sessionState.negotiatedVideoHeight}@${this.sessionState.negotiatedFps}fps)`;
        this.sessionState = {
          ...this.sessionState,
          phase: CarLifeSessionPhase.VIDEO_INITIALIZED,
          lastControlAction: summary,
        };
        return { updatedState: this.sessionState, outboundFrames: [reply], summary };
      }
      case CarLifeMsgType.MSG_CMD_VIDEO_ENCODER_FRAME_RATE_CHANGE: {
        const req = CarlifeVideoFrameRateProto.decode(cmd.body);
        const reply = CarLifeFrameCodec.createCommandFrame(
          CarLifeChannelId.CONTROL,
          CarLifeMsgType.MSG_CMD_VIDEO_ENCODER_FRAME_RATE_CHANGE_DONE,
          CarlifeVideoFrameRateProto.encode(req.frameRate)
        );
        const summary = `RX FRAME_RATE_CHANGE(${req.frameRate}fps) -> TX DONE(${req.frameRate}fps)`;
        this.sessionState = {
          ...this.sessionState,
          negotiatedFps: req.frameRate,
          lastControlAction: summary,
        };
        return { updatedState: this.sessionState, outboundFrames: [reply], summary };
      }
      case CarLifeMsgType.MSG_CMD_MODULE_CONTROL:
      case CarLifeMsgType.MSG_CMD_MODULE_CONTROL_ALT: {
        const hex = CarLifeFrameCodec.formatHexPreview(frame, 256);
        const reqStatus = CarlifeModuleStatusProto.decode(cmd.body);
        const replyFrame = CarLifeFrameCodec.createCommandFrame(
          CarLifeChannelId.CONTROL,
          CarLifeMsgType.MSG_CMD_MODULE_STATUS,
          CarlifeModuleStatusProto.encode(reqStatus.moduleId, reqStatus.statusId)
        );
        const summary = `RX MSG_CMD_MODULE_CONTROL (module=${reqStatus.moduleId}, status=${reqStatus.statusId}) ${hex} -> TX MSG_CMD_MODULE_STATUS (0x00010023)`;
        this.sessionState = { ...this.sessionState, lastControlAction: summary };
        return { updatedState: this.sessionState, outboundFrames: [replyFrame], summary };
      }
      case CarLifeMsgType.MSG_CMD_MODULE_STATUS:
      case CarLifeMsgType.MSG_CMD_MODULE_STATUS_ALT: {
        const hex = CarLifeFrameCodec.formatHexPreview(frame, 256);
        const statusProto = CarlifeModuleStatusProto.decode(cmd.body);
        const note = `RX MSG_CMD_MODULE_STATUS (module=${statusProto.moduleId}, status=${statusProto.statusId}) ${hex}`;
        this.sessionState = { ...this.sessionState, lastControlAction: note };
        return { updatedState: this.sessionState, outboundFrames: [], summary: note };
      }
      case CarLifeMsgType.MSG_CMD_STATISTIC_INFO:
      case CarLifeMsgType.MSG_CMD_STATISTIC_INFO_ALT: {
        const hex = CarLifeFrameCodec.formatHexPreview(frame, 1024);
        const idHex = formatHex32(cmd.serviceType);
        const note = `RX MSG_CMD_STATISTIC_INFO (${idHex}, ${frame.payload.length}B) ${hex} (logged only)`;
        this.sessionState = { ...this.sessionState, lastControlAction: note };
        return { updatedState: this.sessionState, outboundFrames: [], summary: note };
      }
      case CarLifeMsgType.MSG_CMD_HU_RSA_PUBLIC_KEY_REQUEST:
      case 0x00010040:
      case 0x0001804f:
      case 0x0001004f: {
        const hex = CarLifeFrameCodec.formatHexPreview(frame, 256);
        const idHex = formatHex32(cmd.serviceType);
        const note = `RX HFP/Telephony (${idHex}) ${hex} -> ignored (native HU Bluetooth & dialer preserved)`;
        this.sessionState = { ...this.sessionState, lastControlAction: note };
        return { updatedState: this.sessionState, outboundFrames: [], summary: note };
      }
      case CarLifeMsgType.MSG_CMD_HU_AUTHEN_REQUEST:
      case CarLifeMsgType.MSG_CMD_HU_AUTHEN_REQUEST_ALT:
      case CarLifeMsgType.MSG_CMD_HU_AUTHEN_REQUEST_LEGACY: {
        const hex = CarLifeFrameCodec.formatHexPreview(frame, 256);
        const replyProto =
          cmd.body.length > 0
            ? cmd.body
            : new ProtoWireWriter().writeStringField(1, 'CarLife_S26U_Auth_OK').toByteArray();
        const respId =
          cmd.serviceType === CarLifeMsgType.MSG_CMD_HU_AUTHEN_REQUEST_LEGACY
            ? CarLifeMsgType.MSG_CMD_MD_AUTHEN_RESPONSE_LEGACY
            : CarLifeMsgType.MSG_CMD_MD_AUTHEN_RESPONSE;
        const replyFrame = CarLifeFrameCodec.createCommandFrame(
          CarLifeChannelId.CONTROL,
          respId,
          replyProto
        );
        const summary = `RX MSG_CMD_HU_AUTHEN_REQUEST ${hex} -> TX MSG_CMD_MD_AUTHEN_RESPONSE (${formatHex32(respId)})`;
        this.sessionState = { ...this.sessionState, lastControlAction: summary };
        return { updatedState: this.sessionState, outboundFrames: [replyFrame], summary };
      }
      case CarLifeMsgType.MSG_CMD_HU_AUTHEN_RESULT:
      case CarLifeMsgType.MSG_CMD_HU_AUTHEN_RESULT_ALT: {
        const hex = CarLifeFrameCodec.formatHexPreview(frame, 256);
        const replyFrame = CarLifeFrameCodec.createCommandFrame(
          CarLifeChannelId.CONTROL,
          CarLifeMsgType.MSG_CMD_MD_AUTHEN_RESULT,
          new Uint8Array([0x08, 0x01])
        );
        const summary = `RX MSG_CMD_HU_AUTHEN_RESULT ${hex} -> TX MSG_CMD_MD_AUTHEN_RESULT (0x0001004B)`;
        this.sessionState = { ...this.sessionState, lastControlAction: summary };
        return { updatedState: this.sessionState, outboundFrames: [replyFrame], summary };
      }
      case CarLifeMsgType.MSG_CMD_HU_FEATURE_CONFIG_REQUEST:
      case CarLifeMsgType.MSG_CMD_MD_FEATURE_CONFIG_REQUEST: {
        const hex = CarLifeFrameCodec.formatHexPreview(frame, 256);
        const replyFrame = CarLifeFrameCodec.createCommandFrame(
          CarLifeChannelId.CONTROL,
          CarLifeMsgType.MSG_CMD_MD_FEATURE_CONFIG_RESPONSE
        );
        const summary = `RX MSG_CMD_HU_FEATURE_CONFIG_REQUEST ${hex} -> TX MSG_CMD_MD_FEATURE_CONFIG_RESPONSE (0x00010052)`;
        this.sessionState = { ...this.sessionState, lastControlAction: summary };
        return { updatedState: this.sessionState, outboundFrames: [replyFrame], summary };
      }
      case CarLifeMsgType.MSG_CMD_MD_AES_KEY_REQUEST:
      case CarLifeMsgType.MSG_CMD_MD_AES_KEY_REQUEST_ALT:
      case CarLifeMsgType.MSG_CMD_HU_AES_KEY_REQUEST: {
        const hex = CarLifeFrameCodec.formatHexPreview(frame, 256);
        const ack = new Uint8Array([0x08, 0x01]);
        const r57 = CarLifeFrameCodec.createCommandFrame(
          CarLifeChannelId.CONTROL,
          CarLifeMsgType.MSG_CMD_MD_AES_KEY_RESPONSE,
          ack
        );
        const r58 = CarLifeFrameCodec.createCommandFrame(
          CarLifeChannelId.CONTROL,
          CarLifeMsgType.MSG_CMD_HU_AES_REC_RESPONSE,
          ack
        );
        const summary = `RX MSG_CMD_MD_AES_KEY_REQUEST ${hex} -> TX MSG_CMD_HU_AES_REC_RESPONSE (0x00010057/58)`;
        this.sessionState = { ...this.sessionState, lastControlAction: summary };
        return { updatedState: this.sessionState, outboundFrames: [r57, r58], summary };
      }
      default:
        return this.handleUnknownOrAuthCommand(frame, cmd.serviceType);
    }
  }

  private handleProtocolVersion(body: Uint8Array): ControlTransitionResult {
    const versionProto = CarlifeProtocolVersionProto.decode(body);
    const matchStatusFrame = CarLifeFrameCodec.createCommandFrame(
      CarLifeChannelId.CONTROL,
      CarLifeMsgType.MSG_CMD_PROTOCOL_VERSION_MATCH_STATUS,
      CarlifeProtocolVersionMatchStatusProto.encode(CarlifeProtocolVersionMatchStatusProto.MATCH_SUCCESS)
    );

    let outbound: CarLifeFrame[];
    let summary: string;

    switch (this.handshakeTestProfileId) {
      case 1:
        outbound = [matchStatusFrame];
        summary = `HU Protocol v${versionProto.majorVersion}.${versionProto.minorVersion} [Тест 1] -> TX ONLY MATCH_STATUS (0x00010002 [08 01])`;
        break;
      case 2: {
        const minMd = CarLifeFrameCodec.createCommandFrame(
          CarLifeChannelId.CONTROL,
          CarLifeMsgType.MSG_CMD_MD_INFO,
          CarlifeDeviceInfoProto.encodeMinimal(this.mobileDeviceInfo)
        );
        outbound = [matchStatusFrame, minMd];
        summary = `HU Protocol v${versionProto.majorVersion}.${versionProto.minorVersion} [Тест 2] -> TX MATCH_STATUS (0x00010002) + min MD_INFO (0x00010004, ${minMd.payload.length - 8}B)`;
        break;
      }
      case 3: {
        const minMd = CarLifeFrameCodec.createCommandFrame(
          CarLifeChannelId.CONTROL,
          CarLifeMsgType.MSG_CMD_MD_INFO,
          CarlifeDeviceInfoProto.encodeMinimal(this.mobileDeviceInfo)
        );
        const btOob = CarLifeFrameCodec.createCommandFrame(
          CarLifeChannelId.CONTROL,
          CarLifeMsgType.MSG_CMD_MD_BT_OOB_INFO
        );
        outbound = [matchStatusFrame, minMd, btOob];
        summary = `HU Protocol v${versionProto.majorVersion}.${versionProto.minorVersion} [Тест 3] -> TX MATCH_STATUS (0x00010002) + min MD_INFO (0x00010004) + empty BT_OOB (0x00010006)`;
        break;
      }
      default: {
        const fullMd = CarLifeFrameCodec.createCommandFrame(
          CarLifeChannelId.CONTROL,
          CarLifeMsgType.MSG_CMD_MD_INFO,
          CarlifeDeviceInfoProto.encode(this.mobileDeviceInfo)
        );
        outbound = [matchStatusFrame, fullMd];
        summary = `HU Protocol v${versionProto.majorVersion}.${versionProto.minorVersion} [Тест 4] -> TX MATCH_STATUS (0x00010002) + full MD_INFO (0x00010004) + Audio/Video + FG + ScreenOn`;
        break;
      }
    }

    this.sessionState = {
      ...this.sessionState,
      phase: CarLifeSessionPhase.VERSION_MATCHED,
      huProtocolMajor: versionProto.majorVersion,
      huProtocolMinor: versionProto.minorVersion,
      lastControlAction: summary,
    };
    return { updatedState: this.sessionState, outboundFrames: outbound, summary };
  }

  private handleHuInfo(body: Uint8Array): ControlTransitionResult {
    const huInfo = CarlifeDeviceInfoProto.decode(body);
    const mdInfoFrame = CarLifeFrameCodec.createCommandFrame(
      CarLifeChannelId.CONTROL,
      CarLifeMsgType.MSG_CMD_MD_INFO,
      CarlifeDeviceInfoProto.encode(this.mobileDeviceInfo)
    );
    const summary = `RX HU_INFO (0x00018003: ${huInfo.manufacturer} ${huInfo.model}, OS=${huInfo.os}) -> TX MD_INFO (0x00010004: ${this.mobileDeviceInfo.model})`;
    this.sessionState = {
      ...this.sessionState,
      phase:
        this.sessionState.phase === CarLifeSessionPhase.IDLE
          ? CarLifeSessionPhase.DEVICE_INFO_EXCHANGED
          : this.sessionState.phase,
      huDeviceInfo: huInfo,
      lastControlAction: summary,
    };
    return { updatedState: this.sessionState, outboundFrames: [mdInfoFrame], summary };
  }

  private handleVideoEncoderInit(_body: Uint8Array): ControlTransitionResult {
    const negotiatedWidth = this.preferredVideoWidth;
    const negotiatedHeight = this.preferredVideoHeight;
    const negotiatedFps = 30;
    const initDoneFrame = CarLifeFrameCodec.createCommandFrame(
      CarLifeChannelId.CONTROL,
      CarLifeMsgType.MSG_CMD_VIDEO_ENCODER_INIT_DONE,
      CarlifeVideoEncoderInfoProto.encode({
        width: negotiatedWidth,
        height: negotiatedHeight,
        frameRate: negotiatedFps,
      })
    );
    const summary = `Video Init (0x00018007): ${negotiatedWidth}x${negotiatedHeight}@${negotiatedFps}fps -> TX INIT_DONE (0x00010008)`;
    this.sessionState = {
      ...this.sessionState,
      phase: CarLifeSessionPhase.VIDEO_INITIALIZED,
      negotiatedVideoWidth: negotiatedWidth,
      negotiatedVideoHeight: negotiatedHeight,
      negotiatedFps,
      lastControlAction: summary,
    };
    return { updatedState: this.sessionState, outboundFrames: [initDoneFrame], summary };
  }

  private handleVideoEncoderStart(wireBytes = 12): ControlTransitionResult {
    const outbound = this.buildForegroundAndScreenOnFrames();
    const summary = `RX MSG_CMD_VIDEO_ENCODER_START (0x00018009, ${wireBytes}B) -> TX SCREEN_ON (0x00010018) + USERPRESENT (0x0001001A) + FOREGROUND (0x0001001B) + REQ_FG (0x00010038) -> Streaming 0x0002`;
    this.sessionState = {
      ...this.sessionState,
      phase: CarLifeSessionPhase.VIDEO_STREAMING,
      isHuForeground: true,
      isHuScreenOn: true,
      lastControlAction: summary,
    };
    return { updatedState: this.sessionState, outboundFrames: outbound, summary };
  }

  private handleUnknownOrAuthCommand(
    frame: CarLifeFrame,
    serviceId: number
  ): ControlTransitionResult {
    const hex = CarLifeFrameCodec.formatHexPreview(frame, 256);
    const serviceHex = formatHex32(serviceId);
    const normalizedReplyId = (serviceId & ~0x00008000) >>> 0;
    const isBlockedHfp = normalizedReplyId >= 0x00010040 && normalizedReplyId <= 0x0001004f;
    const isPassiveTelemetry =
      (serviceId >= CarLifeMsgType.MSG_CMD_CAR_VELOCITY &&
        serviceId <= CarLifeMsgType.MSG_CMD_CAR_OIL) ||
      serviceId === CarLifeMsgType.MSG_CMD_STATISTIC_INFO ||
      serviceId === CarLifeMsgType.MSG_CMD_STATISTIC_INFO_ALT ||
      serviceId === CarLifeMsgType.MSG_CMD_PAUSE_MEDIA ||
      isBlockedHfp;
    const isHuRequest =
      (serviceId >>> 16) === 0x0001 && (serviceId & 0x8000) !== 0 && !isPassiveTelemetry;

    const outbound = isHuRequest
      ? [
          CarLifeFrameCodec.createCommandFrame(
            CarLifeChannelId.CONTROL,
            normalizedReplyId,
            new Uint8Array([0x08, 0x01])
          ),
        ]
      : [];

    const replyNote =
      outbound.length > 0 ? ` -> TX Mock Ack (${formatHex32(normalizedReplyId)} [08 01])` : '';
    const summary = `AUTH / UNKNOWN (${serviceHex}, ${frame.payload.length}B) ${hex}${replyNote}`;
    this.sessionState = { ...this.sessionState, lastControlAction: summary };
    return { updatedState: this.sessionState, outboundFrames: outbound, summary };
  }
}
