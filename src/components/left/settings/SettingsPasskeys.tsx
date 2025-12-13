import { memo, useEffect, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiPasskey } from '../../../api/types';

import { formatDateTimeToString } from '../../../util/dates/dateFormat';

import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import { LOCAL_TGS_URLS } from '../../common/helpers/animatedAssets';
import AnimatedIconWithPreview from '../../common/AnimatedIconWithPreview';
import Button from '../../ui/Button';
import ConfirmDialog from '../../ui/ConfirmDialog';
import ListItem from '../../ui/ListItem';

import lockPreviewUrl from '../../../assets/lock.png';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  passkeys: ApiPasskey[];
};

const SettingsPasskeys = ({
  isActive,
  passkeys,
  onReset,
}: OwnProps & StateProps) => {
  const { loadPasskeys, createPasskey, deletePasskey } = getActions();

  const lang = useLang();
  const [isDeleteDialogOpen, openDeleteDialog, closeDeleteDialog] = useFlag();
  const [passkeyIdToDelete, setPasskeyIdToDelete] = useState<string>();

  useEffect(() => {
    if (isActive) {
      loadPasskeys();
    }
  }, [isActive, loadPasskeys]);

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const handleCreatePasskey = useLastCallback(() => {
    createPasskey();
  });

  const handleDeleteClick = useLastCallback((passkey: ApiPasskey) => {
    setPasskeyIdToDelete(passkey.id);
    openDeleteDialog();
  });

  const handleConfirmDelete = useLastCallback(() => {
    if (passkeyIdToDelete) {
      deletePasskey({ id: passkeyIdToDelete });
    }
    closeDeleteDialog();
    setPasskeyIdToDelete(undefined);
  });

  const handleCloseDeleteDialog = useLastCallback(() => {
    closeDeleteDialog();
    setPasskeyIdToDelete(undefined);
  });

  function renderPasskey(passkey: ApiPasskey) {
    return (
      <ListItem
        key={passkey.id}
        narrow
        icon="key"
        contextActions={[{
          title: lang('Delete'),
          icon: 'delete',
          destructive: true,
          handler: () => handleDeleteClick(passkey),
        }]}
      >
        <div className="multiline-item full-size" dir="auto">
          <span className="title">{passkey.name || lang('PasskeyUnknown')}</span>
          <span className="subtitle">
            {passkey.lastUsedAt
              ? lang('PasskeyLastUsed', { date: formatDateTimeToString(passkey.lastUsedAt * 1000, lang.code) })
              : lang('PasskeyCreated', { date: formatDateTimeToString(passkey.createdAt * 1000, lang.code) })}
          </span>
        </div>
      </ListItem>
    );
  }

  const hasPasskeys = passkeys.length > 0;

  return (
    <div className="settings-content custom-scroll">
      <div className="settings-content-header no-border">
        <AnimatedIconWithPreview
          tgsUrl={LOCAL_TGS_URLS.Lock}
          previewUrl={lockPreviewUrl}
          size={160}
          className="settings-content-icon"
        />

        <p className="settings-item-description mb-3" dir="auto">
          {lang('PasskeyDescription')}
        </p>
      </div>

      {hasPasskeys && (
        <div className="settings-item">
          <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>
            {lang('Passkeys')}
          </h4>

          {passkeys.map(renderPasskey)}
        </div>
      )}

      <div className="settings-item pt-0">
        <Button onClick={handleCreatePasskey}>
          {lang('PasskeyAdd')}
        </Button>
      </div>

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        title={lang('PasskeyDeleteTitle')}
        text={lang('PasskeyDeleteText')}
        confirmLabel={lang('Delete')}
        confirmHandler={handleConfirmDelete}
        confirmIsDestructive
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    return {
      passkeys: global.passkeys,
    };
  },
)(SettingsPasskeys));
