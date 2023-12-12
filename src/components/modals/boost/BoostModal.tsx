import React, { memo, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChat, ApiMyBoost } from '../../../api/types';
import type { TabState } from '../../../global/types';

import { getChatTitle } from '../../../global/helpers';
import { selectChat, selectIsCurrentUserPremium } from '../../../global/selectors';
import { formatDateInFuture } from '../../../util/dateFormat';
import { getServerTime } from '../../../util/serverTime';
import { getBoostProgressInfo } from '../../common/helpers/boostInfo';
import renderText from '../../common/helpers/renderText';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Avatar from '../../common/Avatar';
import Icon from '../../common/Icon';
import PremiumProgress from '../../common/PremiumProgress';
import Button from '../../ui/Button';
import ConfirmDialog from '../../ui/ConfirmDialog';
import Loading from '../../ui/Loading';
import Modal from '../../ui/Modal';

import styles from './BoostModal.module.scss';

type LoadedParams = {
  boost?: ApiMyBoost;
  leftText: string;
  rightText?: string;
  value: string;
  progress: number;
  descriptionText: string;
  isBoosted?: boolean;
  canBoostMore?: boolean;
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
  isCurrentUserPremium?: boolean;
};

const BoostModal = ({
  info,
  chat,
  boostedChat,
  isCurrentUserPremium,
}: OwnProps & StateProps) => {
  const {
    applyBoost,
    closeBoostModal,
    requestConfetti,
    openPremiumModal,
  } = getActions();

  const [isReplaceModalOpen, openReplaceModal, closeReplaceModal] = useFlag();
  const [isWaitDialogOpen, openWaitDialog, closeWaitDialog] = useFlag();
  const [isPremiumDialogOpen, openPremiumDialog, closePremiumDialog] = useFlag();

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
    boost,
    title,
    leftText,
    rightText,
    value,
    progress,
    descriptionText,
    canBoostMore,
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

    const firstBoost = info?.myBoosts && getFirstAvailableBoost(info.myBoosts, chat.id);
    const areBoostsInDifferentChannels = info?.myBoosts && !areAllBoostsInChannel(info.myBoosts, chat.id);

    const {
      boosts,
      currentLevel,
      hasNextLevel,
      levelProgress,
      remainingBoosts,
    } = getBoostProgressInfo(info.boostStatus, true);

    const hasBoost = hasMyBoost;
    const isJustUpgraded = boosts === currentLevelBoosts && hasBoost;

    const left = lang('BoostsLevel', currentLevel);
    const right = hasNextLevel ? lang('BoostsLevel', currentLevel + 1) : undefined;

    const moreBoosts = lang('ChannelBoost.MoreBoosts', remainingBoosts);
    const currentStoriesPerDay = lang('ChannelBoost.StoriesPerDay', level);
    const nextLevelStoriesPerDay = lang('ChannelBoost.StoriesPerDay', level + 1);

    const modalTitle = hasBoost ? lang('YouBoostedChannel2', chatTitle)
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
      boost: firstBoost,
      isBoosted: hasBoost,
      canBoostMore: areBoostsInDifferentChannels,
    };
  }, [chat, chatTitle, info, lang]);

  const isBoostDisabled = !info?.myBoosts?.length && isCurrentUserPremium;
  const isReplacingBoost = boost?.chatId && boost.chatId !== info?.chatId;

  const handleApplyBoost = useLastCallback(() => {
    closeReplaceModal();
    applyBoost({ chatId: chat!.id, slots: [boost!.slot] });
    requestConfetti({});
  });

  const handleProceedPremium = useLastCallback(() => {
    openPremiumModal();
    closePremiumDialog();
    closeBoostModal();
  });

  const handleButtonClick = useLastCallback(() => {
    if (!boost) {
      if (!isCurrentUserPremium) {
        openPremiumDialog();
      }

      closeBoostModal();
      return;
    }

    if (!canBoostMore) {
      closeBoostModal();
      return;
    }

    if (boost.cooldownUntil) {
      openWaitDialog();
      return;
    }

    if (isReplacingBoost) {
      openReplaceModal();
      return;
    }

    handleApplyBoost();
  });

  const handleCloseClick = useLastCallback(() => {
    closeBoostModal();
  });

  function renderContent() {
    if (!isStatusLoaded) {
      return <Loading className={styles.loading} />;
    }

    return (
      <>
        <PremiumProgress
          leftText={leftText}
          rightText={rightText}
          progress={progress}
          floatingBadgeText={value}
          floatingBadgeIcon="boost"
        />
        <div className={styles.description}>
          {renderText(descriptionText, ['simple_markdown', 'emoji'])}
        </div>
        <div className="dialog-buttons">
          <Button isText className="confirm-dialog-button" disabled={isBoostDisabled} onClick={handleButtonClick}>
            {canBoostMore ? (
              <>
                <Icon name="boost" />
                {lang(isBoosted && canBoostMore ? 'BoostingBoostAgain' : 'ChannelBoost.BoostChannel')}
              </>
            ) : lang('OK')}
          </Button>
          <Button isText className="confirm-dialog-button" onClick={handleCloseClick}>
            {lang('Cancel')}
          </Button>
        </div>
      </>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      title={title}
      className={styles.modal}
      contentClassName={styles.content}
      onClose={closeBoostModal}
    >
      {renderContent()}
      {isReplacingBoost && boostedChatTitle && (
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
          <div>
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
      {Boolean(boost?.cooldownUntil) && (
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
              formatDateInFuture(lang, getServerTime(), boost!.cooldownUntil),
            ),
            ['simple_markdown', 'emoji'],
          )}
        </ConfirmDialog>
      )}
      {!isCurrentUserPremium && (
        <ConfirmDialog
          isOpen={isPremiumDialogOpen}
          confirmLabel={lang('Common.Yes')}
          title={lang('PremiumNeeded')}
          onClose={closePremiumDialog}
          confirmHandler={handleProceedPremium}
        >
          {renderText(lang('PremiumNeededForBoosting'), ['simple_markdown', 'emoji'])}
        </ConfirmDialog>
      )}
    </Modal>
  );
};

function getFirstAvailableBoost(myBoosts: ApiMyBoost[], chatId?: string) {
  return myBoosts.find((boost) => !boost.chatId)
    || myBoosts.filter((b) => chatId && b.chatId !== chatId)
      .sort((a, b) => a.date - b.date)[0];
}

function areAllBoostsInChannel(myBoosts: ApiMyBoost[], chatId: string) {
  return myBoosts.every((boost) => boost.chatId === chatId);
}

export default memo(withGlobal<OwnProps>(
  (global, { info }): StateProps => {
    const chat = info && selectChat(global, info?.chatId);
    const firstBoost = info?.myBoosts && getFirstAvailableBoost(info.myBoosts, info.chatId);
    const boostedChat = firstBoost?.chatId ? selectChat(global, firstBoost?.chatId) : undefined;

    return {
      chat,
      boostedChat,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
    };
  },
)(BoostModal));
