import React, { useEffect, useMemo, useState } from 'react';
import {
  CockpitMediaState,
  COCKPIT_INSTALLED_APPS,
  InstalledAppInfo,
} from '../store/bridgeStore';
import {
  ArrowBackIcon,
  HomeIcon,
  PauseIcon,
  PlayArrowIcon,
  RefreshIcon,
  SkipNextIcon,
  SkipPreviousIcon,
} from './CockpitIcons';

interface CarLifeAppLauncherScreenProps {
  virtualDisplayId: number;
  a11yEnabled: boolean;
  mediaState: CockpitMediaState;
  lastLaunchStatus: string;
  onPlayPause: () => void;
  onNextTrack: () => void;
  onPreviousTrack: () => void;
  onRequestNotificationAccess: () => void;
  onHomePressed: () => void;
  onBackPressed: () => void;
  onLaunchApp: (app: InstalledAppInfo) => void;
}

function formatCurrentTime(): string {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

interface DockCompactMediaPlayerProps {
  mediaState: CockpitMediaState;
  onPlayPause: () => void;
  onNextTrack: () => void;
  onPreviousTrack: () => void;
  onRequestNotificationAccess: () => void;
}

const DockCompactMediaPlayer: React.FC<DockCompactMediaPlayerProps> = ({
  mediaState,
  onPlayPause,
  onNextTrack,
  onPreviousTrack,
  onRequestNotificationAccess,
}) => {
  const progressPct =
    mediaState.durationMs > 0
      ? Math.min(100, Math.max(0, (mediaState.positionMs / mediaState.durationMs) * 100))
      : 0;

  return (
    <div className="w-full rounded-[14px] bg-[#1E2636] border border-[#222938] p-2.5 flex flex-col gap-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-10 h-10 shrink-0 rounded-lg overflow-hidden border border-[#222938] bg-gradient-to-br from-[#1E2636] to-[#0B0E14] flex items-center justify-center">
          <img
            src="/assets/carlife_hero.jpg"
            alt="Album Art"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] leading-tight font-medium text-[#00B4D8] truncate">
            {mediaState.playerAppTitle}
          </div>
          <div className="text-[13px] leading-tight font-semibold text-[#F1F5F9] truncate">
            {mediaState.trackTitle}
          </div>
          <div className="text-[11px] leading-tight text-[#94A3B8] truncate">
            {mediaState.artistName}
          </div>
        </div>
      </div>

      {!mediaState.hasNotificationAccess && (
        <button
          type="button"
          onClick={onRequestNotificationAccess}
          data-testid="grant_media_notif_btn"
          className="w-full rounded-lg bg-[#451A03] text-[#F59E0B] text-[11px] font-medium py-1.5 px-2 text-center hover:brightness-110 transition cursor-pointer"
        >
          Доступ к уведомлениям плеера
        </button>
      )}

      <div className="w-full h-[3px] rounded-sm bg-[#0B0E14] overflow-hidden">
        <div
          className="h-full bg-[#00B4D8] transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="flex items-center justify-evenly pt-0.5">
        <button
          type="button"
          onClick={onPreviousTrack}
          aria-label="Previous Track"
          data-testid="media_prev_button"
          className="w-11 h-11 rounded-full bg-[#151A24] text-[#F1F5F9] flex items-center justify-center hover:bg-[#222938] active:scale-95 transition cursor-pointer"
        >
          <SkipPreviousIcon className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={onPlayPause}
          aria-label="Play or Pause"
          data-testid="media_play_pause_button"
          className="w-11 h-11 rounded-full bg-[#00B4D8] text-[#001D24] flex items-center justify-center hover:brightness-110 active:scale-95 transition cursor-pointer"
        >
          {mediaState.isPlaying ? (
            <PauseIcon className="w-6 h-6" />
          ) : (
            <PlayArrowIcon className="w-6 h-6" />
          )}
        </button>
        <button
          type="button"
          onClick={onNextTrack}
          aria-label="Next Track"
          data-testid="media_next_button"
          className="w-11 h-11 rounded-full bg-[#151A24] text-[#F1F5F9] flex items-center justify-center hover:bg-[#222938] active:scale-95 transition cursor-pointer"
        >
          <SkipNextIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export const CarLifeAppLauncherScreen: React.FC<CarLifeAppLauncherScreenProps> = ({
  virtualDisplayId,
  a11yEnabled,
  mediaState,
  lastLaunchStatus,
  onPlayPause,
  onNextTrack,
  onPreviousTrack,
  onRequestNotificationAccess,
  onHomePressed,
  onBackPressed,
  onLaunchApp,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<0 | 1>(0);
  const [currentTime, setCurrentTime] = useState<string>(() => formatCurrentTime());
  const [refreshPulse, setRefreshPulse] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      setCurrentTime(formatCurrentTime());
    }, 10_000);
    return () => window.clearInterval(id);
  }, []);

  const filteredApps = useMemo(() => {
    if (selectedFilter === 1) {
      const priority = COCKPIT_INSTALLED_APPS.filter((a) => a.isAutomotivePriority);
      return priority.length > 0 ? priority : COCKPIT_INSTALLED_APPS;
    }
    return COCKPIT_INSTALLED_APPS;
  }, [selectedFilter]);

  const handleHome = () => {
    setSelectedFilter(0);
    onHomePressed();
  };

  const handleRefresh = () => {
    setRefreshPulse(true);
    window.setTimeout(() => setRefreshPulse(false), 350);
  };

  const isVdActive = virtualDisplayId !== 0;

  return (
    <div className="h-full w-full p-2.5 flex flex-col md:flex-row gap-2.5 overflow-hidden bg-[#0B0E14]">
      {/* Desktop / Wide Left Side Dock */}
      <aside className="hidden md:flex md:w-[210px] lg:w-[240px] shrink-0 rounded-2xl bg-[#151A24] border border-[#222938] p-3 flex-col justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[28px] leading-none font-semibold text-[#F1F5F9] tracking-tight">
              {currentTime}
            </span>
            <div
              className={`rounded-lg px-2 py-1 border border-[#222938] flex items-center gap-1.5 ${
                isVdActive ? 'bg-[#064E3B]' : 'bg-[#1E2636]'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  a11yEnabled ? 'bg-[#10B981]' : 'bg-[#F59E0B]'
                }`}
              />
              <span
                className={`text-[11px] font-semibold ${
                  isVdActive ? 'text-[#10B981]' : 'text-[#00B4D8]'
                }`}
              >
                {isVdActive ? `VD #${virtualDisplayId}` : 'КОКПИТ'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleHome}
              data-testid="dock_home_button"
              className="h-12 rounded-xl bg-[#1E2636] border border-[#222938] px-2 flex items-center justify-center gap-1.5 hover:border-[#00B4D8]/60 active:scale-[0.98] transition cursor-pointer"
            >
              <HomeIcon className="w-[18px] h-[18px] text-[#00B4D8] shrink-0" />
              <span className="text-[13px] font-medium text-[#F1F5F9] truncate">Домой</span>
            </button>
            <button
              type="button"
              onClick={onBackPressed}
              data-testid="dock_back_button"
              className="h-12 rounded-xl bg-[#1E2636] border border-[#222938] px-2 flex items-center justify-center gap-1.5 hover:border-[#00B4D8]/60 active:scale-[0.98] transition cursor-pointer"
            >
              <ArrowBackIcon className="w-[18px] h-[18px] text-[#F1F5F9] shrink-0" />
              <span className="text-[13px] font-medium text-[#F1F5F9] truncate">Назад</span>
            </button>
          </div>
        </div>

        <DockCompactMediaPlayer
          mediaState={mediaState}
          onPlayPause={onPlayPause}
          onNextTrack={onNextTrack}
          onPreviousTrack={onPreviousTrack}
          onRequestNotificationAccess={onRequestNotificationAccess}
        />
      </aside>

      {/* Mobile / Narrow Top Compact Dock */}
      <div className="flex md:hidden flex-col gap-2 rounded-2xl bg-[#151A24] border border-[#222938] p-3 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleHome}
            data-testid="dock_home_button_mobile"
            className="flex-1 h-12 rounded-xl bg-[#1E2636] border border-[#222938] px-2 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <HomeIcon className="w-[18px] h-[18px] text-[#00B4D8]" />
            <span className="text-[13px] font-medium text-[#F1F5F9]">Домой</span>
          </button>
          <button
            type="button"
            onClick={onBackPressed}
            data-testid="dock_back_button_mobile"
            className="flex-1 h-12 rounded-xl bg-[#1E2636] border border-[#222938] px-2 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ArrowBackIcon className="w-[18px] h-[18px] text-[#F1F5F9]" />
            <span className="text-[13px] font-medium text-[#F1F5F9]">Назад</span>
          </button>
          <div
            className={`rounded-[10px] px-2.5 py-2 text-[11px] font-semibold shrink-0 ${
              a11yEnabled ? 'bg-[#064E3B] text-[#10B981]' : 'bg-[#451A03] text-[#F59E0B]'
            }`}
          >
            {isVdActive ? `VD #${virtualDisplayId}` : a11yEnabled ? 'Touch ON' : 'Touch OFF'}
          </div>
        </div>

        <DockCompactMediaPlayer
          mediaState={mediaState}
          onPlayPause={onPlayPause}
          onNextTrack={onNextTrack}
          onPreviousTrack={onPreviousTrack}
          onRequestNotificationAccess={onRequestNotificationAccess}
        />
      </div>

      {/* Right / Main Panel: Installed Apps Grid */}
      <section className="flex-1 min-h-0 rounded-2xl bg-[#151A24] border border-[#222938] p-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedFilter(0)}
              data-testid="filter_all_apps_chip"
              className={`h-9 px-3 rounded-lg text-[12px] font-medium border transition cursor-pointer ${
                selectedFilter === 0
                  ? 'bg-[#00B4D8]/18 border-[#00B4D8] text-[#00B4D8] font-semibold'
                  : 'bg-[#1E2636] border-[#222938] text-[#94A3B8] hover:text-[#F1F5F9]'
              }`}
            >
              Все ({COCKPIT_INSTALLED_APPS.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter(1)}
              data-testid="filter_auto_apps_chip"
              className={`h-9 px-3 rounded-lg text-[12px] font-medium border transition cursor-pointer ${
                selectedFilter === 1
                  ? 'bg-[#00B4D8]/18 border-[#00B4D8] text-[#00B4D8] font-semibold'
                  : 'bg-[#1E2636] border-[#222938] text-[#94A3B8] hover:text-[#F1F5F9]'
              }`}
            >
              Навигация и Медиа
            </button>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            aria-label="Обновить список приложений"
            data-testid="refresh_apps_button"
            className="w-10 h-10 rounded-lg flex items-center justify-center text-[#00B4D8] hover:bg-[#1E2636] transition cursor-pointer shrink-0"
          >
            <RefreshIcon className={`w-5 h-5 ${refreshPulse ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* App Launch Status Strip */}
        <div className="rounded-lg bg-[#0B0E14] border border-[#222938] px-3 py-1.5 text-[11px] text-[#94A3B8] truncate shrink-0">
          <span className="text-[#10B981] font-medium mr-1.5">●</span>
          {lastLaunchStatus}
        </div>

        {/* Responsive Grid (96px min tile width, 100px tile height) */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
            {filteredApps.map((app) => (
              <button
                key={`${app.packageName}/${app.activityName}`}
                type="button"
                onClick={() => onLaunchApp(app)}
                className="h-[100px] rounded-[14px] bg-[#1E2636] border border-[#222938] hover:border-[#00B4D8]/70 hover:bg-[#242D40] active:scale-[0.97] p-2 flex flex-col items-center justify-center gap-2 transition cursor-pointer"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-[13px] tracking-tight border border-white/10 shadow-inner shrink-0"
                  style={{
                    backgroundColor: `${app.accentColor}22`,
                    color: app.accentColor,
                  }}
                >
                  {app.badgeText}
                </div>
                <span className="text-[12px] leading-tight text-[#F1F5F9] font-medium truncate w-full text-center">
                  {app.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
