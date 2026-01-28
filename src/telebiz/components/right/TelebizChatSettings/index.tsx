import { memo, useEffect, useMemo, useRef, useState } from '@teact';
import { getActions, withGlobal } from '../../../../global';
import { selectTelebizChatSettings, selectTelebizSettingsIsLoading, selectTelebizUserSettings } from '../../../global';

import type { IRadioOption } from '../../../../components/ui/RadioGroup';
import type { ChatFollowupSettings, FollowupPriority, UserSettings } from '../../../services/types';
import { TelebizFeatureSection } from '../../../global/types';
import { TelebizSettingsScreens } from '../../left/types';

import { selectChat } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { formatDateAtTime, formatTimeDuration } from '../../../../util/dates/dateFormat';

import { useVtn } from '../../../../hooks/animations/useVtn';
import useLastCallback from '../../../../hooks/useLastCallback';
import useOldLang from '../../../../hooks/useOldLang';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import Icon from '../../../../components/common/icons/Icon';
import ListItem from '../../../../components/ui/ListItem';
import RadioGroup from '../../../../components/ui/RadioGroup';
import RangeSlider from '../../../../components/ui/RangeSlider';
import Switcher from '../../../../components/ui/Switcher';
import ShieldWarningFill from '../../icons/ShieldWarningFill';

import styles from './TelebizChatSettings.module.scss';

type StateProps = {
  isPrivateChat: boolean;
  chatSettings?: ChatFollowupSettings;
  isLoading: boolean;
  userSettings: UserSettings;
  globallyDisabled: boolean;
};

type OwnProps = {
  chatId: string;
};

const SLIDER_DEBOUNCE_MS = 500;
// Default settings in hours (UI uses hours, API uses minutes)
const DEFAULT_INCOMING_THRESHOLD_HOURS = 24;
const DEFAULT_OUTGOING_THRESHOLD_HOURS = 72;

// Predefined levels config (in hours)
const PREDEFINED_LEVELS = {
  high: {
    outgoingThreshold: 24,
    incomingThreshold: 4,
  },
  medium: {
    outgoingThreshold: 72,
    incomingThreshold: 24,
  },
  low: {
    outgoingThreshold: 168,
    incomingThreshold: 72,
  },
} as const;

type PredefinedLevelKey = keyof typeof PREDEFINED_LEVELS;

// Convert hours to minutes for API
function hoursToMinutes(hours: number): number {
  return hours * 60;
}

// Convert minutes to hours for UI
function minutesToHours(minutes: number): number {
  return Math.round(minutes / 60);
}

