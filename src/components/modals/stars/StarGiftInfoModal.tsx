import React, { memo, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiPeer } from '../../../api/types';

import { getSenderTitle } from '../../../global/helpers';
import { selectTabState, selectUser } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { formatDateTimeToString } from '../../../util/dates/dateFormat';
import renderText from '../../common/helpers/renderText';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import StarIcon from '../../common/icons/StarIcon';
import SafeLink from '../../common/SafeLink';
import TableInfoModal, { type TableData } from '../common/TableInfoModal';

import styles from './StarGiftInfoModal.module.scss';

import StarLogo from '../../../assets/icons/StarLogo.svg';
import StarsBackground from '../../../assets/stars-bg.png';

export type OwnProps = {
  isOpen?: boolean;
};

export type StateProps = {
  stars?: number;
  user?: ApiPeer;
  date?: number;
};

const StarGiftInfoModal = ({
  isOpen,
  stars,
  user,
  date,
}: OwnProps & StateProps) => {
  const {
    closeStarGiftInfoModal,
  } = getActions();
  const oldLang = useOldLang();
  const lang = useLang();

  const infoText = useMemo(() => {
    const linkText = oldLang('GiftStarsSubtitleLinkName');

    return lang('CreditsBoxHistoryEntryGiftOutAbout',
      {
        user: (
          <b>
            {user && renderText(getSenderTitle(oldLang, user) || '', ['simple_markdown'])}
          </b>
        ),
        link: (
          <SafeLink
            url={oldLang('lng_paid_about_link_url')}
            text={linkText}
          />
        ),
      },
      {
        withNodes: true,
      });
  }, [lang, oldLang, user]);

  const footerText = useMemo(() => {
    const linkText = oldLang('lng_payments_terms_link');
    return lang('CreditsBoxOutAbout', {
      link: (
        <SafeLink
          url={oldLang('StarsTOSLink')}
          text={linkText}
        />
      ),
    }, {
      withNodes: true,
    });
  }, [lang, oldLang]);

  const handleButtonClick = useLastCallback(() => {
    closeStarGiftInfoModal();
  });

  const modalData = useMemo(() => {
    if (!isOpen) return undefined;

    const header = (
      <>
        <h2 className={buildClassName(styles.starTitle, styles.centered)}>{oldLang('StarsGiftSent')}</h2>
        <div className={styles.info}>
          <p className={buildClassName(styles.starTitle, styles.centered)}>{stars}</p>
          <StarIcon type="gold" size="middle" />
        </div>
        <p className={styles.centered}>{infoText}</p>
      </>
    );

    const tableData = [
      [oldLang('Recipient'), user ? { chatId: user.id } : oldLang('BoostingNoRecipient')],
      [oldLang('BoostingDate'), formatDateTimeToString(date! * 1000, lang.code, true)],
    ] satisfies TableData;

    const footer = (
      <span className={buildClassName(styles.footer, styles.centered)}>
        {footerText}
      </span>
    );

    return {
      header,
      tableData,
      footer,
    };
  }, [isOpen, oldLang, stars, infoText, user, date, lang.code, footerText]);

  if (!modalData) return undefined;

  return (
    <TableInfoModal
      isOpen={isOpen}
      headerImageUrl={StarLogo}
      logoBackground={StarsBackground}
      tableData={modalData.tableData}
      header={modalData.header}
      footer={modalData.footer}
      buttonText={lang('Close')}
      onButtonClick={handleButtonClick}
      onClose={closeStarGiftInfoModal}
    />
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const {
      starGiftInfoModal,
    } = selectTabState(global);
    const toUserId = starGiftInfoModal?.toUserId;
    const user = toUserId ? selectUser(global, toUserId) : undefined;

    return {
      stars: starGiftInfoModal?.stars,
      user,
      date: starGiftInfoModal?.date,
    };
  },
)(StarGiftInfoModal));
