import type { FC } from '../../lib/teact/teact';
import React, {
  memo,
  useEffect,
  useMemo,
  useRef,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type {
  ApiBotInfo, ApiChat, ApiCountryCode, ApiUserCommonChats, ApiUserFullInfo,
} from '../../api/types';

import {
  getBotCoverMediaHash,
  getChatTitle,
  getPhotoFullDimensions,
  getVideoDimensions,
  getVideoMediaHash,
  isChatWithVerificationCodesBot,
} from '../../global/helpers';
import {
  selectBot, selectChat, selectPeer, selectUserCommonChats, selectUserFullInfo,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';
import { formatPastDatetime, formatRegistrationMonth } from '../../util/dates/dateFormat';
import { isoToEmoji } from '../../util/emoji/emoji';
import { getCountryCodeByIso } from '../../util/phoneNumber';
import stopEvent from '../../util/stopEvent';
import renderText from '../common/helpers/renderText';

import useEffectOnce from '../../hooks/useEffectOnce';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useMedia from '../../hooks/useMedia';
import useOldLang from '../../hooks/useOldLang';
import useShowTransition from '../../hooks/useShowTransition';

import AvatarList from '../common/AvatarList';
import Icon from '../common/icons/Icon';
import MiniTable, { type TableEntry } from '../common/MiniTable';
import Link from '../ui/Link';
import OptimizedVideo from '../ui/OptimizedVideo';
import Skeleton from '../ui/placeholder/Skeleton';

import styles from './MessageListAccountInfo.module.scss';

type OwnProps = {
  chatId: string;
  isInMessageList?: boolean;
};

type StateProps = {
  chat?: ApiChat;
  botInfo?: ApiBotInfo;
  isLoadingFullUser?: boolean;
  phoneCodeList?: ApiCountryCode[];
  commonChats?: ApiUserCommonChats;
  userFullInfo?: ApiUserFullInfo;
};

const MessageListAccountInfo: FC<OwnProps & StateProps> = ({
  chat,
  chatId,
  botInfo,
  isLoadingFullUser,
  isInMessageList,
  phoneCodeList,
  commonChats,
  userFullInfo,
}) => {
  const { loadCommonChats, openChatWithInfo } = getActions();
  const oldLang = useOldLang();
  const lang = useLang();

  const {
    phoneCountry,
    registrationMonth,
    nameChangeDate,
    photoChangeDate,
  } = userFullInfo?.settings || {};

  useEffect(() => {
    loadCommonChats({ userId: chatId });
  }, [chatId]);

  const country = useMemo(() => {
    if (!phoneCodeList || !phoneCountry) return undefined;
    return getCountryCodeByIso(phoneCodeList, phoneCountry);
  }, [phoneCodeList, phoneCountry]);

  const botInfoPhotoUrl = useMedia(botInfo?.photo ? getBotCoverMediaHash(botInfo.photo) : undefined);
  const botInfoGifUrl = useMedia(botInfo?.gif ? getVideoMediaHash(botInfo.gif, 'full') : undefined);
  const botInfoDimensions = botInfo?.photo ? getPhotoFullDimensions(botInfo.photo) : botInfo?.gif
    ? getVideoDimensions(botInfo.gif) : undefined;
  const isBotInfoEmpty = botInfo && !botInfo.description && !botInfo.gif && !botInfo.photo;
  const isChatInfoEmpty = !country || !registrationMonth;

  const isVerifyCodes = isChatWithVerificationCodesBot(chatId);

  const { width, height } = botInfoDimensions || {};

  const handleClick = useLastCallback((e: React.SyntheticEvent<any>) => {
    stopEvent(e);
    openChatWithInfo({
      id: chatId, shouldReplaceHistory: true, profileTab: 'commonChats', forceScrollProfileTab: true,
    });
  });

  const securityNameInfo = nameChangeDate && chat ? (
    <div className="local-action-message" key="security-name-message">
      <span>{lang('UserUpdatedName', {
        user: chat.title,
        time: formatPastDatetime(lang, nameChangeDate),
      }, { withNodes: true, withMarkdown: true })}
      </span>
    </div>
  ) : undefined;

  const securityPhotoInfo = photoChangeDate && chat ? (
    <div className="local-action-message" key="security-photo-message">
      <span>{lang('UserUpdatedPhoto', {
        user: chat.title,
        time: formatPastDatetime(lang, photoChangeDate),
      }, { withNodes: true, withMarkdown: true })}
      </span>
    </div>
  ) : undefined;

  const tableData = useMemo((): TableEntry[] => {
    const entries: TableEntry[] = [];
    if (country) {
      entries.push([
        oldLang('PrivacyPhone'),
        <span className={styles.chatDescription}>
          <span className={styles.country}>
            {renderText(isoToEmoji(country?.iso2))}
          </span>
          {country?.defaultName}
        </span>,
      ]);
    }
    if (registrationMonth) {
      entries.push([
        lang('ContactInfoRegistration'),
        formatRegistrationMonth(lang.code, registrationMonth),
      ]);
    }
    if (userFullInfo?.commonChatsCount) {
      const global = getGlobal();
      const peers = commonChats?.ids.slice(0, 3).map((id) => selectPeer(global, id)!).filter(Boolean);
      entries.push([
        lang('ChatNonContactUserGroups'),
        <Link className={styles.link} onClick={handleClick}>
          <span className={styles.linkInfo}>
            {lang('ChatGroups', {
              count: userFullInfo.commonChatsCount,
            }, {
              pluralValue: userFullInfo.commonChatsCount,
            })}
          </span>
          {Boolean(peers?.length) && <AvatarList size="micro" peers={peers} />}
          <Icon name="next" className={styles.icon} />
        </Link>,
      ]);
    }
    return entries;
  }, [lang, oldLang, country, registrationMonth, commonChats, userFullInfo]);

  const isEmptyOrLoading = (isBotInfoEmpty && isChatInfoEmpty) || isLoadingFullUser;

  const isFirstRenderRef = useRef(true);
  const {
    shouldRender,
    ref,
  } = useShowTransition({
    isOpen: !isEmptyOrLoading && isInMessageList,
    withShouldRender: true,
  });

  useEffectOnce(() => {
    isFirstRenderRef.current = false;
  });

  if (!shouldRender) return undefined;

  return (
    <div ref={ref} className={buildClassName(styles.root, 'empty')}>
      {isLoadingFullUser && isChatInfoEmpty && <span>{oldLang('Loading')}</span>}
      {(isBotInfoEmpty && isChatInfoEmpty) && !isLoadingFullUser && <span>{oldLang('NoMessages')}</span>}
      {botInfo && (
        <div
          className={buildClassName(styles.chatInfo, styles.botBackground)}
          style={buildStyle(
            width ? `width: ${width}px` : undefined,
          )}
        >
          {botInfoPhotoUrl && (
            <img
              className={styles.media}
              src={botInfoPhotoUrl}
              width={width}
              height={height}
              alt="Bot info"
            />
          )}
          {botInfoGifUrl && (
            <OptimizedVideo
              canPlay
              className={styles.media}
              src={botInfoGifUrl}
              loop
              disablePictureInPicture
              muted
              playsInline
              style={buildStyle(Boolean(width) && `width: ${width}px`, Boolean(height) && `height: ${height}px`)}
            />
          )}
          {botInfoDimensions && !botInfoPhotoUrl && !botInfoGifUrl && (
            <Skeleton
              className={styles.media}
              width={width}
              height={height}
              forceAspectRatio
            />
          )}
          {isVerifyCodes && (
            <div className={styles.botInfoDescription}>
              {oldLang('VerifyChatInfo')}
            </div>
          )}
          {!isVerifyCodes && botInfo.description && (
            <div className={styles.botInfoDescription}>
              <p className={styles.botInfoTitle}>{oldLang('BotInfoTitle')}</p>
              {renderText(botInfo.description, ['br', 'emoji', 'links'])}
            </div>
          )}
        </div>
      )}
      {!isChatInfoEmpty && chat && (
        <div
          className={buildClassName(styles.chatInfo, styles.chatBackground)}
        >
          <h3 className={styles.chatInfoTitle}>{renderText(getChatTitle(lang, chat))}</h3>
          <p className={buildClassName(styles.chatInfoSubtitle, styles.textColor)}>
            {lang('ChatNonContactUserSubtitle')}
          </p>
          <MiniTable keyClassName={styles.textColor} data={tableData} />
          {!chat?.isVerified && (
            <div className={buildClassName(styles.chatNotVerified, styles.textColor)}>
              <Icon name="info-filled" />
              <p className={styles.verifiedTitle}>{lang('ContactInfoNotVerified')}</p>
            </div>
          )}
        </div>
      )}
      {securityNameInfo}
      {securityPhotoInfo}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }) => {
    const {
      countryList: { phoneCodes: phoneCodeList },
    } = global;
    const chat = selectChat(global, chatId);
    const userFullInfo = selectUserFullInfo(global, chatId);
    const commonChats = selectUserCommonChats(global, chatId);
    const chatBot = selectBot(global, chatId);

    let isLoadingFullUser = false;
    let botInfo;
    if (chatBot) {
      if (userFullInfo) {
        botInfo = userFullInfo.botInfo;
      } else {
        isLoadingFullUser = true;
      }
    }

    return {
      chat,
      userFullInfo,
      botInfo,
      isLoadingFullUser,
      phoneCodeList,
      commonChats,
    };
  },
)(MessageListAccountInfo));
