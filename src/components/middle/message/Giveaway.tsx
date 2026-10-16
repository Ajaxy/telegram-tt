import type { TeactNode } from '../../../lib/teact/teact';
import {
  memo, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type {
  ApiChat, ApiGiveaway, ApiGiveawayInfo, ApiGiveawayResults, ApiMessage, ApiPeer, ApiSticker,
} from '../../../api/types';

import {
  getChatTitle, getUserFullName, isOwnMessage,
} from '../../../global/helpers';
import { isApiPeerChat } from '../../../global/helpers/peers';
import {
  selectCanPlayAnimatedEmojis,
  selectChat,
  selectForwardedSender,
  selectGiftStickerForDuration,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { isoToEmoji } from '../../../util/emoji/emoji';
import { formatCalendarDate, formatDateTime, secondsToDate } from '../../../util/localization/dateFormat';
import { getServerTime } from '../../../util/serverTime';
import { callApi } from '../../../api/gramjs';
import { LOCAL_TGS_URLS } from '../../common/helpers/animatedAssets';
import renderText from '../../common/helpers/renderText';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import AnimatedIconFromSticker from '../../common/AnimatedIconFromSticker';
import AnimatedIconWithPreview from '../../common/AnimatedIconWithPreview';
import PeerChip from '../../common/PeerChip';
import Button from '../../ui/Button';
import ConfirmDialog from '../../ui/ConfirmDialog';
import Separator from '../../ui/Separator';

import styles from './Giveaway.module.scss';

type OwnProps = {
  message: ApiMessage;
};

type StateProps = {
  chat: ApiChat;
  sender?: ApiPeer;
  giftSticker?: ApiSticker;
  canPlayAnimatedEmojis?: boolean;
};

const NBSP = '\u00A0';
const GIFT_STICKER_SIZE = 175;
const RESULT_STICKER_SIZE = 150;

const Giveaway = ({
  chat,
  sender,
  message,
  canPlayAnimatedEmojis,
  giftSticker,
}: OwnProps & StateProps) => {
  const { openChat } = getActions();
  const lang = useLang();

  const isLoadingInfoRef = useRef(false);
  const [giveawayInfo, setGiveawayInfo] = useState<ApiGiveawayInfo | undefined>();

  const { giveaway, giveawayResults } = message.content;
  const isResults = Boolean(giveawayResults);
  const {
    months, untilDate, prizeDescription, stars,
  } = (giveaway || giveawayResults)!;

  const isOwn = isOwnMessage(message);

  const quantity = isResults ? giveawayResults.winnersCount! : giveaway!.quantity;

  const hasEnded = getServerTime() > untilDate;

  const countryList = useMemo(() => {
    if (isResults || !giveaway?.countries) return undefined;
    return lang.conjunction(giveaway.countries.map((countryCode) => (
      `${isoToEmoji(countryCode)}${NBSP}${lang.region(countryCode)}`
    )));
  }, [giveaway, isResults, lang]);

  const handlePeerClick = useLastCallback((channelId: string) => {
    openChat({ id: channelId });
  });

  const handleShowInfoClick = useLastCallback(async () => {
    if (isLoadingInfoRef.current) return;

    isLoadingInfoRef.current = true;
    const result = await callApi('fetchGiveawayInfo', {
      peer: chat,
      messageId: message.id,
    });
    setGiveawayInfo(result);
    isLoadingInfoRef.current = false;
  });

  const handleCloseInfo = useLastCallback(() => {
    setGiveawayInfo(undefined);
  });

  const giveawayInfoTitle = useMemo(() => {
    if (!giveawayInfo) return undefined;
    return lang(giveawayInfo.type === 'results' ? 'BoostingGiveawayEnd' : 'BoostingGiveAwayAbout');
  }, [giveawayInfo, lang]);

  function renderGiveawayDescription(media: ApiGiveaway) {
    const channelIds = media.channelIds;
    return (
      <>
        <div className={styles.section}>
          <strong className={styles.title}>
            {lang('BoostingGiveawayPrizes', undefined, { withNodes: true, withMarkdown: true })}
          </strong>
          {prizeDescription && (
            <>
              <p className={styles.description}>
                {lang('BoostingGiveawayMsgPrizes', { quantity, prize: prizeDescription }, {
                  pluralValue: quantity, withNodes: true, withMarkdown: true,
                })}
              </p>
              <Separator>{lang('BoostingGiveawayMsgWithDivider')}</Separator>
            </>
          )}
          <p className={styles.description}>
            {stars ? (
              lang('ChatGiveawayMessageStarsPrizeText', {
                stars: lang('StarsAmountText', { amount: stars }, { pluralValue: stars }),
                winners: (
                  <>
                    <br />
                    {lang('AmongWinners', { count: quantity }, {
                      pluralValue: quantity, withNodes: true, withMarkdown: true,
                    })}
                  </>
                ),
              }, { withNodes: true, withMarkdown: true })
            ) : (
              <>
                {lang('ChatGiveawayInfoSubscriptions', { count: quantity }, {
                  pluralValue: quantity, withNodes: true, withMarkdown: true,
                })}
                <br />
                {lang('ActionGiftPremiumDuration', {
                  duration: lang('Months', { count: months! }, { pluralValue: months! }),
                }, { withNodes: true, withMarkdown: true })}
              </>
            )}
          </p>
        </div>
        <div className={styles.section}>
          <strong className={styles.title}>
            {lang('BoostingGiveawayMsgParticipants', undefined, { withNodes: true, withMarkdown: true })}
          </strong>
          <p className={styles.description}>
            {lang('BoostingGiveawayMsgAllSubsPlural', undefined, {
              pluralValue: channelIds.length, withNodes: true, withMarkdown: true,
            })}
          </p>
          <div className={styles.peers}>
            {channelIds.map((peerId) => (
              <PeerChip
                peerId={peerId}
                forceShowSelf
                withPeerColors={!isOwn}
                className={styles.peer}
                clickArg={peerId}
                onClick={handlePeerClick}
              />
            ))}
          </div>
          {countryList && (
            <span>{lang('ChatGiveawayMessageCountriesFrom', { countries: countryList }, { withNodes: true })}</span>
          )}
        </div>
        <div className={styles.section}>
          <strong className={styles.title}>
            {lang('BoostingWinnersDate', undefined, { withNodes: true, withMarkdown: true })}
          </strong>
          <p className={styles.description}>
            {formatDateTime(lang, secondsToDate(untilDate), { date: 'short', time: 'short' })}
          </p>
        </div>
      </>
    );
  }

  function renderGiveawayResultsDescription(media: ApiGiveawayResults) {
    const winnerIds = media.winnerIds;
    return (
      <>
        <div className={styles.section}>
          <strong className={styles.title}>
            {lang('BoostingGiveawayResultsMsgWinnersSelected', undefined, { withNodes: true, withMarkdown: true })}
          </strong>
          <p className={styles.description}>
            {lang('BoostingGiveawayResultsMsgWinnersTitle', { count: winnerIds.length }, {
              pluralValue: winnerIds.length, withNodes: true, withMarkdown: true,
            })}
          </p>
          <strong className={styles.title}>
            {lang('PrizesResultsWinners')}
          </strong>
          <div className={styles.peers}>
            {winnerIds.map((peerId) => (
              <PeerChip
                peerId={peerId}
                forceShowSelf
                withPeerColors={!isOwn}
                className={styles.peer}
                clickArg={peerId}
                onClick={handlePeerClick}
              />
            ))}
          </div>
        </div>
        <div className={styles.section}>
          <p className={styles.description}>
            {lang('BoostingGiveawayResultsMsgAllWinnersReceivedLinks')}
          </p>
        </div>
      </>
    );
  }

  function renderGiveawayInfo() {
    if (!sender || !giveawayInfo) return undefined;
    const isResultsInfo = giveawayInfo.type === 'results';

    const chatTitle = isApiPeerChat(sender) ? getChatTitle(lang, sender) : getUserFullName(lang, sender);
    const endDate = formatCalendarDate(lang, secondsToDate(untilDate), {
      variant: 'date', isShort: true, withTime: true,
    });
    const otherChannelsCount = giveaway?.channelIds ? giveaway.channelIds.length - 1 : 0;
    const otherChannelsString = lang('ChatGiveawayInfoOtherChannels', { count: otherChannelsCount }, {
      pluralValue: otherChannelsCount, withNodes: true, withMarkdown: true,
    });
    const isSeveral = otherChannelsCount > 0;

    const firstParagraph = stars
      ? lang(isResultsInfo ? 'BoostingStarsGiveawayHowItWorksTextEnd' : 'BoostingStarsGiveawayHowItWorksText', {
        count: stars, chat: chatTitle,
      }, { pluralValue: stars, withNodes: true, withMarkdown: true })
      : lang(isResultsInfo ? 'BoostingGiveawayHowItWorksTextEnd' : 'BoostingGiveawayHowItWorksText', {
        chat: chatTitle,
        quantity,
        duration: lang('Months', { count: months! }, { pluralValue: months! }),
      }, { pluralValue: quantity, withNodes: true, withMarkdown: true });

    const additionalPrizes = prizeDescription
      ? lang('BoostingGiveawayHowItWorksIncludeText', { chat: chatTitle, quantity, prize: prizeDescription }, {
        pluralValue: quantity, withNodes: true, withMarkdown: true,
      })
      : undefined;

    const secondParagraph = isSeveral
      ? lang(isResultsInfo
        ? 'BoostingGiveawayHowItWorksSubTextSeveralEnd1' : 'BoostingGiveawayHowItWorksSubTextSeveral1', {
        date: endDate,
        quantity,
        chat: chatTitle,
        otherChannels: lang('BoostingGiveawayHowItWorksSubTextSeveral2', { count: otherChannelsCount }, {
          pluralValue: otherChannelsCount, withNodes: true, withMarkdown: true,
        }),
      }, { pluralValue: quantity, withNodes: true, withMarkdown: true })
      : lang(isResultsInfo ? 'BoostingGiveawayHowItWorksSubTextEnd' : 'BoostingGiveawayHowItWorksSubText', {
        date: endDate, quantity, chat: chatTitle,
      }, { pluralValue: quantity, withNodes: true, withMarkdown: true });

    let result = '';

    if (isResultsInfo) {
      if (giveawayInfo.isRefunded) {
        result = lang('BoostingGiveawayCanceledByPayment');
      } else {
        result = lang(giveawayInfo.isWinner ? 'BoostingGiveawayYouWon' : 'BoostingGiveawayYouNotWon');
      }
    }

    let lastParagraph: TeactNode;
    if (isResultsInfo) {
      // Nothing
    } else if (giveawayInfo.disallowedCountry) {
      lastParagraph = lang('BoostingGiveawayNotEligibleCountry', undefined, { withNodes: true, withMarkdown: true });
    } else if (giveawayInfo.adminDisallowedChatId) {
      // Since rerenders are not expected, we can use the global state directly
      const chatsById = getGlobal().chats.byId;
      const disallowedChat = chatsById[giveawayInfo.adminDisallowedChatId];
      const disallowedChatTitle = disallowedChat && getChatTitle(lang, disallowedChat);
      lastParagraph = lang('BoostingGiveawayNotEligibleAdmin', { chat: disallowedChatTitle }, {
        withNodes: true, withMarkdown: true,
      });
    } else if (giveawayInfo.joinedTooEarlyDate) {
      const joinedTooEarlyDate = formatCalendarDate(lang, secondsToDate(giveawayInfo.joinedTooEarlyDate), {
        variant: 'date', isShort: true, withTime: true,
      });
      lastParagraph = lang('BoostingGiveawayNotEligible', { date: joinedTooEarlyDate }, {
        withNodes: true, withMarkdown: true,
      });
    } else if (giveawayInfo.isParticipating) {
      lastParagraph = isSeveral
        ? lang('ChatGiveawayInfoParticipatingMany', { chat: chatTitle, otherChannels: otherChannelsString }, {
          withNodes: true, withMarkdown: true,
        })
        : lang('ChatGiveawayInfoParticipating', { chat: chatTitle }, { withNodes: true, withMarkdown: true });
    } else {
      lastParagraph = isSeveral
        ? lang('ChatGiveawayInfoNotQualifiedMany', {
          chat: chatTitle, otherChannels: otherChannelsString, date: endDate,
        }, { withNodes: true, withMarkdown: true })
        : lang('ChatGiveawayInfoNotQualified', { chat: chatTitle, date: endDate }, {
          withNodes: true, withMarkdown: true,
        });
    }

    return (
      <>
        {result && (
          <p className={styles.result}>
            {renderText(result, ['simple_markdown'])}
          </p>
        )}
        <p>
          {firstParagraph}
        </p>
        {Boolean(additionalPrizes) && (
          <p>
            {additionalPrizes}
          </p>
        )}
        <p>
          {secondParagraph}
          {isResultsInfo && Boolean(giveawayInfo.activatedCount) && (
            <>
              {' '}
              {lang('BoostingGiveawayUsedLinksPlural', { count: giveawayInfo.activatedCount }, {
                pluralValue: giveawayInfo.activatedCount, withNodes: true, withMarkdown: true,
              })}
            </>
          )}
        </p>
        {Boolean(lastParagraph) && (
          <p>
            {lastParagraph}
          </p>
        )}
      </>
    );
  }

  return (
    <div className={styles.root}>
      <div className={buildClassName(styles.sticker, isResults && styles.resultSticker)}>
        {isResults ? (
          <AnimatedIconWithPreview
            size={RESULT_STICKER_SIZE}
            tgsUrl={LOCAL_TGS_URLS.PartyPopper}
            nonInteractive
            noLoop
          />
        ) : (
          <AnimatedIconFromSticker
            sticker={giftSticker}
            play={canPlayAnimatedEmojis && hasEnded}
            noLoop
            nonInteractive
            size={GIFT_STICKER_SIZE}
          />
        )}
        <span className={styles.count}>
          {`x${quantity}`}
        </span>
      </div>
      {isResults ? renderGiveawayResultsDescription(giveawayResults) : renderGiveawayDescription(giveaway!)}
      <Button
        className={styles.button}
        color="adaptive"
        onClick={handleShowInfoClick}
      >
        {lang('GiftInfoValueLinkMore')}
      </Button>
      <ConfirmDialog
        isOpen={Boolean(giveawayInfo)}
        isOnlyConfirm
        title={giveawayInfoTitle}
        confirmHandler={handleCloseInfo}
        onClose={handleCloseInfo}
      >
        {renderGiveawayInfo()}
      </ConfirmDialog>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { message }): Complete<StateProps> => {
    const { giveaway } = message.content;
    const chat = selectChat(global, message.chatId)!;
    const sender = (giveaway?.channelIds[0] ? selectChat(global, giveaway.channelIds[0]) : undefined)
      || selectForwardedSender(global, message) || chat;

    const sticker = giveaway && selectGiftStickerForDuration(global, giveaway.months);

    return {
      chat,
      sender,
      giftSticker: sticker,
      canPlayAnimatedEmojis: selectCanPlayAnimatedEmojis(global),
    };
  },
)(Giveaway));
