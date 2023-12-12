import React, {
  memo, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type {
  ApiChat, ApiGiveawayInfo, ApiMessage, ApiPeer, ApiSticker,
} from '../../../api/types';

import { getChatTitle, getUserFullName, isApiPeerChat } from '../../../global/helpers';
import {
  selectCanPlayAnimatedEmojis,
  selectChat,
  selectForwardedSender,
  selectGiftStickerForDuration,
} from '../../../global/selectors';
import { formatDateAtTime, formatDateTimeToString } from '../../../util/dateFormat';
import { isoToEmoji } from '../../../util/emoji';
import { getServerTime } from '../../../util/serverTime';
import { callApi } from '../../../api/gramjs';
import renderText from '../../common/helpers/renderText';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import AnimatedIconFromSticker from '../../common/AnimatedIconFromSticker';
import PickerSelectedItem from '../../common/PickerSelectedItem';
import Button from '../../ui/Button';
import ConfirmDialog from '../../ui/ConfirmDialog';

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

  const lang = useLang();
  const {
    months, quantity, channelIds, untilDate, countries,
  } = message.content.giveaway!;

  const hasEnded = getServerTime() > untilDate;

  const countryList = useMemo(() => {
    const translatedNames = new Intl.DisplayNames([lang.code!, 'en'].filter(Boolean), { type: 'region' });
    return countries?.map((countryCode) => (
      `${isoToEmoji(countryCode)}${NBSP}${translatedNames.of(countryCode)}`
    )).join(', ');
  }, [countries, lang.code]);

  const handleChannelClick = useLastCallback((channelId: string) => {
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

  function renderGiveawayInfo() {
    if (!sender || !giveawayInfo) return undefined;
    const isResults = giveawayInfo.type === 'results';

    const chatTitle = isApiPeerChat(sender) ? getChatTitle(lang, sender) : getUserFullName(sender);
    const duration = lang('Chat.Giveaway.Info.Months', months);
    const endDate = formatDateAtTime(lang, untilDate * 1000);
    const otherChannelsCount = channelIds.length ? channelIds.length - 1 : 0;
    const otherChannelsString = lang('Chat.Giveaway.Info.OtherChannels', otherChannelsCount);
    const isSeveral = otherChannelsCount > 0;

    const firstKey = isResults ? 'BoostingGiveawayHowItWorksTextEnd' : 'BoostingGiveawayHowItWorksText';
    const firstParagraph = lang(firstKey, [chatTitle, quantity, duration], undefined, quantity);

    let secondKey = '';
    if (isResults) {
      secondKey = isSeveral ? 'BoostingGiveawayHowItWorksSubTextSeveralEnd' : 'BoostingGiveawayHowItWorksSubTextEnd';
    } else {
      secondKey = isSeveral ? 'BoostingGiveawayHowItWorksSubTextSeveral' : 'BoostingGiveawayHowItWorksSubText';
    }
    let secondParagraph = lang(secondKey, [endDate, quantity, chatTitle, otherChannelsCount], undefined, quantity);
    if (isResults && giveawayInfo.activatedCount) {
      secondParagraph += ` ${lang('BoostingGiveawayUsedLinksPlural', giveawayInfo.activatedCount)}`;
    }

    let lastParagraph = '';
    if (isResults && giveawayInfo.isRefunded) {
      lastParagraph = lang('BoostingGiveawayCanceledByPayment');
    } else if (isResults) {
      lastParagraph = lang(giveawayInfo.isWinner ? 'BoostingGiveawayYouWon' : 'BoostingGiveawayYouNotWon');
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
        <p>
          {renderText(firstParagraph, ['simple_markdown'])}
        </p>
        <p>
          {renderText(secondParagraph, ['simple_markdown'])}
        </p>
        <p>
          {renderText(lastParagraph, ['simple_markdown'])}
        </p>
      </>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.gift}>
        <AnimatedIconFromSticker
          key={message.id}
          sticker={giftSticker}
          play={canPlayAnimatedEmojis && hasEnded}
          noLoop
          nonInteractive
          size={GIFT_STICKER_SIZE}
        />
        <span className={styles.count}>
          {`x${quantity}`}
        </span>
      </div>
      <div className={styles.section}>
        <strong className={styles.title}>
          {renderText(lang('BoostingGiveawayPrizes'), ['simple_markdown'])}
        </strong>
        <p className={styles.description}>
          {renderText(lang('Chat.Giveaway.Info.Subscriptions', quantity), ['simple_markdown'])}
          <br />
          {renderText(lang(
            'ActionGiftPremiumSubtitle',
            lang('Chat.Giveaway.Info.Months', months),
          ), ['simple_markdown'])}
        </p>
      </div>
      <div className={styles.section}>
        <strong className={styles.title}>
          {renderText(lang('BoostingGiveawayMsgParticipants'), ['simple_markdown'])}
        </strong>
        <p className={styles.description}>
          {renderText(lang('BoostingGiveawayMsgAllSubsPlural', channelIds.length), ['simple_markdown'])}
        </p>
        <div className={styles.channels}>
          {channelIds.map((channelId) => (
            <PickerSelectedItem
              peerId={channelId}
              forceShowSelf
              fluid
              className={styles.channel}
              clickArg={channelId}
              onClick={handleChannelClick}
            />
          ))}
        </div>
        {Boolean(countries?.length) && (
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
      <Button
        className={styles.button}
        color="adaptive"
        size="smaller"
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
  (global, { message }): StateProps => {
    const duration = message.content.giveaway!.months;
    const chat = selectChat(global, message.chatId)!;
    const sender = selectChat(global, message.content.giveaway?.channelIds[0]!)
      || selectForwardedSender(global, message) || chat;

    return {
      chat,
      sender,
      giftSticker: selectGiftStickerForDuration(global, duration),
      canPlayAnimatedEmojis: selectCanPlayAnimatedEmojis(global),
    };
  },
)(Giveaway));
