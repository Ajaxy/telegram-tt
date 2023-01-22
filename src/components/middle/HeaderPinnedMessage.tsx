import type { FC } from '../../lib/teact/teact';
import React, { memo, useCallback } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiMessage } from '../../api/types';

import { getPictogramDimensions } from '../common/helpers/mediaDimensions';
import {
  getMessageIsSpoiler,
  getMessageMediaHash, getMessageSingleInlineButton,
} from '../../global/helpers';
import buildClassName from '../../util/buildClassName';
import { IS_TOUCH_ENV } from '../../util/environment';
import renderText from '../common/helpers/renderText';

import useMedia from '../../hooks/useMedia';
import useThumbnail from '../../hooks/useThumbnail';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';

import RippleEffect from '../ui/RippleEffect';
import ConfirmDialog from '../ui/ConfirmDialog';
import Button from '../ui/Button';
import PinnedMessageNavigation from './PinnedMessageNavigation';
import MessageSummary from '../common/MessageSummary';
import MediaSpoiler from '../common/MediaSpoiler';

type OwnProps = {
  message: ApiMessage;
  index: number;
  count: number;
  customTitle?: string;
  className?: string;
  onUnpinMessage?: (id: number) => void;
  onClick?: () => void;
  onAllPinnedClick?: () => void;
};

const HeaderPinnedMessage: FC<OwnProps> = ({
  message, count, index, customTitle, className, onUnpinMessage, onClick, onAllPinnedClick,
}) => {
  const { clickBotInlineButton } = getActions();
  const lang = useLang();
  const mediaThumbnail = useThumbnail(message);
  const mediaBlobUrl = useMedia(getMessageMediaHash(message, 'pictogram'));

  const isSpoiler = getMessageIsSpoiler(message);

  const [isUnpinDialogOpen, openUnpinDialog, closeUnpinDialog] = useFlag();

  const handleUnpinMessage = useCallback(() => {
    closeUnpinDialog();

    if (onUnpinMessage) {
      onUnpinMessage(message.id);
    }
  }, [closeUnpinDialog, onUnpinMessage, message.id]);

  const inlineButton = getMessageSingleInlineButton(message);

  const handleInlineButtonClick = useCallback(() => {
    if (inlineButton) {
      clickBotInlineButton({ messageId: message.id, button: inlineButton });
    }
  }, [clickBotInlineButton, inlineButton, message.id]);

  const [noHoverColor, markNoHoverColor, unmarkNoHoverColor] = useFlag();

  return (
    <div className={buildClassName('HeaderPinnedMessage-wrapper', className)}>
      {count > 1 && (
        <Button
          round
          size="smaller"
          color="translucent"
          className="pin-list-button"
          ariaLabel={lang('EventLogFilterPinnedMessages')}
          onClick={onAllPinnedClick}
        >
          <i className="icon-pin-list" />
        </Button>
      )}
      {onUnpinMessage && (
        <Button
          round
          size="smaller"
          color="translucent"
          ariaLabel={lang('UnpinMessageAlertTitle')}
          className="unpin-button"
          onClick={openUnpinDialog}
        >
          <i className="icon-close" />
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
        className={buildClassName('HeaderPinnedMessage', noHoverColor && 'no-hover')}
        onClick={onClick}
        dir={lang.isRtl ? 'rtl' : undefined}
      >
        <PinnedMessageNavigation
          count={count}
          index={index}
        />
        {mediaThumbnail && renderPictogram(mediaThumbnail, mediaBlobUrl, isSpoiler)}
        <div className="message-text">
          <div className="title" dir="auto">
            {customTitle ? renderText(customTitle) : `${lang('PinnedMessage')} ${index > 0 ? `#${count - index}` : ''}`}
          </div>
          <p dir="auto">
            <MessageSummary lang={lang} message={message} noEmoji={Boolean(mediaThumbnail)} />
          </p>
          <RippleEffect />
        </div>
        {inlineButton && (
          <Button
            size="tiny"
            className="inline-button"
            onClick={handleInlineButtonClick}
            shouldStopPropagation
            onMouseEnter={!IS_TOUCH_ENV ? markNoHoverColor : undefined}
            onMouseLeave={!IS_TOUCH_ENV ? unmarkNoHoverColor : undefined}
          >
            {inlineButton.text}
          </Button>
        )}
      </div>
    </div>
  );
};

function renderPictogram(thumbDataUri: string, blobUrl?: string, isSpoiler?: boolean) {
  const { width, height } = getPictogramDimensions();
  const srcUrl = blobUrl || thumbDataUri;

  return (
    <div className="pinned-thumb">
      {!isSpoiler && <img className="pinned-thumb-image" src={srcUrl} width={width} height={height} alt="" />}
      <MediaSpoiler thumbDataUri={srcUrl} isVisible={Boolean(isSpoiler)} width={width} height={height} />
    </div>
  );
}

export default memo(HeaderPinnedMessage);
