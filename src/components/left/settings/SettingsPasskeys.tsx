import {
  memo,
  useEffect,
  useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiPasskey } from '../../../api/types';

import { IS_WEBAUTHN_SUPPORTED } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import { formatPastDatetime } from '../../../util/dates/dateFormat';
import { LOCAL_TGS_PREVIEW_URLS, LOCAL_TGS_URLS } from '../../common/helpers/animatedAssets';
import { REM } from '../../common/helpers/mediaDimensions';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import AnimatedIconWithPreview from '../../common/AnimatedIconWithPreview';
import CustomEmoji from '../../common/CustomEmoji';
import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import ConfirmDialog from '../../ui/ConfirmDialog';
import Link from '../../ui/Link';
import ListItem from '../../ui/ListItem';

import styles from './SettingsPasskeys.module.scss';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  passkeys?: ApiPasskey[];
  maxPasskeysCount: number;
};

const TOP_STICKER_SIZE = 120;
const ICON_SIZE = 2 * REM;

const SettingsPasskeys = ({
  isActive,
  passkeys,
  maxPasskeysCount,
  onReset,
}: OwnProps & StateProps) => {
  const {
    startPasskeyRegistration,
    deletePasskey,
    openPasskeyModal,
  } = getActions();

  const lang = useLang();

  const [deleteModalId, setDeleteModalId] = useState<string>();

  const canAddPasskey = IS_WEBAUTHN_SUPPORTED && (passkeys?.length ?? 0) < maxPasskeysCount;

  const handleCreatePasskey = useLastCallback(() => {
    startPasskeyRegistration();
  });

  const handleOpenPasskeyModal = useLastCallback(() => {
    openPasskeyModal();
  });

  const confirmDeletePasskey = useLastCallback(() => {
    if (!deleteModalId) return;
    deletePasskey({ id: deleteModalId });
    setDeleteModalId(undefined);
  });

  useEffect(() => {
    if (!passkeys || passkeys.length || !isActive) return;
    onReset(); // Autoclose when last passkey is deleted
  }, [passkeys, onReset, isActive]);

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  function renderPasskey(passkey: ApiPasskey) {
    const { softwareEmojiId, id, name, date, lastUsageDate } = passkey;
    return (
      <ListItem
        key={id}
        ripple
        narrow
        contextActions={[{
          title: lang('Delete'),
          icon: 'delete',
          destructive: true,
          handler: () => {
            setDeleteModalId(id);
          },
        }]}
        leftElement={softwareEmojiId ? (
          <CustomEmoji
            size={ICON_SIZE}
            className={buildClassName(styles.icon, 'ListItem-main-icon')}
            documentId={softwareEmojiId}
            noPlay
          />
        ) : (
          <Icon name="lock" className={buildClassName(styles.fallbackIcon, 'ListItem-main-icon')} />
        )}
      >
        <div className="multiline-item full-size" dir="auto">
          <span className="date">{formatPastDatetime(lang, date)}</span>
          <span className="title">{name || lang('SettingsPasskeyFallbackTitle')}</span>
          {Boolean(lastUsageDate) && (
            <span className="subtitle">
              {lang('SettingsPasskeyUsedAt', {
                date: formatPastDatetime(lang, lastUsageDate),
              })}
            </span>
          )}
        </div>
      </ListItem>
    );
  }

  return (
    <div className="settings-content custom-scroll">
      <div className="settings-content-header">
        <AnimatedIconWithPreview
          tgsUrl={LOCAL_TGS_URLS.Passkeys}
          previewUrl={LOCAL_TGS_PREVIEW_URLS.Passkeys}
          size={TOP_STICKER_SIZE}
          className="settings-content-icon"
        />

        <p className="settings-item-description" dir="auto">
          {lang('SettingsPasskeyInfo')}
        </p>
      </div>
      <div className="settings-item">
        {passkeys?.map(renderPasskey)}
        {canAddPasskey && (
          <Button
            className="settings-button"
            color="primary"
            iconName="add"
            isText
            noForcedUpperCase
            onClick={handleCreatePasskey}
          >
            {lang('SettingsPasskeysCreate')}
          </Button>
        )}
        <p className="settings-item-description mt-3" dir="auto">
          {lang('SettingsPasskeysFooter', {
            link: <Link isPrimary onClick={handleOpenPasskeyModal}>{lang('SettingsPasskeysFooterLink')}</Link>,
          }, { withNodes: true })}
        </p>
      </div>
      <ConfirmDialog
        isOpen={Boolean(deleteModalId)}
        title={lang('PasskeyDeleteTitle')}
        textParts={lang('PasskeyDeleteText', undefined, { withNodes: true, renderTextFilters: ['br'] })}
        confirmHandler={confirmDeletePasskey}
        confirmIsDestructive
        confirmLabel={lang('Delete')}
        onClose={() => setDeleteModalId(undefined)}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    return {
      passkeys: global.settings.passkeys,
      maxPasskeysCount: global.appConfig.passkeysMaxCount,
    };
  },
)(SettingsPasskeys));
