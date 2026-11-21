import React, { useState } from 'react';
import { BridgeRuntimeState, SetupChecklistStatus } from '../store/bridgeStore';
import { UsbIcon, VideocamIcon } from './CockpitIcons';

interface OnboardingChecklistScreenProps {
  status: SetupChecklistStatus;
  runtimeState: BridgeRuntimeState;
  onToggleStep: (
    step:
      | 'step1BatteryUnrestricted'
      | 'step2OverlayGranted'
      | 'step3AccessibilityEnabled'
      | 'step4NotificationAccessGranted'
  ) => void;
  onRequestMediaProjection: () => void;
  onScanAndAttachUsb: () => void;
  onOpenLauncherTab: () => void;
}

const StatusBadgePill: React.FC<{ isCompleted: boolean }> = ({ isCompleted }) => (
  <span
    className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${
      isCompleted ? 'bg-[#064E3B] text-[#10B981]' : 'bg-[#451A03] text-[#F59E0B]'
    }`}
  >
    {isCompleted ? 'Выполнено ✅' : 'Настроить'}
  </span>
);

interface ChecklistStepCardProps {
  title: string;
  isCompleted: boolean;
  description: string;
  primaryButtonText: string;
  testTag: string;
  onPrimaryClick: () => void;
  secondaryButtonText?: string;
  onSecondaryClick?: () => void;
  secondaryHint?: string | null;
}

const ChecklistStepCard: React.FC<ChecklistStepCardProps> = ({
  title,
  isCompleted,
  description,
  primaryButtonText,
  testTag,
  onPrimaryClick,
  secondaryButtonText,
  onSecondaryClick,
  secondaryHint,
}) => (
  <div className="w-full rounded-2xl bg-[#151A24] border border-[#222938] p-4 flex flex-col gap-2.5">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-[16px] font-semibold text-[#F1F5F9] leading-snug flex-1">{title}</h3>
      <StatusBadgePill isCompleted={isCompleted} />
    </div>

    <p className="text-[13px] leading-relaxed text-[#94A3B8]">{description}</p>

    <button
      type="button"
      onClick={onPrimaryClick}
      data-testid={testTag}
      className={`w-full rounded-[10px] py-2.5 px-3.5 text-[13px] font-semibold transition cursor-pointer ${
        isCompleted
          ? 'bg-[#1E2636] border border-[#222938] text-[#F1F5F9] hover:border-[#00B4D8]/50 text-left'
          : 'bg-[#00B4D8] text-[#001D24] hover:brightness-110 text-center'
      }`}
    >
      {primaryButtonText}
    </button>

    {secondaryButtonText && onSecondaryClick && (
      <button
        type="button"
        onClick={onSecondaryClick}
        data-testid={`${testTag}_secondary`}
        className="w-full rounded-[10px] py-2.5 px-3.5 text-[12px] font-medium bg-[#1E2636] border border-[#222938] text-[#94A3B8] hover:text-[#F1F5F9] text-left transition cursor-pointer"
      >
        {secondaryButtonText}
      </button>
    )}

    {secondaryHint && (
      <div className="rounded-lg bg-[#0B0E14] border border-[#222938] px-3 py-2 text-[12px] text-[#00B4D8]">
        {secondaryHint}
      </div>
    )}
  </div>
);

export const OnboardingChecklistScreen: React.FC<OnboardingChecklistScreenProps> = ({
  status,
  runtimeState,
  onToggleStep,
  onRequestMediaProjection,
  onScanAndAttachUsb,
  onOpenLauncherTab,
}) => {
  const [restrictedInfoShown, setRestrictedInfoShown] = useState(false);

  const completedStepsCount = [
    status.step1BatteryUnrestricted,
    status.step2OverlayGranted,
    status.step3AccessibilityEnabled,
    status.step4NotificationAccessGranted,
    status.step5MediaProjectionGranted,
  ].filter(Boolean).length;

  const allPrerequisitesReady = completedStepsCount === 5;
  const progressPct = (completedStepsCount / 5) * 100;

  return (
    <div className="h-full w-full overflow-y-auto px-4 py-4">
      <div className="max-w-[680px] mx-auto flex flex-col gap-3.5 pb-6">
        {/* Header Card */}
        <div className="w-full rounded-2xl bg-[#151A24] border border-[#222938] p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold tracking-wider text-[#00B4D8]">
              МАСТЕР НАСТРОЙКИ CARLIFE
            </span>
            <span
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${
                allPrerequisitesReady
                  ? 'bg-[#064E3B] text-[#10B981]'
                  : 'bg-[#1E2636] text-[#00B4D8]'
              }`}
            >
              {completedStepsCount} / 5 выполнено
            </span>
          </div>

          <h2 className="text-[18px] font-semibold text-[#F1F5F9]">
            Подготовка Galaxy S26 Ultra к Jetta VS7
          </h2>

          <p className="text-[13px] leading-relaxed text-[#94A3B8]">
            Выполните 5 шагов разрешений ниже. После шага 5 («Весь экран») станет активно подключение USB AOA.
          </p>

          <div className="w-full h-1.5 rounded-full bg-[#1E2636] overflow-hidden mt-1">
            <div
              className="h-full bg-[#00B4D8] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Step 1 */}
        <ChecklistStepCard
          title="Шаг 1. Снятие ограничений батареи (WakeLock & 60fps)"
          isCompleted={status.step1BatteryUnrestricted}
          description="Отключите оптимизацию батареи, чтобы система One UI не усыпляла видеопоток при выключенном экране телефона."
          primaryButtonText={
            status.step1BatteryUnrestricted
              ? 'Оптимизация отключена'
              : 'Отключить оптимизацию батареи'
          }
          testTag="step1_battery_btn"
          onPrimaryClick={() => onToggleStep('step1BatteryUnrestricted')}
        />

        {/* Step 2 */}
        <ChecklistStepCard
          title="Шаг 2. Разрешение «Поверх других окон» (Overlay)"
          isCompleted={status.step2OverlayGranted}
          description="Разрешите показ поверх других окон — это необходимо для запуска полноценных приложений на экране ГУ из фонового сервиса."
          primaryButtonText={
            status.step2OverlayGranted
              ? 'Разрешение Overlay выдано'
              : 'Разрешить «Поверх других окон»'
          }
          testTag="step2_overlay_btn"
          onPrimaryClick={() => onToggleStep('step2OverlayGranted')}
        />

        {/* Step 3 */}
        <ChecklistStepCard
          title="Шаг 3. Служба специальных возможностей (Тачскрин ГУ)"
          isCompleted={status.step3AccessibilityEnabled}
          description="Откройте «Специальные возможности» -> «Установленные приложения» -> включите службу управления касаниями CarLife. (Если кнопка неактивна на Android 16: Настройки -> Приложения -> Наше приложение -> Меню ⋮ -> «Разрешить ограниченные настройки»)."
          primaryButtonText={
            status.step3AccessibilityEnabled
              ? 'Служба касаний активна'
              : 'Открыть Специальные возможности'
          }
          testTag="step3_accessibility_btn"
          onPrimaryClick={() => onToggleStep('step3AccessibilityEnabled')}
          secondaryButtonText="О приложении (Разрешить ограниченные настройки)"
          onSecondaryClick={() => setRestrictedInfoShown((prev) => !prev)}
          secondaryHint={
            restrictedInfoShown
              ? 'One UI / Android 16: Настройки → Приложения → CarLife Bridge → Меню ⋮ (справа сверху) → «Разрешить ограниченные настройки».'
              : null
          }
        />

        {/* Step 4 */}
        <ChecklistStepCard
          title="Шаг 4. Доступ к уведомлениям (Для виджета музыки на ГУ)"
          isCompleted={status.step4NotificationAccessGranted}
          description="Разрешите чтение уведомлений для отображения обложек треков и управления Яндекс.Музыкой / Spotify с экрана ГУ."
          primaryButtonText={
            status.step4NotificationAccessGranted
              ? 'Доступ к уведомлениям открыт'
              : 'Разрешить доступ к уведомлениям'
          }
          testTag="step4_notifications_btn"
          onPrimaryClick={() => onToggleStep('step4NotificationAccessGranted')}
        />

        {/* Step 5: MediaProjection */}
        <div className="w-full rounded-2xl bg-[#151A24] border border-[#222938] p-4 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[16px] font-semibold text-[#F1F5F9] leading-snug flex-1">
              Шаг 5. Захват экрана (MediaProjection) — КРИТИЧНО ДЛЯ 90%
            </h3>
            <StatusBadgePill isCompleted={status.step5MediaProjectionGranted} />
          </div>

          <div className="rounded-xl bg-[#1E2636] border border-[#222938] p-3 text-[13px] leading-relaxed text-[#F1F5F9]">
            Нажмите «Начать трансляцию».{' '}
            <span className="text-[#EF4444] font-semibold">
              ВНИМАНИЕ: В системном окне Samsung обязательно выберите «Весь экран» (Entire Screen), а НЕ «Одно приложение», иначе загрузка на ГУ зависнет на 90%!
            </span>
          </div>

          <button
            type="button"
            onClick={onRequestMediaProjection}
            data-testid="step5_mediaprojection_btn"
            className={`w-full rounded-xl py-2.5 px-4 flex items-center justify-center gap-2 text-[13px] font-semibold transition cursor-pointer ${
              status.step5MediaProjectionGranted
                ? 'bg-[#1E2636] border border-[#222938] text-[#F1F5F9] hover:border-[#00B4D8]/50'
                : 'bg-[#00B4D8] text-[#001D24] hover:brightness-110'
            }`}
          >
            <VideocamIcon className="w-[18px] h-[18px]" />
            <span>
              {status.step5MediaProjectionGranted
                ? 'Трансляция «Весь экран» активна (Перезапустить)'
                : 'Начать трансляцию (Выбрать «Весь экран»)'}
            </span>
          </button>
        </div>

        {/* Step 6: USB AOA */}
        <div className="w-full rounded-2xl bg-[#151A24] border border-[#222938] p-4 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3
              className={`text-[16px] font-semibold leading-snug flex-1 ${
                allPrerequisitesReady ? 'text-[#F1F5F9]' : 'text-[#64748B]'
              }`}
            >
              Шаг 6. Подключение USB-кабеля к ГУ автомобиля
            </h3>
            <span
              className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${
                allPrerequisitesReady
                  ? 'bg-[#064E3B] text-[#10B981]'
                  : 'bg-[#451A03] text-[#F59E0B]'
              }`}
            >
              {status.isUsbConnected && allPrerequisitesReady
                ? 'Подключено ✅'
                : allPrerequisitesReady
                ? 'Выполнено ✅'
                : 'Настроить'}
            </span>
          </div>

          <p
            className={`text-[13px] leading-relaxed ${
              allPrerequisitesReady ? 'text-[#94A3B8]' : 'text-[#64748B]'
            }`}
          >
            Подключите телефон кабелем к USB-порту автомобиля и нажмите на всплывающем окне «ОК» (всегда открывать при подключении CarLife).
          </p>

          <p
            className={`text-[11px] font-medium ${
              allPrerequisitesReady ? 'text-[#00B4D8]' : 'text-[#64748B]'
            }`}
          >
            Статус канала: {runtimeState.lastProtocolEvent}
          </p>

          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              disabled={!allPrerequisitesReady}
              onClick={onScanAndAttachUsb}
              data-testid="step6_connect_usb_btn"
              className={`flex-1 h-11 rounded-xl px-4 flex items-center justify-center gap-1.5 text-[13px] font-semibold transition ${
                allPrerequisitesReady
                  ? 'bg-[#00B4D8] text-[#001D24] hover:brightness-110 cursor-pointer'
                  : 'bg-[#1E2636] text-[#64748B] border border-[#222938] cursor-not-allowed opacity-70'
              }`}
            >
              <UsbIcon className="w-[18px] h-[18px]" />
              <span>Подключить USB AOA</span>
            </button>

            <button
              type="button"
              onClick={onOpenLauncherTab}
              data-testid="step6_open_launcher_btn"
              className="h-11 rounded-xl px-4 border border-[#222938] bg-[#151A24] text-[#00B4D8] text-[13px] font-medium hover:bg-[#1E2636] transition cursor-pointer shrink-0"
            >
              Лаунчер ГУ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
