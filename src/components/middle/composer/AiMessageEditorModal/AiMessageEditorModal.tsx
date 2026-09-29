import { memo, useEffect, useMemo, useRef } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { TabState } from '../../../../global/types';
import type { AnimationLevel } from '../../../../types';
import type { IconName } from '../../../../types/icons';

import { SCHEDULED_WHEN_ONLINE } from '../../../../config';
import { hasAiEditorContent } from '../../../../global/helpers/aiMessageEditor';
import {
  selectCanScheduleUntilOnline,
  selectIsChatWithSelf,
  selectIsStoryViewerOpen,
  selectPeerPaidMessagesStars,
} from '../../../../global/selectors';
import { selectCurrentMessageList } from '../../../../global/selectors/messages';
import { selectAnimationLevel } from '../../../../global/selectors/sharedState';
import { selectIsCurrentUserPremium } from '../../../../global/selectors/users';
import buildClassName from '../../../../util/buildClassName';
import { resolveTransitionName } from '../../../../util/resolveTransitionName';

import useContextMenuHandlers from '../../../../hooks/useContextMenuHandlers';
import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useSchedule from '../../../../hooks/useSchedule';

import AnimatedCounter from '../../../common/AnimatedCounter';
import Icon from '../../../common/icons/Icon';
import Button from '../../../ui/Button';
import Modal from '../../../ui/Modal';
import TabList from '../../../ui/TabList';
import Transition from '../../../ui/Transition';
import CustomSendMenu from '../CustomSendMenu.async';
import AiTextFixEditor from './AiTextFixEditor';
import AiTextStyleEditor from './AiTextStyleEditor';
import AiTextTranslateEditor from './AiTextTranslateEditor';

import styles from './AiMessageEditorModal.module.scss';

export type OwnProps = {
  modal: TabState['aiMessageEditorModal'];
};

type StateProps = {
  animationLevel: AnimationLevel;
  isPremium?: boolean;
  isChatWithSelf?: boolean;
  canScheduleUntilOnline?: boolean;
  isInScheduledList?: boolean;
  paidMessagesStars?: number;
  isStoryViewerOpen?: boolean;
};

const INDEX_TO_TAB_ID = ['translate', 'style', 'fix'] as const;

const TAB_TRANSLATE = 0;
const TAB_STYLE = 1;
const TAB_FIX = 2;

const TAB_ID_TO_INDEX = Object.fromEntries(
  INDEX_TO_TAB_ID.map((id, i) => [id, i]),
) as Record<typeof INDEX_TO_TAB_ID[number], number>;

