import React, { useEffect, useRef, useState } from 'react';
import {
  CARLIFE_CHANNELS,
  CarLifeChannelId,
  formatHex16,
} from '../protocol/carlifeConstants';
import { HANDSHAKE_TEST_PROFILES } from '../protocol/carlifeControlStateMachine';
import {
  APP_LAUNCH_MODE_META,
  APP_MODE_META,
  AppLaunchMode,
  AppMode,
  BridgeRuntimeState,
  PacketLogEntry,
  SetupChecklistStatus,
  VIDEO_SOURCE_META,
  VideoSourceMode,
} from '../store/bridgeStore';
import {
  AppsGridIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClearAllIcon,
  GraphicEqIcon,
  MemoryIcon,
  PlayArrowIcon,
  RefreshIcon,
  StopIcon,
  TouchAppIcon,
  VideocamIcon,
} from './CockpitIcons';

interface UnifiedSettingsAndDiagnosticsScreenProps {
  state: BridgeRuntimeState;
  checklistStatus: SetupChecklistStatus;
  lastLaunchStatus: string;
  lastDecodedBreakdown: string;
  mediaStream: MediaStream | null;
  onSetAppMode: (mode: AppMode) => void;
  onSetLogPacketsInUi: (enabled: boolean) => void;
  onSetMutePhoneSpeaker: (enabled: boolean) => void;
  onToggleAudioCapture: () => void;
  onSetVideoSourceMode: (mode: VideoSourceMode) => void;
  onSetAppLaunchMode: (mode: AppLaunchMode) => void;
  onSetHandshakeProfile: (id: number) => void;
  onSelectResolution: (width: number, height: number) => void;
  onSelectBitrate: (kbps: number) => void;
  onSetVideoHeaderMode: (useAoA20B: boolean) => void;
  onToggleProjection: () => void;
  onStartJettaVs7Vd: () => void;
  onToggleAccessibility: () => void;
  onToggleOverlay: () => void;
  onRequestMediaProjection: () => void;
  onScanAndAttachUsb: () => void;
  onStopBridge: () => void;
  onInjectTouch: (x: number, y: number) => void;
  onRunLoopbackVector: (vector: 'handshake' | 'video' | 'touch' | 'hardkey') => void;
  onClearLogs: () => void;
}

const CanvasTestCardPreview: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let rafId = 0;
    let frameNum = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          frameNum += 1;
          ctx.fillStyle = '#0B0E14';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Grid lines
          ctx.strokeStyle = '#1E2636';
          ctx.lineWidth = 1;
          for (let x = 0; x < canvas.width; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
          }
          for (let y = 0; y < canvas.height; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
          }

          // Pulsing scan bar
          const scanX = (frameNum * 5) % canvas.width;
          ctx.fillStyle = 'rgba(0, 180, 216, 0.25)';
          ctx.fillRect(scanX, 0, 16, canvas.height);

          // Header banner
          ctx.fillStyle = '#00B4D8';
          ctx.font = 'bold 20px "Space Grotesk", sans-serif';
          ctx.fillText('JETTA VS7 TEST • H.264 CANVAS', 20, 42);

          ctx.fillStyle = '#10B981';
          ctx.font = '14px "JetBrains Mono", monospace';
          const nowStr = new Date().toLocaleTimeString([], { hour12: false });
          ctx.fillText(`TIME: ${nowStr}  |  FRAME #${frameNum}  |  ${width}x${height} @ 30fps`, 20, 74);

          ctx.fillStyle = '#F59E0B';
          ctx.fillText('CHANNEL 0x0002 • AOA 20B (0x00020001) • CBR Baseline', 20, 102);
        }
      }
      rafId = window.requestAnimationFrame(draw);
    };
    rafId = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(rafId);
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={140}
      className="w-full h-[120px] rounded-[10px] border border-[#222938] bg-[#0B0E14] object-cover"
    />
  );
};

const MediaStreamPreview: React.FC<{ stream: MediaStream }> = ({ stream }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);
  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className="w-full h-[140px] rounded-[10px] border border-[#222938] bg-[#0B0E14] object-contain"
    />
  );
};

const SelectableOptionButton: React.FC<{
  label: string;
  selected: boolean;
  testTag: string;
  onClick: () => void;
  className?: string;
}> = ({ label, selected, testTag, onClick, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testTag}
    className={`h-11 rounded-[10px] px-2.5 text-[12px] truncate border transition cursor-pointer flex items-center justify-center ${
      selected
        ? 'bg-[#00B4D8]/18 border-[#00B4D8] text-[#00B4D8] font-semibold'
        : 'bg-[#1E2636] border-[#222938] text-[#F1F5F9] font-medium hover:border-[#00B4D8]/50'
    } ${className}`}
  >
    {label}
  </button>
);

const StatusActionChip: React.FC<{
  label: string;
  active: boolean;
  icon: React.ReactNode;
  testTag: string;
  onClick: () => void;
}> = ({ label, active, icon, testTag, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testTag}
    className={`flex-1 h-11 rounded-[10px] px-2.5 flex items-center justify-center gap-1.5 text-[12px] font-semibold transition cursor-pointer min-w-0 ${
      active
        ? 'bg-[#064E3B] text-[#10B981] hover:brightness-110'
        : 'bg-[#451A03] text-[#F59E0B] hover:brightness-110'
    }`}
  >
    <span className="shrink-0">{icon}</span>
    <span className="truncate">{label}</span>
  </button>
);

const MetricPill: React.FC<{ label: string; value: string; subValue: string }> = ({
  label,
  value,
  subValue,
}) => (
  <div className="flex-1 min-w-0 rounded-[10px] bg-[#151A24] border border-[#222938] p-2.5">
    <div className="text-[10px] font-medium text-[#64748B] truncate">{label}</div>
    <div className="text-[16px] font-semibold text-[#F1F5F9] mt-0.5 truncate">{value}</div>
    <div className="text-[11px] text-[#00B4D8] truncate">{subValue}</div>
  </div>
);

