import React, { FC, memo, useCallback } from '../../lib/teact/teact';

import { ApiMessage } from '../../api/types';

import { getPictogramDimensions } from '../common/helpers/mediaDimensions';
import { getMessageMediaHash, getMessageSummaryText } from '../../modules/helpers';
import renderText from '../common/helpers/renderText';
import useMedia from '../../hooks/useMedia';
import useWebpThumbnail from '../../hooks/useWebpThumbnail';

import ConfirmDialog from '../ui/ConfirmDialog';
import Button from '../ui/Button';
import RippleEffect from '../ui/RippleEffect';
import buildClassName from '../../util/buildClassName';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';

import PinnedMessageNavigation from './PinnedMessageNavigation';

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
  const lang = useLang();
  const mediaThumbnail = useWebpThumbnail(message);
  const mediaBlobUrl = useMedia(getMessageMediaHash(message, 'pictogram'));

  const text = getMessageSummaryText(lang, message, Boolean(mediaThumbnail));
  const [isUnpinDialogOpen, openUnpinDialog, closeUnpinDialog] = useFlag();

  const handleUnpinMessage = useCallback(() => {
    closeUnpinDialog();

    if (onUnpinMessage) {
      onUnpinMessage(message.id);
    }
  }, [closeUnpinDialog, onUnpinMessage, message.id]);

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
      <div className="HeaderPinnedMessage" onClick={onClick} dir={lang.isRtl ? 'rtl' : undefined}>
        <PinnedMessageNavigation
          count={count}
          index={index}
        />
        {mediaThumbnail && renderPictogram(mediaThumbnail, mediaBlobUrl)}
        <div className="message-text">
          <div className="title" dir="auto">
            {customTitle || `${lang('PinnedMessage')} ${index > 0 ? `#${count - index}` : ''}`}
          </div>
          <p dir="auto">{renderText(text)}</p>
        </div>

        <RippleEffect />
      </div>
    </div>
  );
};

function renderPictogram(thumbDataUri: string, blobUrl?: string) {
  const { width, height } = getPictogramDimensions();

  return (
    <img src={blobUrl || thumbDataUri} width={width} height={height} alt="" />
  );
}

export default memo(HeaderPinnedMessage);
