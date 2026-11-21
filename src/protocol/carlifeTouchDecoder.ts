import {
  CarLifeChannelId,
  CarLifeMsgType,
  KEYCODE_BACK,
  KEYCODE_CALL,
  KEYCODE_DPAD_CENTER,
  KEYCODE_DPAD_LEFT,
  KEYCODE_DPAD_RIGHT,
  KEYCODE_ENDCALL,
  KEYCODE_ESCAPE,
  KEYCODE_HOME,
  KEYCODE_MEDIA_NEXT,
  KEYCODE_MEDIA_PLAY_PAUSE,
  KEYCODE_MEDIA_PREVIOUS,
  KEYCODE_UNKNOWN,
  KEYCODE_VOICE_ASSIST,
  KEYCODE_VOLUME_MUTE,
  MOTION_ACTION_DOWN,
  MOTION_ACTION_MOVE,
  MOTION_ACTION_UP,
} from './carlifeConstants';
import { CarLifeFrame, CarLifeFrameCodec, parseCommandMessageOrNull } from './carlifeFrameCodec';
import { ProtoWireReader, ProtoWireWriter } from './carlifeWireProtobuf';

export enum CarLifeTouchEventType {
  DOWN = 'ACTION_DOWN',
  MOVE = 'ACTION_MOVE',
  UP = 'ACTION_UP',
  SINGLE_CLICK = 'SINGLE_CLICK',
  DOUBLE_CLICK = 'DOUBLE_CLICK',
  LONG_PRESS = 'LONG_PRESS',
}

export interface CarLifeHardKeyInfo {
  id: string;
  carLifeCode: number;
  androidKeyCode: number;
  label: string;
}

export const CARLIFE_HARD_KEYS: CarLifeHardKeyInfo[] = [
  { id: 'HOME', carLifeCode: 0x00000001, androidKeyCode: KEYCODE_HOME, label: 'HOME' },
  { id: 'PHONE_CALL', carLifeCode: 0x00000002, androidKeyCode: KEYCODE_CALL, label: 'PHONE_CALL' },
  { id: 'PHONE_END', carLifeCode: 0x00000003, androidKeyCode: KEYCODE_ENDCALL, label: 'PHONE_END' },
  { id: 'VR_START', carLifeCode: 0x00000009, androidKeyCode: KEYCODE_VOICE_ASSIST, label: 'VR_START (Voice)' },
  { id: 'VR_STOP', carLifeCode: 0x0000000a, androidKeyCode: KEYCODE_ESCAPE, label: 'VR_STOP' },
  { id: 'SELECTOR_NEXT', carLifeCode: 0x0000000b, androidKeyCode: KEYCODE_DPAD_RIGHT, label: 'ROTARY_NEXT (CW)' },
  { id: 'SELECTOR_PREVIOUS', carLifeCode: 0x0000000c, androidKeyCode: KEYCODE_DPAD_LEFT, label: 'ROTARY_PREV (CCW)' },
  { id: 'SELECTOR_OK', carLifeCode: 0x0000000d, androidKeyCode: KEYCODE_DPAD_CENTER, label: 'ROTARY_OK' },
  { id: 'BACK', carLifeCode: 0x0000000e, androidKeyCode: KEYCODE_BACK, label: 'BACK' },
  { id: 'SEEK_SUB', carLifeCode: 0x00000015, androidKeyCode: KEYCODE_MEDIA_PREVIOUS, label: 'PREV_TRACK (<<)' },
  { id: 'SEEK_ADD', carLifeCode: 0x00000016, androidKeyCode: KEYCODE_MEDIA_NEXT, label: 'NEXT_TRACK (>>)' },
  { id: 'VOLUME_MUTE', carLifeCode: 0x00000017, androidKeyCode: KEYCODE_VOLUME_MUTE, label: 'MUTE' },
  { id: 'PLAY_PAUSE', carLifeCode: 0x00000018, androidKeyCode: KEYCODE_MEDIA_PLAY_PAUSE, label: 'PLAY_PAUSE' },
];

