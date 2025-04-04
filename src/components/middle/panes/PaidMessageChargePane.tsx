import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiChat,
} from '../../../api/types';

import {
  getPeerTitle,
} from '../../../global/helpers';
import {
  selectChat,
  selectUserFullInfo,
} from '../../../global/selectors';
import { formatStarsAsIcon } from '../../../util/localization/format';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
// import useTimeout from '../../../hooks/schedulers/useTimeout';
import useLastCallback from '../../../hooks/useLastCallback';
import useHeaderPane, { type PaneState } from '../hooks/useHeaderPane';

import Button from '../../ui/Button';
import Checkbox from '../../ui/Checkbox';
import ConfirmDialog from '../../ui/ConfirmDialog';

// import CustomEmoji from '../../common/CustomEmoji';
import styles from './PaidMessageChargePane.module.scss';

type OwnProps = {
  peerId: string;
  onPaneStateChange?: (state: PaneState) => void;
};

type StateProps = {
  chargedPaidMessageStars?: number;
  chat?: ApiChat;
};

const PaidMessageChargePane: FC<OwnProps & StateProps> = ({
  chargedPaidMessageStars,
  chat,
  onPaneStateChange,
  peerId,
}) => {
  const isOpen = Boolean(chargedPaidMessageStars);
  const lang = useLang();
  const [isRemoveFeeDialogOpen, openRemoveFeeDialog, closeRemoveFeeDialog] = useFlag();
  const [shouldRefoundStars, setShouldRefoundStars] = useFlag(false);

  const {
    addNoPaidMessagesException,
  } = getActions();

  const { ref, shouldRender } = useHeaderPane({
    isOpen,
    onStateChange: onPaneStateChange,
  });

  const handleRemoveFee = useLastCallback(() => {
    openRemoveFeeDialog();
  });

  const handleConfirmRemoveFee = useLastCallback(() => {
    addNoPaidMessagesException({ userId: peerId, shouldRefundCharged: shouldRefoundStars });
  });

  if (!shouldRender || !chargedPaidMessageStars) return undefined;

  const peerName = chat ? getPeerTitle(lang, chat) : undefined;

  const message = lang('PaneMessagePaidMessageCharge', {
    peer: peerName,
    amount: formatStarsAsIcon(lang,
      chargedPaidMessageStars,
      { asFont: true, className: styles.messageStarIcon, containerClassName: styles.messageStars }),
  }, {
    withMarkdown: true,
    withNodes: true,
  });

  const dialogMessage = lang('ConfirmDialogMessageRemoveFee', {
    peer: peerName,
  }, {
    withMarkdown: true,
    withNodes: true,
  });

  const checkBoxTitle = lang('ConfirmDialogRemoveFeeRefundStars', {
    amount: chargedPaidMessageStars,
  }, {
    withMarkdown: true,
    withNodes: true,
  });

  return (
    <div ref={ref} className={styles.root}>
      <div className={styles.message}>
        {message}
      </div>
      <Button
        isText
        noForcedUpperCase
        pill
        fluid
        size="tiny"
        className={styles.button}
        onClick={handleRemoveFee}
      >
        {lang('RemoveFeeTitle')}
      </Button>

      <ConfirmDialog
        isOpen={isRemoveFeeDialogOpen}
        onClose={closeRemoveFeeDialog}
        title={lang('RemoveFeeTitle')}
        confirmLabel={lang('ConfirmRemoveMessageFee')}
        confirmHandler={handleConfirmRemoveFee}
      >
        {dialogMessage}
        <Checkbox
          className={styles.checkBox}
          label={checkBoxTitle}
          checked={shouldRefoundStars}
          onCheck={setShouldRefoundStars}
        />
      </ConfirmDialog>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { peerId }): StateProps => {
    const chat = selectChat(global, peerId);
    const peerFullInfo = selectUserFullInfo(global, peerId);
    const chargedPaidMessageStars = peerFullInfo?.settings?.chargedPaidMessageStars;

    return {
      chargedPaidMessageStars,
      chat,
    };
  },
)(PaidMessageChargePane));
