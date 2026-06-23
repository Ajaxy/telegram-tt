import { memo } from '../../../lib/teact/teact';

import type { ApiUser } from '../../../api/types';

import { getUserFullName } from '../../../global/helpers';

import useLang from '../../../hooks/useLang';

import TransferBetweenPeers from '../../common/TransferBetweenPeers';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';

import styles from './GuardReplaceBotModal.module.scss';

type OwnProps = {
  isOpen: boolean;
  currentBot: ApiUser;
  newBot: ApiUser;
  onConfirm: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
};

const GuardReplaceBotModal = ({
  isOpen,
  currentBot,
  newBot,
  onConfirm,
  onClose,
}: OwnProps) => {
  const lang = useLang();

  const currentName = getUserFullName(currentBot) || '';
  const newName = getUserFullName(newBot) || '';

  return (
    <Modal
      isOpen={isOpen}
      isSlim
      className={styles.root}
      onClose={onClose}
      onEnter={onConfirm}
    >
      <TransferBetweenPeers fromPeer={currentBot} toPeer={newBot} />
      <h3 className={styles.title}>{lang('ReplaceGuardBotTitle')}</h3>
      <p className={styles.description}>
        {lang('ReplaceGuardBotDescription', {
          current: currentName,
          new: newName,
        }, { withNodes: true, withMarkdown: true })}
      </p>
      <div className={styles.buttons}>
        <Button noForcedUpperCase isText onClick={onClose}>
          {lang('ReplaceGuardBotKeep', { bot: currentName })}
        </Button>
        <Button noForcedUpperCase color="primary" onClick={onConfirm}>
          {lang('ReplaceGuardBotUse', { bot: newName })}
        </Button>
      </div>
    </Modal>
  );
};

export default memo(GuardReplaceBotModal);
