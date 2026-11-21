/**
 * Baidu CarLife USB AOA Protocol Constants & Service IDs
 * tailored for Jetta VS7 (FAW-VW MQB platform) Head Unit + Samsung Galaxy S26 Ultra.
 */

export const CHANNEL_CONTROL = 0x00000001;
export const CHANNEL_VIDEO = 0x00000002;
export const CHANNEL_MEDIA_AUDIO = 0x00000003;
export const CHANNEL_TTS_AUDIO = 0x00000004;
export const CHANNEL_VR_AUDIO = 0x00000005;
export const CHANNEL_TOUCH = 0x00000006;

export const STANDARD_HEADER_SIZE = 8;
export const MEDIA_HEADER_SIZE = 12;
export const INNER_CMD_HEADER_SIZE = 8;
export const MAX_AOA_WRITE_SIZE = 16_384;
export const MAX_FRAME_PAYLOAD_SIZE = 8 * 1024 * 1024;

export enum CarLifeChannelId {
  CONTROL = 0x0001,
  VIDEO = 0x0002,
  MEDIA_AUDIO = 0x0003,
  TTS_AUDIO = 0x0004,
  VR_AUDIO = 0x0005,
  TOUCH = 0x0006,
}

export interface CarLifeChannelInfo {
  id: CarLifeChannelId;
  key: 'CONTROL' | 'VIDEO' | 'MEDIA_AUDIO' | 'TTS_AUDIO' | 'VR_AUDIO' | 'TOUCH';
  label: string;
  hasTimestampHeader: boolean;
  headerSizeBytes: number;
}

export const CARLIFE_CHANNELS: CarLifeChannelInfo[] = [
  {
    id: CarLifeChannelId.CONTROL,
    key: 'CONTROL',
    label: 'CMD / Control',
    hasTimestampHeader: false,
    headerSizeBytes: STANDARD_HEADER_SIZE,
  },
  {
    id: CarLifeChannelId.VIDEO,
    key: 'VIDEO',
    label: 'H.264 Video',
    hasTimestampHeader: true,
    headerSizeBytes: MEDIA_HEADER_SIZE,
  },
  {
    id: CarLifeChannelId.MEDIA_AUDIO,
    key: 'MEDIA_AUDIO',
    label: 'PCM Media Audio',
    hasTimestampHeader: true,
    headerSizeBytes: MEDIA_HEADER_SIZE,
  },
  {
    id: CarLifeChannelId.TTS_AUDIO,
    key: 'TTS_AUDIO',
    label: 'PCM TTS Audio',
    hasTimestampHeader: true,
    headerSizeBytes: MEDIA_HEADER_SIZE,
  },
  {
    id: CarLifeChannelId.VR_AUDIO,
    key: 'VR_AUDIO',
    label: 'VR Mic Audio',
    hasTimestampHeader: true,
    headerSizeBytes: MEDIA_HEADER_SIZE,
  },
  {
    id: CarLifeChannelId.TOUCH,
    key: 'TOUCH',
    label: 'Touch & HardKey',
    hasTimestampHeader: false,
    headerSizeBytes: STANDARD_HEADER_SIZE,
  },
];

export function channelFromId(rawChannelId: number): CarLifeChannelInfo | null {
  const normalized = rawChannelId & 0xffff;
  return CARLIFE_CHANNELS.find((c) => c.id === normalized) ?? null;
}

export function channelInfo(id: CarLifeChannelId): CarLifeChannelInfo {
  return CARLIFE_CHANNELS.find((c) => c.id === id) ?? CARLIFE_CHANNELS[0];
}

