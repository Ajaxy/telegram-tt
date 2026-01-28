import type { FC } from '../../../../lib/teact/teact';
import type React from '../../../../lib/teact/teact';
import {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../../lib/teact/teact';

import { TelebizFeatureSection } from '../../../global/types';

import animateHorizontalScroll from '../../../../util/animateHorizontalScroll';
import buildClassName from '../../../../util/buildClassName';

import useFlag from '../../../../hooks/useFlag';
import useLastCallback from '../../../../hooks/useLastCallback';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import Icon from '../../../../components/common/icons/Icon';
import SliderDots from '../../../../components/common/SliderDots';
import Button from '../../../../components/ui/Button';
import Modal from '../../../../components/ui/Modal';

import styles from './TelebizFeaturesModal.module.scss';

const TELEBIZ_FEATURE_SECTIONS: TelebizFeatureSection[] = [
  TelebizFeatureSection.Organizations,
  TelebizFeatureSection.Integrations,
  TelebizFeatureSection.CrmIntegration,
  TelebizFeatureSection.MessageTemplates,
  TelebizFeatureSection.BulkSend,
  TelebizFeatureSection.AiAgent,
  TelebizFeatureSection.AutomatedFollowups,
  TelebizFeatureSection.MessageReminders,
  TelebizFeatureSection.FocusMode,
  TelebizFeatureSection.Drawer,
  TelebizFeatureSection.ContextMenu,
];

type FeatureConfig = {
  screenshot?: string;
  benefits: string[];
};

const FEATURE_CONFIGS: Record<TelebizFeatureSection, FeatureConfig> = {
  [TelebizFeatureSection.Drawer]: {
    screenshot: 'features/drawer.png',
    benefits: [
      'Switch between Agent, Tasks Mode & Settings',
      'Quick access from chat list',
      'See pending notifications at a glance',
    ],
  },
  [TelebizFeatureSection.CrmIntegration]: {
    screenshot: 'features/crm.png',
    benefits: [
      'Connect HubSpot, Pipedrive, or Notion',
      'Link chats to deals, contacts & companies',
      'Sync activities automatically',
    ],
  },
  [TelebizFeatureSection.MessageTemplates]: {
    screenshot: 'features/templates.png',
    benefits: [
      'Turn any chat into a template source',
      'Organize templates by category',
      'Send with via the attachment menu',
    ],
  },
  [TelebizFeatureSection.BulkSend]: {
    screenshot: 'features/bulksend.png',
    benefits: [
      'Send template messages to multiple chats',
      'Configure delays between messages',
      'Track progress in real-time',
    ],
  },
  [TelebizFeatureSection.AiAgent]: {
    screenshot: 'features/agent.png',
    benefits: [
      'Bring your own LLM via OpenRouter',
      'Summarize conversations in natural language',
      'Automate tasks like adding contacts to groups',
    ],
  },
  [TelebizFeatureSection.Integrations]: {
    screenshot: 'features/integrations.png',
    benefits: [
      'Connect CRMs: HubSpot, Pipedrive, Notion',
      'Add AI via OpenRouter',
      'More integrations coming soon',
    ],
  },
  [TelebizFeatureSection.FocusMode]: {
    screenshot: 'features/header-task.jpeg',
    benefits: [
      'See chats needing your attention',
      'Based on your follow-up rules',
      'Never let a conversation slip',
    ],
  },
  [TelebizFeatureSection.Organizations]: {
    screenshot: 'features/organizations.png',
    benefits: [
      'Create or join a team workspace',
      'Share CRM connections with your team',
      'Manage roles and permissions',
    ],
  },
  [TelebizFeatureSection.AutomatedFollowups]: {
    screenshot: 'features/followup-settings.png',
    benefits: [
      'Set custom inactivity rules per chat',
      'Get notified when chats go silent',
      'High, Medium, Low or Custom priority',
    ],
  },
  [TelebizFeatureSection.MessageReminders]: {
    screenshot: 'features/reminder-modal.png',
    benefits: [
      'Right-click any message to set a reminder',
      'Choose when to be notified',
      'Never forget to follow up',
    ],
  },
  [TelebizFeatureSection.ContextMenu]: {
    screenshot: 'features/message-right-click.png',
    benefits: [
      'Access all Telebiz features from any message',
      'Set reminders and more',
      'Add messages to your CRM, create tasks and more',
    ],
  },
};

export const TELEBIZ_FEATURE_TITLES: Record<TelebizFeatureSection, string> = {
  [TelebizFeatureSection.Drawer]: 'TelebizFeatures.Drawer.Title',
  [TelebizFeatureSection.CrmIntegration]: 'TelebizFeatures.CrmIntegration.Title',
  [TelebizFeatureSection.MessageTemplates]: 'TelebizFeatures.MessageTemplates.Title',
  [TelebizFeatureSection.BulkSend]: 'TelebizFeatures.BulkSend.Title',
  [TelebizFeatureSection.AiAgent]: 'TelebizFeatures.AiAgent.Title',
  [TelebizFeatureSection.Integrations]: 'TelebizFeatures.Integrations.Title',
  [TelebizFeatureSection.FocusMode]: 'TelebizFeatures.FocusMode.Title',
  [TelebizFeatureSection.Organizations]: 'TelebizFeatures.Organizations.Title',
  [TelebizFeatureSection.AutomatedFollowups]: 'TelebizFeatures.AutomatedFollowups.Title',
  [TelebizFeatureSection.MessageReminders]: 'TelebizFeatures.MessageReminders.Title',
  [TelebizFeatureSection.ContextMenu]: 'TelebizFeatures.ContextMenu.Title',
};

export const TELEBIZ_FEATURE_DESCRIPTIONS: Record<TelebizFeatureSection, string> = {
  [TelebizFeatureSection.Drawer]: 'TelebizFeatures.Drawer.Description',
  [TelebizFeatureSection.CrmIntegration]: 'TelebizFeatures.CrmIntegration.Description',
  [TelebizFeatureSection.MessageTemplates]: 'TelebizFeatures.MessageTemplates.Description',
  [TelebizFeatureSection.BulkSend]: 'TelebizFeatures.BulkSend.Description',
  [TelebizFeatureSection.AiAgent]: 'TelebizFeatures.AiAgent.Description',
  [TelebizFeatureSection.Integrations]: 'TelebizFeatures.Integrations.Description',
  [TelebizFeatureSection.FocusMode]: 'TelebizFeatures.FocusMode.Description',
  [TelebizFeatureSection.Organizations]: 'TelebizFeatures.Organizations.Description',
  [TelebizFeatureSection.AutomatedFollowups]: 'TelebizFeatures.AutomatedFollowups.Description',
  [TelebizFeatureSection.MessageReminders]: 'TelebizFeatures.MessageReminders.Description',
  [TelebizFeatureSection.ContextMenu]: 'TelebizFeatures.ContextMenu.Description',
};

type OwnProps = {
  isOpen: boolean;
  initialSection?: TelebizFeatureSection;
  onClose: () => void;
};

const TelebizFeaturesModal: FC<OwnProps> = ({
  isOpen,
  initialSection,
  onClose,
}) => {
  const lang = useTelebizLang();
  const scrollContainerRef = useRef<HTMLDivElement>();

  const initialIndex = initialSection ? TELEBIZ_FEATURE_SECTIONS.indexOf(initialSection) : 0;
  const [currentSlideIndex, setCurrentSlideIndex] = useState(Math.max(0, initialIndex));
  const [isScrolling, startScrolling, stopScrolling] = useFlag();

  // Reset to initial section when modal opens
  useEffect(() => {
    if (isOpen) {
      const index = initialSection ? TELEBIZ_FEATURE_SECTIONS.indexOf(initialSection) : 0;
      setCurrentSlideIndex(Math.max(0, index));

      // Scroll to the correct slide when opening
      const scrollContainer = scrollContainerRef.current;
      if (scrollContainer && index > 0) {
        requestAnimationFrame(() => {
          scrollContainer.scrollLeft = scrollContainer.clientWidth * index;
        });
      }
    }
  }, [isOpen, initialSection]);

  const handleScroll = useLastCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (isScrolling) return;

    const target = e.currentTarget;
    const { clientWidth, scrollLeft } = target;
    const slide = Math.round(scrollLeft / clientWidth);
    setCurrentSlideIndex(slide);
  });

  const handleSelectSlide = useLastCallback(async (index: number) => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    setCurrentSlideIndex(index);
    startScrolling();
    await animateHorizontalScroll(scrollContainer, scrollContainer.clientWidth * index, 400);
    stopScrolling();
  });

  const slides = useMemo(() => {
    return TELEBIZ_FEATURE_SECTIONS.map((section) => {
      const titleKey = TELEBIZ_FEATURE_TITLES[section];
      const descKey = TELEBIZ_FEATURE_DESCRIPTIONS[section];
      const config = FEATURE_CONFIGS[section];

      return (
        <div key={section} className={styles.slide}>
          <div className={styles.frame}>
            <div className={styles.screenshotArea}>
              {config.screenshot ? (
                <img
                  src={config.screenshot}
                  alt={section}
                  className={styles.screenshot}
                  draggable={false}
                />
              ) : (
                <div className={styles.screenshotPlaceholder}>
                  <span>Screenshot</span>
                </div>
              )}
            </div>
          </div>
          <h1 className={styles.title}>{lang(titleKey as any)}</h1>
          <div className={styles.description}>{lang(descKey as any)}</div>

          {/* Benefits */}
          <div className={styles.benefits}>
            {config.benefits.map((benefit, idx) => (
              <div key={idx} className={styles.benefit}>
                <span className={styles.benefitCheck}>
                  <Icon name="check" />
                </span>
                <span className={styles.benefitText}>{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      );
    });
  }, [lang]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className={styles.modal}
    >
      <div className={styles.root}>
        <Button
          round
          size="tiny"
          className={buildClassName(styles.backButton, styles.whiteBackButton)}
          color="translucent-white"
          onClick={onClose}
          ariaLabel="Close"
          iconName="close"
        />

        <div
          className={buildClassName(styles.content, 'no-scrollbar')}
          onScroll={handleScroll}
          ref={scrollContainerRef}
        >
          {slides}
        </div>

        <div className={buildClassName(styles.footer, styles.noFooterBorder)}>
          <SliderDots
            length={TELEBIZ_FEATURE_SECTIONS.length}
            active={currentSlideIndex}
            onSelectSlide={handleSelectSlide}
          />
          <Button
            className={styles.button}
            color="primary"
            onClick={onClose}
          >
            {lang('TelebizFeatures.GotIt')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default memo(TelebizFeaturesModal);