const TelebizChatSettings = ({
  chatId,
  isPrivateChat,
  chatSettings,
  userSettings,
  isLoading,
  globallyDisabled,
}: OwnProps & StateProps) => {
  const { updateTelebizChatSettings, openTelebizSettingsScreen, telebizOpenFeaturesModal } = getActions();

  const lang = useTelebizLang();
  const oldLang = useOldLang();
  const { createVtnStyle } = useVtn();

  // Debounce timers for sliders
  const incomingDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const outgoingDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Derive values from settings or use defaults
  const isFollowupsEnabled = chatSettings?.followup_enabled ?? false;
  const serverIncomingHours = chatSettings
    ? minutesToHours(chatSettings.incoming_threshold_minutes || DEFAULT_INCOMING_THRESHOLD_HOURS * 60)
    : DEFAULT_INCOMING_THRESHOLD_HOURS;
  const serverOutgoingHours = chatSettings
    ? minutesToHours(chatSettings.outgoing_threshold_minutes || DEFAULT_OUTGOING_THRESHOLD_HOURS * 60)
    : DEFAULT_OUTGOING_THRESHOLD_HOURS;

  // Local state for sliders (for immediate visual feedback)
  const [localIncomingHours, setLocalIncomingHours] = useState(serverIncomingHours);
  const [localOutgoingHours, setLocalOutgoingHours] = useState(serverOutgoingHours);

  // Sync local state when server values change
  useEffect(() => {
    setLocalIncomingHours(serverIncomingHours);
  }, [serverIncomingHours]);

  useEffect(() => {
    setLocalOutgoingHours(serverOutgoingHours);
  }, [serverOutgoingHours]);

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      if (incomingDebounceRef.current) clearTimeout(incomingDebounceRef.current);
      if (outgoingDebounceRef.current) clearTimeout(outgoingDebounceRef.current);
    };
  }, []);

  const handleToggleFollowups = useLastCallback(() => {
    updateTelebizChatSettings({
      chatId,
      settings: { followup_enabled: !isFollowupsEnabled },
    });
  });

  const handleIncomingThresholdChange = useLastCallback((hours: number) => {
    setLocalIncomingHours(hours);

    if (incomingDebounceRef.current) clearTimeout(incomingDebounceRef.current);
    incomingDebounceRef.current = setTimeout(() => {
      updateTelebizChatSettings({
        chatId,
        settings: { incoming_threshold_minutes: hoursToMinutes(hours) },
      });
    }, SLIDER_DEBOUNCE_MS);
  });

  const handleOutgoingThresholdChange = useLastCallback((hours: number) => {
    setLocalOutgoingHours(hours);

    if (outgoingDebounceRef.current) clearTimeout(outgoingDebounceRef.current);
    outgoingDebounceRef.current = setTimeout(() => {
      updateTelebizChatSettings({
        chatId,
        settings: { outgoing_threshold_minutes: hoursToMinutes(hours) },
      });
    }, SLIDER_DEBOUNCE_MS);
  });

  const handlePredefinedLevelChange = useLastCallback((value: string) => {
    if (value === 'custom') return;
    const level = value as PredefinedLevelKey;
    if (!PREDEFINED_LEVELS[level]) return;

    const config = PREDEFINED_LEVELS[level];

    // Update local state immediately
    setLocalIncomingHours(config.incomingThreshold);
    setLocalOutgoingHours(config.outgoingThreshold);

    // Clear any pending debounced updates
    if (incomingDebounceRef.current) clearTimeout(incomingDebounceRef.current);
    if (outgoingDebounceRef.current) clearTimeout(outgoingDebounceRef.current);

    // Send to server immediately (no debounce for preset selection)
    updateTelebizChatSettings({
      chatId,
      settings: {
        incoming_threshold_minutes: hoursToMinutes(config.incomingThreshold),
        outgoing_threshold_minutes: hoursToMinutes(config.outgoingThreshold),
        priority: level as FollowupPriority,
      },
    });
  });

  const renderRangeValue = (value: number) => {
    return formatTimeDuration(oldLang, value * 3600, 3);
  };

  const predefinedLevelsOptions: IRadioOption[] = [{
    label: lang('TelebizChatSettings.High'),
    subLabel: `${renderRangeValue(PREDEFINED_LEVELS.high.incomingThreshold)} ${lang('TelebizChatSettings.ForIncoming')},
    ${renderRangeValue(PREDEFINED_LEVELS.high.outgoingThreshold)} ${lang('TelebizChatSettings.ForOutgoing')}`,
    value: 'high',
  }, {
    label: lang('TelebizChatSettings.Medium'),
    subLabel: `${renderRangeValue(PREDEFINED_LEVELS.medium.incomingThreshold)} `
      + `${lang('TelebizChatSettings.ForIncoming')}, `
      + `${renderRangeValue(PREDEFINED_LEVELS.medium.outgoingThreshold)} ${lang('TelebizChatSettings.ForOutgoing')}`,
    value: 'medium',
  }, {
    label: lang('TelebizChatSettings.Low'),
    subLabel: `${renderRangeValue(PREDEFINED_LEVELS.low.incomingThreshold)} ${lang('TelebizChatSettings.ForIncoming')},
    ${renderRangeValue(PREDEFINED_LEVELS.low.outgoingThreshold)} ${lang('TelebizChatSettings.ForOutgoing')}`,
    value: 'low',
  }, {
    label: lang('TelebizChatSettings.Custom'),
    value: 'custom',
  }];

  const levelValue = useMemo(() => {
    const matchedLevel = (Object.keys(PREDEFINED_LEVELS) as PredefinedLevelKey[]).find((key) => {
      const config = PREDEFINED_LEVELS[key];
      return localOutgoingHours === config.outgoingThreshold
        && localIncomingHours === config.incomingThreshold;
    });
    return matchedLevel || 'custom';
  }, [localOutgoingHours, localIncomingHours]);

  return (
    <div className="settings-content no-border custom-scroll">
      <div className="settings-item">
        <h4 className="settings-item-header">
          {lang('TelebizChatSettings.FollowUps')}
        </h4>
        <p className="settings-item-description pt-1">
          {lang('TelebizChatSettings.GetNotificationsForInactivityBasedOnYourSetup')}
          {' '}
          <a
            className="text-entity-link"
            onClick={() => telebizOpenFeaturesModal({ section: TelebizFeatureSection.AutomatedFollowups })}
          >
            {lang('TelebizFeatures.LearnMoreShort')}
          </a>
        </p>
        {
          globallyDisabled && (
            <div className={buildClassName(styles.hint, 'mb-4')}>
              <div className={styles.hintIcon}>
                <ShieldWarningFill />
              </div>
              <div className={styles.hintText}>
                The Follow-Ups feature is globally disabled for all
                {' '}
                {isPrivateChat ? 'private chats' : 'groups / channels'}
                .
                <span
                  className={buildClassName(styles.link, styles.linkActive)}
                  onClick={() => {
                    openTelebizSettingsScreen({ screen: TelebizSettingsScreens.Activities });
                  }}
                >
                  Open Activities Settings
                </span>
              </div>
            </div>
          )
        }
        <ListItem
          icon="timer"
          className={styles.followups}
          narrow
          ripple
          disabled={globallyDisabled}
          onClick={handleToggleFollowups}
          style={createVtnStyle('followups')}
        >
          <span>{lang('TelebizChatSettings.AutomatedFollowUps')}</span>
          <Switcher
            id="group-followups"
            label={lang('TelebizChatSettings.AutomatedFollowUps')}
            checked={isFollowupsEnabled}
            inactive
          />
        </ListItem>

        <div className={buildClassName(
          styles.thresholds,
          (!isFollowupsEnabled || globallyDisabled) && styles.disabled)}
        >
          <RadioGroup
            name="predefined-levels"
            options={predefinedLevelsOptions}
            selected={levelValue}
            onChange={handlePredefinedLevelChange}
          />
          <div className="pt-1">
            <RangeSlider
              label={lang('TelebizChatSettings.IncomingMessage')}
              renderValue={renderRangeValue}
              disabled={!isFollowupsEnabled || isLoading}
              min={1}
              max={24 * 14}
              value={localIncomingHours}
              onChange={handleIncomingThresholdChange}
            />
          </div>
          <div className="pt-1">
            <RangeSlider
              label={lang('TelebizChatSettings.OutgoingMessage')}
              renderValue={renderRangeValue}
              disabled={!isFollowupsEnabled || isLoading}
              min={1}
              max={24 * 14}
              value={localOutgoingHours}
              onChange={handleOutgoingThresholdChange}
            />
          </div>
        </div>

        {
          !globallyDisabled && (
            <div className={styles.hint}>
              <div className={styles.hintIcon}>
                <Icon name="info" />
              </div>
              <div className={styles.hintText}>
                {chatSettings?.followup_at && new Date(chatSettings.followup_at) > new Date() ? (
                  lang('TelebizChatSettings.NextFollowupAt', {
                    time: formatDateAtTime(oldLang, new Date(chatSettings.followup_at)),
                  })
                ) : (
                  lang('TelebizChatSettings.YoullBeNotifiedWhenAChatNeedsYourAttention')
                )}
              </div>
            </div>
          )
        }
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId);
    const isPrivateChat = chat ? ['chatTypePrivate', 'chatTypeSecret'].includes(chat.type) : false;
    const userSettings = selectTelebizUserSettings(global);
    const globallyDisabled =
      (!userSettings?.sync_private_chats && isPrivateChat) || (!userSettings?.sync_groups && !isPrivateChat);
    return {
      isPrivateChat,
      chatSettings: selectTelebizChatSettings(global, chatId),
      isLoading: selectTelebizSettingsIsLoading(global),
      userSettings,
      globallyDisabled,
    };
  },
)(TelebizChatSettings));
