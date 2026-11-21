import {
  CarLifeChannelId,
  CarLifeMsgType,
  channelInfo,
} from '../protocol/carlifeConstants';
import {
  CarLifeControlSessionState,
  CarLifeControlStateMachine,
} from '../protocol/carlifeControlStateMachine';
import {
  CarLifeFrame,
  CarLifeFrameCodec,
  parseCommandMessageOrNull,
} from '../protocol/carlifeFrameCodec';
import { CarLifeTouchDecoder } from '../protocol/carlifeTouchDecoder';
import {
  CarlifeProtocolVersionProto,
  CarlifeVideoEncoderInfoProto,
} from '../protocol/carlifeWireProtobuf';

export enum AppMode {
  COCKPIT = 'cockpit',
  MIRRORING = 'mirroring',
}

export const APP_MODE_META: Record<AppMode, { id: AppMode; title: string; subtitle: string }> = {
  [AppMode.COCKPIT]: {
    id: AppMode.COCKPIT,
    title: 'Кокпит (Виртуальный экран)',
    subtitle:
      'Лаунчер ГУ на VirtualDisplay (Presentation). Тач 0x0006 идёт строго в Presentation.decorView без AccessibilityService.',
  },
  [AppMode.MIRRORING]: {
    id: AppMode.MIRRORING,
    title: 'Зеркалирование (Экран телефона)',
    subtitle:
      'Прямой захват экрана смартфона (MediaProjection, 1280×720@30fps). Тач 0x0006 идёт строго через CarLifeAccessibilityService.',
  },
};

export enum VideoSourceMode {
  SCREEN_MIRRORING = 'screen_mirroring',
  VIRTUAL_DISPLAY = 'virtual_display',
  CANVAS_TEST_CARD = 'canvas_test_card',
}

export const VIDEO_SOURCE_META: Record<
  VideoSourceMode,
  { id: VideoSourceMode; title: string; subtitle: string }
> = {
  [VideoSourceMode.SCREEN_MIRRORING]: {
    id: VideoSourceMode.SCREEN_MIRRORING,
    title: 'Зеркалирование экрана (MediaProjection)',
    subtitle:
      'Прямой захват реального экрана смартфона (1280×720@30fps, 2000 kbps) без Presentation + тач через AccessibilityService',
  },
  [VideoSourceMode.VIRTUAL_DISPLAY]: {
    id: VideoSourceMode.VIRTUAL_DISPLAY,
    title: 'Виртуальный экран (VD + Лаунчер)',
    subtitle:
      'Захват VirtualDisplay / MediaProjection + оверлей лаунчера CarLife (Presentation)',
  },
  [VideoSourceMode.CANVAS_TEST_CARD]: {
    id: VideoSourceMode.CANVAS_TEST_CARD,
    title: 'Тест-карта (Canvas)',
    subtitle:
      'Прямая отрисовка 30 fps в inputSurface без VirtualDisplay (JETTA VS7 TEST + время + FRAME #)',
  },
};

export enum AppLaunchMode {
  VIRTUAL_DISPLAY_IF_AVAILABLE = 'virtual_display',
  SCREEN_MIRRORING = 'screen_mirroring',
}

export const APP_LAUNCH_MODE_META: Record<
  AppLaunchMode,
  { id: AppLaunchMode; title: string; subtitle: string }
> = {
  [AppLaunchMode.VIRTUAL_DISPLAY_IF_AVAILABLE]: {
    id: AppLaunchMode.VIRTUAL_DISPLAY_IF_AVAILABLE,
    title: 'На VirtualDisplay (если доступно)',
    subtitle:
      'Сначала запуск через ActivityOptions(launchDisplayId); при SecurityException — мгновенный запасной запуск без ActivityOptions.',
  },
  [AppLaunchMode.SCREEN_MIRRORING]: {
    id: AppLaunchMode.SCREEN_MIRRORING,
    title: 'Зеркалирование экрана (MediaProjection)',
    subtitle:
      'Запуск приложений сразу на основном экране телефона без ActivityOptions для зеркалирования через MediaProjection.',
  },
};

export type UsbTransportState =
  | { kind: 'disconnected' }
  | { kind: 'connecting'; manufacturer: string; model: string }
  | { kind: 'connected'; manufacturer: string; model: string; fdNumber: number; connectedAt: number }
  | { kind: 'error'; reason: string };

export interface PacketLogEntry {
  id: number;
  timestampFormatted: string;
  direction: string;
  channel: CarLifeChannelId;
  headerSizeBytes: number;
  payloadSizeBytes: number;
  mediaTimestampMs: number;
  serviceName: string | null;
  hexPreview: string;
}

export interface ProjectionPipelineStats {
  isRunning: boolean;
  appMode: AppMode;
  videoSourceMode: VideoSourceMode;
  usingMediaProjection: boolean;
  virtualDisplayId: number;
  width: number;
  height: number;
  fps: number;
  bitRateKbps: number;
  encodedNalFrames: number;
  encodedBytes: number;
  lastIdrBytes: number;
  spsPpsConfigured: boolean;
  injectedTouches: number;
  lastTouchPoint: [number, number] | null;
  activeCockpitWidget: string;
  statusMessage: string;
}

export interface AudioCaptureStats {
  isCapturing: boolean;
  hasRecordAudioPermission: boolean;
  mutePhoneSpeakerDuringUsbAudio: boolean;
  isPhoneSpeakerMutedByBridge: boolean;
  savedPhoneMusicVolume: number | null;
  mediaInitSent: boolean;
  sentInitPackets: number;
  sentPcmPackets: number;
  skippedSilentPackets: number;
  sentPcmBytes: number;
  sentStopPackets: number;
  statusMessage: string;
}

export interface AutoTestState {
  isRunning: boolean;
  currentStep: number;
  totalSteps: number;
  activeProfileLabel: string;
  statusMessage: string;
  matchedProfileLabel: string | null;
  audioInitForced: boolean;
}

export interface SetupChecklistStatus {
  step1BatteryUnrestricted: boolean;
  step2OverlayGranted: boolean;
  step3AccessibilityEnabled: boolean;
  step4NotificationAccessGranted: boolean;
  step5MediaProjectionGranted: boolean;
  isUsbConnected: boolean;
}

export interface CockpitMediaState {
  hasNotificationAccess: boolean;
  activePackageName: string;
  playerAppTitle: string;
  trackTitle: string;
  artistName: string;
  albumName: string;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
}

export interface InstalledAppInfo {
  label: string;
  packageName: string;
  activityName: string;
  isAutomotivePriority: boolean;
  accentColor: string;
  badgeText: string;
  category: 'nav' | 'media' | 'browser' | 'utility';
}

export interface BridgeRuntimeState {
  isServiceRunning: boolean;
  wakeLockHeld: boolean;
  transportState: UsbTransportState;
  controlSession: CarLifeControlSessionState;
  projectionStats: ProjectionPipelineStats;
  audioCaptureStats: AudioCaptureStats;
  isVideoChannelReadyForStreaming: boolean;
  useNestedVideoMsgHeader: boolean;
  appMode: AppMode;
  logPacketsInUi: boolean;
  mutePhoneSpeakerDuringUsbAudio: boolean;
  videoSourceMode: VideoSourceMode;
  appLaunchMode: AppLaunchMode;
  handshakeTestProfileId: number;
  configuredWidth: number;
  configuredHeight: number;
  configuredBitrateBps: number;
  autoTestState: AutoTestState;
  lastTouchOrKeyEvent: string;
  rxBytes: number;
  txBytes: number;
  rxFrames: number;
  txFrames: number;
  channelFrameCounts: Record<CarLifeChannelId, number>;
  commandPacketLogs: PacketLogEntry[];
  videoPacketLogs: PacketLogEntry[];
  lastProtocolEvent: string;
}

export interface DemoTrack {
  player: string;
  pkg: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
}

