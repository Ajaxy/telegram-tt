import type { FC } from '../../../lib/teact/teact';
import { memo, useCallback } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiUser, ApiWebSession } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';

import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useOldLang from '../../../hooks/useOldLang';

import Avatar from '../../common/Avatar';
import FullNameTitle from '../../common/FullNameTitle';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';

import styles from './SettingsActiveWebsite.module.scss';

type OwnProps = {
  isOpen: boolean;
  hash?: string;
  onClose: () => void;
};

type StateProps = {
  session?: ApiWebSession;
  bot?: ApiUser;
};

const SettingsActiveWebsite: FC<OwnProps & StateProps> = ({
  isOpen,
  session,
  bot,
  onClose,
}) => {
  const { terminateWebAuthorization } = getActions();
  const lang = useOldLang();

  const renderingSession = useCurrentOrPrev(session, true);
  const renderingBot = useCurrentOrPrev(bot, true);

  const handleTerminateSessionClick = useCallback(() => {
    terminateWebAuthorization({ hash: session!.hash });
    onClose();
  }, [onClose, session, terminateWebAuthorization]);

  if (!renderingSession) {
    return undefined;
  }

  function renderHeader() {
    return (
      <div className="modal-header-condensed" dir={lang.isRtl ? 'rtl' : undefined}>
        <Button
          round
          color="translucent"
          size="tiny"
          ariaLabel={lang('Close')}
          onClick={onClose}
          iconName="close"
        />
        <div className="modal-title">{lang('WebSessionsTitle')}</div>
        <Button
          color="danger"
          onClick={handleTerminateSessionClick}
          className={buildClassName('modal-action-button', styles.headerButton)}
        >
          {lang('AuthSessions.LogOut')}
        </Button>
      </div>
    );
  }
  return (
    <Modal
      header={renderHeader()}
      isOpen={isOpen}
      hasCloseButton
      onClose={onClose}
      className={styles.root}
    >
      <Avatar
        className={styles.avatar}
        peer={renderingBot}
        size="large"
      />
      {renderingBot && <FullNameTitle className={styles.title} peer={renderingBot} />}
      <div className={styles.note}>
        {renderingSession?.domain}
      </div>

      <dl className={styles.box}>
        <dt>{lang('AuthSessions.View.Browser')}</dt>
        <dd>
          {renderingSession?.browser}
        </dd>

        <dt>{lang('SessionPreview.Ip')}</dt>
        <dd>{renderingSession?.ip}</dd>

        <dt>{lang('SessionPreview.Location')}</dt>
        <dd>{renderingSession?.region}</dd>
      </dl>
      <p className={styles.note}>{lang('AuthSessions.View.LocationInfo')}</p>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>((global, { hash }): Complete<StateProps> => {
  const session = hash ? global.activeWebSessions.byHash[hash] : undefined;
  const bot = session ? global.users.byId[session.botId] : undefined;

  return {
    session,
    bot,
  };
})(SettingsActiveWebsite));