const AiMessageEditorModal = ({
  modal,
  animationLevel,
  isPremium,
  isChatWithSelf,
  canScheduleUntilOnline,
  isInScheduledList,
  paidMessagesStars,
  isStoryViewerOpen,
}: OwnProps & StateProps) => {
  const {
    closeAiMessageEditorModal,
    setAiMessageEditorTab,
    applyAiMessageEditorResult,
    sendAiMessageEditorResult,
    composeWithAiMessageEditor,
    openCocoonModal,
  } = getActions();

  const lang = useLang();

  const mainButtonRef = useRef<HTMLButtonElement>();

  const [requestCalendar, calendar] = useSchedule(canScheduleUntilOnline);

  const {
    isContextMenuOpen: isCustomSendMenuOpen,
    handleContextMenu,
    handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(mainButtonRef, !modal);

  const starsForMessage = paidMessagesStars || 0;
  const shouldRenderPaidBadge = Boolean(paidMessagesStars);

  useEffect(() => {
    if (!isCustomSendMenuOpen) {
      handleContextMenuHide();
      handleContextMenuClose();
    }
  }, [isCustomSendMenuOpen, handleContextMenuHide, handleContextMenuClose]);

  const isOpen = Boolean(modal);
  const renderingModal = useCurrentOrPrev(modal);

  const {
    activeTab,
    isEditing,
    content,
    translateTab,
    styleTab,
    fixTab,
  } = renderingModal || {};

  const currentTabState = activeTab === 'translate' ? translateTab
    : activeTab === 'style' ? styleTab : fixTab;
  const isLoading = currentTabState?.isLoading;
  const error = currentTabState?.error;
  const hasSource = Boolean(content && hasAiEditorContent(content));
  const hasContent = currentTabState?.result ? hasAiEditorContent(currentTabState.result) : hasSource;
  const shouldGenerate = activeTab === 'style' && styleTab?.selectedTone?.type === 'singleUse'
    && !styleTab.result && !styleTab.error;

  const tabs = useMemo((): { icon: IconName; title: string }[] => [
    { icon: 'language', title: lang('AiMessageEditorTranslate') },
    { icon: 'ai-edit', title: lang('AiMessageEditorStyle') },
    { icon: 'ai-fix', title: lang('AiMessageEditorFix') },
  ], [lang]);

  const activeTabIndex = TAB_ID_TO_INDEX[activeTab || 'style'] ?? TAB_STYLE;

  const handleTabChange = useLastCallback((index: number) => {
    const tab = INDEX_TO_TAB_ID[index];
    if (!hasSource && tab !== 'style') return;
    setAiMessageEditorTab({ tab });

    if (!hasSource) return;

    switch (tab) {
      case 'translate':
        composeWithAiMessageEditor({
          translateToLang: translateTab?.selectedLanguage,
          tone: translateTab?.selectedTone,
          isEmojify: translateTab?.shouldEmojify,
        });
        break;
      case 'style':
        if (styleTab?.selectedTone && styleTab.selectedTone.type !== 'singleUse') {
          composeWithAiMessageEditor({
            tone: styleTab.selectedTone,
            isEmojify: styleTab?.shouldEmojify,
          });
        }
        break;
      case 'fix':
        composeWithAiMessageEditor({ shouldProofread: true });
        break;
    }
  });

  const handleApply = useLastCallback(() => {
    applyAiMessageEditorResult();
  });

  const handleGenerate = useLastCallback(() => {
    if (!styleTab?.customPrompt?.trim() || isLoading) return;
    composeWithAiMessageEditor({ tone: styleTab.selectedTone, isEmojify: styleTab.shouldEmojify });
  });

  const handleOpenCocoonModal = useLastCallback(() => {
    openCocoonModal();
  });

  const handleSend = useLastCallback(() => {
    if (isInScheduledList) {
      requestCalendar((scheduledAt, scheduleRepeatPeriod) => {
        sendAiMessageEditorResult({ scheduledAt, scheduleRepeatPeriod });
      });
    } else {
      sendAiMessageEditorResult();
    }
  });

  const handleSendSilent = useLastCallback(() => {
    sendAiMessageEditorResult({ isSilent: true });
  });

  const handleSendSchedule = useLastCallback(() => {
    requestCalendar((scheduledAt, scheduleRepeatPeriod) => {
      sendAiMessageEditorResult({ scheduledAt, scheduleRepeatPeriod });
    });
  });

  const handleSendWhenOnline = useLastCallback(() => {
    sendAiMessageEditorResult({ scheduledAt: SCHEDULED_WHEN_ONLINE });
  });

  function renderTabContent() {
    switch (activeTabIndex) {
      case TAB_TRANSLATE:
        return (
          <div className={styles.tabContent}>
            <AiTextTranslateEditor
              content={content}
              selectedLanguage={translateTab?.selectedLanguage}
              selectedTone={translateTab?.selectedTone}
              shouldEmojify={translateTab?.shouldEmojify}
              isLoading={translateTab?.isLoading}
              result={translateTab?.result}
              error={translateTab?.error}
              isPremium={isPremium}
            />
          </div>
        );
      case TAB_STYLE:
        return (
          <div className={styles.tabContent}>
            <AiTextStyleEditor
              content={content}
              customPrompt={styleTab?.customPrompt}
              selectedTone={styleTab?.selectedTone}
              shouldEmojify={styleTab?.shouldEmojify}
              isLoading={styleTab?.isLoading}
              result={styleTab?.result}
              error={styleTab?.error}
              isPremium={isPremium}
              onGenerate={handleGenerate}
            />
          </div>
        );
      case TAB_FIX:
        return (
          <div className={styles.tabContent}>
            <AiTextFixEditor
              content={content}
              isLoading={fixTab?.isLoading}
              result={fixTab?.result}
              error={fixTab?.error}
              isPremium={isPremium}
            />
          </div>
        );
      default:
        return undefined;
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      title={lang('AiMessageEditor')}
      hasCloseButton
      onClose={closeAiMessageEditorModal}
      className={buildClassName(
        styles.modal, !hasSource && styles.promptOnly, isStoryViewerOpen && 'component-theme-dark',
      )}
      headerClassName="modal-header-condensed-wide"
      dialogClassName={styles.modalDialog}
      contentClassName={styles.modalContent}
      headerRightToolBar={(
        <Button
          className={styles.helpButton}
          round
          size="tiny"
          color="translucent"
          iconName="help"
          ariaLabel={lang('ButtonHelp')}
          onClick={handleOpenCocoonModal}
        />
      )}
      isSlim
    >
      {hasSource && (
        <TabList
          tabs={tabs}
          activeTab={activeTabIndex}
          withFadeMask
          fadeMaskClassName={styles.fadeMask}
          className={styles.tabList}
          tabClassName={styles.tab}
          stretched
          itemAlignment="vertical"
          onSwitchTab={handleTabChange}
        />
      )}

      <div className={styles.transitionWrapper}>
        <Transition
          className={styles.transition}
          name={resolveTransitionName('slideOptimized', animationLevel, undefined, lang.isRtl)}
          activeKey={activeTabIndex}
          renderCount={tabs.length}
        >
          {renderTabContent()}
        </Transition>
      </div>

      <div className={styles.footer}>
        <Button
          className={styles.applyButton}
          isShiny={isLoading}
          disabled={isLoading || (shouldGenerate ? !styleTab?.customPrompt?.trim() : Boolean(error) || !hasContent)}
          onClick={shouldGenerate ? handleGenerate : handleApply}
        >
          {lang(shouldGenerate ? 'AiEditorGenerate' : 'AiMessageEditorApply')}
        </Button>
        {!isEditing && (
          <Button
            ref={mainButtonRef}
            className={styles.sendButton}
            round
            color="primary"
            disabled={shouldGenerate || isLoading || Boolean(error) || !hasContent}
            ariaLabel={lang('Send')}
            onClick={handleSend}
            onContextMenu={!isInScheduledList && !paidMessagesStars ? handleContextMenu : undefined}
            iconName="new-send"
          >
            <Button
              className={buildClassName(
                styles.paidStarsBadge,
                !shouldRenderPaidBadge && styles.hidden,
              )}
              nonInteractive
              size="tiny"
              color="stars"
              pill
              fluid
            >
              <div className={styles.paidStarsBadgeText}>
                <Icon name="star" />
                <AnimatedCounter text={lang.number(starsForMessage)} />
              </div>
            </Button>
          </Button>
        )}
        {isOpen && !isEditing && !isInScheduledList && (
          <CustomSendMenu
            isOpen={isCustomSendMenuOpen}
            canSchedule
            canScheduleUntilOnline={canScheduleUntilOnline}
            onSendSilent={!isChatWithSelf ? handleSendSilent : undefined}
            onSendSchedule={handleSendSchedule}
            onSendWhenOnline={handleSendWhenOnline}
            onClose={handleContextMenuClose}
            onCloseAnimationEnd={handleContextMenuHide}
            isSavedMessages={isChatWithSelf}
          />
        )}
      </div>
      {calendar}
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => {
    const chatId = modal?.chatId;
    const currentMessageList = selectCurrentMessageList(global);
    const paidMessagesStars = chatId ? selectPeerPaidMessagesStars(global, chatId) : undefined;

    return {
      animationLevel: selectAnimationLevel(global),
      isPremium: selectIsCurrentUserPremium(global),
      isChatWithSelf: chatId ? selectIsChatWithSelf(global, chatId) : undefined,
      canScheduleUntilOnline: currentMessageList?.chatId
        ? selectCanScheduleUntilOnline(global, currentMessageList.chatId)
        : undefined,
      isInScheduledList: currentMessageList?.type === 'scheduled',
      paidMessagesStars,
      isStoryViewerOpen: selectIsStoryViewerOpen(global),
    };
  },
)(AiMessageEditorModal));