export const FALLBACK_PLAYLIST: DemoTrack[] = [
  {
    player: 'Yandex Music • CarLife Audio',
    pkg: 'ru.yandex.music',
    title: 'Nightcall (MQB Cockpit Mix)',
    artist: 'Kavinsky',
    album: 'OutRun',
    durationMs: 258_000,
  },
  {
    player: 'Spotify • Lossless Stream',
    pkg: 'com.spotify.music',
    title: 'Midnight City',
    artist: 'M83',
    album: "Hurry Up, We're Dreaming",
    durationMs: 243_000,
  },
  {
    player: 'Poweramp • Direct Hi-Res',
    pkg: 'com.maxmpz.audioplayer',
    title: 'Horizon',
    artist: 'Daft Punk',
    album: 'Random Access Memories',
    durationMs: 264_000,
  },
  {
    player: 'Yandex Music • My Vibe',
    pkg: 'ru.yandex.music',
    title: 'Veridis Quo',
    artist: 'Daft Punk',
    album: 'Discovery',
    durationMs: 345_000,
  },
];

export const COCKPIT_INSTALLED_APPS: InstalledAppInfo[] = [
  {
    label: 'Яндекс Навигатор',
    packageName: 'ru.yandex.yandexnavi',
    activityName: 'ru.yandex.yandexnavi.NaviActivity',
    isAutomotivePriority: true,
    accentColor: '#F59E0B',
    badgeText: 'НАВ',
    category: 'nav',
  },
  {
    label: 'Яндекс Карты',
    packageName: 'ru.yandex.yandexmaps',
    activityName: 'ru.yandex.yandexmaps.MapActivity',
    isAutomotivePriority: true,
    accentColor: '#EF4444',
    badgeText: 'MAP',
    category: 'nav',
  },
  {
    label: '2ГИС',
    packageName: 'ru.dublgis.dgismobile',
    activityName: 'ru.dublgis.dgismobile.MainActivity',
    isAutomotivePriority: true,
    accentColor: '#10B981',
    badgeText: '2GIS',
    category: 'nav',
  },
  {
    label: 'Google Maps',
    packageName: 'com.google.android.apps.maps',
    activityName: 'com.google.android.maps.MapsActivity',
    isAutomotivePriority: true,
    accentColor: '#38BDF8',
    badgeText: 'GM',
    category: 'nav',
  },
  {
    label: 'Яндекс Музыка',
    packageName: 'ru.yandex.music',
    activityName: 'ru.yandex.music.MainActivity',
    isAutomotivePriority: true,
    accentColor: '#FBBF24',
    badgeText: 'ЯМ',
    category: 'media',
  },
  {
    label: 'Spotify',
    packageName: 'com.spotify.music',
    activityName: 'com.spotify.music.MainActivity',
    isAutomotivePriority: true,
    accentColor: '#1DB954',
    badgeText: 'SP',
    category: 'media',
  },
  {
    label: 'Poweramp',
    packageName: 'com.maxmpz.audioplayer',
    activityName: 'com.maxmpz.audioplayer.StartupActivity',
    isAutomotivePriority: true,
    accentColor: '#00B4D8',
    badgeText: 'PA',
    category: 'media',
  },
  {
    label: 'YouTube Music',
    packageName: 'com.google.android.apps.youtube.music',
    activityName: 'com.google.android.apps.youtube.music.Activities.MusicActivity',
    isAutomotivePriority: true,
    accentColor: '#EF4444',
    badgeText: 'YTM',
    category: 'media',
  },
  {
    label: 'YouTube',
    packageName: 'com.google.android.youtube',
    activityName: 'com.google.android.youtube.HomeActivity',
    isAutomotivePriority: true,
    accentColor: '#F87171',
    badgeText: 'YT',
    category: 'media',
  },
  {
    label: 'Chrome',
    packageName: 'com.android.chrome',
    activityName: 'com.google.android.apps.chrome.Main',
    isAutomotivePriority: true,
    accentColor: '#60A5FA',
    badgeText: 'CHR',
    category: 'browser',
  },
  {
    label: 'Samsung Internet',
    packageName: 'com.sec.android.app.sbrowser',
    activityName: 'com.sec.android.app.sbrowser.SBrowserMainActivity',
    isAutomotivePriority: true,
    accentColor: '#818CF8',
    badgeText: 'SBR',
    category: 'browser',
  },
  {
    label: 'VLC Player',
    packageName: 'org.videolan.vlc',
    activityName: 'org.videolan.vlc.StartActivity',
    isAutomotivePriority: true,
    accentColor: '#FB923C',
    badgeText: 'VLC',
    category: 'media',
  },
  {
    label: 'Телефон (HFP)',
    packageName: 'com.samsung.android.dialer',
    activityName: 'com.samsung.android.dialer.DialtactsActivity',
    isAutomotivePriority: false,
    accentColor: '#10B981',
    badgeText: 'TEL',
    category: 'utility',
  },
  {
    label: 'Telegram',
    packageName: 'org.telegram.messenger',
    activityName: 'org.telegram.ui.LaunchActivity',
    isAutomotivePriority: false,
    accentColor: '#38BDF8',
    badgeText: 'TG',
    category: 'utility',
  },
  {
    label: 'Антирадар HUD',
    packageName: 'com.hudway.radar',
    activityName: 'com.hudway.radar.MainActivity',
    isAutomotivePriority: false,
    accentColor: '#F59E0B',
    badgeText: 'HUD',
    category: 'utility',
  },
  {
    label: 'Настройки S26U',
    packageName: 'com.android.settings',
    activityName: 'com.android.settings.Settings',
    isAutomotivePriority: false,
    accentColor: '#94A3B8',
    badgeText: 'SET',
    category: 'utility',
  },
];

const STORAGE_KEY_CHECKLIST = 'carlife_bridge_checklist_v1';
const STORAGE_KEY_SETTINGS = 'carlife_bridge_settings_v1';

interface PersistedSettings {
  appMode: AppMode;
  logPacketsInUi: boolean;
  mutePhoneSpeakerDuringUsbAudio: boolean;
  videoSourceMode: VideoSourceMode;
  appLaunchMode: AppLaunchMode;
  handshakeTestProfileId: number;
  configuredWidth: number;
  configuredHeight: number;
  configuredBitrateBps: number;
  useNestedVideoMsgHeader: boolean;
}

function loadChecklistFromStorage(): SetupChecklistStatus {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CHECKLIST);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SetupChecklistStatus>;
      return {
        step1BatteryUnrestricted: Boolean(parsed.step1BatteryUnrestricted),
        step2OverlayGranted: Boolean(parsed.step2OverlayGranted),
        step3AccessibilityEnabled: Boolean(parsed.step3AccessibilityEnabled),
        step4NotificationAccessGranted: Boolean(parsed.step4NotificationAccessGranted),
        step5MediaProjectionGranted: Boolean(parsed.step5MediaProjectionGranted),
        isUsbConnected: false,
      };
    }
  } catch {
    // Ignore storage parse failure
  }
  return {
    step1BatteryUnrestricted: false,
    step2OverlayGranted: false,
    step3AccessibilityEnabled: false,
    step4NotificationAccessGranted: false,
    step5MediaProjectionGranted: false,
    isUsbConnected: false,
  };
}

