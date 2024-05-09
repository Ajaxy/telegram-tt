import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiMessage } from '../../api/types';

import {
  getMessageIsSpoiler,
  getMessageMediaHash, getMessageSingleInlineButton,
} from '../../global/helpers';
import buildClassName from '../../util/buildClassName';
import { IS_TOUCH_ENV } from '../../util/windowEnvironment';
import { getPictogramDimensions, REM } from '../common/helpers/mediaDimensions';
import renderText from '../common/helpers/renderText';

import { useFastClick } from '../../hooks/useFastClick';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useMedia from '../../hooks/useMedia';
import useThumbnail from '../../hooks/useThumbnail';
import useAsyncRendering from '../right/hooks/useAsyncRendering';

import AnimatedCounter from '../common/AnimatedCounter';
import MediaSpoiler from '../common/MediaSpoiler';
import MessageSummary from '../common/MessageSummary';
import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import RippleEffect from '../ui/RippleEffect';
import Spinner from '../ui/Spinner';
import Transition from '../ui/Transition';
import PinnedMessageNavigation from './PinnedMessageNavigation';

import styles from './HeaderPinnedMessage.module.scss';

const SHOW_LOADER_DELAY = 450;
const EMOJI_SIZE = 1.125 * REM;

type OwnProps = {
  message: ApiMessage;
  index: number;
  count: number;
  customTitle?: string;
  className?: string;
  onUnpinMessage?: (id: number) => void;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onAllPinnedClick?: () => void;
  isLoading?: boolean;
  isFullWidth?: boolean;
};

const HeaderPinnedMessage: FC<OwnProps> = ({
  message, count, index, customTitle, className, onUnpinMessage, onClick, onAllPinnedClick,
  isLoading, isFullWidth,
}) => {
  const { clickBotInlineButton } = getActions();
  const lang = useLang();

  const mediaThumbnail = useThumbnail(message);
  const mediaBlobUrl = useMedia(getMessageMediaHash(message, 'pictogram'));
  const isSpoiler = getMessageIsSpoiler(message);
  const canRenderLoader = useAsyncRendering([isLoading], SHOW_LOADER_DELAY);
  const shouldShowLoader = canRenderLoader && isLoading;

  const [isUnpinDialogOpen, openUnpinDialog, closeUnpinDialog] = useFlag();

  const handleUnpinMessage = useLastCallback(() => {
    closeUnpinDialog();

    if (onUnpinMessage) {
      onUnpinMessage(message.id);
    }
  });

  const inlineButton = getMessageSingleInlineButton(message);

  const handleInlineButtonClick = useLastCallback(() => {
    if (inlineButton) {
      clickBotInlineButton({ messageId: message.id, button: inlineButton });
    }
  });

  const [noHoverColor, markNoHoverColor, unmarkNoHoverColor] = useFlag();

  const { handleClick, handleMouseDown } = useFastClick(onClick);

  function renderPictogram(thumbDataUri?: string, blobUrl?: string, spoiler?: boolean) {
    const { width, height } = getPictogramDimensions();
    const srcUrl = blobUrl || thumbDataUri;

    return (
      <div className={styles.pinnedThumb}>
        {thumbDataUri && !spoiler && (
          <img
            className={styles.pinnedThumbImage}
            src={srcUrl}
            width={width}
            height={height}
            alt=""
            draggable={false}
          />
        )}
        {thumbDataUri
          && <MediaSpoiler thumbDataUri={srcUrl} isVisible={Boolean(spoiler)} width={width} height={height} />}
      </div>
    );
  }

  return (
    <div className={buildClassName(
      'HeaderPinnedMessageWrapper', styles.root, isFullWidth && 'full-width', className,
    )}
    >
      {(count > 1 || shouldShowLoader) && (
        <Button
          round
          size="smaller"
          color="translucent"
          ariaLabel={lang('EventLogFilterPinnedMessages')}
          onClick={!shouldShowLoader ? onAllPinnedClick : undefined}
        >
          {isLoading && (
            <Spinner
              color="blue"
              className={buildClassName(
                styles.loading, styles.pinListIcon, !shouldShowLoader && styles.pinListIconHidden,
              )}
            />
          )}
          <i
            className={buildClassName(
              'icon', 'icon-pin-list', styles.pinListIcon, shouldShowLoader && styles.pinListIconHidden,
            )}
          />
        </Button>
      )}
      {onUnpinMessage && (
        <Button
          round
          size="smaller"
          color="translucent"
          ariaLabel={lang('UnpinMessageAlertTitle')}
          onClick={openUnpinDialog}
        >
          <i className="icon icon-close" />
        </Button>
      )}
      <ConfirmDialog
        isOpen={isUnpinDialogOpen}
        onClose={closeUnpinDialog}
        text="Would you like to unpin this message?"
        confirmLabel="Unpin"
        confirmHandler={handleUnpinMessage}
      />
      <div
        className={buildClassName(styles.pinnedMessage, noHoverColor && styles.noHover)}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        dir={lang.isRtl ? 'rtl' : undefined}
      >
        <PinnedMessageNavigation
          count={count}
          index={index}
        />
        <Transition activeKey={message.id} name="slideVertical" className={styles.pictogramTransition}>
          {renderPictogram(
            mediaThumbnail,
            mediaBlobUrl,
            isSpoiler,
          )}
        </Transition>
        <div className={buildClassName(styles.messageText, mediaThumbnail && styles.withMedia)}>
          <div className={styles.title} dir="auto">
            {!customTitle && (
              <AnimatedCounter text={`${lang('PinnedMessage')} ${index > 0 ? `#${count - index}` : ''}`} />
            )}

            {customTitle && renderText(customTitle)}
          </div>
          <Transition activeKey={message.id} name="slideVerticalFade" className={styles.messageTextTransition}>
            <p dir="auto" className={styles.summary}>
              <MessageSummary
                lang={lang}
                message={message}
                noEmoji={Boolean(mediaThumbnail)}
                emojiSize={EMOJI_SIZE}
              />
            </p>
          </Transition>
        </div>
        <RippleEffect />
        {inlineButton && (
          <Button
            size="tiny"
            className={styles.inlineButton}
            onClick={handleInlineButtonClick}
            shouldStopPropagation
            onMouseEnter={!IS_TOUCH_ENV ? markNoHoverColor : undefined}
            onMouseLeave={!IS_TOUCH_ENV ? unmarkNoHoverColor : undefined}
          >
            {renderText(inlineButton.text)}
          </Button>
        )}
      </div>
    </div>
  );
};

export default memo(HeaderPinnedMessage);