export type CarLifeInputEvent =
  | {
      kind: 'touch';
      type: CarLifeTouchEventType;
      rawX: number;
      rawY: number;
      huWidth: number;
      huHeight: number;
      scaledX: number;
      scaledY: number;
      targetWidth: number;
      targetHeight: number;
    }
  | {
      kind: 'hardkey';
      rawKeyCode: number;
      mappedKey: CarLifeHardKeyInfo | null;
      androidKeyCode: number;
    };

export const DEFAULT_HU_TOUCH_MAX_X = 1280;
export const DEFAULT_HU_TOUCH_MAX_Y = 720;

export function scaleTouchCoordinates(
  rawX: number,
  rawY: number,
  currentSurfaceWidth: number,
  currentSurfaceHeight: number,
  huTouchMaxX = DEFAULT_HU_TOUCH_MAX_X,
  huTouchMaxY = DEFAULT_HU_TOUCH_MAX_Y
): [number, number] {
  const safeSurfaceW = Math.max(1, currentSurfaceWidth);
  const safeSurfaceH = Math.max(1, currentSurfaceHeight);
  const safeHuMaxX = huTouchMaxX > 0 ? huTouchMaxX : DEFAULT_HU_TOUCH_MAX_X;
  const safeHuMaxY = huTouchMaxY > 0 ? huTouchMaxY : DEFAULT_HU_TOUCH_MAX_Y;

  const scaledX = Math.min(safeSurfaceW, Math.max(0, rawX * (safeSurfaceW / safeHuMaxX)));
  const scaledY = Math.min(safeSurfaceH, Math.max(0, rawY * (safeSurfaceH / safeHuMaxY)));
  return [scaledX, scaledY];
}