function loadSettingsFromStorage(): PersistedSettings {
  const defaults: PersistedSettings = {
    appMode: AppMode.MIRRORING,
    logPacketsInUi: false,
    mutePhoneSpeakerDuringUsbAudio: true,
    videoSourceMode: VideoSourceMode.SCREEN_MIRRORING,
    appLaunchMode: AppLaunchMode.VIRTUAL_DISPLAY_IF_AVAILABLE,
    handshakeTestProfileId: 4,
    configuredWidth: 1280,
    configuredHeight: 720,
    configuredBitrateBps: 2_000_000,
    useNestedVideoMsgHeader: true,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
    return {
      appMode: parsed.appMode === AppMode.COCKPIT ? AppMode.COCKPIT : AppMode.MIRRORING,
      logPacketsInUi: Boolean(parsed.logPacketsInUi),
      mutePhoneSpeakerDuringUsbAudio:
        parsed.mutePhoneSpeakerDuringUsbAudio !== undefined
          ? Boolean(parsed.mutePhoneSpeakerDuringUsbAudio)
          : true,
      videoSourceMode: Object.values(VideoSourceMode).includes(parsed.videoSourceMode as VideoSourceMode)
        ? (parsed.videoSourceMode as VideoSourceMode)
        : VideoSourceMode.SCREEN_MIRRORING,
      appLaunchMode:
        parsed.appLaunchMode === AppLaunchMode.SCREEN_MIRRORING
          ? AppLaunchMode.SCREEN_MIRRORING
          : AppLaunchMode.VIRTUAL_DISPLAY_IF_AVAILABLE,
      handshakeTestProfileId:
        typeof parsed.handshakeTestProfileId === 'number' &&
        parsed.handshakeTestProfileId >= 1 &&
        parsed.handshakeTestProfileId <= 4
          ? parsed.handshakeTestProfileId
          : 4,
      configuredWidth:
        typeof parsed.configuredWidth === 'number' ? parsed.configuredWidth : 1280,
      configuredHeight:
        typeof parsed.configuredHeight === 'number' ? parsed.configuredHeight : 720,
      configuredBitrateBps:
        typeof parsed.configuredBitrateBps === 'number' ? parsed.configuredBitrateBps : 2_000_000,
      useNestedVideoMsgHeader:
        parsed.useNestedVideoMsgHeader !== undefined ? Boolean(parsed.useNestedVideoMsgHeader) : true,
    };
  } catch {
    return defaults;
  }
}

