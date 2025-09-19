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
import { formatDateAtTime, formatDateTimeToString } from '../../../util/dates/dateFormat';
import { isoToEmoji } from '../../../util/emoji/emoji';
import { getServerTime } from '../../../util/serverTime';
import { callApi } from '../../../api/gramjs';
import { LOCAL_TGS_URLS } from '../../common/helpers/animatedAssets';
import renderText from '../../common/helpers/renderText';

import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

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

  const isLoadingInfo = useRef(false);
  const [giveawayInfo, setGiveawayInfo] = useState<ApiGiveawayInfo | undefined>();

  const lang = useOldLang();
  const { giveaway, giveawayResults } = message.content;
  const isResults = Boolean(giveawayResults);
  const {
    months, untilDate, prizeDescription, stars,
  } = (giveaway || giveawayResults)!;

  const isOwn = isOwnMessage(message);

  const quantity = isResults ? giveawayResults.winnersCount : giveaway!.quantity;

  const hasEnded = getServerTime() > untilDate;

  const countryList = useMemo(() => {
    if (isResults) return undefined;
    const translatedNames = new Intl.DisplayNames([lang.code!, 'en'].filter(Boolean), { type: 'region' });
    return giveaway?.countries?.map((countryCode) => (
      `${isoToEmoji(countryCode)}${NBSP}${translatedNames.of(countryCode)}`
    )).join(', ');
  }, [giveaway, isResults, lang.code]);

  const handlePeerClick = useLastCallback((channelId: string) => {
    openChat({ id: channelId });
  });

  const handleShowInfoClick = useLastCallback(async () => {
    if (isLoadingInfo.current) return;

    isLoadingInfo.current = true;
    const result = await callApi('fetchGiveawayInfo', {
      peer: chat,
      messageId: message.id,
    });
    setGiveawayInfo(result);
    isLoadingInfo.current = false;
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
            {renderText(lang('BoostingGiveawayPrizes'), ['simple_markdown'])}
          </strong>
          {prizeDescription && (
            <>
              <p className={styles.description}>
                {renderText(
                  lang('BoostingGiveawayMsgPrizes', [quantity, prizeDescription], undefined, quantity),
                  ['simple_markdown'],
                )}
              </p>
              <Separator>{lang('BoostingGiveawayMsgWithDivider')}</Separator>
            </>
          )}
          <p className={styles.description}>
            {message?.content?.giveaway?.stars ? (
              <>
                {renderText(
                  lang('Chat.Giveaway.Message.Stars.PrizeText', lang('Stars', message?.content?.giveaway?.stars)),
                  ['simple_markdown'],
                )}
                <br />
                {renderText(lang('AmongWinners', quantity), ['simple_markdown'])}
              </>
            ) : (
              <>
                {renderText(lang('Chat.Giveaway.Info.Subscriptions', quantity), ['simple_markdown'])}
                <br />
                {renderText(lang(
                  'ActionGiftPremiumSubtitle',
                  lang('Chat.Giveaway.Info.Months', months),
                ), ['simple_markdown'])}
              </>
            )}
          </p>
        </div>
        <div className={styles.section}>
          <strong className={styles.title}>
            {renderText(lang('BoostingGiveawayMsgParticipants'), ['simple_markdown'])}
          </strong>
          <p className={styles.description}>
            {renderText(lang('BoostingGiveawayMsgAllSubsPlural', channelIds.length), ['simple_markdown'])}
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
            <span>{renderText(lang('Chat.Giveaway.Message.CountriesFrom', countryList))}</span>
          )}
        </div>
        <div className={styles.section}>
          <strong className={styles.title}>
            {renderText(lang('BoostingWinnersDate'), ['simple_markdown'])}
          </strong>
          <p className={styles.description}>
            {formatDateTimeToString(untilDate * 1000, lang.code, true)}
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
            {renderText(lang('BoostingGiveawayResultsMsgWinnersSelected'), ['simple_markdown'])}
          </strong>
          <p className={styles.description}>
            {renderText(lang('BoostingGiveawayResultsMsgWinnersTitle', winnerIds.length), ['simple_markdown'])}
          </p>
          <strong className={styles.title}>
            {lang('lng_prizes_results_winners')}
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

    const chatTitle = isApiPeerChat(sender) ? getChatTitle(lang, sender) : getUserFullName(sender);
    const endDate = formatDateAtTime(lang, untilDate * 1000);
    const otherChannelsCount = giveaway?.channelIds ? giveaway.channelIds.length - 1 : 0;
    const otherChannelsString = lang('Chat.Giveaway.Info.OtherChannels', otherChannelsCount);
    const isSeveral = otherChannelsCount > 0;

    const firstKey = isResultsInfo ? 'BoostingGiveawayHowItWorksTextEnd' : 'BoostingGiveawayHowItWorksText';
    const giveawayDuration = isResultsInfo ? lang('Chat.Giveaway.Info.Months', months) : lang('Stars', stars, 'i');
    const firstParagraph = lang(firstKey, [chatTitle, quantity, giveawayDuration], undefined, quantity);

    const additionalPrizes = prizeDescription
      ? lang('BoostingGiveawayHowItWorksIncludeText', [chatTitle, quantity, prizeDescription], undefined, quantity)
      : undefined;

    let secondKey = '';
    if (isResultsInfo) {
      secondKey = isSeveral ? 'BoostingGiveawayHowItWorksSubTextSeveralEnd' : 'BoostingGiveawayHowItWorksSubTextEnd';
    } else {
      secondKey = isSeveral ? 'BoostingGiveawayHowItWorksSubTextSeveral' : 'BoostingGiveawayHowItWorksSubText';
    }
    let secondParagraph = lang(secondKey, [endDate, quantity, chatTitle, otherChannelsCount], undefined, quantity);
    if (isResultsInfo && giveawayInfo.activatedCount) {
      secondParagraph += ` ${lang('BoostingGiveawayUsedLinksPlural', giveawayInfo.activatedCount)}`;
    }

    let result = '';

    if (isResultsInfo) {
      if (giveawayInfo.isRefunded) {
        result = lang('BoostingGiveawayCanceledByPayment');
      } else {
        result = lang(giveawayInfo.isWinner ? 'BoostingGiveawayYouWon' : 'BoostingGiveawayYouNotWon');
      }
    }

    let lastParagraph = '';
    if (isResultsInfo) {
      // Nothing
    } else if (giveawayInfo.disallowedCountry) {
      lastParagraph = lang('BoostingGiveawayNotEligibleCountry');
    } else if (giveawayInfo.adminDisallowedChatId) {
      // Since rerenders are not expected, we can use the global state directly
      const chatsById = getGlobal().chats.byId;
      const disallowedChat = chatsById[giveawayInfo.adminDisallowedChatId];
      const disallowedChatTitle = disallowedChat && getChatTitle(lang, disallowedChat);
      lastParagraph = lang('BoostingGiveawayNotEligibleAdmin', disallowedChatTitle);
    } else if (giveawayInfo.joinedTooEarlyDate) {
      const joinedTooEarlyDate = formatDateAtTime(lang, giveawayInfo.joinedTooEarlyDate * 1000);
      lastParagraph = lang('BoostingGiveawayNotEligible', joinedTooEarlyDate);
    } else if (giveawayInfo.isParticipating) {
      lastParagraph = isSeveral
        ? lang('Chat.Giveaway.Info.ParticipatingMany', [chatTitle, otherChannelsCount])
        : lang('Chat.Giveaway.Info.Participating', chatTitle);
    } else {
      lastParagraph = isSeveral
        ? lang('Chat.Giveaway.Info.NotQualifiedMany', [chatTitle, otherChannelsString, endDate])
        : lang('Chat.Giveaway.Info.NotQualified', [chatTitle, endDate]);
    }

    return (
      <>
        {result && (
          <p className={styles.result}>
            {renderText(result, ['simple_markdown'])}
          </p>
        )}
        <p>
          {renderText(firstParagraph, ['simple_markdown'])}
        </p>
        {additionalPrizes && (
          <p>
            {renderText(additionalPrizes, ['simple_markdown'])}
          </p>
        )}
        <p>
          {renderText(secondParagraph, ['simple_markdown'])}
        </p>
        {lastParagraph && (
          <p>
            {renderText(lastParagraph, ['simple_markdown'])}
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
        {lang('BoostingHowItWork')}
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