const PacketLogItemCard: React.FC<{ entry: PacketLogEntry }> = ({ entry }) => {
  const isRx = entry.direction.startsWith('RX');
  const chHex = formatHex16(entry.channel);
  return (
    <div className="w-full rounded-xl bg-[#151A24] border border-[#222938] p-3 flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
              isRx ? 'bg-[#064E3B] text-[#10B981]' : 'bg-[#00B4D8]/15 text-[#00B4D8]'
            }`}
          >
            {entry.direction}
          </span>
          <span className="font-mono-jetbrains text-[11px] text-[#F59E0B]">
            CH {chHex} ({entry.headerSizeBytes}B HDR)
          </span>
        </div>
        <span className="font-mono-jetbrains text-[11px] text-[#64748B]">
          {entry.timestampFormatted}
        </span>
      </div>

      {entry.serviceName && (
        <div className="text-[12px] font-medium text-[#F1F5F9] break-all">
          {entry.serviceName}
        </div>
      )}

      <div className="text-[11px] text-[#94A3B8]">
        Payload: {entry.payloadSizeBytes}B
        {entry.mediaTimestampMs > 0 ? ` • TS: ${entry.mediaTimestampMs} ms` : ''}
      </div>

      <div className="rounded-lg bg-[#0B0E14] border border-[#222938] p-2 font-mono-jetbrains text-[11px] text-[#94A3B8] break-all leading-relaxed">
        {entry.hexPreview}
      </div>
    </div>
  );
};

export const UnifiedSettingsAndDiagnosticsScreen: React.FC<
  UnifiedSettingsAndDiagnosticsScreenProps
> = ({
  state,
  checklistStatus,
  lastLaunchStatus,
  lastDecodedBreakdown,
  mediaStream,
  onSetAppMode,
  onSetLogPacketsInUi,
  onSetMutePhoneSpeaker,
  onToggleAudioCapture,
  onSetVideoSourceMode,
  onSetAppLaunchMode,
  onSetHandshakeProfile,
  onSelectResolution,
  onSelectBitrate,
  onSetVideoHeaderMode,
  onToggleProjection,
  onStartJettaVs7Vd,
  onToggleAccessibility,
  onToggleOverlay,
  onRequestMediaProjection,
  onScanAndAttachUsb,
  onStopBridge,
  onInjectTouch,
  onRunLoopbackVector,
  onClearLogs,
}) => {
  const [diagnosticsExpanded, setDiagnosticsExpanded] = useState(false);
  const [selectedLogTab, setSelectedLogTab] = useState<0 | 1>(0);

  const sourceMode = state.videoSourceMode;
  const proj = state.projectionStats;
  const audioStats = state.audioCaptureStats;

  const vdStatusLine = (() => {
    if (proj.isRunning && !lastLaunchStatus.startsWith('Запущено:')) {
      if (sourceMode === VideoSourceMode.SCREEN_MIRRORING) {
        return proj.usingMediaProjection
          ? `Зеркалирование экрана активно (${state.configuredWidth}×${state.configuredHeight} @ ${state.configuredBitrateBps / 1000} кбит/с, 30 fps, без Presentation)`
          : 'Ожидание разрешения MediaProjection («Весь экран») — нажмите кнопку «Начать трансляцию»';
      }
      if (sourceMode === VideoSourceMode.CANVAS_TEST_CARD) {
        return `Тест-карта (Canvas) активна на Surface (${state.configuredWidth}×${state.configuredHeight} @ ${state.configuredBitrateBps / 1000} кбит/с, 30 fps)`;
      }
      return `Лаунчер ГУ активен на VD #${proj.virtualDisplayId} (${state.configuredWidth}×${state.configuredHeight} @ ${state.configuredBitrateBps / 1000} кбит/с)`;
    }
    if (!proj.isRunning) {
      return `Готов к трансляции: выбрано разрешение ${state.configuredWidth}×${state.configuredHeight} @ ${state.configuredBitrateBps / 1000} кбит/с`;
    }
    return lastLaunchStatus;
  })();

  const displayedLogs =
    selectedLogTab === 0 ? state.commandPacketLogs : state.videoPacketLogs;

  return (
    <div className="h-full w-full overflow-y-auto px-4 py-4">
      <div className="max-w-[680px] mx-auto flex flex-col gap-3.5 pb-6">
        {/* 0. App Mode Switcher */}
        <div
          data-testid="app_mode_switcher_card"
          className="w-full rounded-2xl bg-[#151A24] border border-[#00B4D8]/75 p-4 flex flex-col gap-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-[16px] font-semibold text-[#F1F5F9]">Режим работы приложения</h3>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                Независимые видеопоток и маршрутизация тача (0x0006)
              </p>
            </div>
            <span className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold bg-[#00B4D8]/16 border border-[#00B4D8]/65 text-[#00B4D8] whitespace-nowrap">
              {state.appMode === AppMode.COCKPIT ? 'КОКПИТ VD' : 'ЗЕРКАЛО'}
            </span>
          </div>

          {[AppMode.COCKPIT, AppMode.MIRRORING].map((mode) => {
            const meta = APP_MODE_META[mode];
            const isSelected = state.appMode === mode;
            const tag =
              mode === AppMode.COCKPIT ? 'app_mode_cockpit_btn' : 'app_mode_mirroring_btn';
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onSetAppMode(mode)}
                data-testid={tag}
                className={`w-full min-h-[48px] rounded-xl px-3 py-2.5 border flex items-center gap-2.5 text-left transition cursor-pointer ${
                  isSelected
                    ? 'bg-[#00B4D8]/12 border-[#00B4D8]'
                    : 'bg-[#0B0E14] border-[#222938] hover:border-[#00B4D8]/40'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    isSelected ? 'border-[#00B4D8]' : 'border-[#64748B]'
                  }`}
                >
                  {isSelected && <span className="w-2 h-2 rounded-full bg-[#00B4D8]" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-[13px] ${
                      isSelected ? 'font-semibold text-[#00B4D8]' : 'font-medium text-[#F1F5F9]'
                    }`}
                  >
                    {meta.title}
                  </div>
                  <div className="text-[11px] text-[#94A3B8] mt-0.5 leading-snug">
                    {meta.subtitle}
                  </div>
                </div>
              </button>
            );
          })}

          {/* Switch: Log Packets in UI */}
          <div className="w-full min-h-[48px] rounded-xl bg-[#0B0E14] border border-[#222938] px-3 py-2 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-[#F1F5F9]">Логировать пакеты в UI</div>
              <div className="text-[11px] text-[#94A3B8] mt-0.5">
                {state.logPacketsInUi
                  ? 'Вкл — пакеты 0x0001/0x0002 пишутся в журнал (может нагружать UI)'
                  : 'Выкл — ноль лишних перерисовок UI при 30 fps и аудио PCM'}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={state.logPacketsInUi}
              onClick={() => onSetLogPacketsInUi(!state.logPacketsInUi)}
              data-testid="log_packets_ui_switch"
              className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                state.logPacketsInUi ? 'bg-[#00B4D8]' : 'bg-[#1E2636]'
              }`}
            >
              <span
                className={`block w-5 h-5 rounded-full transition-transform ${
                  state.logPacketsInUi
                    ? 'translate-x-5 bg-[#0B0E14]'
                    : 'translate-x-0 bg-[#94A3B8]'
                }`}
              />
            </button>
          </div>
        </div>

        {/* 1. Virtual Display & Status Card */}
        <div className="w-full rounded-2xl bg-[#151A24] border border-[#222938] p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[16px] font-semibold text-[#F1F5F9] flex-1">
              {sourceMode === VideoSourceMode.SCREEN_MIRRORING
                ? 'Зеркалирование экрана (MediaProjection)'
                : sourceMode === VideoSourceMode.VIRTUAL_DISPLAY
                ? 'Виртуальный экран ГУ (VirtualDisplay)'
                : 'Источник H.264: Тест-карта (Canvas)'}
            </h3>
            <span
              className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${
                proj.isRunning
                  ? 'bg-[#064E3B] text-[#10B981]'
                  : 'bg-[#1E2636] text-[#94A3B8]'
              }`}
            >
              {proj.isRunning && sourceMode === VideoSourceMode.SCREEN_MIRRORING
                ? proj.usingMediaProjection
                  ? 'MIRROR ON'
                  : 'ЖДЁТ MP'
                : proj.isRunning && sourceMode === VideoSourceMode.CANVAS_TEST_CARD
                ? 'CANVAS 30FPS'
                : proj.isRunning
                ? `VD #${proj.virtualDisplayId} АКТИВЕН`
                : sourceMode === VideoSourceMode.SCREEN_MIRRORING
                ? 'MIRROR ВЫКЛ'
                : sourceMode === VideoSourceMode.CANVAS_TEST_CARD
                ? 'CANVAS ВЫКЛ'
                : 'VD ВЫКЛ'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <StatusActionChip
              label={
                proj.isRunning && sourceMode === VideoSourceMode.SCREEN_MIRRORING
                  ? 'Mirror ON'
                  : sourceMode === VideoSourceMode.SCREEN_MIRRORING
                  ? 'Start Mirror'
                  : proj.isRunning && sourceMode === VideoSourceMode.CANVAS_TEST_CARD
                  ? 'Canvas ON'
                  : sourceMode === VideoSourceMode.CANVAS_TEST_CARD
                  ? 'Start Canvas'
                  : proj.isRunning
                  ? 'VD ON'
                  : 'Start VD'
              }
              active={proj.isRunning}
              icon={<VideocamIcon className="w-4 h-4" />}
              testTag="quick_toggle_vd_btn"
              onClick={onToggleProjection}
            />
            <StatusActionChip
              label={checklistStatus.step3AccessibilityEnabled ? 'Тач: Вкл' : 'Тач: Выкл'}
              active={checklistStatus.step3AccessibilityEnabled}
              icon={<TouchAppIcon className="w-4 h-4" />}
              testTag="quick_a11y_settings_btn"
              onClick={onToggleAccessibility}
            />
            <StatusActionChip
              label={checklistStatus.step2OverlayGranted ? 'Overlay OK' : 'Overlay'}
              active={checklistStatus.step2OverlayGranted}
              icon={<AppsGridIcon className="w-4 h-4" />}
              testTag="quick_overlay_settings_btn"
              onClick={onToggleOverlay}
            />
          </div>

          <div className="rounded-[10px] bg-[#0B0E14] border border-[#222938] px-3 py-2">
            <p
              className={`text-[12px] font-medium ${
                proj.isRunning ? 'text-[#10B981]' : 'text-[#94A3B8]'
              }`}
            >
              {vdStatusLine}
            </p>
          </div>

          {proj.isRunning && sourceMode === VideoSourceMode.CANVAS_TEST_CARD && (
            <CanvasTestCardPreview width={state.configuredWidth} height={state.configuredHeight} />
          )}

          {proj.isRunning && mediaStream && sourceMode !== VideoSourceMode.CANVAS_TEST_CARD && (
            <MediaStreamPreview stream={mediaStream} />
          )}
        </div>

        {/* 1.15 USB AOA Audio Channel 0x0003 */}
        <div
          data-testid="usb_audio_0x0003_card"
          className={`w-full rounded-2xl bg-[#151A24] border p-4 flex flex-col gap-2.5 ${
            audioStats.isCapturing ? 'border-[#10B981]/70' : 'border-[#222938]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-[16px] font-semibold text-[#F1F5F9]">
                Звук по USB AOA (канал 0x0003)
              </h3>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                48 кГц Stereo 16-bit PCM (4096B) • Звонки HFP на Bluetooth авто
              </p>
            </div>
            <span
              className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${
                audioStats.isCapturing
                  ? 'bg-[#064E3B] text-[#10B981]'
                  : !checklistStatus.step5MediaProjectionGranted
                  ? 'bg-[#451A03] text-[#F59E0B]'
                  : 'bg-[#1E2636] text-[#94A3B8]'
              }`}
            >
              {audioStats.isCapturing
                ? 'PCM 48КГЦ ON'
                : !checklistStatus.step5MediaProjectionGranted
                ? 'НЕТ ЭКРАНА'
                : 'ГОТОВ 0x0003'}
            </span>
          </div>

          <p className="text-[12px] text-[#94A3B8] leading-relaxed">
            Системный звук (Я.Музыка, Навигатор, 2ГИС, YouTube) захватывается через AudioPlaybackCapture и передаётся в канал 0x0003 (AOA 20B). Паузы тишины пропускаются.
          </p>

          <div className="rounded-[10px] bg-[#0B0E14] border border-[#222938] px-3 py-2 flex flex-col gap-0.5">
            <div
              className={`text-[12px] font-medium ${
                audioStats.isCapturing ? 'text-[#10B981]' : 'text-[#94A3B8]'
              }`}
            >
              {audioStats.statusMessage}
            </div>
            <div className="text-[11px] text-[#64748B]">
              INIT: {audioStats.sentInitPackets} • PCM: {audioStats.sentPcmPackets} пак. (
              {Math.floor(audioStats.sentPcmBytes / 1024)} КБ) • Тишина пропущена:{' '}
              {audioStats.skippedSilentPackets}
            </div>
          </div>

          <div className="w-full min-h-[48px] rounded-xl bg-[#0B0E14] border border-[#222938] px-3 py-2 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-[#F1F5F9]">
                Глушить динамик телефона при USB-звуке
              </div>
              <div
                className={`text-[11px] mt-0.5 ${
                  audioStats.isPhoneSpeakerMutedByBridge ? 'text-[#10B981]' : 'text-[#94A3B8]'
                }`}
              >
                {audioStats.isPhoneSpeakerMutedByBridge
                  ? `Динамик телефона заглушен (сохранена громкость: ${audioStats.savedPhoneMusicVolume ?? 0}); восстановится при отключении USB`
                  : 'При старте захвата 0x0003 сохраняет STREAM_MUSIC, ставит 0 и возвращает при остановке/отключении USB'}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={state.mutePhoneSpeakerDuringUsbAudio}
              onClick={() => onSetMutePhoneSpeaker(!state.mutePhoneSpeakerDuringUsbAudio)}
              data-testid="mute_speaker_usb_audio_switch"
              className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                state.mutePhoneSpeakerDuringUsbAudio ? 'bg-[#10B981]' : 'bg-[#1E2636]'
              }`}
            >
              <span
                className={`block w-5 h-5 rounded-full transition-transform ${
                  state.mutePhoneSpeakerDuringUsbAudio
                    ? 'translate-x-5 bg-[#0B0E14]'
                    : 'translate-x-0 bg-[#94A3B8]'
                }`}
              />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!checklistStatus.step5MediaProjectionGranted) {
                onRequestMediaProjection();
              } else {
                onToggleAudioCapture();
              }
            }}
            data-testid="audio_0x0003_action_btn"
            className={`w-full min-h-[48px] rounded-[10px] px-4 font-semibold text-[13px] transition cursor-pointer ${
              audioStats.isCapturing
                ? 'bg-[#1E2636] text-[#F1F5F9] border border-[#222938]'
                : 'bg-[#00B4D8] text-[#001D24] hover:brightness-110'
            }`}
          >
            {!checklistStatus.step5MediaProjectionGranted
              ? 'Выдать MediaProjection («Весь экран»)'
              : audioStats.isCapturing
              ? 'Остановить звук 0x0003 (MSG_MEDIA_STOP)'
              : 'Запустить захват звука 0x0003'}
          </button>
        </div>

        {/* 1.20 Accessibility Touch Service */}
        <div
          data-testid="accessibility_touch_service_card"
          className={`w-full rounded-2xl bg-[#151A24] border p-4 flex flex-col gap-2.5 ${
            checklistStatus.step3AccessibilityEnabled
              ? 'border-[#10B981]/70'
              : 'border-[#F59E0B]/70'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-[16px] font-semibold text-[#F1F5F9]">
                Служба тача (Спец. возможности)
              </h3>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                CarLifeAccessibilityService • Тапы, свайпы карт и Назад/Домой (канал 0x0006)
              </p>
            </div>
            <span
              className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                checklistStatus.step3AccessibilityEnabled
                  ? 'bg-[#064E3B] text-[#10B981]'
                  : 'bg-[#451A03] text-[#F59E0B]'
              }`}
            >
              {checklistStatus.step3AccessibilityEnabled ? 'Вкл' : 'Выкл'}
            </span>
          </div>

          <p className="text-[12px] text-[#94A3B8] leading-relaxed">
            Переводит касания с экрана ГУ (1280×720) в реальные координаты смартфона с учётом ориентации и выполняет тапы (50 мс) и свайпы карт в любых приложениях (2ГИС, Яндекс.Навигатор, YouTube).
          </p>

          <button
            type="button"
            onClick={onToggleAccessibility}
            data-testid="enable_accessibility_touch_btn"
            className={`w-full min-h-[48px] rounded-[10px] px-4 flex items-center justify-center gap-2 font-semibold text-[13px] transition cursor-pointer ${
              checklistStatus.step3AccessibilityEnabled
                ? 'bg-[#1E2636] text-[#F1F5F9] border border-[#222938]'
                : 'bg-[#00B4D8] text-[#001D24] hover:brightness-110'
            }`}
          >
            <TouchAppIcon className="w-[18px] h-[18px]" />
            <span>
              {checklistStatus.step3AccessibilityEnabled
                ? 'Служба тача активна (Настройки)'
                : 'Включить службу тача (Спец. возможности)'}
            </span>
          </button>
        </div>

        {/* 1.25 Video Source Switcher */}
        <div
          data-testid="video_source_card"
          className="w-full rounded-2xl bg-[#151A24] border border-[#10B981]/70 p-4 flex flex-col gap-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-[16px] font-semibold text-[#F1F5F9]">Источник видео</h3>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                Выбор входа для H.264 MediaCodec (1280×720@30fps, 2000 kbps, AOA 20B)
              </p>
            </div>
            <span className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold bg-[#10B981]/16 border border-[#10B981]/65 text-[#10B981] whitespace-nowrap">
              {sourceMode === VideoSourceMode.SCREEN_MIRRORING
                ? 'MIRROR'
                : sourceMode === VideoSourceMode.VIRTUAL_DISPLAY
                ? 'VD'
                : 'CANVAS'}
            </span>
          </div>

          {[
            VideoSourceMode.SCREEN_MIRRORING,
            VideoSourceMode.VIRTUAL_DISPLAY,
            VideoSourceMode.CANVAS_TEST_CARD,
          ].map((mode) => {
            const meta = VIDEO_SOURCE_META[mode];
            const isSelected = sourceMode === mode;
            const tag =
              mode === VideoSourceMode.SCREEN_MIRRORING
                ? 'video_source_mirror_btn'
                : mode === VideoSourceMode.VIRTUAL_DISPLAY
                ? 'video_source_vd_btn'
                : 'video_source_canvas_btn';
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onSetVideoSourceMode(mode)}
                data-testid={tag}
                className={`w-full min-h-[48px] rounded-xl px-3 py-2.5 border flex items-center gap-2.5 text-left transition cursor-pointer ${
                  isSelected
                    ? 'bg-[#10B981]/12 border-[#10B981]'
                    : 'bg-[#0B0E14] border-[#222938] hover:border-[#10B981]/40'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    isSelected ? 'border-[#10B981]' : 'border-[#64748B]'
                  }`}
                >
                  {isSelected && <span className="w-2 h-2 rounded-full bg-[#10B981]" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-[13px] ${
                      isSelected ? 'font-semibold text-[#10B981]' : 'font-medium text-[#F1F5F9]'
                    }`}
                  >
                    {meta.title}
                  </div>
                  <div className="text-[11px] text-[#94A3B8] mt-0.5 leading-snug">
                    {meta.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* 1.35 App Launch Mode */}
        <div
          data-testid="app_launch_mode_card"
          className="w-full rounded-2xl bg-[#151A24] border border-[#00B4D8]/70 p-4 flex flex-col gap-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-[16px] font-semibold text-[#F1F5F9]">Режим запуска приложений</h3>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                При SecurityException на VD выполняется мгновенный запасной запуск без ActivityOptions
              </p>
            </div>
            <span className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold bg-[#00B4D8]/16 border border-[#00B4D8]/65 text-[#00B4D8] whitespace-nowrap">
              {state.appLaunchMode === AppLaunchMode.VIRTUAL_DISPLAY_IF_AVAILABLE
                ? 'VD'
                : 'MIRROR'}
            </span>
          </div>

          {[AppLaunchMode.VIRTUAL_DISPLAY_IF_AVAILABLE, AppLaunchMode.SCREEN_MIRRORING].map(
            (mode) => {
              const meta = APP_LAUNCH_MODE_META[mode];
              const isSelected = state.appLaunchMode === mode;
              const tag =
                mode === AppLaunchMode.VIRTUAL_DISPLAY_IF_AVAILABLE
                  ? 'launch_mode_vd_btn'
                  : 'launch_mode_mirror_btn';
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onSetAppLaunchMode(mode)}
                  data-testid={tag}
                  className={`w-full min-h-[48px] rounded-xl px-3 py-2.5 border flex items-center gap-2.5 text-left transition cursor-pointer ${
                    isSelected
                      ? 'bg-[#00B4D8]/12 border-[#00B4D8]'
                      : 'bg-[#0B0E14] border-[#222938] hover:border-[#00B4D8]/40'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      isSelected ? 'border-[#00B4D8]' : 'border-[#64748B]'
                    }`}
                  >
                    {isSelected && <span className="w-2 h-2 rounded-full bg-[#00B4D8]" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-[13px] ${
                        isSelected ? 'font-semibold text-[#00B4D8]' : 'font-medium text-[#F1F5F9]'
                      }`}
                    >
                      {meta.title}
                    </div>
                    <div className="text-[11px] text-[#94A3B8] mt-0.5 leading-snug">
                      {meta.subtitle}
                    </div>
                  </div>
                </button>
              );
            }
          )}
        </div>

        {/* 1.5 Handshake Lab 0x0001 */}
        <div
          data-testid="handshake_lab_card"
          className="w-full rounded-2xl bg-[#151A24] border border-[#00B4D8]/70 p-4 flex flex-col gap-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-[16px] font-semibold text-[#F1F5F9]">Тест рукопожатия 0x0001</h3>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                Режим ответа на MSG_CMD_HU_PROTOCOL_VERSION (0x00018001) от ГУ Jetta VS7
              </p>
            </div>
            <span className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold bg-[#00B4D8]/16 border border-[#00B4D8]/65 text-[#00B4D8] whitespace-nowrap">
              ТЕСТ {state.handshakeTestProfileId}/4
            </span>
          </div>

          {HANDSHAKE_TEST_PROFILES.map((profile) => {
            const isSelected = state.handshakeTestProfileId === profile.id;
            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => onSetHandshakeProfile(profile.id)}
                data-testid={`handshake_profile_${profile.id}_btn`}
                className={`w-full min-h-[48px] rounded-xl px-3 py-2.5 border flex items-center gap-2.5 text-left transition cursor-pointer ${
                  isSelected
                    ? 'bg-[#00B4D8]/12 border-[#00B4D8]'
                    : 'bg-[#0B0E14] border-[#222938] hover:border-[#00B4D8]/40'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    isSelected ? 'border-[#00B4D8]' : 'border-[#64748B]'
                  }`}
                >
                  {isSelected && <span className="w-2 h-2 rounded-full bg-[#00B4D8]" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-[13px] ${
                      isSelected ? 'font-semibold text-[#00B4D8]' : 'font-medium text-[#F1F5F9]'
                    }`}
                  >
                    {profile.shortTitle}
                  </div>
                  <div className="text-[11px] text-[#94A3B8] mt-0.5 leading-snug">
                    {profile.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* 2. Video H.264 Stream Parameters */}
        <div className="w-full rounded-2xl bg-[#151A24] border border-[#222938] p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[16px] font-semibold text-[#F1F5F9] flex-1">
              Параметры видеопотока H.264
            </h3>
            <span className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium bg-[#1E2636] border border-[#222938] text-[#00B4D8] whitespace-nowrap">
              Baseline CBR • 30fps • I=1s
            </span>
          </div>

          <p className="text-[12px] text-[#94A3B8]">
            Разрешение виртуального дисплея, Presentation и кодека (1280×720 • 160 dpi по умолчанию)
          </p>

          <div className="grid grid-cols-3 gap-2">
            <SelectableOptionButton
              label="800 × 480"
              selected={state.configuredWidth === 800}
              testTag="res_480p_btn"
              onClick={() => onSelectResolution(800, 480)}
            />
            <SelectableOptionButton
              label="1024 × 600"
              selected={state.configuredWidth === 1024}
              testTag="res_600p_btn"
              onClick={() => onSelectResolution(1024, 600)}
            />
            <SelectableOptionButton
              label="1280 × 720"
              selected={state.configuredWidth === 1280}
              testTag="res_720p_btn"
              onClick={() => onSelectResolution(1280, 720)}
            />
          </div>

          <p className="text-[12px] text-[#94A3B8]">
            Битрейт кодека (AVCProfileBaseline CBR, 30fps, I=1s, 2.0 Мбит/с по умолчанию)
          </p>

          <div className="grid grid-cols-3 gap-2">
            <SelectableOptionButton
              label="800 кбит/с"
              selected={state.configuredBitrateBps === 800_000}
              testTag="bitrate_2m_btn"
              onClick={() => onSelectBitrate(800)}
            />
            <SelectableOptionButton
              label="1.2 Мбит/с"
              selected={state.configuredBitrateBps === 1_200_000}
              testTag="bitrate_4m_btn"
              onClick={() => onSelectBitrate(1200)}
            />
            <SelectableOptionButton
              label="2.0 Мбит/с"
              selected={state.configuredBitrateBps === 2_000_000}
              testTag="bitrate_6m_btn"
              onClick={() => onSelectBitrate(2000)}
            />
          </div>

          <p className="text-[12px] text-[#94A3B8]">
            Формат шапки видеоканала 0x0002 (Режим 1: AOA 20B с 0x00020001 по умолчанию)
          </p>

          <div className="flex items-center gap-2">
            <SelectableOptionButton
              label="Режим 1: AOA 20B (0x00020001)"
              selected={state.useNestedVideoMsgHeader}
              testTag="toggle_video_header_mode_btn"
              onClick={() => onSetVideoHeaderMode(true)}
              className="flex-[1.25]"
            />
            <SelectableOptionButton
              label="Режим 2: Direct 12B"
              selected={!state.useNestedVideoMsgHeader}
              testTag="video_header_legacy_12b_btn"
              onClick={() => onSetVideoHeaderMode(false)}
              className="flex-1"
            />
          </div>
        </div>

        {/* 2.5 Jetta VS7 Fixed Profile */}
        <div
          data-testid="auto_test_card"
          className="w-full rounded-2xl bg-[#151A24] border border-[#10B981] p-4 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-[16px] font-semibold text-[#F1F5F9]">
                Профиль Jetta VS7 (AOA 20B 0x00020001 + Audio Init)
              </h3>
              <p className="text-[11px] text-[#94A3B8] mt-1 leading-relaxed">
                После 0x00018001 / 0x00018003 отправляются MATCH_STATUS (0x00010002), полный MD_INFO (0x00010004), Audio-Init (0x0003, 0x0004), INIT_DONE (0x00010008), SCREEN_ON (0x00010018), USERPRESENT (0x0001001A), FOREGROUND (0x0001001B), REQ_FG (0x00010038) и видеопоток 0x0002 (AOA 20B 0x00020001, единый пакет SPS+PPS+IDR, при простое &gt;200 мс — HEARTBEAT 0x00020002).
              </p>
            </div>
            <span className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold bg-[#064E3B] border border-[#10B981] text-[#10B981] whitespace-nowrap">
              JETTA VS7
            </span>
          </div>

          <div className="rounded-[10px] bg-[#10B981]/12 border border-[#10B981]/65 px-3 py-2 text-[12px] font-medium text-[#10B981]">
            {state.autoTestState.statusMessage}
          </div>

          <button
            type="button"
            onClick={onStartJettaVs7Vd}
            data-testid="start_auto_test_btn"
            className="w-full min-h-[48px] rounded-xl px-4 bg-[#00B4D8] text-[#001D24] font-semibold text-[13px] flex items-center justify-center gap-2 hover:brightness-110 transition cursor-pointer"
          >
            <CheckCircleIcon className="w-[18px] h-[18px] shrink-0" />
            <span className="truncate">Стартовать VD (1280×720 • 2.0 Мбит/с • 160 dpi)</span>
          </button>
        </div>

        {/* 3. Expandable Engineering Diagnostics (AOA & Protocol Lab) */}
        <div className="w-full rounded-2xl bg-[#151A24] border border-[#222938] p-4 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setDiagnosticsExpanded((v) => !v)}
            data-testid="toggle_engineering_diagnostics_btn"
            className="w-full rounded-[10px] py-1 flex items-center justify-between gap-2 text-left cursor-pointer hover:opacity-90"
          >
            <div className="flex-1 min-w-0">
              <h3 className="text-[16px] font-semibold text-[#F1F5F9]">
                Инженерная диагностика (AOA &amp; Protocol Lab)
              </h3>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                Статистика USB AOA, счетчики каналов 0x0001..0x0006 и генератор тестовых пакетов
              </p>
            </div>
            {diagnosticsExpanded ? (
              <ChevronUpIcon className="w-6 h-6 text-[#00B4D8] shrink-0" />
            ) : (
              <ChevronDownIcon className="w-6 h-6 text-[#00B4D8] shrink-0" />
            )}
          </button>

          {diagnosticsExpanded && (
            <div className="flex flex-col gap-3 pt-1">
              {/* Projection Engine Card */}
              <div className="rounded-[14px] bg-[#1E2636] border border-[#222938] p-3 flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-[#F1F5F9]">
                    {sourceMode === VideoSourceMode.SCREEN_MIRRORING
                      ? 'Конвейер Зеркалирование экрана (MediaProjection) + H.264'
                      : sourceMode === VideoSourceMode.VIRTUAL_DISPLAY
                      ? 'Конвейер VirtualDisplay + H.264'
                      : 'Конвейер Тест-карта (Canvas) + H.264'}
                  </span>
                  <span className="text-[11px] font-medium text-[#00B4D8] shrink-0">
                    {proj.spsPpsConfigured ? 'SPS/PPS LOCKED' : 'AVC Baseline'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <MetricPill
                    label="H.264 NALS"
                    value={`${proj.encodedNalFrames}`}
                    subValue={`${Math.floor(proj.encodedBytes / 1024)} KiB`}
                  />
                  <MetricPill
                    label="TOUCH INJECT"
                    value={`${proj.injectedTouches}`}
                    subValue={
                      sourceMode === VideoSourceMode.SCREEN_MIRRORING
                        ? 'MIRROR A11Y'
                        : sourceMode === VideoSourceMode.CANVAS_TEST_CARD
                        ? 'CANVAS'
                        : `VD #${proj.virtualDisplayId}`
                    }
                  />
                  <MetricPill
                    label="SURFACE"
                    value={`${state.configuredWidth}×${state.configuredHeight}`}
                    subValue={`${proj.fps} FPS`}
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {!proj.isRunning ? (
                    <button
                      type="button"
                      onClick={onToggleProjection}
                      data-testid="start_projection_btn"
                      className="flex-1 h-10 rounded-[10px] bg-[#00B4D8] text-[#001D24] font-semibold text-[12px] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <PlayArrowIcon className="w-[18px] h-[18px]" />
                      <span>
                        {sourceMode === VideoSourceMode.SCREEN_MIRRORING
                          ? 'Запустить Зеркалирование (MediaProjection)'
                          : sourceMode === VideoSourceMode.VIRTUAL_DISPLAY
                          ? 'Запустить VirtualDisplay + H.264'
                          : 'Запустить Тест-карту (Canvas) + H.264'}
                      </span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onInjectTouch(120, 180)}
                        data-testid="inject_touch_dock_btn"
                        className="flex-1 h-10 rounded-[10px] bg-[#151A24] border border-[#222938] text-[#F1F5F9] text-[12px] font-medium hover:border-[#00B4D8]/50 cursor-pointer"
                      >
                        Тест тача (Док)
                      </button>
                      <button
                        type="button"
                        onClick={() => onInjectTouch(680, 360)}
                        data-testid="inject_touch_launcher_btn"
                        className="flex-1 h-10 rounded-[10px] bg-[#151A24] border border-[#222938] text-[#F1F5F9] text-[12px] font-medium hover:border-[#00B4D8]/50 cursor-pointer"
                      >
                        Тест тача (Сетка)
                      </button>
                      <button
                        type="button"
                        onClick={onToggleProjection}
                        data-testid="stop_projection_btn"
                        className="h-10 px-4 rounded-[10px] border border-[#222938] bg-[#151A24] text-[#EF4444] text-[12px] font-semibold cursor-pointer"
                      >
                        Стоп
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Transport Controls Card */}
              <div className="rounded-[14px] bg-[#1E2636] border border-[#222938] p-3 flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-[#F1F5F9]">Транспорт USB AOA</span>
                  <span className="text-[11px] font-medium text-[#10B981]">
                    {state.wakeLockHeld ? 'WakeLock: ACTIVE' : 'DirectBufferPool'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <MetricPill
                    label="RX КАДРЫ"
                    value={`${state.rxFrames}`}
                    subValue={`${state.rxBytes} B`}
                  />
                  <MetricPill
                    label="TX КАДРЫ"
                    value={`${state.txFrames}`}
                    subValue={`${state.txBytes} B`}
                  />
                  <MetricPill
                    label="СТАТУС"
                    value={state.controlSession.phase.slice(0, 8)}
                    subValue={`${state.controlSession.negotiatedFps} FPS`}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onScanAndAttachUsb}
                    data-testid="scan_connect_usb_button"
                    className="flex-1 h-10 rounded-[10px] bg-[#00B4D8] text-[#001D24] font-semibold text-[12px] flex items-center justify-center gap-1.5 hover:brightness-110 cursor-pointer"
                  >
                    <RefreshIcon className="w-[18px] h-[18px]" />
                    <span>Scan &amp; Attach USB AOA</span>
                  </button>

                  {state.isServiceRunning && (
                    <button
                      type="button"
                      onClick={onStopBridge}
                      data-testid="stop_bridge_button"
                      className="h-10 px-3.5 rounded-[10px] border border-[#222938] bg-[#151A24] text-[#EF4444] text-[12px] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <StopIcon className="w-4 h-4" />
                      <span>Стоп</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Channel Multiplexer Grid */}
              <div className="rounded-[14px] bg-[#1E2636] border border-[#222938] p-3 flex flex-col gap-2">
                <div className="text-[13px] font-semibold text-[#F1F5F9]">
                  Каналы мультиплексора CarLife (0x0001 .. 0x0006)
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {CARLIFE_CHANNELS.map((ch) => {
                    const count = state.channelFrameCounts[ch.id] ?? 0;
                    const badgeColor = ch.hasTimestampHeader ? '#10B981' : '#00B4D8';
                    return (
                      <div
                        key={ch.id}
                        className="rounded-[10px] bg-[#151A24] border border-[#222938] p-2.5 flex flex-col"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className="font-mono-jetbrains text-[11px] font-medium"
                            style={{ color: badgeColor }}
                          >
                            {formatHex16(ch.id)}
                          </span>
                          <span className="font-mono-jetbrains text-[10px] text-[#64748B]">
                            {ch.headerSizeBytes}B HDR
                          </span>
                        </div>
                        <div className="text-[13px] font-semibold text-[#F1F5F9] mt-0.5 truncate">
                          {ch.label}
                        </div>
                        <div
                          className="text-[11px]"
                          style={{ color: count > 0 ? badgeColor : '#94A3B8' }}
                        >
                          {count} пакетов
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Protocol Lab Test Vectors */}
              <div className="rounded-[14px] bg-[#1E2636] border border-[#222938] p-3 flex flex-col gap-2.5">
                <div className="text-[13px] font-semibold text-[#00B4D8]">
                  Тестовые векторы протокола Baidu CarLife
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLogTab(0);
                      onRunLoopbackVector('handshake');
                    }}
                    data-testid="test_control_frame_btn"
                    className="rounded-[10px] bg-[#151A24] border border-[#222938] hover:border-[#00B4D8]/60 p-2.5 flex items-center gap-2 text-left cursor-pointer"
                  >
                    <MemoryIcon className="w-5 h-5 text-[#00B4D8] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold text-[#F1F5F9] truncate">
                        1. Handshake
                      </div>
                      <div className="text-[10px] text-[#94A3B8] truncate">
                        HU v2.0 + Video Init
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLogTab(1);
                      onRunLoopbackVector('video');
                    }}
                    data-testid="test_video_frame_btn"
                    className="rounded-[10px] bg-[#151A24] border border-[#222938] hover:border-[#10B981]/60 p-2.5 flex items-center gap-2 text-left cursor-pointer"
                  >
                    <VideocamIcon className="w-5 h-5 text-[#10B981] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold text-[#F1F5F9] truncate">
                        2. Video (0x0002)
                      </div>
                      <div className="text-[10px] text-[#94A3B8] truncate">
                        H.264 SPS/PPS + IDR
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLogTab(0);
                      onRunLoopbackVector('touch');
                    }}
                    data-testid="test_touch_frame_btn"
                    className="rounded-[10px] bg-[#151A24] border border-[#222938] hover:border-[#F59E0B]/60 p-2.5 flex items-center gap-2 text-left cursor-pointer"
                  >
                    <TouchAppIcon className="w-5 h-5 text-[#F59E0B] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold text-[#F1F5F9] truncate">
                        3. Touch Scale
                      </div>
                      <div className="text-[10px] text-[#94A3B8] truncate">
                        1280x720 -&gt; 1920x1080
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLogTab(0);
                      onRunLoopbackVector('hardkey');
                    }}
                    data-testid="test_audio_frame_btn"
                    className="rounded-[10px] bg-[#151A24] border border-[#222938] hover:border-[#38BDF8]/60 p-2.5 flex items-center gap-2 text-left cursor-pointer"
                  >
                    <GraphicEqIcon className="w-5 h-5 text-[#38BDF8] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold text-[#F1F5F9] truncate">
                        4. HardKey
                      </div>
                      <div className="text-[10px] text-[#94A3B8] truncate">
                        Steering Wheel NEXT
                      </div>
                    </div>
                  </button>
                </div>

                <div className="rounded-[10px] bg-[#0B0E14] border border-[#222938] p-2.5 font-mono-jetbrains text-[11px] text-[#F1F5F9] whitespace-pre-wrap break-words leading-relaxed">
                  {lastDecodedBreakdown}
                </div>
              </div>

              {/* Binary Packet Log Header + Filter Tabs */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[13px] font-semibold text-[#00B4D8]">
                  Журнал бинарных пакетов
                </span>
                <button
                  type="button"
                  onClick={onClearLogs}
                  aria-label="Очистить логи"
                  data-testid="clear_logs_button"
                  className="p-2 rounded-lg text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#1E2636] cursor-pointer"
                >
                  <ClearAllIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <SelectableOptionButton
                  label={`Команды 0x0001 & 0x0006 (${state.commandPacketLogs.length})`}
                  selected={selectedLogTab === 0}
                  testTag="filter_rx_commands_chip"
                  onClick={() => setSelectedLogTab(0)}
                  className="flex-[1.25]"
                />
                <SelectableOptionButton
                  label={`Видеопоток 0x0002 (${state.videoPacketLogs.length})`}
                  selected={selectedLogTab === 1}
                  testTag="filter_all_packets_chip"
                  onClick={() => setSelectedLogTab(1)}
                  className="flex-[0.95]"
                />
              </div>

              {selectedLogTab === 1 && (
                <div className="rounded-xl bg-[#1E2636] border border-[#222938] p-3 flex flex-col gap-1">
                  <div className="text-[12px] font-semibold text-[#10B981]">
                    Статистика видеоканала 0x0002 •{' '}
                    {state.useNestedVideoMsgHeader
                      ? 'Режим 1: AOA 20B (8B AOA + 12B 0x00020001)'
                      : 'Режим 2: Direct 12B ([0x0002][nalSize][ts])'}
                  </div>
                  <div className="font-mono-jetbrains text-[11px] text-[#94A3B8]">
                    {state.isVideoChannelReadyForStreaming
                      ? 'Шлюз 0x0002: ОТКРЫТ (поток 0x0002 активен)'
                      : 'Шлюз 0x0002: ЗАКРЫТ (ожидание 0x00018001 / 0x00018007 от ГУ)'}{' '}
                    • Кадров 0x0002: {state.channelFrameCounts[CarLifeChannelId.VIDEO] ?? 0} • Кодек:{' '}
                    {proj.width}×{proj.height}@{proj.fps}fps ({state.configuredBitrateBps / 1000} kbps) •
                    IDR: {proj.lastIdrBytes}B
                  </div>
                </div>
              )}

              {/* Log Entries */}
              {displayedLogs.length === 0 ? (
                <div className="rounded-xl bg-[#1E2636] border border-[#222938] p-4 text-center text-[12px] text-[#64748B]">
                  Пакеты ещё не записаны. Запустите тестовый вектор выше или подключите USB AOA.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {displayedLogs.map((entry) => (
                    <PacketLogItemCard key={entry.id} entry={entry} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
