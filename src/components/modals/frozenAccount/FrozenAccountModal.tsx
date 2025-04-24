import React, { memo, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { TabState } from '../../../global/types';

import { selectUser } from '../../../global/selectors';
import { formatDateToString } from '../../../util/dates/dateFormat';
import { LOCAL_TGS_URLS } from '../../common/helpers/animatedAssets';
import formatUsername from '../../common/helpers/formatUsername';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import AnimatedIconWithPreview from '../../common/AnimatedIconWithPreview';
import Button from '../../ui/Button';
import Link from '../../ui/Link';
import TableAboutModal, { type TableAboutData } from '../common/TableAboutModal';

import styles from './FrozenAccountModal.module.scss';

export type OwnProps = {
  modal: TabState['isFrozenAccountModalOpen'];
};

type StateProps = {
  freezeAppealUrl?: string;
  botFreezeAppealUsername?: string;
  freezeUntilDate?: number;
};

const FrozenAccountModal = ({
  modal,
  freezeUntilDate,
  freezeAppealUrl,
  botFreezeAppealUsername,
}: OwnProps & StateProps) => {
  const {
    closeFrozenAccountModal,
    openUrl,
  } = getActions();
  const lang = useLang();

  const isOpen = Boolean(modal);

  const handleClose = useLastCallback(() => {
    closeFrozenAccountModal();
  });

  const handleAppeal = useLastCallback(() => {
    closeFrozenAccountModal();
    if (freezeAppealUrl) {
      openUrl({ url: freezeAppealUrl });
    }
  });

  const header = useMemo(() => {
    return (
      <div className={styles.header}>
        <AnimatedIconWithPreview
          size={160}
          tgsUrl={LOCAL_TGS_URLS.BannedDuck}
          noLoop
        />
        <div className={styles.title}>
          {lang('FrozenAccountModalTitle')}
        </div>
      </div>
    );
  }, [lang]);

  const footer = useMemo(() => {
    if (!isOpen) return undefined;
    return (
      <div className={styles.footer}>
        <Button
          className={styles.buttonAppeal}
          size="smaller"
          onClick={handleAppeal}
          noForcedUpperCase
        >
          {lang('ButtonAppeal')}
        </Button>
        <Button
          isText
          size="smaller"
          onClick={handleClose}
          noForcedUpperCase
        >
          {lang('ButtonUnderstood')}
        </Button>
      </div>
    );
  }, [lang, isOpen]);

  if (!freezeUntilDate || !botFreezeAppealUsername) return undefined;

  const date = new Date(freezeUntilDate * 1000);

  const botLink = (
    <Link onClick={handleAppeal} isPrimary>
      {formatUsername(botFreezeAppealUsername)}
    </Link>
  );

  const listItemData = [
    ['hand-stop', lang('FrozenAccountViolationTitle'), lang('FrozenAccountViolationSubtitle')],
    ['lock', lang('FrozenAccountReadOnlyTitle'), lang('FrozenAccountReadOnlySubtitle')],
    ['frozen-time', lang('FrozenAccountAppealTitle'),
      lang('FrozenAccountAppealSubtitle', {
        botLink,
        date: formatDateToString(date, lang.code),
      }, {
        withNodes: true,
      })],
  ] satisfies TableAboutData;

  return (
    <TableAboutModal
      isOpen={isOpen}
      header={header}
      listItemData={listItemData}
      footer={footer}
      hasBackdrop
      onClose={handleClose}
    />
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const freezeUntilDate = global.appConfig?.freezeUntilDate;
    const freezeAppealUrl = global.appConfig?.freezeAppealUrl;
    const botFreezeAppealId = global.botFreezeAppealId;
    const botFreezeAppealUsername = botFreezeAppealId
      ? selectUser(global, botFreezeAppealId)?.usernames?.[0]?.username : undefined;

    return {
      freezeUntilDate,
      freezeAppealUrl,
      botFreezeAppealUsername,
    };
  },
)(FrozenAccountModal));
