import React, { memo, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiApplyBoostInfo, ApiChat } from '../../../api/types';
import type { TabState } from '../../../global/types';

import { getChatTitle } from '../../../global/helpers';
import { selectChat } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { formatDateInFuture } from '../../../util/dateFormat';
import { getServerTime } from '../../../util/serverTime';
import { getBoostProgressInfo } from '../../common/helpers/boostInfo';
import renderText from '../../common/helpers/renderText';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Avatar from '../../common/Avatar';
import Icon from '../../common/Icon';
import PickerSelectedItem from '../../common/PickerSelectedItem';
import PremiumProgress from '../../common/PremiumProgress';
import Button from '../../ui/Button';
import ConfirmDialog from '../../ui/ConfirmDialog';
import Loading from '../../ui/Loading';
import Modal from '../../ui/Modal';

import styles from './BoostModal.module.scss';

type LoadedParams = {
  applyInfo?: ApiApplyBoostInfo;
  leftText: string;
  rightText?: string;
  value: string;
  progress: number;
  descriptionText: string;
  isBoosted?: boolean;
};

type BoostInfo = ({
  isStatusLoaded: false;
  title: string;
} & Undefined<LoadedParams>) | ({
  isStatusLoaded: true;
  title: string;
} & LoadedParams);

export type OwnProps = {
  info: TabState['boostModal'];
};

type StateProps = {
  chat?: ApiChat;
  boostedChat?: ApiChat;
};