export const CarLifeTouchDecoder = {
  createTouchActionFrame(
    action: number,
    x: number,
    y: number,
    huWidth = 1280,
    huHeight = 720
  ): CarLifeFrame {
    const protoBytes = new ProtoWireWriter()
      .writeVarintField(1, action)
      .writeVarintField(2, x)
      .writeVarintField(3, y)
      .writeVarintField(4, huWidth)
      .writeVarintField(5, huHeight)
      .toByteArray();

    return CarLifeFrameCodec.createCommandFrame(
      CarLifeChannelId.TOUCH,
      CarLifeMsgType.MSG_TOUCH_ACTION,
      protoBytes
    );
  },

  createHardKeyFrame(keyId: string): CarLifeFrame {
    const key = CARLIFE_HARD_KEYS.find((k) => k.id === keyId) ?? CARLIFE_HARD_KEYS[10]; // default SEEK_ADD
    const protoBytes = new ProtoWireWriter().writeVarintField(1, key.carLifeCode).toByteArray();
    return CarLifeFrameCodec.createCommandFrame(
      CarLifeChannelId.TOUCH,
      CarLifeMsgType.MSG_TOUCH_CAR_HARD_KEY_CODE,
      protoBytes
    );
  },

  decodeTouchChannelFrame(
    frame: CarLifeFrame,
    targetWidth = 1280,
    targetHeight = 720,
    defaultHuWidth = 1280,
    defaultHuHeight = 720
  ): CarLifeInputEvent | null {
    if (frame.header.channel !== CarLifeChannelId.TOUCH) return null;
    const cmd = parseCommandMessageOrNull(frame);
    if (!cmd) return null;

    switch (cmd.serviceType) {
      case CarLifeMsgType.MSG_TOUCH_ACTION: {
        let actionCode = MOTION_ACTION_DOWN;
        let x = 0;
        let y = 0;
        let width = defaultHuWidth;
        let height = defaultHuHeight;
        const reader = new ProtoWireReader(cmd.body);
        while (reader.readTag()) {
          switch (reader.lastFieldNumber) {
            case 1:
              actionCode = reader.readVarint32();
              break;
            case 2:
              x = reader.readVarint32();
              break;
            case 3:
              y = reader.readVarint32();
              break;
            case 4: {
              const v = reader.readVarint32();
              width = v > 0 ? v : defaultHuWidth;
              break;
            }
            case 5: {
              const v = reader.readVarint32();
              height = v > 0 ? v : defaultHuHeight;
              break;
            }
            default:
              reader.skipField();
              break;
          }
        }
        const type =
          actionCode === MOTION_ACTION_UP
            ? CarLifeTouchEventType.UP
            : actionCode === MOTION_ACTION_MOVE
            ? CarLifeTouchEventType.MOVE
            : CarLifeTouchEventType.DOWN;
        const [scaledX, scaledY] = scaleTouchCoordinates(x, y, targetWidth, targetHeight, width, height);
        return {
          kind: 'touch',
          type,
          rawX: x,
          rawY: y,
          huWidth: width,
          huHeight: height,
          scaledX,
          scaledY,
          targetWidth,
          targetHeight,
        };
      }

      case CarLifeMsgType.MSG_TOUCH_ACTION_DOWN:
      case CarLifeMsgType.MSG_TOUCH_ACTION_MOVE:
      case CarLifeMsgType.MSG_TOUCH_ACTION_UP:
      case CarLifeMsgType.MSG_TOUCH_SINGLE_CLICK:
      case CarLifeMsgType.MSG_TOUCH_DOUBLE_CLICK:
      case CarLifeMsgType.MSG_TOUCH_LONG_PRESS: {
        let x = 0;
        let y = 0;
        if (cmd.body.length > 0 && cmd.body[0] === 0x08) {
          const reader = new ProtoWireReader(cmd.body);
          while (reader.readTag()) {
            if (reader.lastFieldNumber === 1) x = reader.readVarint32();
            else if (reader.lastFieldNumber === 2) y = reader.readVarint32();
            else reader.skipField();
          }
        } else if (cmd.body.length >= 12) {
          const view = new DataView(cmd.body.buffer, cmd.body.byteOffset, cmd.body.byteLength);
          x = view.getInt32(4, false);
          y = view.getInt32(8, false);
        } else if (cmd.body.length >= 8) {
          const view = new DataView(cmd.body.buffer, cmd.body.byteOffset, cmd.body.byteLength);
          x = view.getInt32(0, false);
          y = view.getInt32(4, false);
        }
        const type =
          cmd.serviceType === CarLifeMsgType.MSG_TOUCH_ACTION_MOVE
            ? CarLifeTouchEventType.MOVE
            : cmd.serviceType === CarLifeMsgType.MSG_TOUCH_ACTION_UP
            ? CarLifeTouchEventType.UP
            : cmd.serviceType === CarLifeMsgType.MSG_TOUCH_SINGLE_CLICK
            ? CarLifeTouchEventType.SINGLE_CLICK
            : cmd.serviceType === CarLifeMsgType.MSG_TOUCH_DOUBLE_CLICK
            ? CarLifeTouchEventType.DOUBLE_CLICK
            : cmd.serviceType === CarLifeMsgType.MSG_TOUCH_LONG_PRESS
            ? CarLifeTouchEventType.LONG_PRESS
            : CarLifeTouchEventType.DOWN;
        const [scaledX, scaledY] = scaleTouchCoordinates(
          x,
          y,
          targetWidth,
          targetHeight,
          defaultHuWidth,
          defaultHuHeight
        );
        return {
          kind: 'touch',
          type,
          rawX: x,
          rawY: y,
          huWidth: defaultHuWidth,
          huHeight: defaultHuHeight,
          scaledX,
          scaledY,
          targetWidth,
          targetHeight,
        };
      }

      case CarLifeMsgType.MSG_TOUCH_CAR_HARD_KEY_CODE: {
        let keyCode = 0;
        if (cmd.body.length > 0 && cmd.body[0] === 0x08) {
          const reader = new ProtoWireReader(cmd.body);
          while (reader.readTag()) {
            if (reader.lastFieldNumber === 1) keyCode = reader.readVarint32();
            else reader.skipField();
          }
        } else if (cmd.body.length >= 4) {
          const view = new DataView(cmd.body.buffer, cmd.body.byteOffset, cmd.body.byteLength);
          keyCode = view.getInt32(0, false);
        }
        const mapped = CARLIFE_HARD_KEYS.find((k) => k.carLifeCode === keyCode) ?? null;
        return {
          kind: 'hardkey',
          rawKeyCode: keyCode,
          mappedKey: mapped,
          androidKeyCode: mapped ? mapped.androidKeyCode : KEYCODE_UNKNOWN,
        };
      }

      default:
        return null;
    }
  },
};
