import React, { memo, type TeactNode } from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiChat, ApiMessage, ApiPeer } from '../../../api/types';

import { GENERAL_TOPIC_ID, SERVICE_NOTIFICATIONS_USER_ID, TME_LINK_PREFIX } from '../../../config';
import {
  getMessageInvoice, getMessageText, getPeerTitle, isChatChannel,
} from '../../../global/helpers';
import { getMessageReplyInfo } from '../../../global/helpers/replies';
import {
  selectChat,
  selectChatMessage,
  selectPeer,
  selectSender,
  selectThreadIdFromMessage,
  selectTopic,
} from '../../../global/selectors';
import { ensureProtocol } from '../../../util/browser/url';
import { formatDateTimeToString, formatShortDuration } from '../../../util/dates/dateFormat';
import { formatCurrency } from '../../../util/formatCurrency';
import { formatStarsAsText } from '../../../util/localization/format';
import { conjuctionWithNodes } from '../../../util/localization/utils';
import renderText from '../../common/helpers/renderText';
import { renderTextWithEntities } from '../../common/helpers/renderTextWithEntities';
import {
  getCallMessageKey,
  getPinnedMediaValue,
  renderMessageLink,
  renderPeerLink,
  translateWithYou,
} from './helpers/messageActions';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import CustomEmoji from '../../common/CustomEmoji';
import TopicDefaultIcon from '../../common/TopicDefaultIcon';
import Link from '../../ui/Link';

import styles from './ActionMessage.module.scss';

type OwnProps = {
  message: ApiMessage;
  isInsideTopic?: boolean;
  asPreview?: boolean;
};

type StateProps = {
  currentUserId?: string;
  sender?: ApiPeer;
  replyMessage?: ApiMessage;
  chat?: ApiChat;
};

const NBSP = '\u00A0';
const DEFAULT_TOPIC_ICON_ID = '0';

const UNSUPPORTED_LANG_KEY = 'ActionUnsupported';

