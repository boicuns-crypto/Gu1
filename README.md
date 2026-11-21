# CarLife Bridge

Baidu CarLife USB AOA protocol bridge and automotive head unit transport engine rewritten as a React + TypeScript + Tailwind CSS application (ported from the Android Jetpack Compose codebase for Samsung Galaxy S26 Ultra & FAW-VW Jetta VS7 MQB MIB).

## Features

- **CarLife App Launcher (`Лаунчер ГУ`)**:
  - Automotive dock bar with live `HH:mm` clock, `VD` / `КОКПИТ` status pill, touch service indicator, **Домой** and **Назад** controls, and compact media player controls (track metadata, progress bar, previous/play-pause/next).
  - Filterable automotive app grid (`Все`, `Навигация и Медиа`) with one-click launch feedback for VirtualDisplay or Screen Mirroring modes.
- **Setup Checklist (`Подключение`)**:
  - Interactive 6-step setup wizard covering battery optimization, Overlay permission, Accessibility Touch Service (`CarLifeAccessibilityService`), Media Notification Access, Screen Capture (`MediaProjection` via browser `getDisplayMedia` with graceful fallback), and USB AOA connection (`WebUSB` probe + binary handshake state machine).
- **Settings & Protocol Lab (`Настройки`)**:
  - Independent mode switching (`Кокпит (Виртуальный экран)` vs `Зеркалирование (Экран телефона)`), UI packet logging toggle, USB AOA `0x0003` audio capture controls (48 kHz Stereo 16-bit PCM) with phone speaker mute option, Video Source selector (`SCREEN_MIRRORING`, `VIRTUAL_DISPLAY`, `CANVAS_TEST_CARD`), App Launch strategy, Handshake Test Profiles (`1/4` – `4/4`), H.264 stream resolution/bitrate/framing (`AOA 20B` vs `Direct 12B`), and Jetta VS7 quick-start profile.
  - Expandable **Engineering Diagnostics (AOA & Protocol Lab)**: H.264/Touch pipeline metrics, USB AOA RX/TX counters, 6-channel multiplexer grid (`0x0001`–`0x0006`), interactive loopback test vectors (`1. Handshake`, `2. Video (0x0002)`, `3. Touch Scale`, `4. HardKey`) with byte-level header breakdown, and dual-tab binary hex packet log.

## Protocol Modules (`src/protocol/`)

- `carlifeConstants.ts`: Channel IDs (`0x0001`–`0x0006`), service message IDs (`CarLifeMsgType`), MotionEvent/KeyEvent constants.
- `carlifeWireProtobuf.ts`: Big-endian wire & protobuf encoder/decoder (`CarlifeProtocolVersionProto`, `CarlifeDeviceInfoProto`, `CarlifeVideoEncoderInfoProto`, `CarlifeMusicInitProto`).
- `carlifeFrameCodec.ts`: 8B/12B/20B AOA framing, Annex-B NAL helpers (`SPS`/`PPS`/`IDR`), command framing, and hex preview formatter.
- `carlifeTouchDecoder.ts`: Head-unit to smartphone touch coordinate scaler and MQB steering wheel/rotary HardKey mapper.
- `carlifeControlStateMachine.ts`: Handshake state machine (`IDLE` → `VERSION_MATCHED` → `VIDEO_STREAMING`) supporting Profiles 1–4.

## Development

```bash
npm install
npm run dev      # Starts Vite dev server on http://0.0.0.0:3000
npm run lint     # Runs TypeScript type checking (tsc --noEmit)
npm run build    # Type checks and builds production bundle into dist/
```