const BoostModal = ({
  info,
  chat,
  boostedChat,
}: OwnProps & StateProps) => {
  const {
    openChat,
    applyBoost,
    closeBoostModal,
    requestConfetti,
  } = getActions();

  const [isReplaceModalOpen, openReplaceModal, closeReplaceModal] = useFlag();
  const [isWaitDialogOpen, openWaitDialog, closeWaitDialog] = useFlag();

  const isOpen = Boolean(info);

  const lang = useLang();

  const chatTitle = useMemo(() => {
    if (!chat) {
      return undefined;
    }

    return getChatTitle(lang, chat);
  }, [chat, lang]);

  const boostedChatTitle = useMemo(() => {
    if (!boostedChat) {
      return undefined;
    }

    return getChatTitle(lang, boostedChat);
  }, [boostedChat, lang]);

  const {
    isStatusLoaded,
    isBoosted,
    applyInfo,
    title,
    leftText,
    rightText,
    value,
    progress,
    descriptionText,
  }: BoostInfo = useMemo(() => {
    if (!info?.boostStatus || !chat) {
      return {
        isStatusLoaded: false,
        title: lang('Loading'),
      };
    }

    const {
      level, currentLevelBoosts, hasMyBoost,
    } = info.boostStatus;

    const {
      boosts,
      currentLevel,
      hasNextLevel,
      levelProgress,
      remainingBoosts,
    } = getBoostProgressInfo(info.boostStatus);

    const hasBoost = hasMyBoost || info.applyInfo?.type === 'already';
    const isJustUpgraded = boosts === currentLevelBoosts && hasBoost;

    const left = lang('BoostsLevel', currentLevel);
    const right = hasNextLevel ? lang('BoostsLevel', currentLevel + 1) : undefined;

    const moreBoosts = lang('ChannelBoost.MoreBoosts', remainingBoosts);
    const currentStoriesPerDay = lang('ChannelBoost.StoriesPerDay', level);
    const nextLevelStoriesPerDay = lang('ChannelBoost.StoriesPerDay', level + 1);

    const modalTitle = hasBoost ? lang('ChannelBoost.YouBoostedOtherChannel')
      : level === 0 ? lang('lng_boost_channel_title_first') : lang('lng_boost_channel_title_more');

    let description: string | undefined;
    if (level === 0) {
      if (!hasBoost) {
        description = lang('ChannelBoost.EnableStoriesForChannelText', [chatTitle, moreBoosts]);
      } else {
        description = lang('ChannelBoost.EnableStoriesMoreRequired', moreBoosts);
      }
    } else if (isJustUpgraded) {
      if (level === 1) {
        description = lang('ChannelBoost.EnabledStoriesForChannelText');
      } else {
        description = lang('ChannelBoost.BoostedChannelReachedLevel', [level, currentStoriesPerDay]);
      }
    } else {
      description = lang('ChannelBoost.HelpUpgradeChannelText', [chatTitle, moreBoosts, nextLevelStoriesPerDay]);
    }

    return {
      isStatusLoaded: true,
      title: modalTitle,
      leftText: left,
      rightText: right,
      value: boosts.toString(),
      progress: levelProgress,
      remainingBoosts,
      descriptionText: description,
      applyInfo: info.applyInfo,
      isBoosted: hasBoost,
    };
  }, [chat, chatTitle, info, lang]);

  const handleOpenChat = useLastCallback(() => {
    openChat({ id: chat!.id });
    closeBoostModal();
  });

  const handleApplyBoost = useLastCallback(() => {
    closeReplaceModal();
    applyBoost({ chatId: chat!.id });
    requestConfetti();
  });

  const handleButtonClick = useLastCallback(() => {
    if (applyInfo?.type === 'ok') {
      handleApplyBoost();
    }

    if (applyInfo?.type === 'replace') {
      openReplaceModal();
    }

    if (applyInfo?.type === 'wait') {
      openWaitDialog();
    }

    if (isBoosted) {
      closeBoostModal();
    }
  });

  function renderContent() {
    if (!isStatusLoaded) {
      return <Loading className={styles.loading} />;
    }

    return (
      <>
        {chat && (
          <PickerSelectedItem
            className={styles.chip}
            peerId={chat.id}
            isStandalone
            onClick={handleOpenChat}
          />
        )}
        <PremiumProgress
          leftText={leftText}
          rightText={rightText}
          progress={progress}
          floatingBadgeText={value}
          floatingBadgeIcon="boost"
        />
        <div className={buildClassName(styles.description, styles.textCenter)}>
          {renderText(descriptionText, ['simple_markdown', 'emoji'])}
        </div>
        <Button
          className={styles.button}
          size="smaller"
          withPremiumGradient
          isShiny
          isLoading={!applyInfo}
          ripple
          onClick={handleButtonClick}
        >
          {!isBoosted ? (
            <>
              <Icon name="boost" />
              {lang('ChannelBoost.BoostChannel')}
            </>
          ) : lang('OK')}
        </Button>
      </>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      title={title}
      contentClassName={styles.content}
      onClose={closeBoostModal}
      isSlim
      hasCloseButton
    >
      {renderContent()}
      {applyInfo?.type === 'replace' && boostedChatTitle && (
        <Modal
          isOpen={isReplaceModalOpen}
          className={styles.replaceModal}
          contentClassName={styles.replaceModalContent}
          onClose={closeReplaceModal}
        >
          <div className={styles.avatarContainer}>
            <div className={styles.boostedWrapper}>
              <Avatar peer={boostedChat} size="large" />
              <Icon name="boostcircle" className={styles.boostedMark} />
            </div>
            <Icon name="next" className={styles.arrow} />
            <Avatar peer={chat} size="large" />
          </div>
          <div className={styles.textCenter}>
            {renderText(lang('ChannelBoost.ReplaceBoost', [boostedChatTitle, chatTitle]), ['simple_markdown', 'emoji'])}
          </div>
          <div className="dialog-buttons">
            <Button isText className="confirm-dialog-button" onClick={handleApplyBoost}>
              {lang('Replace')}
            </Button>
            <Button isText className="confirm-dialog-button" onClick={closeReplaceModal}>
              {lang('Cancel')}
            </Button>
          </div>
        </Modal>
      )}
      {applyInfo?.type === 'wait' && (
        <ConfirmDialog
          isOpen={isWaitDialogOpen}
          isOnlyConfirm
          confirmLabel={lang('OK')}
          title={lang('ChannelBoost.Error.BoostTooOftenTitle')}
          onClose={closeWaitDialog}
          confirmHandler={closeWaitDialog}
        >
          {renderText(
            lang(
              'ChannelBoost.Error.BoostTooOftenText',
              formatDateInFuture(lang, getServerTime(), applyInfo.waitUntil),
            ),
            ['simple_markdown', 'emoji'],
          )}
        </ConfirmDialog>
      )}
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { info }): StateProps => {
    const chat = info && selectChat(global, info?.chatId);
    const boostedChat = info?.applyInfo?.type === 'replace'
      ? selectChat(global, info.applyInfo.boostedChatId) : undefined;

    return {
      chat,
      boostedChat,
    };
  },
)(BoostModal));
