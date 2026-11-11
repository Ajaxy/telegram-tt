import { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiUser } from '../../../api/types';
import type { TabState } from '../../../global/types';
import type { RegularLangKeyWithVariables } from '../../../types/language';

import { getUserFullName } from '../../../global/helpers';
import { selectUser } from '../../../global/selectors';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Avatar from '../../common/Avatar';
import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';

import styles from './MediaAccessModal.module.scss';

export type OwnProps = {
  modal: NonNullable<TabState['mediaAccessModal']>;
  isOpen: boolean;
};

type StateProps = {
  currentUser?: ApiUser;
};

const MediaAccessModal = ({
  modal,
  isOpen,
  currentUser,
}: OwnProps & StateProps) => {
  const { closeMediaAccessModal } = getActions();

  const lang = useLang();

  const { bot, kinds } = modal;

  const handleAllow = useLastCallback(() => {
    closeMediaAccessModal({ isAccessGranted: true });
  });

  const handleDeny = useLastCallback(() => {
    closeMediaAccessModal({ isAccessGranted: false });
  });

  return (
    <Modal className="confirm" isOpen={isOpen} onClose={handleDeny}>
      <div className={styles.avatars}>
        <Avatar size="large" peer={currentUser} />
        <Icon name="next" className={styles.arrow} />
        <Avatar size="large" peer={bot} />
      </div>
      <p>
        {lang(getTextKey(kinds), { name: getUserFullName(lang, bot) }, { withNodes: true, withMarkdown: true })}
      </p>
      <p>{lang('MediaAccessReloadNote')}</p>
      <div className="dialog-buttons mt-2">
        <Button className="confirm-dialog-button" isText color="primary" onClick={handleAllow}>
          {lang('BotAllowWriteConfirm')}
        </Button>
        <Button className="confirm-dialog-button" isText onClick={handleDeny}>
          {lang('BotAuthPhoneNumberDeny')}
        </Button>
      </div>
    </Modal>
  );
};

function getTextKey(kinds: OwnProps['modal']['kinds']): RegularLangKeyWithVariables {
  if (kinds.length > 1) return 'MediaAccessCameraMicrophoneText';
  return kinds[0] === 'camera' ? 'MediaAccessCameraText' : 'MediaAccessMicrophoneText';
}

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => ({
    currentUser: selectUser(global, global.currentUserId!),
  }),
)(MediaAccessModal));
