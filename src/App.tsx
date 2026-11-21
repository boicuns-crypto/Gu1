import React, { useState, useSyncExternalStore } from 'react';
import { CarLifeAppLauncherScreen } from './components/CarLifeAppLauncherScreen';
import { AppsGridIcon, CheckCircleIcon, SettingsIcon } from './components/CockpitIcons';
import { OnboardingChecklistScreen } from './components/OnboardingChecklistScreen';
import { UnifiedSettingsAndDiagnosticsScreen } from './components/UnifiedSettingsAndDiagnosticsScreen';
import { bridgeController } from './store/bridgeStore';

type TabIndex = 0 | 1 | 2;

export function App() {
  const [selectedTab, setSelectedTab] = useState<TabIndex>(0);
  const snapshot = useSyncExternalStore(
    bridgeController.subscribe,
    bridgeController.getSnapshot
  );

  const {
    runtimeState,
    checklistStatus,
    mediaState,
    lastLaunchStatus,
    lastDecodedBreakdown,
    mediaStream,
  } = snapshot;

  const navItems: Array<{
    id: TabIndex;
    label: string;
    railLabel: string;
    icon: React.ReactNode;
    testTag: string;
  }> = [
    {
      id: 0,
      label: 'Лаунчер ГУ',
      railLabel: 'Лаунчер',
      icon: <AppsGridIcon className="w-[22px] h-[22px]" />,
      testTag: 'nav_tab_launcher',
    },
    {
      id: 1,
      label: 'Подключение',
      railLabel: 'Чек-лист',
      icon: <CheckCircleIcon className="w-[22px] h-[22px]" />,
      testTag: 'nav_tab_setup',
    },
    {
      id: 2,
      label: 'Настройки',
      railLabel: 'Настройки',
      icon: <SettingsIcon className="w-[22px] h-[22px]" />,
      testTag: 'nav_tab_settings',
    },
  ];

  return (
    <div className="h-screen w-screen bg-[#0B0E14] text-[#F1F5F9] flex flex-col md:flex-row overflow-hidden select-none">
      {/* Desktop / Landscape NavigationRail */}
      <nav
        aria-label="Primary Navigation"
        className="hidden md:flex w-[72px] shrink-0 bg-[#151A24] border-r border-[#222938] flex-col items-center justify-center gap-3 py-4"
      >
        {navItems.map((item) => {
          const active = selectedTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedTab(item.id)}
              data-testid={item.testTag}
              className="w-16 py-2 rounded-xl flex flex-col items-center gap-1 transition cursor-pointer group"
            >
              <div
                className={`w-12 h-8 rounded-full flex items-center justify-center transition ${
                  active
                    ? 'bg-[#00B4D8]/20 text-[#00B4D8]'
                    : 'text-[#64748B] group-hover:text-[#F1F5F9]'
                }`}
              >
                {item.icon}
              </div>
              <span
                className={`text-[11px] font-medium ${
                  active ? 'text-[#00B4D8]' : 'text-[#64748B] group-hover:text-[#94A3B8]'
                }`}
              >
                {item.railLabel}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 min-h-0 overflow-hidden">
        {selectedTab === 0 && (
          <CarLifeAppLauncherScreen
            virtualDisplayId={runtimeState.projectionStats.virtualDisplayId}
            a11yEnabled={checklistStatus.step3AccessibilityEnabled}
            mediaState={mediaState}
            lastLaunchStatus={lastLaunchStatus}
            onPlayPause={() => bridgeController.togglePlayPause()}
            onNextTrack={() => bridgeController.skipNextTrack()}
            onPreviousTrack={() => bridgeController.skipPreviousTrack()}
            onRequestNotificationAccess={() =>
              bridgeController.toggleChecklistStep('step4NotificationAccessGranted')
            }
            onHomePressed={() => bridgeController.triggerDockHome()}
            onBackPressed={() => bridgeController.triggerDockBack()}
            onLaunchApp={(app) => bridgeController.launchApp(app)}
          />
        )}

        {selectedTab === 1 && (
          <OnboardingChecklistScreen
            status={checklistStatus}
            runtimeState={runtimeState}
            onToggleStep={(step) => bridgeController.toggleChecklistStep(step)}
            onRequestMediaProjection={() => bridgeController.requestMediaProjection()}
            onScanAndAttachUsb={() => bridgeController.scanAndAttachUsb()}
            onOpenLauncherTab={() => setSelectedTab(0)}
          />
        )}

        {selectedTab === 2 && (
          <UnifiedSettingsAndDiagnosticsScreen
            state={runtimeState}
            checklistStatus={checklistStatus}
            lastLaunchStatus={lastLaunchStatus}
            lastDecodedBreakdown={lastDecodedBreakdown}
            mediaStream={mediaStream}
            onSetAppMode={(mode) => bridgeController.setAppMode(mode)}
            onSetLogPacketsInUi={(enabled) => bridgeController.setLogPacketsInUi(enabled)}
            onSetMutePhoneSpeaker={(enabled) =>
              bridgeController.setMutePhoneSpeakerDuringUsbAudio(enabled)
            }
            onToggleAudioCapture={() => bridgeController.toggleAudioCapture()}
            onSetVideoSourceMode={(mode) => bridgeController.setVideoSourceMode(mode)}
            onSetAppLaunchMode={(mode) => bridgeController.setAppLaunchMode(mode)}
            onSetHandshakeProfile={(id) => bridgeController.setHandshakeProfile(id)}
            onSelectResolution={(w, h) => bridgeController.setResolution(w, h)}
            onSelectBitrate={(kbps) => bridgeController.setBitrateKbps(kbps)}
            onSetVideoHeaderMode={(aoa) => bridgeController.setVideoHeaderMode(aoa)}
            onToggleProjection={() => bridgeController.toggleProjection()}
            onStartJettaVs7Vd={() => bridgeController.startJettaVs7DefaultVd()}
            onToggleAccessibility={() =>
              bridgeController.toggleChecklistStep('step3AccessibilityEnabled')
            }
            onToggleOverlay={() => bridgeController.toggleChecklistStep('step2OverlayGranted')}
            onRequestMediaProjection={() => bridgeController.requestMediaProjection()}
            onScanAndAttachUsb={() => bridgeController.scanAndAttachUsb()}
            onStopBridge={() => bridgeController.stopBridge()}
            onInjectTouch={(x, y) => bridgeController.injectTestTouch(x, y)}
            onRunLoopbackVector={(vector) => bridgeController.runLoopbackVector(vector)}
            onClearLogs={() => bridgeController.clearLogs()}
          />
        )}
      </main>

      {/* Mobile / Portrait Bottom NavigationBar */}
      <nav
        aria-label="Bottom Navigation"
        className="flex md:hidden h-16 shrink-0 bg-[#151A24] border-t border-[#222938] items-center justify-around px-2"
      >
        {navItems.map((item) => {
          const active = selectedTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedTab(item.id)}
              data-testid={`${item.testTag}_bottom`}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1 cursor-pointer"
            >
              <div
                className={`w-14 h-7 rounded-full flex items-center justify-center transition ${
                  active ? 'bg-[#00B4D8]/20 text-[#00B4D8]' : 'text-[#64748B]'
                }`}
              >
                {item.icon}
              </div>
              <span
                className={`text-[11px] font-medium ${
                  active ? 'text-[#00B4D8]' : 'text-[#64748B]'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default App;
