import type { FC } from '../../../lib/teact/teact';
import {
  memo,
  useMemo,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiCountryCode } from '../../../api/types';
import type { TabState } from '../../../global/types';

import { copyTextToClipboard } from '../../../util/clipboard';
import { formatDateAtTime } from '../../../util/dates/dateFormat';
import { formatCurrencyAsString } from '../../../util/formatCurrency';
import { formatPhoneNumberWithCode } from '../../../util/phoneNumber';
import { LOCAL_TGS_URLS } from '../../common/helpers/animatedAssets';
import formatUsername from '../../common/helpers/formatUsername';
import renderText from '../../common/helpers/renderText';

import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import AnimatedIconWithPreview from '../../common/AnimatedIconWithPreview';
import PeerChip from '../../common/PeerChip';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';

import styles from './CollectibleInfoModal.module.scss';

export type OwnProps = {
  modal: TabState['collectibleInfoModal'];
};

type StateProps = {
  phoneCodeList: ApiCountryCode[];
};

const TOP_ICON_SIZE = 60;

const CollectibleInfoModal: FC<OwnProps & StateProps> = ({
  modal,
  phoneCodeList,
}) => {
  const {
    closeCollectibleInfoModal,
    openChat,
    openUrl,
    showNotification,
  } = getActions();
  const lang = useOldLang();

  const isUsername = modal?.type === 'username';

  const handleClose = useLastCallback(() => {
    closeCollectibleInfoModal();
  });

  const handleOpenChat = useLastCallback(() => {
    openChat({ id: modal!.peerId });
    handleClose();
  });

  const handleOpenUrl = useLastCallback(() => {
    openUrl({
      url: modal!.url,
    });
    handleClose();
  });

  const handleCopy = useLastCallback(() => {
    const text = isUsername ? formatUsername(modal.collectible)
      : formatPhoneNumberWithCode(phoneCodeList, modal!.collectible);
    copyTextToClipboard(text);
    showNotification({
      message: lang(isUsername ? 'UsernameCopied' : 'PhoneCopied'),
    });
    handleClose();
  });

  const title = useMemo(() => {
    if (!modal) return undefined;
    const key = isUsername ? 'FragmentUsernameTitle' : 'FragmentPhoneTitle';
    const formattedCollectible = isUsername
      ? formatUsername(modal.collectible)
      : formatPhoneNumberWithCode(phoneCodeList, modal.collectible);
    return lang(key, formattedCollectible);
  }, [modal, isUsername, phoneCodeList, lang]);

  const description = useMemo(() => {
    if (!modal) return undefined;
    const key = isUsername ? 'FragmentUsernameMessage' : 'FragmentPhoneMessage';
    const date = formatDateAtTime(lang, modal.purchaseDate * 1000);
    const currency = formatCurrencyAsString(modal.amount, modal.currency, lang.code);
    const cryptoCurrency = formatCurrencyAsString(modal.cryptoAmount, modal.cryptoCurrency, lang.code);
    const paid = `${cryptoCurrency} (${currency})`;
    return lang(key, [date, paid]);
  }, [modal, isUsername, lang]);

  return (
    <Modal
      isOpen={Boolean(modal)}
      isSlim
      contentClassName={styles.content}
      onClose={closeCollectibleInfoModal}
      hasAbsoluteCloseButton
    >
      <div className={styles.icon}>
        <AnimatedIconWithPreview
          tgsUrl={isUsername ? LOCAL_TGS_URLS.Mention : LOCAL_TGS_URLS.Fragment}
          size={TOP_ICON_SIZE}
        />
      </div>
      <h3 className={styles.title}>
        {title && renderText(title, ['simple_markdown'])}
      </h3>
      <PeerChip
        className={styles.chip}
        peerId={modal?.peerId}
        forceShowSelf
        clickArg={modal?.peerId}
        onClick={handleOpenChat}
      />
      <p className={styles.description}>
        {description && renderText(description, ['simple_markdown'])}
      </p>
      <div className="dialog-buttons dialog-buttons-centered">
        <Button className="confirm-dialog-button" onClick={handleOpenUrl}>
          {lang('FragmentUsernameOpen')}
        </Button>
        <Button isText className="confirm-dialog-button" onClick={handleCopy}>
          {lang(isUsername ? 'FragmentUsernameCopy' : 'FragmentPhoneCopy')}
        </Button>
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const { countryList } = global;

    return {
      phoneCodeList: countryList.phoneCodes,
    };
  },
)(CollectibleInfoModal));
