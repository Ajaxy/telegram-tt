import { memo, useEffect, useMemo, useRef } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiChat } from '../../../../api/types';
import type { TabState } from '../../../../global/types';
import type { AnimationLevel } from '../../../../types';
import type { IconName } from '../../../../types/icons';

import { SCHEDULED_WHEN_ONLINE } from '../../../../config';
import { getPeerTitle } from '../../../../global/helpers/peers';
import {
  selectCanScheduleUntilOnline,
  selectChat,
  selectIsChatWithSelf,
  selectPeerPaidMessagesStars,
  selectTabState,
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
import usePaidMessageConfirmation from '../hooks/usePaidMessageConfirmation';

import AnimatedCounter from '../../../common/AnimatedCounter';
import Icon from '../../../common/icons/Icon';
import PaymentMessageConfirmDialog from '../../../common/PaymentMessageConfirmDialog';
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
  chat?: ApiChat;
  paidMessagesStars?: number;
  isPaymentMessageConfirmDialogOpen?: boolean;
  starsBalance: number;
  isStarsBalanceModalOpen?: boolean;
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
  chat,
  paidMessagesStars,
  isPaymentMessageConfirmDialogOpen,
  starsBalance,
  isStarsBalanceModalOpen,
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

  const {
    closeConfirmDialog: closeConfirmModalPayForMessage,
    handleWithConfirmation: handleActionWithPaymentConfirmation,
    dialogHandler: confirmModalPayForMessageHandler,
    shouldAutoApprove: shouldPaidMessageAutoApprove,
    setAutoApprove: setShouldPaidMessageAutoApprove,
  } = usePaidMessageConfirmation(starsForMessage, Boolean(isStarsBalanceModalOpen), starsBalance, true);

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
    text,
    translateTab,
    styleTab,
    fixTab,
  } = renderingModal || {};

  const currentTabState = activeTab === 'translate' ? translateTab
    : activeTab === 'style' ? styleTab : fixTab;
  const isLoading = currentTabState?.isLoading;
  const error = currentTabState?.error;

  const tabs = useMemo((): { icon: IconName; title: string }[] => [
    { icon: 'language', title: lang('AiMessageEditorTranslate') },
    { icon: 'ai-edit', title: lang('AiMessageEditorStyle') },
    { icon: 'ai-fix', title: lang('AiMessageEditorFix') },
  ], [lang]);

  const activeTabIndex = TAB_ID_TO_INDEX[activeTab || 'style'] ?? TAB_STYLE;

  const handleTabChange = useLastCallback((index: number) => {
    const tab = INDEX_TO_TAB_ID[index];
    setAiMessageEditorTab({ tab });

    if (!text?.text) return;

    switch (tab) {
      case 'translate':
        composeWithAiMessageEditor({
          translateToLang: translateTab?.selectedLanguage,
          changeTone: translateTab?.selectedTone,
          isEmojify: translateTab?.shouldEmojify,
        });
        break;
      case 'style':
        if (styleTab?.selectedTone) {
          composeWithAiMessageEditor({ changeTone: styleTab.selectedTone, isEmojify: styleTab?.shouldEmojify });
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

  const handleOpenCocoonModal = useLastCallback(() => {
    openCocoonModal();
  });

  const handleSendAction = useLastCallback((
    isSilent?: boolean, scheduledAt?: number, scheduleRepeatPeriod?: number,
  ) => {
    sendAiMessageEditorResult({ isSilent, scheduledAt, scheduleRepeatPeriod });
  });

  const handleSend = useLastCallback(() => {
    if (isInScheduledList) {
      requestCalendar((scheduledAt, scheduleRepeatPeriod) => {
        sendAiMessageEditorResult({ scheduledAt, scheduleRepeatPeriod });
      });
    } else {
      handleActionWithPaymentConfirmation(handleSendAction);
    }
  });

  const handleSendSilent = useLastCallback(() => {
    handleActionWithPaymentConfirmation(handleSendAction, true);
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
              text={text}
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
              text={text}
              selectedTone={styleTab?.selectedTone}
              shouldEmojify={styleTab?.shouldEmojify}
              isLoading={styleTab?.isLoading}
              result={styleTab?.result}
              error={styleTab?.error}
              isPremium={isPremium}
            />
          </div>
        );
      case TAB_FIX:
        return (
          <div className={styles.tabContent}>
            <AiTextFixEditor
              text={text}
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
      className={styles.modal}
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
      <div className={styles.tabListWrapper}>
        <TabList
          tabs={tabs}
          activeTab={activeTabIndex}
          onSwitchTab={handleTabChange}
          className={styles.tabList}
          tabClassName={styles.tab}
          stretched
          itemAlignment="vertical"
        />
      </div>

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
          disabled={isLoading || Boolean(error)}
          onClick={handleApply}
        >
          {lang('AiMessageEditorApply')}
        </Button>
        <Button
          ref={mainButtonRef}
          className={styles.sendButton}
          round
          color="primary"
          disabled={isLoading || Boolean(error)}
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
        {isOpen && !isInScheduledList && (
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
      <PaymentMessageConfirmDialog
        isOpen={Boolean(isPaymentMessageConfirmDialogOpen)}
        onClose={closeConfirmModalPayForMessage}
        userName={chat ? getPeerTitle(lang, chat) : undefined}
        messagePriceInStars={paidMessagesStars || 0}
        messagesCount={1}
        shouldAutoApprove={shouldPaidMessageAutoApprove}
        setAutoApprove={setShouldPaidMessageAutoApprove}
        confirmHandler={confirmModalPayForMessageHandler}
      />
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => {
    const chatId = modal?.chatId;
    const currentMessageList = selectCurrentMessageList(global);
    const tabState = selectTabState(global);
    const chat = chatId ? selectChat(global, chatId) : undefined;
    const paidMessagesStars = chatId ? selectPeerPaidMessagesStars(global, chatId) : undefined;
    const starsBalance = global.stars?.balance.amount || 0;
    const isStarsBalanceModalOpen = Boolean(tabState.starsBalanceModal);

    return {
      animationLevel: selectAnimationLevel(global),
      isPremium: selectIsCurrentUserPremium(global),
      isChatWithSelf: chatId ? selectIsChatWithSelf(global, chatId) : undefined,
      canScheduleUntilOnline: currentMessageList?.chatId
        ? selectCanScheduleUntilOnline(global, currentMessageList.chatId)
        : undefined,
      isInScheduledList: currentMessageList?.type === 'scheduled',
      chat,
      paidMessagesStars,
      isPaymentMessageConfirmDialogOpen: tabState.isPaymentMessageConfirmDialogOpen,
      starsBalance,
      isStarsBalanceModalOpen,
    };
  },
)(AiMessageEditorModal));