export function formatHex32(value: number): string {
  return `0x${(value >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
}

export function formatHex16(value: number): string {
  return `0x${(value & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`;
}

export const CarLifeMsgType = {
  // Control Channel (0x0001)
  MSG_CMD_HU_PROTOCOL_VERSION: 0x00018001,
  MSG_CMD_HU_PROTOCOL_VERSION_ALT: 0x00010001,
  MSG_CMD_PROTOCOL_VERSION_MATCH_STATUS: 0x00010002,
  MSG_CMD_HU_INFO: 0x00018003,
  MSG_CMD_MD_INFO: 0x00010004,
  MSG_CMD_HU_STATS_REQUEST: 0x00018004,
  MSG_CMD_HU_BT_OOB_INFO: 0x00018005,
  MSG_CMD_HU_BT_OOB_INFO_ALT: 0x00010005,
  MSG_CMD_MD_BT_OOB_INFO: 0x00010006,
  MSG_CMD_VIDEO_ENCODER_INIT: 0x00018007,
  MSG_CMD_VIDEO_ENCODER_INIT_ALT: 0x00010007,
  MSG_CMD_VIDEO_ENCODER_INIT_DONE: 0x00010008,
  MSG_CMD_VIDEO_ENCODER_START: 0x00018009,
  MSG_CMD_VIDEO_ENCODER_START_ALT: 0x00010009,
  MSG_CMD_VIDEO_ENCODER_PAUSE: 0x0001800a,
  MSG_CMD_VIDEO_ENCODER_PAUSE_ALT: 0x0001800b,
  MSG_CMD_VIDEO_ENCODER_RESET: 0x0001800c,
  MSG_CMD_VIDEO_ENCODER_FRAME_RATE_CHANGE: 0x0001800d,
  MSG_CMD_VIDEO_ENCODER_FRAME_RATE_CHANGE_DONE: 0x0001000e,
  MSG_CMD_AUTHEN_REQUEST_0B: 0x0001000b,
  MSG_CMD_AUTHEN_RESPONSE_0B: 0x0001800b,
  MSG_CMD_AUTHEN_REQUEST_0C: 0x0001000c,
  MSG_CMD_AUTHEN_RESPONSE_0C: 0x0001800c,
  MSG_CMD_AUTHEN_REQUEST_0D: 0x0001000d,
  MSG_CMD_AUTHEN_RESPONSE_0D: 0x0001800d,
  MSG_CMD_AUTHEN_RESPONSE_0E: 0x0001800e,
  MSG_CMD_PAUSE_MEDIA: 0x0001800e,
  MSG_CMD_CAR_VELOCITY: 0x0001800f,
  MSG_CMD_CAR_GPS: 0x00018010,
  MSG_CMD_CAR_GYROSCOPE: 0x00018011,
  MSG_CMD_CAR_ACCELERATION: 0x00018012,
  MSG_CMD_CAR_OIL: 0x00018013,
  MSG_CMD_LAUNCH_MODE_NORMAL: 0x00010014,
  MSG_CMD_LAUNCH_MODE_PHONE: 0x00010015,
  MSG_CMD_LAUNCH_MODE_MAP: 0x00010016,
  MSG_CMD_LAUNCH_MODE_MUSIC: 0x00010017,
  MSG_CMD_SCREEN_ON: 0x00010018,
  MSG_CMD_SCREEN_OFF: 0x00010019,
  MSG_CMD_SCREEN_USERPRESENT: 0x0001001a,
  MSG_CMD_FOREGROUND: 0x0001001b,
  MSG_CMD_BACKGROUND: 0x0001001c,
  MSG_CMD_GO_TO_DESKTOP: 0x0001001e,
  MSG_CMD_MIC_RECORD_WAKEUP_START: 0x0001001f,
  MSG_CMD_MIC_RECORD_END: 0x00010020,
  MSG_CMD_MIC_RECORD_RECOG_START: 0x00010021,
  MSG_CMD_MODULE_STATUS: 0x00010023,
  MSG_CMD_MODULE_STATUS_ALT: 0x00018023,
  MSG_CMD_STATISTIC_INFO_ALT: 0x00018024,
  MSG_CMD_GO_TO_FOREGROUND: 0x00018025,
  MSG_CMD_MODULE_CONTROL: 0x00018026,
  MSG_CMD_MODULE_CONTROL_ALT: 0x00010026,
  MSG_CMD_STATISTIC_INFO: 0x00018027,
  MSG_CMD_REQUEST_GO_TO_FOREGROUND: 0x00010038,
  MSG_CMD_HU_RSA_PUBLIC_KEY_REQUEST: 0x00018040,
  MSG_CMD_HU_RSA_PUBLIC_KEY_RESPONSE: 0x00010040,
  MSG_CMD_VEHICLE_CERTIFICATE_REQUEST: 0x00018041,
  MSG_CMD_VEHICLE_CERTIFICATE_RESPONSE: 0x00010041,
  MSG_CMD_HU_AUTHEN_REQUEST: 0x00018048,
  MSG_CMD_HU_AUTHEN_REQUEST_ALT: 0x00010048,
  MSG_CMD_HU_AUTHEN_REQUEST_LEGACY: 0x00018030,
  MSG_CMD_MD_AUTHEN_RESPONSE: 0x00010049,
  MSG_CMD_MD_AUTHEN_RESPONSE_LEGACY: 0x00010031,
  MSG_CMD_HU_AUTHEN_RESULT: 0x0001804a,
  MSG_CMD_HU_AUTHEN_RESULT_ALT: 0x0001004a,
  MSG_CMD_MD_AUTHEN_RESULT: 0x0001004b,
  MSG_CMD_HU_FEATURE_CONFIG_REQUEST: 0x00018051,
  MSG_CMD_MD_FEATURE_CONFIG_REQUEST: 0x00010050,
  MSG_CMD_MD_FEATURE_CONFIG_RESPONSE: 0x00010052,
  MSG_CMD_MD_AES_KEY_REQUEST: 0x00018056,
  MSG_CMD_MD_AES_KEY_REQUEST_ALT: 0x00010056,
  MSG_CMD_HU_AES_KEY_REQUEST: 0x00018057,
  MSG_CMD_MD_AES_KEY_RESPONSE: 0x00010057,
  MSG_CMD_HU_AES_REC_RESPONSE: 0x00010058,

  // Video Channel (0x0002)
  MSG_VIDEO_DATA: 0x00020001,
  MSG_VIDEO_DATA_ALT: 0x00028001,
  MSG_VIDEO_HEARTBEAT: 0x00020002,
  MSG_VIDEO_HEARTBEAT_ALT: 0x00028002,

  // Audio Channels (0x0003..0x0005)
  MSG_MEDIA_INIT: 0x00030001,
  MSG_MEDIA_STOP: 0x00030002,
  MSG_MEDIA_PAUSE: 0x00030003,
  MSG_MEDIA_RESUME_PLAY: 0x00030004,
  MSG_MEDIA_SEEK_TO: 0x00030005,
  MSG_MEDIA_DATA: 0x00030006,

  // Touch & Key Channel (0x0006)
  MSG_TOUCH_ACTION: 0x00068001,
  MSG_TOUCH_ACTION_DOWN: 0x00068002,
  MSG_TOUCH_ACTION_UP: 0x00068003,
  MSG_TOUCH_ACTION_MOVE: 0x00068004,
  MSG_TOUCH_SINGLE_CLICK: 0x00068005,
  MSG_TOUCH_DOUBLE_CLICK: 0x00068006,
  MSG_TOUCH_LONG_PRESS: 0x00068007,
  MSG_TOUCH_CAR_HARD_KEY_CODE: 0x00068008,
  MSG_TOUCH_UI_ACTION_SOUND: 0x00060009,
} as const;

export function isCarLifeServiceId(candidate: number): boolean {
  const high16 = (candidate >>> 16) & 0xffff;
  const low16 = candidate & 0xffff;
  return high16 >= 0x0001 && high16 <= 0x0006 && low16 !== 0;
}

export function serviceTypeName(serviceType: number): string {
  switch (serviceType >>> 0) {
    case CarLifeMsgType.MSG_CMD_HU_PROTOCOL_VERSION:
    case CarLifeMsgType.MSG_CMD_HU_PROTOCOL_VERSION_ALT:
      return 'MSG_CMD_HU_PROTOCOL_VERSION';
    case CarLifeMsgType.MSG_CMD_PROTOCOL_VERSION_MATCH_STATUS:
      return 'MSG_CMD_PROTOCOL_VERSION_MATCH_STATUS';
    case CarLifeMsgType.MSG_CMD_HU_INFO:
      return 'MSG_CMD_HU_INFO';
    case CarLifeMsgType.MSG_CMD_MD_INFO:
      return 'MSG_CMD_MD_INFO';
    case CarLifeMsgType.MSG_CMD_HU_STATS_REQUEST:
      return 'AUTH / STATS_REQ (0x00018004)';
    case CarLifeMsgType.MSG_CMD_HU_BT_OOB_INFO:
    case CarLifeMsgType.MSG_CMD_HU_BT_OOB_INFO_ALT:
      return 'MSG_CMD_HU_BT_OOB_INFO';
    case CarLifeMsgType.MSG_CMD_MD_BT_OOB_INFO:
      return 'MSG_CMD_MD_BT_OOB_INFO';
    case CarLifeMsgType.MSG_CMD_VIDEO_ENCODER_INIT:
    case CarLifeMsgType.MSG_CMD_VIDEO_ENCODER_INIT_ALT:
      return 'MSG_CMD_VIDEO_ENCODER_INIT';
    case CarLifeMsgType.MSG_CMD_VIDEO_ENCODER_INIT_DONE:
      return 'MSG_CMD_VIDEO_ENCODER_INIT_DONE';
    case CarLifeMsgType.MSG_CMD_VIDEO_ENCODER_START:
    case CarLifeMsgType.MSG_CMD_VIDEO_ENCODER_START_ALT:
      return 'MSG_CMD_VIDEO_ENCODER_START';
    case CarLifeMsgType.MSG_CMD_VIDEO_ENCODER_PAUSE:
    case CarLifeMsgType.MSG_CMD_VIDEO_ENCODER_PAUSE_ALT:
      return 'MSG_CMD_VIDEO_ENCODER_PAUSE';
    case CarLifeMsgType.MSG_CMD_VIDEO_ENCODER_RESET:
      return 'MSG_CMD_VIDEO_ENCODER_RESET';
    case CarLifeMsgType.MSG_CMD_VIDEO_ENCODER_FRAME_RATE_CHANGE:
      return 'MSG_CMD_VIDEO_ENCODER_FRAME_RATE_CHANGE';
    case CarLifeMsgType.MSG_CMD_VIDEO_ENCODER_FRAME_RATE_CHANGE_DONE:
      return 'MSG_CMD_VIDEO_ENCODER_FRAME_RATE_CHANGE_DONE';
    case CarLifeMsgType.MSG_CMD_SCREEN_ON:
      return 'MSG_CMD_SCREEN_ON';
    case CarLifeMsgType.MSG_CMD_SCREEN_OFF:
      return 'MSG_CMD_SCREEN_OFF';
    case CarLifeMsgType.MSG_CMD_SCREEN_USERPRESENT:
      return 'MSG_CMD_SCREEN_USERPRESENT';
    case CarLifeMsgType.MSG_CMD_FOREGROUND:
      return 'MSG_CMD_FOREGROUND';
    case CarLifeMsgType.MSG_CMD_BACKGROUND:
      return 'MSG_CMD_BACKGROUND';
    case CarLifeMsgType.MSG_CMD_GO_TO_DESKTOP:
      return 'MSG_CMD_GO_TO_DESKTOP';
    case CarLifeMsgType.MSG_CMD_GO_TO_FOREGROUND:
      return 'MSG_CMD_GO_TO_FOREGROUND';
    case CarLifeMsgType.MSG_CMD_REQUEST_GO_TO_FOREGROUND:
      return 'MSG_CMD_REQUEST_GO_TO_FOREGROUND';
    case CarLifeMsgType.MSG_CMD_MODULE_STATUS:
    case CarLifeMsgType.MSG_CMD_MODULE_STATUS_ALT:
      return 'MSG_CMD_MODULE_STATUS';
    case CarLifeMsgType.MSG_CMD_STATISTIC_INFO:
    case CarLifeMsgType.MSG_CMD_STATISTIC_INFO_ALT:
      return 'MSG_CMD_STATISTIC_INFO';
    case CarLifeMsgType.MSG_CMD_MODULE_CONTROL:
    case CarLifeMsgType.MSG_CMD_MODULE_CONTROL_ALT:
      return 'MSG_CMD_MODULE_CONTROL';
    case CarLifeMsgType.MSG_CMD_HU_RSA_PUBLIC_KEY_REQUEST:
      return 'AUTH / HU_RSA_PUBLIC_KEY (0x00018040)';
    case CarLifeMsgType.MSG_CMD_HU_RSA_PUBLIC_KEY_RESPONSE:
      return 'AUTH / MD_RSA_PUBLIC_KEY_RESP (0x00010040)';
    case CarLifeMsgType.MSG_CMD_VEHICLE_CERTIFICATE_REQUEST:
      return 'AUTH / VEHICLE_CERT (0x00018041)';
    case CarLifeMsgType.MSG_CMD_VEHICLE_CERTIFICATE_RESPONSE:
      return 'AUTH / VEHICLE_CERT_RESP (0x00010041)';
    case CarLifeMsgType.MSG_CMD_HU_AUTHEN_REQUEST:
    case CarLifeMsgType.MSG_CMD_HU_AUTHEN_REQUEST_ALT:
    case CarLifeMsgType.MSG_CMD_HU_AUTHEN_REQUEST_LEGACY:
      return 'MSG_CMD_HU_AUTHEN_REQUEST';
    case CarLifeMsgType.MSG_CMD_MD_AUTHEN_RESPONSE:
    case CarLifeMsgType.MSG_CMD_MD_AUTHEN_RESPONSE_LEGACY:
      return 'MSG_CMD_MD_AUTHEN_RESPONSE';
    case CarLifeMsgType.MSG_CMD_HU_AUTHEN_RESULT:
    case CarLifeMsgType.MSG_CMD_HU_AUTHEN_RESULT_ALT:
      return 'MSG_CMD_HU_AUTHEN_RESULT';
    case CarLifeMsgType.MSG_CMD_MD_AUTHEN_RESULT:
      return 'MSG_CMD_MD_AUTHEN_RESULT';
    case CarLifeMsgType.MSG_CMD_HU_FEATURE_CONFIG_REQUEST:
    case CarLifeMsgType.MSG_CMD_MD_FEATURE_CONFIG_REQUEST:
      return 'MSG_CMD_HU_FEATURE_CONFIG_REQUEST';
    case CarLifeMsgType.MSG_CMD_MD_FEATURE_CONFIG_RESPONSE:
      return 'MSG_CMD_MD_FEATURE_CONFIG_RESPONSE';
    case CarLifeMsgType.MSG_CMD_MD_AES_KEY_REQUEST:
    case CarLifeMsgType.MSG_CMD_MD_AES_KEY_REQUEST_ALT:
    case CarLifeMsgType.MSG_CMD_HU_AES_KEY_REQUEST:
      return 'MSG_CMD_MD_AES_KEY_REQUEST';
    case CarLifeMsgType.MSG_CMD_MD_AES_KEY_RESPONSE:
    case CarLifeMsgType.MSG_CMD_HU_AES_REC_RESPONSE:
      return 'MSG_CMD_HU_AES_REC_RESPONSE';
    case CarLifeMsgType.MSG_VIDEO_DATA:
    case CarLifeMsgType.MSG_VIDEO_DATA_ALT:
      return 'MSG_VIDEO_DATA';
    case CarLifeMsgType.MSG_VIDEO_HEARTBEAT:
    case CarLifeMsgType.MSG_VIDEO_HEARTBEAT_ALT:
      return 'MSG_VIDEO_HEARTBEAT';
    case CarLifeMsgType.MSG_MEDIA_INIT:
      return 'MSG_MEDIA_INIT';
    case CarLifeMsgType.MSG_MEDIA_STOP:
      return 'MSG_MEDIA_STOP';
    case CarLifeMsgType.MSG_MEDIA_PAUSE:
      return 'MSG_MEDIA_PAUSE';
    case CarLifeMsgType.MSG_MEDIA_RESUME_PLAY:
      return 'MSG_MEDIA_RESUME_PLAY';
    case CarLifeMsgType.MSG_MEDIA_DATA:
      return 'MSG_MEDIA_DATA';
    case CarLifeMsgType.MSG_TOUCH_ACTION:
      return 'MSG_TOUCH_ACTION';
    case CarLifeMsgType.MSG_TOUCH_ACTION_DOWN:
      return 'MSG_TOUCH_ACTION_DOWN';
    case CarLifeMsgType.MSG_TOUCH_ACTION_UP:
      return 'MSG_TOUCH_ACTION_UP';
    case CarLifeMsgType.MSG_TOUCH_ACTION_MOVE:
      return 'MSG_TOUCH_ACTION_MOVE';
    case CarLifeMsgType.MSG_TOUCH_SINGLE_CLICK:
      return 'MSG_TOUCH_SINGLE_CLICK';
    case CarLifeMsgType.MSG_TOUCH_DOUBLE_CLICK:
      return 'MSG_TOUCH_DOUBLE_CLICK';
    case CarLifeMsgType.MSG_TOUCH_LONG_PRESS:
      return 'MSG_TOUCH_LONG_PRESS';
    case CarLifeMsgType.MSG_TOUCH_CAR_HARD_KEY_CODE:
      return 'MSG_TOUCH_CAR_HARD_KEY_CODE';
    default:
      return `AUTH / UNKNOWN (${formatHex32(serviceType)})`;
  }
}

// Android MotionEvent constants mirrored cleanly for protocol decoding parity
export const MOTION_ACTION_DOWN = 0;
export const MOTION_ACTION_UP = 1;
export const MOTION_ACTION_MOVE = 2;

// Android KeyEvent constants mirrored cleanly for HardKey mapping parity
export const KEYCODE_UNKNOWN = 0;
export const KEYCODE_HOME = 3;
export const KEYCODE_BACK = 4;
export const KEYCODE_CALL = 5;
export const KEYCODE_ENDCALL = 6;
export const KEYCODE_DPAD_LEFT = 21;
export const KEYCODE_DPAD_RIGHT = 22;
export const KEYCODE_DPAD_CENTER = 23;
export const KEYCODE_MEDIA_PLAY_PAUSE = 85;
export const KEYCODE_MEDIA_NEXT = 87;
export const KEYCODE_MEDIA_PREVIOUS = 88;
export const KEYCODE_ESCAPE = 111;
export const KEYCODE_VOLUME_MUTE = 164;
export const KEYCODE_VOICE_ASSIST = 231;