export function formatTimeStampMs(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

export interface BridgeControllerSnapshot {
  runtimeState: BridgeRuntimeState;
  checklistStatus: SetupChecklistStatus;
  mediaState: CockpitMediaState;
  lastLaunchStatus: string;
  lastDecodedBreakdown: string;
  mediaStream: MediaStream | null;
}

export class BridgeController {
  private runtimeState: BridgeRuntimeState;
  private checklist: SetupChecklistStatus;
  private mediaState: CockpitMediaState;
  private lastLaunchStatus = 'Лаунчер ГУ активен — готов к выводу на VirtualDisplay автомобиля';
  private lastDecodedBreakdown =
    'Выберите тестовый вектор ниже для проверки бинарного кадра через CarLifeFrameCodec и декодер тачскрина.';
  private stateMachine: CarLifeControlStateMachine;
  private logSequence = 0;
  private fallbackTrackIndex = 0;
  private listeners = new Set<() => void>();
  private mediaStream: MediaStream | null = null;
  private streamTimer: number | null = null;
  private audioTimer: number | null = null;
  private mediaTicker: number | null = null;
  private snapshot: BridgeControllerSnapshot;

  constructor() {
    const savedSettings = loadSettingsFromStorage();
    this.checklist = loadChecklistFromStorage();
    CarLifeFrameCodec.useNestedVideoMsgHeader = savedSettings.useNestedVideoMsgHeader;
    this.stateMachine = new CarLifeControlStateMachine(
      savedSettings.configuredWidth,
      savedSettings.configuredHeight,
      savedSettings.handshakeTestProfileId
    );

    this.mediaState = {
      hasNotificationAccess: this.checklist.step4NotificationAccessGranted,
      activePackageName: FALLBACK_PLAYLIST[0].pkg,
      playerAppTitle: FALLBACK_PLAYLIST[0].player,
      trackTitle: FALLBACK_PLAYLIST[0].title,
      artistName: FALLBACK_PLAYLIST[0].artist,
      albumName: FALLBACK_PLAYLIST[0].album,
      isPlaying: true,
      positionMs: 84_000,
      durationMs: FALLBACK_PLAYLIST[0].durationMs,
    };

    this.runtimeState = {
      isServiceRunning: true,
      wakeLockHeld: false,
      transportState: { kind: 'disconnected' },
      controlSession: this.stateMachine.state,
      projectionStats: {
        isRunning: true,
        appMode: savedSettings.appMode,
        videoSourceMode: savedSettings.videoSourceMode,
        usingMediaProjection: this.checklist.step5MediaProjectionGranted,
        virtualDisplayId: savedSettings.videoSourceMode === VideoSourceMode.VIRTUAL_DISPLAY ? 2 : 0,
        width: savedSettings.configuredWidth,
        height: savedSettings.configuredHeight,
        fps: 30,
        bitRateKbps: Math.round(savedSettings.configuredBitrateBps / 1000),
        encodedNalFrames: 0,
        encodedBytes: 0,
        lastIdrBytes: 0,
        spsPpsConfigured: false,
        injectedTouches: 0,
        lastTouchPoint: null,
        activeCockpitWidget:
          savedSettings.videoSourceMode === VideoSourceMode.SCREEN_MIRRORING
            ? 'Зеркалирование экрана (MediaProjection) готово'
            : savedSettings.videoSourceMode === VideoSourceMode.VIRTUAL_DISPLAY
            ? 'Виртуальный экран (VD #2) активен'
            : 'Тест-карта (Canvas) активна',
        statusMessage: `${
          savedSettings.videoSourceMode === VideoSourceMode.SCREEN_MIRRORING
            ? 'Зеркалирование экрана'
            : savedSettings.videoSourceMode === VideoSourceMode.VIRTUAL_DISPLAY
            ? 'Виртуальный экран VD'
            : 'Тест-карта Canvas'
        } (${savedSettings.configuredWidth}×${savedSettings.configuredHeight} @ ${(
          savedSettings.configuredBitrateBps / 1_000_000
        ).toFixed(1)} Мбит/с, CBR 30fps, ${
          savedSettings.useNestedVideoMsgHeader ? 'AOA 20B' : 'Direct 12B'
        })`,
      },
      audioCaptureStats: {
        isCapturing: false,
        hasRecordAudioPermission: true,
        mutePhoneSpeakerDuringUsbAudio: savedSettings.mutePhoneSpeakerDuringUsbAudio,
        isPhoneSpeakerMutedByBridge: false,
        savedPhoneMusicVolume: 9,
        mediaInitSent: false,
        sentInitPackets: 0,
        sentPcmPackets: 0,
        skippedSilentPackets: 0,
        sentPcmBytes: 0,
        sentStopPackets: 0,
        statusMessage:
          'Аудио 0x0003: ожидание MediaProjection и разрешения RECORD_AUDIO (48 кГц Stereo 16-bit PCM)',
      },
      isVideoChannelReadyForStreaming: false,
      useNestedVideoMsgHeader: savedSettings.useNestedVideoMsgHeader,
      appMode: savedSettings.appMode,
      logPacketsInUi: savedSettings.logPacketsInUi,
      mutePhoneSpeakerDuringUsbAudio: savedSettings.mutePhoneSpeakerDuringUsbAudio,
      videoSourceMode: savedSettings.videoSourceMode,
      appLaunchMode: savedSettings.appLaunchMode,
      handshakeTestProfileId: savedSettings.handshakeTestProfileId,
      configuredWidth: savedSettings.configuredWidth,
      configuredHeight: savedSettings.configuredHeight,
      configuredBitrateBps: savedSettings.configuredBitrateBps,
      autoTestState: {
        isRunning: false,
        currentStep: 0,
        totalSteps: 0,
        activeProfileLabel:
          '1280×720 • 2.0 Мбит/с • CBR 30fps • 160 dpi • AOA 20B (0x00020001)',
        statusMessage:
          'Авто-тестер отключён: зафиксирован профиль Jetta VS7 (1280×720 • 2.0 Мбит/с • CBR 30fps • 160 dpi • AOA 20B)',
        matchedProfileLabel:
          '1280×720 • 2.0 Мбит/с • CBR 30fps • 160 dpi • AOA 20B (0x00020001)',
        audioInitForced: true,
      },
      lastTouchOrKeyEvent: 'None — Waiting for Touch/Hardkey Channel (0x0006)',
      rxBytes: 0,
      txBytes: 0,
      rxFrames: 0,
      txFrames: 0,
      channelFrameCounts: {
        [CarLifeChannelId.CONTROL]: 0,
        [CarLifeChannelId.VIDEO]: 0,
        [CarLifeChannelId.MEDIA_AUDIO]: 0,
        [CarLifeChannelId.TTS_AUDIO]: 0,
        [CarLifeChannelId.VR_AUDIO]: 0,
        [CarLifeChannelId.TOUCH]: 0,
      },
      commandPacketLogs: [],
      videoPacketLogs: [],
      lastProtocolEvent:
        'Idle — Waiting for Jetta VS7 (MQB) Baidu CarLife USB AOA attachment',
    };

    this.snapshot = {
      runtimeState: this.runtimeState,
      checklistStatus: this.checklist,
      mediaState: this.mediaState,
      lastLaunchStatus: this.lastLaunchStatus,
      lastDecodedBreakdown: this.lastDecodedBreakdown,
      mediaStream: this.mediaStream,
    };

    this.mediaTicker = window.setInterval(() => {
      if (this.mediaState.isPlaying) {
        const nextPos = this.mediaState.positionMs + 1000;
        if (nextPos >= this.mediaState.durationMs) {
          this.skipNextTrack();
        } else {
          this.mediaState = { ...this.mediaState, positionMs: nextPos };
          this.emit();
        }
      }
    }, 1000);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  dispose(): void {
    if (this.mediaTicker !== null) {
      window.clearInterval(this.mediaTicker);
      this.mediaTicker = null;
    }
    this.stopStreamingTelemetryTimers();
  }

  private emit(): void {
    this.snapshot = {
      runtimeState: this.runtimeState,
      checklistStatus: this.checklist,
      mediaState: this.mediaState,
      lastLaunchStatus: this.lastLaunchStatus,
      lastDecodedBreakdown: this.lastDecodedBreakdown,
      mediaStream: this.mediaStream,
    };
    this.listeners.forEach((l) => l());
  }

  private persistSettings(): void {
    try {
      const data: PersistedSettings = {
        appMode: this.runtimeState.appMode,
        logPacketsInUi: this.runtimeState.logPacketsInUi,
        mutePhoneSpeakerDuringUsbAudio: this.runtimeState.mutePhoneSpeakerDuringUsbAudio,
        videoSourceMode: this.runtimeState.videoSourceMode,
        appLaunchMode: this.runtimeState.appLaunchMode,
        handshakeTestProfileId: this.runtimeState.handshakeTestProfileId,
        configuredWidth: this.runtimeState.configuredWidth,
        configuredHeight: this.runtimeState.configuredHeight,
        configuredBitrateBps: this.runtimeState.configuredBitrateBps,
        useNestedVideoMsgHeader: this.runtimeState.useNestedVideoMsgHeader,
      };
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(data));
    } catch {
      // Ignore storage error
    }
  }

  private persistChecklist(): void {
    try {
      localStorage.setItem(STORAGE_KEY_CHECKLIST, JSON.stringify(this.checklist));
    } catch {
      // Ignore storage error
    }
  }

  getSnapshot = (): BridgeControllerSnapshot => {
    return this.snapshot;
  };

  // --- Checklist Steps ---
  toggleChecklistStep(
    step:
      | 'step1BatteryUnrestricted'
      | 'step2OverlayGranted'
      | 'step3AccessibilityEnabled'
      | 'step4NotificationAccessGranted'
  ): void {
    const nextVal = !this.checklist[step];
    this.checklist = { ...this.checklist, [step]: nextVal };
    if (step === 'step4NotificationAccessGranted') {
      this.mediaState = { ...this.mediaState, hasNotificationAccess: nextVal };
    }
    this.persistChecklist();
    this.emit();
  }

  async requestMediaProjection(): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getDisplayMedia) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
          audio: true,
        });
        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach((t) => t.stop());
        }
        this.mediaStream = stream;
        stream.getVideoTracks()[0]?.addEventListener('ended', () => {
          this.mediaStream = null;
          this.checklist = { ...this.checklist, step5MediaProjectionGranted: false };
          this.runtimeState = {
            ...this.runtimeState,
            projectionStats: {
              ...this.runtimeState.projectionStats,
              usingMediaProjection: false,
            },
            lastProtocolEvent: 'Захват экрана (MediaProjection) завершён пользователем',
          };
          this.persistChecklist();
          this.emit();
        });
      } catch {
        // Browser environment or iframe denied getDisplayMedia — toggle simulation token gracefully
      }
    }

    const granted = this.mediaStream !== null ? true : !this.checklist.step5MediaProjectionGranted;
    this.checklist = { ...this.checklist, step5MediaProjectionGranted: granted };
    this.runtimeState = {
      ...this.runtimeState,
      projectionStats: {
        ...this.runtimeState.projectionStats,
        usingMediaProjection: granted,
        isRunning: granted || this.runtimeState.videoSourceMode !== VideoSourceMode.SCREEN_MIRRORING,
      },
      lastProtocolEvent: granted
        ? 'MediaProjection («Весь экран») активирован — готов к потоку H.264'
        : 'MediaProjection приостановлен',
    };
    this.persistChecklist();
    this.emit();
  }

  // --- USB AOA Connect / Scan / Stop ---
  async scanAndAttachUsb(): Promise<void> {
    // Try WebUSB accessory probe if available (non-blocking if unsupported or cancelled)
    let detectedLabel = 'FAW-VW Jetta VS7 (MQB MIB)';
    const navWithUsb = navigator as Navigator & {
      usb?: { requestDevice: (opts: { filters: Array<{ vendorId?: number }> }) => Promise<{ productName?: string; manufacturerName?: string }> };
    };
    if (navWithUsb.usb) {
      try {
        const dev = await navWithUsb.usb.requestDevice({ filters: [] });
        if (dev) {
          detectedLabel = `${dev.manufacturerName || 'Volkswagen'} ${dev.productName || 'Jetta VS7'}`;
        }
      } catch {
        // Standard fallback to Jetta VS7 AOA session simulation
      }
    }

    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        await (navigator as Navigator & { wakeLock: { request: (t: string) => Promise<unknown> } }).wakeLock.request('screen');
      } catch {
        // Ignore wakeLock rejection in headless/iframe
      }
    }

    this.runtimeState = {
      ...this.runtimeState,
      isServiceRunning: true,
      wakeLockHeld: true,
      transportState: { kind: 'connecting', manufacturer: 'FAW-VW', model: detectedLabel },
      lastProtocolEvent: `Opening AOA Direct-IO FileChannel (${detectedLabel})...`,
    };
    this.emit();

    // Perform real binary protocol handshake via CarLifeFrameCodec + CarLifeControlStateMachine
    const versionReq = CarLifeFrameCodec.createCommandFrame(
      CarLifeChannelId.CONTROL,
      CarLifeMsgType.MSG_CMD_HU_PROTOCOL_VERSION,
      CarlifeProtocolVersionProto.encode({ majorVersion: 2, minorVersion: 0 })
    );
    const huBytes = CarLifeFrameCodec.encodeFrame(versionReq);
    this.recordFrame('RX (HU -> S26U)', versionReq, huBytes.length, 0, true);
    const transition1 = this.stateMachine.onControlFrame(versionReq);
    for (const out of transition1.outboundFrames) {
      const encoded = CarLifeFrameCodec.encodeFrame(out);
      this.recordFrame('TX (S26U -> HU)', out, 0, encoded.length, true);
    }

    if (this.runtimeState.handshakeTestProfileId === 4) {
      const audioInit = CarLifeFrameCodec.createMediaInitFrame();
      const audioBytes = CarLifeFrameCodec.encodeFrame(audioInit);
      this.recordFrame('TX (S26U -> HU)', audioInit, 0, audioBytes.length, true, 'MSG_MEDIA_INIT (48kHz Stereo)');

      const autoResult = this.stateMachine.buildAutoVideoEncoderInitAndStartFrames(
        this.runtimeState.configuredWidth,
        this.runtimeState.configuredHeight,
        30,
        'Профиль Jetta VS7',
        true
      );
      for (const out of autoResult.outboundFrames) {
        const encoded = CarLifeFrameCodec.encodeFrame(out);
        this.recordFrame('TX (S26U -> HU)', out, 0, encoded.length, true);
      }

      this.checklist = { ...this.checklist, isUsbConnected: true };
      this.runtimeState = {
        ...this.runtimeState,
        transportState: {
          kind: 'connected',
          manufacturer: 'FAW-VW',
          model: detectedLabel,
          fdNumber: 64,
          connectedAt: Date.now(),
        },
        controlSession: this.stateMachine.state,
        isVideoChannelReadyForStreaming: true,
        projectionStats: {
          ...this.runtimeState.projectionStats,
          isRunning: true,
          spsPpsConfigured: true,
        },
        audioCaptureStats: {
          ...this.runtimeState.audioCaptureStats,
          isCapturing: true,
          mediaInitSent: true,
          sentInitPackets: this.runtimeState.audioCaptureStats.sentInitPackets + 1,
          isPhoneSpeakerMutedByBridge: this.runtimeState.mutePhoneSpeakerDuringUsbAudio,
          statusMessage: 'Аудио 0x0003: активна передача PCM 48кГц Stereo (4096B)',
        },
        lastProtocolEvent:
          'USB AOA подключён (Jetta VS7) • Рукопожатие 0x0001 завершено • Поток 0x0002 (SPS/PPS + IDR) и аудио 0x0003 открыты ✅',
      };
      this.startStreamingTelemetryTimers();
    } else {
      this.checklist = { ...this.checklist, isUsbConnected: true };
      this.runtimeState = {
        ...this.runtimeState,
        transportState: {
          kind: 'connected',
          manufacturer: 'FAW-VW',
          model: detectedLabel,
          fdNumber: 64,
          connectedAt: Date.now(),
        },
        controlSession: this.stateMachine.state,
        isVideoChannelReadyForStreaming: false,
        lastProtocolEvent: transition1.summary,
      };
    }
    this.emit();
  }

  stopBridge(): void {
    this.stopStreamingTelemetryTimers();
    if (this.runtimeState.audioCaptureStats.isCapturing) {
      const stopFrame = CarLifeFrameCodec.createMediaStopFrame();
      this.recordFrame('TX (S26U -> HU)', stopFrame, 0, CarLifeFrameCodec.encodeFrame(stopFrame).length, true);
    }
    this.stateMachine.reset();
    this.checklist = { ...this.checklist, isUsbConnected: false };
    this.runtimeState = {
      ...this.runtimeState,
      isServiceRunning: false,
      wakeLockHeld: false,
      transportState: { kind: 'disconnected' },
      controlSession: this.stateMachine.state,
      isVideoChannelReadyForStreaming: false,
      audioCaptureStats: {
        ...this.runtimeState.audioCaptureStats,
        isCapturing: false,
        isPhoneSpeakerMutedByBridge: false,
        statusMessage: 'Аудио 0x0003: остановлено (MSG_MEDIA_STOP)',
      },
      lastProtocolEvent: 'BridgeForegroundService stopped by user',
    };
    this.emit();
  }

  private startStreamingTelemetryTimers(): void {
    this.stopStreamingTelemetryTimers();

    // Push immediate SPS+PPS+IDR frame log so 0x0002 Video tab shows real data
    this.emitSimulatedVideoKeyframe();

    this.streamTimer = window.setInterval(() => {
      if (!this.runtimeState.isVideoChannelReadyForStreaming || !this.runtimeState.projectionStats.isRunning) {
        return;
      }
      const nalSample = new Uint8Array([
        0x00, 0x00, 0x00, 0x01, 0x41, 0x9a, 0x24, 0x6c, 0x4b, 0x7f, 0x11, 0x80, 0x00, 0x12, 0x34, 0x56,
      ]);
      const frame = CarLifeFrameCodec.createVideoFrame(nalSample, Date.now() & 0x7fffffff);
      const wireLen = CarLifeFrameCodec.encodeFrame(frame).length + 4200;
      const nextCount = this.runtimeState.projectionStats.encodedNalFrames + 15;
      this.runtimeState = {
        ...this.runtimeState,
        txFrames: this.runtimeState.txFrames + 15,
        txBytes: this.runtimeState.txBytes + wireLen * 15,
        channelFrameCounts: {
          ...this.runtimeState.channelFrameCounts,
          [CarLifeChannelId.VIDEO]: this.runtimeState.channelFrameCounts[CarLifeChannelId.VIDEO] + 15,
        },
        projectionStats: {
          ...this.runtimeState.projectionStats,
          encodedNalFrames: nextCount,
          encodedBytes: this.runtimeState.projectionStats.encodedBytes + wireLen * 15,
        },
      };
      if (this.runtimeState.logPacketsInUi) {
        this.recordFrame('TX (S26U -> HU)', frame, 0, wireLen, false, `H.264 Slice #${nextCount}`);
      }
      this.emit();
    }, 1000);

    this.audioTimer = window.setInterval(() => {
      if (!this.runtimeState.audioCaptureStats.isCapturing) return;
      const stats = this.runtimeState.audioCaptureStats;
      if (this.mediaState.isPlaying) {
        const nextPkts = stats.sentPcmPackets + 10;
        const addedBytes = 4096 * 10;
        this.runtimeState = {
          ...this.runtimeState,
          txFrames: this.runtimeState.txFrames + 10,
          txBytes: this.runtimeState.txBytes + addedBytes + 200,
          channelFrameCounts: {
            ...this.runtimeState.channelFrameCounts,
            [CarLifeChannelId.MEDIA_AUDIO]:
              this.runtimeState.channelFrameCounts[CarLifeChannelId.MEDIA_AUDIO] + 10,
          },
          audioCaptureStats: {
            ...stats,
            sentPcmPackets: nextPkts,
            sentPcmBytes: stats.sentPcmBytes + addedBytes,
          },
        };
      } else {
        this.runtimeState = {
          ...this.runtimeState,
          audioCaptureStats: {
            ...stats,
            skippedSilentPackets: stats.skippedSilentPackets + 10,
          },
        };
      }
      this.emit();
    }, 1000);
  }

  private emitSimulatedVideoKeyframe(): void {
    const spsPpsIdr = new Uint8Array([
      0x00, 0x00, 0x00, 0x01, 0x67, 0x42, 0xc0, 0x1f, 0xda, 0x01, 0x40, 0x16, 0xec, 0x04, 0x40, 0x00,
      0x00, 0x00, 0x01, 0x68, 0xce, 0x3c, 0x80, 0x00, 0x00, 0x00, 0x01, 0x65, 0x88, 0x84, 0x21, 0xa0,
    ]);
    const keyFrame = CarLifeFrameCodec.createVideoFrame(spsPpsIdr, Date.now() & 0x7fffffff);
    const wireLen = CarLifeFrameCodec.encodeFrame(keyFrame).length;
    this.runtimeState = {
      ...this.runtimeState,
      projectionStats: {
        ...this.runtimeState.projectionStats,
        encodedNalFrames: this.runtimeState.projectionStats.encodedNalFrames + 1,
        encodedBytes: this.runtimeState.projectionStats.encodedBytes + wireLen,
        lastIdrBytes: 18_432,
        spsPpsConfigured: true,
      },
    };
    this.recordFrame('TX (S26U -> HU)', keyFrame, 0, wireLen, true, 'SPS+PPS+IDR KeyFrame #1');
  }

  private stopStreamingTelemetryTimers(): void {
    if (this.streamTimer !== null) {
      window.clearInterval(this.streamTimer);
      this.streamTimer = null;
    }
    if (this.audioTimer !== null) {
      window.clearInterval(this.audioTimer);
      this.audioTimer = null;
    }
  }

  // --- Settings & Controls ---
  setAppMode(mode: AppMode): void {
    const mappedSource =
      mode === AppMode.MIRRORING ? VideoSourceMode.SCREEN_MIRRORING : VideoSourceMode.VIRTUAL_DISPLAY;
    const mappedLaunch =
      mode === AppMode.MIRRORING
        ? AppLaunchMode.SCREEN_MIRRORING
        : AppLaunchMode.VIRTUAL_DISPLAY_IF_AVAILABLE;
    this.runtimeState = {
      ...this.runtimeState,
      appMode: mode,
      videoSourceMode: mappedSource,
      appLaunchMode: mappedLaunch,
      logPacketsInUi: mode === AppMode.COCKPIT,
      projectionStats: {
        ...this.runtimeState.projectionStats,
        appMode: mode,
        videoSourceMode: mappedSource,
        virtualDisplayId: mappedSource === VideoSourceMode.VIRTUAL_DISPLAY ? 2 : 0,
        activeCockpitWidget:
          mode === AppMode.COCKPIT ? 'Виртуальный экран (VD #2) активен' : 'Зеркалирование экрана готово',
      },
      lastProtocolEvent: `Режим работы: ${APP_MODE_META[mode].title}`,
    };
    this.persistSettings();
    this.emit();
  }

  setLogPacketsInUi(enabled: boolean): void {
    this.runtimeState = {
      ...this.runtimeState,
      logPacketsInUi: enabled,
      lastProtocolEvent: enabled
        ? 'Логирование пакетов в UI: ВКЛ'
        : 'Логирование пакетов в UI: ВЫКЛ (макс. производительность)',
    };
    this.persistSettings();
    this.emit();
  }

  setMutePhoneSpeakerDuringUsbAudio(enabled: boolean): void {
    this.runtimeState = {
      ...this.runtimeState,
      mutePhoneSpeakerDuringUsbAudio: enabled,
      audioCaptureStats: {
        ...this.runtimeState.audioCaptureStats,
        mutePhoneSpeakerDuringUsbAudio: enabled,
        isPhoneSpeakerMutedByBridge: enabled && this.runtimeState.audioCaptureStats.isCapturing,
      },
      lastProtocolEvent: enabled
        ? 'Глушить динамик телефона при USB-звуке: ВКЛ'
        : 'Глушить динамик телефона при USB-звуке: ВЫКЛ',
    };
    this.persistSettings();
    this.emit();
  }

  toggleAudioCapture(): void {
    const currentlyCapturing = this.runtimeState.audioCaptureStats.isCapturing;
    if (currentlyCapturing) {
      const stopFrame = CarLifeFrameCodec.createMediaStopFrame();
      this.recordFrame(
        'TX (S26U -> HU)',
        stopFrame,
        0,
        CarLifeFrameCodec.encodeFrame(stopFrame).length,
        true,
        'MSG_MEDIA_STOP (0x00030002)'
      );
      this.runtimeState = {
        ...this.runtimeState,
        audioCaptureStats: {
          ...this.runtimeState.audioCaptureStats,
          isCapturing: false,
          isPhoneSpeakerMutedByBridge: false,
          sentStopPackets: this.runtimeState.audioCaptureStats.sentStopPackets + 1,
          statusMessage: 'Аудио 0x0003: остановлено (MSG_MEDIA_STOP)',
        },
        lastProtocolEvent: 'Аудиоканал 0x0003 остановлен (MSG_MEDIA_STOP)',
      };
    } else {
      const initFrame = CarLifeFrameCodec.createMediaInitFrame();
      this.recordFrame(
        'TX (S26U -> HU)',
        initFrame,
        0,
        CarLifeFrameCodec.encodeFrame(initFrame).length,
        true,
        'MSG_MEDIA_INIT (48kHz Stereo 16-bit)'
      );
      this.runtimeState = {
        ...this.runtimeState,
        audioCaptureStats: {
          ...this.runtimeState.audioCaptureStats,
          isCapturing: true,
          mediaInitSent: true,
          sentInitPackets: this.runtimeState.audioCaptureStats.sentInitPackets + 1,
          isPhoneSpeakerMutedByBridge: this.runtimeState.mutePhoneSpeakerDuringUsbAudio,
          statusMessage: 'Аудио 0x0003: активна передача PCM 48кГц Stereo (4096B)',
        },
        lastProtocolEvent: 'Аудиоканал 0x0003 запущен (MSG_MEDIA_INIT 48000 Hz Stereo)',
      };
    }
    this.emit();
  }

  setVideoSourceMode(mode: VideoSourceMode): void {
    const mappedAppMode =
      mode === VideoSourceMode.SCREEN_MIRRORING ? AppMode.MIRRORING : AppMode.COCKPIT;
    this.runtimeState = {
      ...this.runtimeState,
      appMode: mappedAppMode,
      videoSourceMode: mode,
      projectionStats: {
        ...this.runtimeState.projectionStats,
        appMode: mappedAppMode,
        videoSourceMode: mode,
        virtualDisplayId: mode === VideoSourceMode.VIRTUAL_DISPLAY ? 2 : 0,
        isRunning: true,
        activeCockpitWidget: VIDEO_SOURCE_META[mode].title,
      },
      lastProtocolEvent: `Источник видео: ${VIDEO_SOURCE_META[mode].title}`,
    };
    this.persistSettings();
    this.emit();
  }

  setAppLaunchMode(mode: AppLaunchMode): void {
    this.lastLaunchStatus = `Режим запуска: ${APP_LAUNCH_MODE_META[mode].title}`;
    this.runtimeState = {
      ...this.runtimeState,
      appLaunchMode: mode,
      lastProtocolEvent: `Режим запуска приложений: ${APP_LAUNCH_MODE_META[mode].title}`,
    };
    this.persistSettings();
    this.emit();
  }

  setHandshakeProfile(profileId: number): void {
    this.stateMachine.handshakeTestProfileId = profileId;
    this.runtimeState = {
      ...this.runtimeState,
      handshakeTestProfileId: profileId,
      lastProtocolEvent: `Профиль 0x00018001 выбран: Тест ${profileId}`,
    };
    this.persistSettings();
    this.emit();
  }

  setResolution(width: number, height: number): void {
    this.stateMachine.setPreferredResolution(width, height);
    this.runtimeState = {
      ...this.runtimeState,
      configuredWidth: width,
      configuredHeight: height,
      projectionStats: {
        ...this.runtimeState.projectionStats,
        width,
        height,
      },
      controlSession: {
        ...this.runtimeState.controlSession,
        negotiatedVideoWidth: width,
        negotiatedVideoHeight: height,
      },
      lastProtocolEvent: `Видеоконфигурация обновлена: ${width}×${height} @ ${this.runtimeState.configuredBitrateBps / 1000} кбит/с`,
    };
    this.persistSettings();
    this.emit();
  }

  setBitrateKbps(kbps: number): void {
    const bps = kbps * 1000;
    this.runtimeState = {
      ...this.runtimeState,
      configuredBitrateBps: bps,
      projectionStats: {
        ...this.runtimeState.projectionStats,
        bitRateKbps: kbps,
      },
      lastProtocolEvent: `Битрейт H.264 обновлён: ${kbps} кбит/с (CBR 30fps)`,
    };
    this.persistSettings();
    this.emit();
  }

  setVideoHeaderMode(useAoA20B: boolean): void {
    CarLifeFrameCodec.useNestedVideoMsgHeader = useAoA20B;
    this.runtimeState = {
      ...this.runtimeState,
      useNestedVideoMsgHeader: useAoA20B,
      lastProtocolEvent: useAoA20B
        ? 'Video 0x0002 Framing: Режим 1: AOA 20B (8B AOA + 12B 0x00020001) active'
        : 'Video 0x0002 Framing: Режим 2: Direct 12B ([00 00 00 02][nalSize][ts]) active',
    };
    this.persistSettings();
    this.emit();
  }

  toggleProjection(): void {
    const nextRunning = !this.runtimeState.projectionStats.isRunning;
    this.runtimeState = {
      ...this.runtimeState,
      isServiceRunning: true,
      projectionStats: {
        ...this.runtimeState.projectionStats,
        isRunning: nextRunning,
        spsPpsConfigured: nextRunning,
      },
      lastProtocolEvent: nextRunning
        ? `Конвейер видеозаписи запущен (${this.runtimeState.configuredWidth}×${this.runtimeState.configuredHeight}@30fps)`
        : 'Конвейер видеозаписи остановлен',
    };
    this.emit();
  }

  startJettaVs7DefaultVd(): void {
    this.setResolution(1280, 720);
    this.setBitrateKbps(2000);
    this.setVideoHeaderMode(true);
    this.setVideoSourceMode(VideoSourceMode.VIRTUAL_DISPLAY);
    this.runtimeState = {
      ...this.runtimeState,
      isServiceRunning: true,
      projectionStats: {
        ...this.runtimeState.projectionStats,
        isRunning: true,
        virtualDisplayId: 2,
        spsPpsConfigured: true,
      },
      lastProtocolEvent: 'Стартован VD #2 (1280×720 • 2.0 Мбит/с • 160 dpi • AOA 20B)',
    };
    this.emit();
  }

  injectTestTouch(x: number, y: number): void {
    const frame = CarLifeTouchDecoder.createTouchActionFrame(
      0,
      x,
      y,
      this.runtimeState.configuredWidth,
      this.runtimeState.configuredHeight
    );
    const wireLen = CarLifeFrameCodec.encodeFrame(frame).length;
    this.recordFrame('RX (HU -> S26U)', frame, wireLen, 0, true);
    const ev = CarLifeTouchDecoder.decodeTouchChannelFrame(
      frame,
      1920,
      1080,
      this.runtimeState.configuredWidth,
      this.runtimeState.configuredHeight
    );
    const label =
      ev && ev.kind === 'touch'
        ? this.runtimeState.appMode === AppMode.MIRRORING
          ? `Touch ${ev.type}: HU(${ev.rawX},${ev.rawY}) -> Mirroring (AccessibilityService)`
          : `Touch ${ev.type}: HU(${ev.rawX},${ev.rawY}) -> Cockpit VD(${Math.round(ev.scaledX)},${Math.round(ev.scaledY)})`
        : `Touch (${x}, ${y})`;

    this.runtimeState = {
      ...this.runtimeState,
      projectionStats: {
        ...this.runtimeState.projectionStats,
        injectedTouches: this.runtimeState.projectionStats.injectedTouches + 1,
        lastTouchPoint: [x, y],
      },
      lastTouchOrKeyEvent: label,
      lastProtocolEvent: label,
    };
    this.emit();
  }

  // --- Protocol Lab Loopback Vectors ---
  runLoopbackVector(vector: 'handshake' | 'video' | 'touch' | 'hardkey'): void {
    if (vector === 'handshake') {
      const vFrame = CarLifeFrameCodec.createCommandFrame(
        CarLifeChannelId.CONTROL,
        CarLifeMsgType.MSG_CMD_HU_PROTOCOL_VERSION,
        CarlifeProtocolVersionProto.encode({ majorVersion: 2, minorVersion: 0 })
      );
      const initFrame = CarLifeFrameCodec.createCommandFrame(
        CarLifeChannelId.CONTROL,
        CarLifeMsgType.MSG_CMD_VIDEO_ENCODER_INIT,
        CarlifeVideoEncoderInfoProto.encode({ width: 800, height: 480, frameRate: 30 })
      );
      this.executeSingleLoopback(vFrame, 'Control 0x0001: MSG_CMD_HU_PROTOCOL_VERSION (v2.0)');
      this.executeSingleLoopback(initFrame, 'Control 0x0001: MSG_CMD_VIDEO_ENCODER_INIT (800x480@30)');
    } else if (vector === 'video') {
      const h264SpsPps = new Uint8Array([
        0x00, 0x00, 0x00, 0x01, 0x67, 0x42, 0x00, 0x1f, 0x00, 0x00, 0x00, 0x01, 0x68, 0xce, 0x3c, 0x80,
      ]);
      const vFrame = CarLifeFrameCodec.createVideoFrame(h264SpsPps, Date.now() & 0x7fffffff);
      this.executeSingleLoopback(vFrame, 'Video 0x0002: H.264 SPS/PPS NAL');
    } else if (vector === 'touch') {
      const tFrame = CarLifeTouchDecoder.createTouchActionFrame(0, 640, 360, 1280, 720);
      this.executeSingleLoopback(tFrame, 'Touch 0x0006: MSG_TOUCH_ACTION (640,360 on 1280x720)');
    } else {
      const hkFrame = CarLifeTouchDecoder.createHardKeyFrame('SEEK_ADD');
      this.executeSingleLoopback(hkFrame, 'Touch 0x0006: MSG_TOUCH_CAR_HARD_KEY_CODE (SEEK_ADD)');
    }
  }

  private executeSingleLoopback(frame: CarLifeFrame, description: string): void {
    const encodedBytes = CarLifeFrameCodec.encodeFrame(frame);
    const decoded = CarLifeFrameCodec.decodeFrame(encodedBytes);
    let extraAnalysis = '';

    if (decoded.header.channel === CarLifeChannelId.CONTROL) {
      const transition = this.stateMachine.onControlFrame(decoded);
      extraAnalysis = `\n• State Machine Transition: ${transition.summary}`;
      for (const reply of transition.outboundFrames) {
        const replyWire = CarLifeFrameCodec.encodeFrame(reply);
        this.recordFrame('TX (S26U -> HU)', reply, 0, replyWire.length, true);
      }
      this.runtimeState = {
        ...this.runtimeState,
        controlSession: transition.updatedState,
      };
    } else if (decoded.header.channel === CarLifeChannelId.TOUCH) {
      const ev = CarLifeTouchDecoder.decodeTouchChannelFrame(decoded, 1920, 1080, 1280, 720);
      let evStr = 'None';
      if (ev?.kind === 'touch') {
        evStr = `${ev.type} Raw(${ev.rawX},${ev.rawY} @ ${ev.huWidth}x${ev.huHeight}) -> Scaled(${Math.round(ev.scaledX)},${Math.round(ev.scaledY)} @ 1920x1080)`;
      } else if (ev?.kind === 'hardkey') {
        evStr = `HardKey ${ev.mappedKey?.label ?? 'UNKNOWN'} -> Android KeyCode ${ev.androidKeyCode}`;
        if (ev.mappedKey?.id === 'SEEK_ADD') {
          this.skipNextTrack();
        }
      }
      extraAnalysis = `\n• Touch/Key Decoded: ${evStr}`;
      this.runtimeState = {
        ...this.runtimeState,
        lastTouchOrKeyEvent: evStr,
        projectionStats: {
          ...this.runtimeState.projectionStats,
          injectedTouches: this.runtimeState.projectionStats.injectedTouches + 1,
        },
      };
    }

    this.recordFrame('RX (HU -> S26U)', decoded, encodedBytes.length, 0, true);

    const rawHeader = CarLifeFrameCodec.encodeHeader(decoded.header);
    const toHex = (arr: Uint8Array) =>
      Array.from(arr)
        .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
        .join(' ');
    const chHex = toHex(rawHeader.subarray(0, 4));
    const lenHex = toHex(rawHeader.subarray(4, 8));
    const info = channelInfo(decoded.header.channel);

    let tsPart = '\n• Timestamp Field: Omitted (8-byte Standard Channel Header)';
    if (decoded.header.includeOuterTimestamp && rawHeader.length >= 12) {
      tsPart = `\n• Bytes [8..11] Timestamp: [${toHex(rawHeader.subarray(8, 12))}] -> ${decoded.header.timestamp} ms`;
    } else if (decoded.header.channel === CarLifeChannelId.VIDEO) {
      tsPart = `\n• Video Framing: AOA 20B (8B AOA + 12B 0x00020001) | ts=${decoded.header.timestamp} ms`;
    }

    const cmd = parseCommandMessageOrNull(decoded);
    const cmdSub = cmd
      ? `\n• Inner Header: len=${cmd.body.length}B | service=${cmd.serviceName} (0x${(cmd.serviceType >>> 0)
          .toString(16)
          .toUpperCase()
          .padStart(8, '0')})`
      : '';

    this.lastDecodedBreakdown =
      `[${description}]\n` +
      `• Header Size: ${decoded.header.includeOuterTimestamp ? 12 : 8} bytes | Total Wire Size: ${encodedBytes.length} bytes\n` +
      `• Bytes [0..3] Channel ID: [${chHex}] -> ${info.key} (0x${info.id.toString(16).toUpperCase().padStart(4, '0')})\n` +
      `• Bytes [4..7] Payload Len: [${lenHex}] -> ${decoded.header.payloadLength} bytes` +
      tsPart +
      cmdSub +
      extraAnalysis;

    this.emit();
  }

  private recordFrame(
    direction: string,
    frame: CarLifeFrame,
    rxAddBytes: number,
    txAddBytes: number,
    forceLog = false,
    serviceNameOverride?: string
  ): void {
    const ch = frame.header.channel;
    const isVideo = ch === CarLifeChannelId.VIDEO;
    const nextChannelCounts = {
      ...this.runtimeState.channelFrameCounts,
      [ch]: (this.runtimeState.channelFrameCounts[ch] ?? 0) + 1,
    };

    const rxF = direction.startsWith('RX') ? this.runtimeState.rxFrames + 1 : this.runtimeState.rxFrames;
    const txF = direction.startsWith('TX') ? this.runtimeState.txFrames + 1 : this.runtimeState.txFrames;

    if (!this.runtimeState.logPacketsInUi && !forceLog) {
      this.runtimeState = {
        ...this.runtimeState,
        rxBytes: this.runtimeState.rxBytes + rxAddBytes,
        txBytes: this.runtimeState.txBytes + txAddBytes,
        rxFrames: rxF,
        txFrames: txF,
        channelFrameCounts: nextChannelCounts,
      };
      return;
    }

    const cmd = parseCommandMessageOrNull(frame);
    const isAoA20BVideo = isVideo && !frame.header.includeOuterTimestamp && frame.payload.length >= 12;
    const effectiveHeaderBytes = isAoA20BVideo
      ? 20
      : frame.header.includeOuterTimestamp
      ? 12
      : 8;
    const effectivePayloadBytes = isAoA20BVideo ? frame.payload.length - 12 : frame.payload.length;
    const hexMaxBytes = direction.startsWith('RX') ? 512 : !isVideo ? Math.max(frame.payload.length, 16) : 48;

    const entry: PacketLogEntry = {
      id: ++this.logSequence,
      timestampFormatted: formatTimeStampMs(),
      direction,
      channel: ch,
      headerSizeBytes: effectiveHeaderBytes,
      payloadSizeBytes: effectivePayloadBytes,
      mediaTimestampMs: frame.header.timestamp,
      serviceName: serviceNameOverride ?? cmd?.serviceName ?? null,
      hexPreview: CarLifeFrameCodec.formatHexPreview(frame, hexMaxBytes),
    };

    const nextCommandLogs = !isVideo
      ? [entry, ...this.runtimeState.commandPacketLogs].slice(0, 200)
      : this.runtimeState.commandPacketLogs;
    const nextVideoLogs = isVideo
      ? [entry, ...this.runtimeState.videoPacketLogs].slice(0, 60)
      : this.runtimeState.videoPacketLogs;

    this.runtimeState = {
      ...this.runtimeState,
      rxBytes: this.runtimeState.rxBytes + rxAddBytes,
      txBytes: this.runtimeState.txBytes + txAddBytes,
      rxFrames: rxF,
      txFrames: txF,
      channelFrameCounts: nextChannelCounts,
      commandPacketLogs: nextCommandLogs,
      videoPacketLogs: nextVideoLogs,
    };
  }

  clearLogs(): void {
    this.runtimeState = {
      ...this.runtimeState,
      commandPacketLogs: [],
      videoPacketLogs: [],
      channelFrameCounts: {
        [CarLifeChannelId.CONTROL]: 0,
        [CarLifeChannelId.VIDEO]: 0,
        [CarLifeChannelId.MEDIA_AUDIO]: 0,
        [CarLifeChannelId.TTS_AUDIO]: 0,
        [CarLifeChannelId.VR_AUDIO]: 0,
        [CarLifeChannelId.TOUCH]: 0,
      },
      lastProtocolEvent: 'Packet log cleared',
    };
    this.emit();
  }

  // --- Launcher & Media Actions ---
  launchApp(app: InstalledAppInfo): void {
    const mode = this.runtimeState.appLaunchMode;
    const vdId = this.runtimeState.projectionStats.virtualDisplayId;
    if (mode === AppLaunchMode.VIRTUAL_DISPLAY_IF_AVAILABLE && vdId > 0) {
      this.lastLaunchStatus = `Запущено: ${app.label} (${app.packageName}) -> VirtualDisplay #${vdId}`;
    } else {
      const modeSuffix =
        mode === AppLaunchMode.SCREEN_MIRRORING
          ? 'Зеркалирование экрана (MediaProjection)'
          : 'Default Display (0)';
      this.lastLaunchStatus = `Запущено: ${app.label} (${app.packageName}) -> ${modeSuffix}`;
    }
    this.runtimeState = {
      ...this.runtimeState,
      projectionStats: {
        ...this.runtimeState.projectionStats,
        activeCockpitWidget: `${app.label} • Активно`,
      },
      lastProtocolEvent: this.lastLaunchStatus,
    };
    this.emit();
  }

  triggerDockHome(): void {
    this.lastLaunchStatus = 'Команда Домой (CarLifeAccessibilityService GLOBAL_ACTION_HOME)';
    this.runtimeState = {
      ...this.runtimeState,
      lastTouchOrKeyEvent: 'HardKey HOME (0x00000001) -> GLOBAL_ACTION_HOME',
    };
    this.emit();
  }

  triggerDockBack(): void {
    this.lastLaunchStatus = 'Команда Назад (CarLifeAccessibilityService GLOBAL_ACTION_BACK)';
    this.runtimeState = {
      ...this.runtimeState,
      lastTouchOrKeyEvent: 'HardKey BACK (0x0000000E) -> GLOBAL_ACTION_BACK',
    };
    this.emit();
  }

  togglePlayPause(): void {
    this.mediaState = { ...this.mediaState, isPlaying: !this.mediaState.isPlaying };
    this.emit();
  }

  skipNextTrack(): void {
    this.fallbackTrackIndex = (this.fallbackTrackIndex + 1) % FALLBACK_PLAYLIST.length;
    const t = FALLBACK_PLAYLIST[this.fallbackTrackIndex];
    this.mediaState = {
      ...this.mediaState,
      activePackageName: t.pkg,
      playerAppTitle: t.player,
      trackTitle: t.title,
      artistName: t.artist,
      albumName: t.album,
      isPlaying: true,
      positionMs: 42_000,
      durationMs: t.durationMs,
    };
    this.emit();
  }

  skipPreviousTrack(): void {
    this.fallbackTrackIndex =
      (this.fallbackTrackIndex - 1 + FALLBACK_PLAYLIST.length) % FALLBACK_PLAYLIST.length;
    const t = FALLBACK_PLAYLIST[this.fallbackTrackIndex];
    this.mediaState = {
      ...this.mediaState,
      activePackageName: t.pkg,
      playerAppTitle: t.player,
      trackTitle: t.title,
      artistName: t.artist,
      albumName: t.album,
      isPlaying: true,
      positionMs: 42_000,
      durationMs: t.durationMs,
    };
    this.emit();
  }
}

export const bridgeController = new BridgeController();