const ActionMessageText = ({
  message,
  currentUserId,
  sender,
  chat,
  replyMessage,
  isInsideTopic,
  asPreview,
}: OwnProps & StateProps) => {
  const {
    openThread,
    openTelegramLink,
    openUrl,
  } = getActions();
  const { chatId, isOutgoing } = message;
  const action = message.content.action!;

  const lang = useLang();

  function renderStrong(text: TeactNode) {
    if (asPreview) return text;
    return <span className={styles.strong}>{text}</span>;
  }

  const renderActionText = useLastCallback(() => {
    const global = getGlobal();

    const isChannel = chat && isChatChannel(chat);
    const isServiceNotificationsChat = chatId === SERVICE_NOTIFICATIONS_USER_ID;
    const isSavedMessages = chatId === currentUserId;

    const senderTitle = sender && getPeerTitle(lang, sender);
    const chatTitle = chat && getPeerTitle(lang, chat);

    const userFallbackText = lang('ActionFallbackUser');
    const chatFallbackText = lang('ActionFallbackChat');
    const channelFallbackText = lang('ActionFallbackChannel');

    const senderLink = renderPeerLink(sender?.id, senderTitle || userFallbackText, asPreview);
    const chatLink = renderPeerLink(chat?.id, chatTitle || chatFallbackText, asPreview);

    switch (action.type) {
      case 'pinMessage': {
        if (replyMessage) {
          const formattedText = getMessageText(replyMessage);
          if (formattedText) {
            const textLink = renderMessageLink(
              replyMessage,
              renderTextWithEntities({
                text: formattedText.text,
                entities: formattedText.entities,
                asPreview: true,
              }),
              asPreview,
            );

            return translateWithYou(
              lang, 'ActionPinnedText', isOutgoing, { text: textLink, from: senderLink },
            );
          }

          const mediaValue = getPinnedMediaValue(lang, replyMessage);
          if (mediaValue) {
            const messageLink = renderMessageLink(replyMessage, mediaValue, asPreview);
            return translateWithYou(
              lang, 'ActionPinnedMedia', isOutgoing, { from: senderLink, media: messageLink },
            );
          }
        }

        return translateWithYou(
          lang,
          'ActionPinnedNotFound',
          isOutgoing,
          { from: senderLink },
        );
      }

      case 'gameScore': {
        const { score } = action;

        const gameTitle = replyMessage?.content.game?.title;
        const gameLink = gameTitle && renderMessageLink(replyMessage, renderText(gameTitle), asPreview);

        if (gameLink) {
          return translateWithYou(
            lang,
            'ActionGameScore',
            isOutgoing,
            { from: senderLink, count: score, game: gameLink },
            { pluralValue: score },
          );
        }

        return translateWithYou(
          lang, 'ActionGameScoreNoGame', isOutgoing, { from: senderLink, count: score }, { pluralValue: score },
        );
      }

      case 'chatJoinedByLink':
        return lang('ActionUserJoinedByLink', { from: senderLink }, { withNodes: true });

      case 'chatJoinedByRequest':
        return translateWithYou(lang, 'ActionJoinedByRequest', isOutgoing, { from: senderLink });

      case 'channelJoined': {
        const { isViaRequest, inviterId } = action;
        const inviter = inviterId ? selectPeer(global, inviterId) : undefined;
        if (inviter && inviterId !== currentUserId) {
          const inviterLink = renderPeerLink(inviterId, getPeerTitle(lang, inviter) || userFallbackText, asPreview);
          return lang('ActionAddYou', { from: inviterLink }, { withNodes: true });
        }

        return lang(isViaRequest ? 'ActionChannelJoinedByRequestChannelYou' : 'ActionChannelJoinedYou');
      }

      case 'chatEditTitle': {
        const { title } = action;
        if (isChannel) return lang('ActionChangedTitleChannel', { title });
        return translateWithYou(lang, 'ActionChangedTitle', isOutgoing, { title, from: senderLink });
      }

      case 'chatDeletePhoto':
        return isChannel ? lang('ActionRemovedPhotoChannel')
          : translateWithYou(lang, 'ActionRemovedPhoto', isOutgoing, { from: senderLink });

      case 'chatEditPhoto':
        return isChannel ? lang('ActionChangedPhotoChannel')
          : translateWithYou(lang, 'ActionChangedPhoto', isOutgoing, { from: senderLink });

      case 'chatCreate': {
        const { title } = action;
        return lang('ActionCreatedChat', { title, from: senderLink }, { withNodes: true });
      }

      case 'channelCreate': {
        const { title } = action;
        return isChannel ? lang('ActionCreatedChannel')
          : translateWithYou(lang, 'ActionCreatedChat', isOutgoing, { title, from: senderLink });
      }

      case 'chatMigrateTo': {
        const { channelId } = action;
        const channel = selectChat(global, channelId)!;
        const channelLink = renderPeerLink(channelId, getPeerTitle(lang, channel)!, asPreview);
        return lang('ActionMigratedTo', { chat: channelLink }, { withNodes: true });
      }

      case 'channelMigrateFrom': {
        const { chatId: originalChatId, title } = action;
        const originalChatLink = renderPeerLink(originalChatId, title || chatFallbackText, asPreview);
        return lang('ActionMigratedFrom', { chat: originalChatLink }, { withNodes: true });
      }

      case 'topicCreate': {
        const { title, iconColor, iconEmojiId } = action;

        const topicId = selectThreadIdFromMessage(global, message);

        const topicLink = (
          <Link
            className={styles.topicLink}
            // eslint-disable-next-line react/jsx-no-bind
            onClick={() => openThread({ chatId, threadId: topicId })}
          >
            {iconEmojiId ? <CustomEmoji documentId={iconEmojiId} isSelectable />
              : <TopicDefaultIcon topicId={topicId} title={title} iconColor={iconColor} />}
            {NBSP}
            {renderText(title)}
          </Link>
        );
        return lang('ActionTopicCreated', { topic: topicLink }, { withNodes: true });
      }

      case 'topicEdit': {
        const {
          iconEmojiId, isClosed, isHidden, title,
        } = action;

        const topicId = selectThreadIdFromMessage(global, message);
        const currentTopic = selectTopic(global, chatId, topicId);
        const topicLink = (
          <Link
            className={styles.topicLink}
            // eslint-disable-next-line react/jsx-no-bind
            onClick={() => openThread({ chatId, threadId: topicId })}
          >
            {iconEmojiId && iconEmojiId !== DEFAULT_TOPIC_ICON_ID
              ? <CustomEmoji documentId={iconEmojiId} isSelectable />
              : (
                <TopicDefaultIcon
                  topicId={topicId}
                  title={title || currentTopic?.title || lang('ActionTopicPlaceholder')}
                  iconColor={currentTopic?.iconColor}
                />
              )}
            {topicId !== GENERAL_TOPIC_ID && NBSP}
            {renderText(title || currentTopic?.title || lang('ActionTopicPlaceholder'))}
          </Link>
        );

        const topicPlaceholderLink = (
          <Link
            className={styles.topicLink}
            // eslint-disable-next-line react/jsx-no-bind
            onClick={() => openThread({ chatId, threadId: topicId })}
          >
            {lang('ActionTopicPlaceholder')}
          </Link>
        );

        if (isClosed !== undefined) {
          if (isInsideTopic) {
            return lang(isClosed ? 'ActionTopicClosedInside' : 'ActionTopicReopenedInside');
          }

          return lang(
            isClosed ? 'ActionTopicClosed' : 'ActionTopicReopened',
            { from: senderLink, topic: topicLink },
            { withNodes: true },
          );
        }

        if (isHidden !== undefined) {
          if (isInsideTopic) {
            return lang(isHidden ? 'ActionTopicHiddenInside' : 'ActionTopicUnhiddenInside');
          }
          return lang(
            isHidden ? 'ActionTopicHidden' : 'ActionTopicUnhidden',
            { topic: topicLink },
            { withNodes: true },
          );
        }

        if (title && iconEmojiId) {
          return lang(
            'ActionTopicIconAndRenamed',
            {
              from: senderLink,
              link: topicPlaceholderLink,
              topic: topicLink,
            },
            { withNodes: true },
          );
        }

        if (title === undefined) {
          if (!iconEmojiId || iconEmojiId === DEFAULT_TOPIC_ICON_ID) {
            return lang(
              'ActionTopicIconRemoved', { from: senderLink, link: topicPlaceholderLink }, { withNodes: true },
            );
          }
          return lang(
            'ActionTopicIconChanged',
            {
              from: senderLink,
              link: topicPlaceholderLink,
              emoji: <CustomEmoji documentId={iconEmojiId} loopLimit={2} />,
            },
            { withNodes: true },
          );
        }

        return lang('ActionTopicRenamed', { from: senderLink, link: topicPlaceholderLink, title }, { withNodes: true });
      }

      case 'boostApply':
        return translateWithYou(
          lang,
          'ActionBoostApply',
          isOutgoing,
          { from: senderLink, count: action.boosts },
          { pluralValue: action.boosts },
        );

      case 'chatAddUser': {
        const { userIds } = action;

        if (sender?.id === userIds[0]) {
          return translateWithYou(lang, 'ActionUserJoined', isOutgoing, { from: senderLink });
        }

        if (userIds.length === 1) {
          const user = selectPeer(global, userIds[0]);
          const userTitle = (user && getPeerTitle(lang, user)) || userFallbackText;
          const userLink = renderPeerLink(user?.id, userTitle, asPreview);
          return translateWithYou(lang, 'ActionAddUser', isOutgoing, { from: senderLink, user: userLink });
        }

        const users = userIds.map((userId) => selectPeer(global, userId)).filter(Boolean);

        if (!users.length) {
          return translateWithYou(lang, 'ActionAddUser', isOutgoing, { from: senderLink, user: userFallbackText });
        }

        const userLinks = users.map((user) => (
          renderPeerLink(user.id, getPeerTitle(lang, user) || userFallbackText, asPreview)
        ));

        return translateWithYou(
          lang, 'ActionAddUsersMany', isOutgoing, { from: senderLink, users: conjuctionWithNodes(lang, userLinks) },
        );
      }

      case 'chatDeleteUser': {
        const { userId } = action;
        if (sender?.id === userId) {
          return translateWithYou(lang, 'ActionUserLeft', isOutgoing, { from: senderLink });
        }

        const user = selectPeer(global, userId);
        const userTitle = (user && getPeerTitle(lang, user)) || userFallbackText;
        const userLink = renderPeerLink(user?.id, userTitle, asPreview);
        return translateWithYou(lang, 'ActionKickUser', isOutgoing, { from: senderLink, user: userLink });
      }

      case 'botAllowed': {
        const {
          app, domain, isAttachMenu, isFromRequest,
        } = action;
        if (isAttachMenu) return lang('ActionAttachMenuBotAllowed');
        if (isFromRequest) return lang('ActionWebappBotAllowed');
        if (app) {
          const link = sender?.usernames?.length
            && `${TME_LINK_PREFIX + sender.usernames[0].username}/${app.shortName}`;
          const appLink = link
            // eslint-disable-next-line react/jsx-no-bind
            ? <Link onClick={() => openTelegramLink({ url: link })}>{app.title}</Link>
            : lang('ActionBotAppPlaceholder');
          return lang('ActionBotAllowedFromApp', { app: appLink }, { withNodes: true });
        }

        if (!domain) return lang(UNSUPPORTED_LANG_KEY);

        const url = ensureProtocol(domain)!;
        // eslint-disable-next-line react/jsx-no-bind
        const link = <Link onClick={() => openUrl({ url })}>{domain}</Link>;
        return lang('ActionBotAllowedFromDomain', { domain: link }, { withNodes: true });
      }

      case 'giveawayLaunch': {
        const { stars } = action;

        if (stars) {
          return lang(
            isChannel ? 'ActionGiveawayStarsStarted' : 'ActionGiveawayStarsStartedGroup',
            { from: senderLink, amount: renderStrong(formatStarsAsText(lang, stars)) },
            { withNodes: true },
          );
        }

        return lang(
          isChannel ? 'ActionGiveawayStarted' : 'ActionGiveawayStartedGroup',
          { from: senderLink },
          { withNodes: true },
        );
      }

      case 'giveawayResults': {
        const { winnersCount, isStars, unclaimedCount } = action;
        if (!winnersCount) return lang('ActionGiveawayResultsNone');
        if (unclaimedCount) {
          return lang(isStars ? 'ActionGiveawayResultsStarsSome' : 'ActionGiveawayResultsSome');
        }

        return lang(
          isStars ? 'ActionGiveawayResultsStars' : 'ActionGiveawayResults',
          { count: winnersCount },
          { pluralValue: winnersCount },
        );
      }

      case 'giftStars':
      case 'giftPremium': {
        const {
          amount, currency, cryptoAmount, cryptoCurrency,
        } = action;

        const price = formatCurrency(lang, amount, currency, { asFontIcon: true });
        const cryptoPrice = cryptoAmount ? formatCurrency(lang, cryptoAmount, cryptoCurrency!) : undefined;

        const cost = cryptoPrice ? lang('ActionCostCrypto', { price, cryptoPrice }, { withNodes: true }) : price;

        if (isServiceNotificationsChat) {
          return lang('ActionGiftTextCostAnonymous', { cost }, { withNodes: true });
        }
        return translateWithYou(
          lang, 'ActionGiftTextCost', isOutgoing, { from: senderLink, cost: renderStrong(cost) },
        );
      }

      case 'prizeStars':
      case 'giftCode': {
        return lang('ActionGiftTextUnknown');
      }

      case 'groupCall': {
        const { duration } = action;
        const durationText = duration ? formatShortDuration(lang, duration) : undefined;
        if (durationText) {
          if (isChannel) {
            return lang('ActionGroupCallFinishedChannel', { duration: durationText });
          }
          return lang(
            'ActionGroupCallFinishedGroup', { from: senderLink, duration: durationText }, { withNodes: true },
          );
        }

        if (isChannel) return lang('ActionGroupCallStartedChannel');
        return lang('ActionGroupCallStartedGroup', { from: senderLink }, { withNodes: true });
      }

      case 'groupCallScheduled': {
        const { scheduleDate } = action;
        const formattedDate = formatDateTimeToString(scheduleDate * 1000, lang.code, true);

        if (isChannel) return lang('ActionGroupCallScheduledChannel', { date: formattedDate });
        return lang('ActionGroupCallScheduledGroup', { from: senderLink, date: formattedDate }, { withNodes: true });
      }

      case 'inviteToGroupCall': {
        const { userIds } = action;

        if (userIds.length === 1) {
          const user = selectPeer(global, userIds[0]);
          const userTitle = (user && getPeerTitle(lang, user)) || userFallbackText;
          const userLink = renderPeerLink(user?.id, userTitle, asPreview);
          return translateWithYou(lang, 'ActionVideoInvited', isOutgoing, { from: senderLink, user: userLink });
        }

        const users = userIds.map((userId) => selectPeer(global, userId)).filter(Boolean);

        if (!users.length) {
          return translateWithYou(
            lang, 'ActionVideoInvited', isOutgoing, { from: senderLink, user: userFallbackText },
          );
        }

        const userLinks = users.map((user) => (
          renderPeerLink(user.id, getPeerTitle(lang, user) || userFallbackText, asPreview)
        ));

        return translateWithYou(
          lang, 'ActionVideoInvitedMany', isOutgoing, { from: senderLink, users: conjuctionWithNodes(lang, userLinks) },
        );
      }

      case 'paymentSent': {
        const {
          currency, totalAmount, isRecurringInit, isRecurringUsed,
        } = action;

        const cost = renderStrong(formatCurrency(lang, totalAmount, currency, { asFontIcon: true }));
        const invoice = replyMessage && getMessageInvoice(replyMessage);
        const invoiceTitle = invoice?.title;

        if (isRecurringUsed) {
          return lang('ActionPaymentUsedRecurring', { amount: cost }, { withNodes: true });
        }

        if (!invoiceTitle) {
          if (isRecurringInit) {
            return lang('ActionPaymentInitRecurring', { amount: cost, user: chatLink }, { withNodes: true });
          }

          return lang('ActionPaymentDone', { amount: cost, user: chatLink }, { withNodes: true });
        }

        if (isRecurringInit) {
          return lang(
            'ActionPaymentInitRecurringFor',
            { amount: cost, user: chatLink, invoice: renderMessageLink(replyMessage!, invoiceTitle, asPreview) },
            { withNodes: true },
          );
        }

        return lang(
          'ActionPaymentDoneFor',
          { amount: cost, user: chatLink, invoice: renderMessageLink(replyMessage!, invoiceTitle, asPreview) },
          { withNodes: true },
        );
      }

      case 'paymentRefunded': {
        const { currency, totalAmount, peerId } = action;
        const peer = selectPeer(global, peerId);
        const peerTitle = (peer && getPeerTitle(lang, peer)) || userFallbackText;
        const peerLink = renderPeerLink(peer?.id, peerTitle, asPreview);
        const amount = formatCurrency(lang, totalAmount, currency, { asFontIcon: true });

        return lang('ActionPaymentRefunded', { peer: peerLink, amount }, { withNodes: true });
      }

      case 'starGift': {
        const {
          gift, alreadyPaidUpgradeStars, peerId, savedId, fromId,
        } = action;
        const isToChannel = Boolean(peerId && savedId);

        const fromPeer = fromId ? selectPeer(global, fromId) : sender;
        const fromTitle = (fromPeer && getPeerTitle(lang, fromPeer)) || userFallbackText;
        const fromLink = renderPeerLink(fromPeer?.id, fromTitle, asPreview);

        const starsAmount = gift.stars + (alreadyPaidUpgradeStars || 0);
        const cost = renderStrong(formatStarsAsText(lang, starsAmount));

        if (isToChannel) {
          const channelPeer = selectPeer(global, peerId!);
          const isYou = fromPeer?.id === currentUserId;

          const channelTitle = (channelPeer && getPeerTitle(lang, channelPeer)) || channelFallbackText;
          const channelLink = renderPeerLink(peerId, channelTitle, asPreview);
          return translateWithYou(
            lang, 'ActionStarGiftSentChannel', isYou, { user: fromLink, channel: channelLink, cost },
          );
        }

        if (isServiceNotificationsChat) {
          return lang('ActionStarGiftReceivedAnonymous', { cost }, { withNodes: true });
        }

        if (isSavedMessages) {
          return lang('ActionStarGiftSelfBought', { cost }, { withNodes: true });
        }

        if (isOutgoing) {
          return lang('ActionStarGiftSent', { cost }, { withNodes: true });
        }

        return lang('ActionStarGiftReceived', { user: senderLink, cost }, { withNodes: true });
      }

      case 'starGiftUnique': {
        const {
          isTransferred, isUpgrade, savedId, peerId, fromId,
        } = action;

        const isToChannel = Boolean(peerId && savedId);

        const fromPeer = fromId ? selectPeer(global, fromId) : sender;
        const fromTitle = (fromPeer && getPeerTitle(lang, fromPeer)) || userFallbackText;
        const fromLink = renderPeerLink(fromPeer?.id, fromTitle, asPreview);

        if (isToChannel) {
          const channelPeer = selectPeer(global, peerId!);
          const isYou = fromPeer?.id === currentUserId;
          const isAnonymous = fromPeer?.id === SERVICE_NOTIFICATIONS_USER_ID;

          const channelTitle = (channelPeer && getPeerTitle(lang, channelPeer)) || channelFallbackText;
          const channelLink = renderPeerLink(peerId, channelTitle, asPreview);

          if (isUpgrade) {
            return translateWithYou(
              lang, 'ActionStarGiftUpgradedChannel', isYou, { user: fromLink, channel: channelLink },
            );
          }

          if (isTransferred) {
            if (isAnonymous) {
              return lang('ActionStarGiftTransferredUnknownChannel', { channel: channelLink }, { withNodes: true });
            }

            return translateWithYou(
              lang, 'ActionStarGiftTransferredChannel', isYou, { user: fromLink, channel: channelLink },
            );
          }
        }

        if (isSavedMessages) {
          if (isUpgrade) return lang('ActionStarGiftUpgradedSelf');
          if (isTransferred) return lang('ActionStarGiftTransferredSelf');
        }

        if (isUpgrade) {
          if (isOutgoing) {
            return lang('ActionStarGiftUpgradedMine', { user: chatLink }, { withNodes: true });
          }

          if (isSavedMessages) {
            return lang('ActionStarGiftUpgradedSelf');
          }

          return lang('ActionStarGiftUpgradedUser', { user: senderLink }, { withNodes: true });
        }

        if (isTransferred) {
          if (sender?.id === SERVICE_NOTIFICATIONS_USER_ID) {
            return lang('ActionStarGiftTransferredUnknown');
          }

          if (isSavedMessages) {
            return lang('ActionStarGiftTransferredSelf');
          }

          if (isOutgoing) {
            return lang('ActionStarGiftTransferredMine', { user: chatLink }, { withNodes: true });
          }

          return lang('ActionStarGiftTransferred', { user: senderLink }, { withNodes: true });
        }

        if (isOutgoing) {
          return lang('ActionGiftUniqueSent');
        }

        return lang('ActionGiftUniqueReceived', { user: senderLink }, { withNodes: true });
      }

      case 'suggestProfilePhoto': {
        const actionPeer = (isOutgoing ? chat : sender)!;
        const actionPeerLink = renderPeerLink(
          actionPeer.id, getPeerTitle(lang, actionPeer) || userFallbackText, asPreview,
        );

        return translateWithYou(lang, 'ActionSuggestedPhoto', isOutgoing, { user: actionPeerLink });
      }

      case 'webViewDataSent':
        return lang('ActionWebviewDataDone', { text: action.text });

      case 'expired': {
        const { isRoundVideo, isVoice } = action;
        if (isVoice) return lang('ActionExpiredVoice');
        if (isRoundVideo) return lang('ActionExpiredVideo');

        return lang(UNSUPPORTED_LANG_KEY);
      }

      case 'historyClear':
        return lang('ActionHistoryCleared');

      case 'screenshotTaken':
        return translateWithYou(lang, 'ActionScreenshotTaken', isOutgoing, { from: senderLink });

      case 'contactSignUp':
        return lang('ActionUserRegistered', { from: senderLink }, { withNodes: true });

      case 'customAction':
        return action.message;

      case 'phoneCall': // Rendered as a regular message, but considered an action for the summary
        return lang(getCallMessageKey(action, isOutgoing));
      default:
        return lang(UNSUPPORTED_LANG_KEY);
    }
  });

  return renderActionText();
};

export default memo(withGlobal<OwnProps>(
  (global, { message }): StateProps => {
    const chat = selectChat(global, message.chatId);
    const sender = selectSender(global, message);

    const { replyToMsgId, replyToPeerId } = getMessageReplyInfo(message) || {};
    const replyMessage = replyToMsgId
      ? selectChatMessage(global, replyToPeerId || message.chatId, replyToMsgId) : undefined;

    return {
      currentUserId: global.currentUserId,
      replyMessage,
      chat,
      sender,
    };
  },
)(ActionMessageText));
