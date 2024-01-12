import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { ApiBotInfo } from '../../api/types';

import {
  getBotCoverMediaHash,
  getDocumentMediaHash,
  getPhotoFullDimensions,
  getVideoDimensions,
} from '../../global/helpers';
import { selectBot, selectUserFullInfo } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';
import renderText from '../common/helpers/renderText';

import useLang from '../../hooks/useLang';
import useMedia from '../../hooks/useMedia';
import useDevicePixelRatio from '../../hooks/window/useDevicePixelRatio';

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
  botInfo,
  isLoadingBotInfo,
  isInMessageList,
}) => {
  const lang = useLang();
  const dpr = useDevicePixelRatio();

  const botInfoPhotoUrl = useMedia(botInfo?.photo ? getBotCoverMediaHash(botInfo.photo) : undefined);
  const botInfoGifUrl = useMedia(botInfo?.gif ? getDocumentMediaHash(botInfo.gif) : undefined);
  const botInfoDimensions = botInfo?.photo ? getPhotoFullDimensions(botInfo.photo) : botInfo?.gif
    ? getVideoDimensions(botInfo.gif) : undefined;
  const botInfoRealDimensions = botInfoDimensions && {
    width: botInfoDimensions.width / dpr,
    height: botInfoDimensions.height / dpr,
  };
  const isBotInfoEmpty = botInfo && !botInfo.description && !botInfo.gif && !botInfo.photo;

  const { width, height } = botInfoRealDimensions || {};

  const isEmptyOrLoading = isBotInfoEmpty || isLoadingBotInfo;

  if (isEmptyOrLoading && isInMessageList) return undefined;

  return (
    <div className={buildClassName(styles.root, 'empty')}>
      {isLoadingBotInfo && <span>{lang('Loading')}</span>}
      {isBotInfoEmpty && !isLoadingBotInfo && <span>{lang('NoMessages')}</span>}
      {botInfo && (
        <div
          className={styles.botInfo}
          style={botInfoRealDimensions && (
            `width: ${botInfoRealDimensions.width}px`
          )}
        >
          {botInfoPhotoUrl && (
            <img
              className={styles.image}
              src={botInfoPhotoUrl}
              width={botInfoRealDimensions?.width}
              height={botInfoRealDimensions?.height}
              alt="Bot info"
            />
          )}
          {botInfoGifUrl && (
            <OptimizedVideo
              canPlay
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
              width={botInfoRealDimensions?.width}
              height={botInfoRealDimensions?.height}
            />
          )}
          {botInfo.description && (
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
