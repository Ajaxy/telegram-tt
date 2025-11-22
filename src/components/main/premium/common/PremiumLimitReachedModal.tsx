import type { FC } from '../../../../lib/teact/teact';
import { memo, useCallback, useEffect } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiLimitTypeWithModal } from '../../../../api/types';
import type { OldLangFn } from '../../../../hooks/useOldLang';
import type { IconName } from '../../../../types/icons';

import { MAX_UPLOAD_FILEPART_SIZE } from '../../../../config';
import { selectIsCurrentUserPremium, selectIsPremiumPurchaseBlocked } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { type LangFn } from '../../../../util/localization';
import { formatFileSize } from '../../../../util/textFormat';
import renderText from '../../../common/helpers/renderText';

import useFlag from '../../../../hooks/useFlag';
import useLang from '../../../../hooks/useLang';
import useOldLang from '../../../../hooks/useOldLang';

import Button from '../../../ui/Button';
import Modal from '../../../ui/Modal';
import PremiumLimitsCompare from './PremiumLimitsCompare';

import styles from './PremiumLimitReachedModal.module.scss';

const LIMIT_DESCRIPTION: Record<ApiLimitTypeWithModal, string> = {
  dialogFiltersChats: 'LimitReachedChatInFolders',
  uploadMaxFileparts: 'LimitReachedFileSize',
  dialogFilters: 'LimitReachedFolders',
  dialogFolderPinned: 'LimitReachedPinDialogs',
  channelsPublic: 'LimitReachedPublicLinks',
  channels: 'LimitReachedCommunities',
  chatlistInvites: 'LimitReachedFolderLinks',
  chatlistJoined: 'LimitReachedSharedFolders',
  savedDialogsPinned: 'LimitReachedPinSavedDialogs',
};

const LIMIT_DESCRIPTION_BLOCKED: Record<ApiLimitTypeWithModal, string> = {
  dialogFiltersChats: 'LimitReachedChatInFoldersLocked',
  uploadMaxFileparts: 'LimitReachedFileSizeLocked',
  dialogFilters: 'LimitReachedFoldersLocked',
  dialogFolderPinned: 'LimitReachedPinDialogsLocked',
  channelsPublic: 'LimitReachedPublicLinksLocked',
  channels: 'LimitReachedCommunitiesLocked',
  chatlistInvites: 'LimitReachedFolderLinksLocked',
  chatlistJoined: 'LimitReachedSharedFoldersLocked',
  savedDialogsPinned: 'LimitReachedPinSavedDialogsLocked',
};

const LIMIT_DESCRIPTION_PREMIUM: Record<ApiLimitTypeWithModal, string> = {
  dialogFiltersChats: 'LimitReachedChatInFoldersPremium',
  uploadMaxFileparts: 'LimitReachedFileSizePremium',
  dialogFilters: 'LimitReachedFoldersPremium',
  dialogFolderPinned: 'LimitReachedPinDialogsPremium',
  channelsPublic: 'LimitReachedPublicLinksPremium',
  channels: 'LimitReachedCommunitiesPremium',
  chatlistInvites: 'LimitReachedFolderLinksPremium',
  chatlistJoined: 'LimitReachedSharedFoldersPremium',
  savedDialogsPinned: 'LimitReachedPinSavedDialogsPremium',
};

const LIMIT_ICON: Record<ApiLimitTypeWithModal, IconName> = {
  dialogFiltersChats: 'chat-badge',
  uploadMaxFileparts: 'file-badge',
  dialogFilters: 'folder-badge',
  dialogFolderPinned: 'pin-badge',
  channelsPublic: 'link-badge',
  channels: 'chats-badge',
  chatlistInvites: 'link-badge',
  chatlistJoined: 'folder-badge',
  savedDialogsPinned: 'pin-badge',
};

const LIMIT_VALUE_FORMATTER: Partial<Record<ApiLimitTypeWithModal, (...args: any[]) => string>> = {
  uploadMaxFileparts: (lang: LangFn, value: number) => {
    // The real size is not exactly 4gb, so we need to round it
    if (value === 8000) return lang('MediaSizeGB', { size: 4 }, { pluralValue: 4 });
    if (value === 4000) return lang('MediaSizeGB', { size: 2 }, { pluralValue: 2 });
    return formatFileSize(lang, value * MAX_UPLOAD_FILEPART_SIZE);
  },
};

