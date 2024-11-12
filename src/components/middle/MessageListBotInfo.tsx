import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { ApiBotInfo } from '../../api/types';

import {
  getBotCoverMediaHash,
  getPhotoFullDimensions,
  getVideoDimensions,
  getVideoMediaHash,
  isChatWithVerificationCodesBot,
} from '../../global/helpers';
import { selectBot, selectUserFullInfo } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';
import renderText from '../common/helpers/renderText';

import useMedia from '../../hooks/useMedia';
import useOldLang from '../../hooks/useOldLang';

import OptimizedVideo from '../ui/OptimizedVideo';
import Skeleton from '../ui/placeholder/Skeleton';

import styles from './MessageListBotInfo.module.scss';

type OwnProps = {
  chatId: string;
  isInMessageList?: boolean;
};

type StateProps = {
  botInfo?: ApiBotInfo;
  isLoadingBotInfo?: boolean;
};

const MessageListBotInfo: FC<OwnProps & StateProps> = ({
  chatId,
  botInfo,
  isLoadingBotInfo,
  isInMessageList,
}) => {
  const lang = useOldLang();

  const botInfoPhotoUrl = useMedia(botInfo?.photo ? getBotCoverMediaHash(botInfo.photo) : undefined);
  const botInfoGifUrl = useMedia(botInfo?.gif ? getVideoMediaHash(botInfo.gif, 'full') : undefined);
  const botInfoDimensions = botInfo?.photo ? getPhotoFullDimensions(botInfo.photo) : botInfo?.gif
    ? getVideoDimensions(botInfo.gif) : undefined;
  const isBotInfoEmpty = botInfo && !botInfo.description && !botInfo.gif && !botInfo.photo;

  const isVerifyCodes = isChatWithVerificationCodesBot(chatId);

  const { width, height } = botInfoDimensions || {};

  const isEmptyOrLoading = isBotInfoEmpty || isLoadingBotInfo;

  if (isEmptyOrLoading && isInMessageList) return undefined;

  return (
    <div className={buildClassName(styles.root, 'empty')}>
      {isLoadingBotInfo && <span>{lang('Loading')}</span>}
      {isBotInfoEmpty && !isLoadingBotInfo && <span>{lang('NoMessages')}</span>}
      {botInfo && (
        <div
          className={styles.botInfo}
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
              {lang('VerifyChatInfo')}
            </div>
          )}
          {!isVerifyCodes && botInfo.description && (
            <div className={styles.botInfoDescription}>
              <p className={styles.botInfoTitle}>{lang('BotInfoTitle')}</p>
              {renderText(botInfo.description, ['br', 'emoji', 'links'])}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }) => {
    const chatBot = selectBot(global, chatId);
    let isLoadingBotInfo = false;
    let botInfo;
    if (chatBot) {
      const chatBotFullInfo = selectUserFullInfo(global, chatBot.id);
      if (chatBotFullInfo) {
        botInfo = chatBotFullInfo.botInfo;
      } else {
        isLoadingBotInfo = true;
      }
    }
    return {
      botInfo,
      isLoadingBotInfo,
    };
  },
)(MessageListBotInfo));