function getLimiterDescription({
  lang,
  oldLang,
  limitType,
  isPremium,
  canBuyPremium,
  defaultValue,
  premiumValue,
  valueFormatter,
}: {
  lang: LangFn;
  oldLang: OldLangFn;
  limitType?: ApiLimitTypeWithModal;
  isPremium?: boolean;
  canBuyPremium?: boolean;
  defaultValue?: number;
  premiumValue?: number;
  valueFormatter?: (...args: any[]) => string;
}) {
  if (!limitType) {
    return undefined;
  }

  const defaultValueFormatted = valueFormatter ? valueFormatter(lang, defaultValue) : defaultValue;
  const premiumValueFormatted = valueFormatter ? valueFormatter(lang, premiumValue) : premiumValue;

  if (isPremium) {
    return oldLang(LIMIT_DESCRIPTION_PREMIUM[limitType], premiumValueFormatted);
  }

  return canBuyPremium
    ? oldLang(LIMIT_DESCRIPTION[limitType],
      limitType === 'channelsPublic' ? premiumValueFormatted : [defaultValueFormatted, premiumValueFormatted])
    : oldLang(LIMIT_DESCRIPTION_BLOCKED[limitType], defaultValueFormatted);
}

export type OwnProps = {
  limit?: ApiLimitTypeWithModal;
};

type StateProps = {
  defaultValue?: number;
  premiumValue?: number;
  isPremium?: boolean;
  canBuyPremium?: boolean;
};

const PremiumLimitReachedModal: FC<OwnProps & StateProps> = ({
  defaultValue,
  premiumValue,
  limit,
  isPremium,
  canBuyPremium,
}) => {
  const { closeLimitReachedModal, openPremiumModal } = getActions();
  const lang = useLang();
  const oldLang = useOldLang();

  const [isClosing, startClosing, stopClosing] = useFlag();

  const handleClick = useCallback(() => {
    openPremiumModal();
    startClosing();
  }, [openPremiumModal, startClosing]);

  useEffect(() => {
    if (!limit && isClosing) stopClosing();
  }, [isClosing, limit, stopClosing]);

  const title = lang('LimitReached');
  const valueFormatter = limit && LIMIT_VALUE_FORMATTER[limit];
  const description = getLimiterDescription({
    lang,
    oldLang,
    limitType: limit,
    isPremium,
    canBuyPremium,
    defaultValue,
    premiumValue,
    valueFormatter,
  });
  const icon = limit && LIMIT_ICON[limit];
  const canUpgrade = canBuyPremium && !isPremium;

  return (
    <Modal
      onClose={startClosing}
      onCloseAnimationEnd={closeLimitReachedModal}
      isOpen={Boolean(limit) && !isClosing}
      title={title}
      className={styles.root}
    >
      {!canUpgrade && (
        <div className={styles.limitBadge}>
          <i className={buildClassName(styles.limitIcon, icon, 'icon')} />
          <div className={styles.limitValue}>
            {valueFormatter?.(
              lang, isPremium ? premiumValue : defaultValue,
            ) || (isPremium ? premiumValue : defaultValue)}
          </div>
        </div>
      )}

      {canUpgrade && (
        <PremiumLimitsCompare
          className={styles.limitCompare}
          leftValue={valueFormatter?.(lang, defaultValue) || defaultValue?.toString()}
          rightValue={valueFormatter?.(lang, premiumValue) || premiumValue?.toString()}
          floatingBadgeIcon={icon}
        />
      )}

      <div>
        {renderText(description || '', ['simple_markdown', 'br'])}
      </div>

      <div className={styles.dialogButtons}>
        <Button
          className="confirm-dialog-button"
          isText
          onClick={startClosing}
          color="primary"
        >
          {lang(canUpgrade ? 'Cancel' : 'OK')}
        </Button>
        {canUpgrade
          && (
            <Button
              className="confirm-dialog-button"
              isText
              onClick={handleClick}
              color="primary"
              iconName="double-badge"
              iconClassName={styles.x2}
              iconAlignment="end"
            >
              {lang('IncreaseLimit')}
            </Button>
          )}
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { limit }): Complete<StateProps> => {
    const { limits } = global.appConfig;
    const isPremium = selectIsCurrentUserPremium(global);

    return {
      defaultValue: limit ? limits?.[limit][0] : undefined,
      premiumValue: limit ? limits?.[limit][1] : undefined,
      canBuyPremium: !selectIsPremiumPurchaseBlocked(global),
      isPremium,
    };
  },
)(PremiumLimitReachedModal));
