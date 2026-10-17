import { memo, useMemo, useState } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiUser } from '../../api/types';
import type { TabState } from '../../global/types';
import type { Wish, WishSettings, WishSupporter } from '../../types/wish';
import type { LangFn } from '../../util/localization';

import { getPeerTitle } from '../../global/helpers/peers';
import { selectWish } from '../../global/selectors';
import { getServerTime } from '../../util/serverTime';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Avatar from '../common/Avatar';
import Island, { IslandTitle } from '../gili/layout/Island';
import SwitchField from '../gili/templates/SwitchField';
import Button from '../ui/Button';
import InputText from '../ui/InputText';
import ListItem from '../ui/ListItem';
import TabList from '../ui/TabList';
import Modal, {
  ModalCloseButton,
  ModalHeader,
  ModalTitle,
} from '@gili/modal/Modal';

import styles from './WishModal.module.scss';

export type OwnProps = {
  modal: NonNullable<TabState['wishModal']>;
  isOpen: boolean;
};

type StateProps = {
  wish?: Wish;
  isOwner: boolean;
  usersById: Record<string, ApiUser>;
};

const SUPPORTER_AVATAR_SIZE = 40;
const HIDDEN_AMOUNT = '•••';
const TITLE_MAX_LENGTH = 40;
const SECONDS_IN_MINUTE = 60;
const SECONDS_IN_HOUR = 3600;
const SECONDS_IN_DAY = 86400;
const PERCENT = 100;

enum SupportersTab {
  Recent,
  Top,
}

const WishModal = ({
  isOpen,
  wish,
  isOwner,
  usersById,
}: OwnProps & StateProps) => {
  const { closeWishModal, updateWish, showNotification } = getActions();
  const lang = useLang();

  const [activeTab, setActiveTab] = useState(SupportersTab.Recent);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editTarget, setEditTarget] = useState('');

  const tabs = useMemo(() => [
    { title: lang('WishTabRecent') },
    { title: lang('WishTabTop') },
  ], [lang]);

  const sortedSupporters = useMemo(() => {
    if (!wish) return undefined;

    return [...wish.supporters].sort(activeTab === SupportersTab.Top
      ? (a, b) => b.amountGram - a.amountGram
      : (a, b) => b.lastSupportAt - a.lastSupportAt);
  }, [wish, activeTab]);

  const handleClose = useLastCallback(() => {
    closeWishModal();
  });

  const handleBack = useLastCallback(() => {
    setIsEditing(false);
  });

  const handleEditClick = useLastCallback(() => {
    setEditTitle(wish!.title);
    setEditTarget(String(wish!.targetGram));
    setIsEditing(true);
  });

  const handleTitleChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditTitle(e.currentTarget.value);
  });

  const handleTargetChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditTarget(e.currentTarget.value.replace(/[^\d.,]/g, '').replace(',', '.'));
  });

  const handleSave = useLastCallback(() => {
    const title = editTitle.trim();
    const targetGram = Number(editTarget);
    updateWish({
      ownerId: wish!.ownerId,
      update: {
        title: title || undefined,
        targetGram: targetGram > 0 ? targetGram : undefined,
      },
    });
    setIsEditing(false);
    showNotification({ message: { key: 'WishUpdated' } });
  });

  const handleSettingChange = useLastCallback((key: keyof WishSettings, value: boolean) => {
    updateWish({ ownerId: wish!.ownerId, update: { settings: { [key]: value } } });
  });

  if (!wish) return undefined;

  const {
    title, targetGram, raisedGram, settings, supporters,
  } = wish;
  const percent = Math.min(PERCENT, Math.round((raisedGram / targetGram) * PERCENT));
  const areSupportersHidden = !isOwner && !settings.shouldShowSupporters;
  const areAmountsHidden = !isOwner && !settings.shouldShowAmounts;

  const header = (
    <ModalHeader>
      <ModalCloseButton onBack={isEditing ? handleBack : undefined} />
      <ModalTitle>{lang(isEditing ? 'WishEditTitle' : 'WishTitle')}</ModalTitle>
    </ModalHeader>
  );

  function renderSupporter({ userId, amountGram, lastSupportAt }: WishSupporter) {
    const user = usersById[userId];

    return (
      <ListItem
        key={userId}
        leftElement={<Avatar peer={user} size={SUPPORTER_AVATAR_SIZE} className={styles.avatar} />}
        rightElement={(
          <span className={styles.supportAmount}>
            {areAmountsHidden ? HIDDEN_AMOUNT : lang('WishSupportAmount', { amount: lang.number(amountGram) })}
          </span>
        )}
        multiline
        narrow
        isStatic
      >
        <span className="title" dir="auto">{user ? getPeerTitle(lang, user) : userId}</span>
        <span className="subtitle">{formatSupportTime(lang, lastSupportAt)}</span>
      </ListItem>
    );
  }

  function renderSupporters() {
    if (areSupportersHidden) {
      return <div className={styles.note}>{lang('WishSupportersHidden')}</div>;
    }
    if (!sortedSupporters?.length) {
      return <div className={styles.note}>{lang('WishNoSupporters')}</div>;
    }

    return sortedSupporters.map(renderSupporter);
  }

  function renderOwnerSettings() {
    return (
      <Island className={styles.island}>
        <IslandTitle>{lang('WishVisibleToVisitors')}</IslandTitle>
        <SwitchField
          label={lang('WishSettingWish')}
          checked={settings.shouldShowWish}
          onChange={(value) => handleSettingChange('shouldShowWish', value)}
        />
        <SwitchField
          label={lang('WishSettingSupporters')}
          checked={settings.shouldShowSupporters}
          onChange={(value) => handleSettingChange('shouldShowSupporters', value)}
        />
        <SwitchField
          label={lang('WishSettingAmounts')}
          checked={settings.shouldShowAmounts}
          onChange={(value) => handleSettingChange('shouldShowAmounts', value)}
        />
        <ListItem icon="edit" withPrimaryColor narrow ripple onClick={handleEditClick}>
          <span>{lang('WishEdit')}</span>
        </ListItem>
      </Island>
    );
  }

  function renderEditForm() {
    return (
      <div className={styles.editForm}>
        <InputText
          label={lang('WishTitleLabel')}
          value={editTitle}
          maxLength={TITLE_MAX_LENGTH}
          onChange={handleTitleChange}
        />
        <InputText
          label={lang('WishTargetLabel')}
          value={editTarget}
          inputMode="decimal"
          onChange={handleTargetChange}
        />
        <Button onClick={handleSave}>{lang('Save')}</Button>
      </div>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      header={header}
      width="regular"
      height={isEditing ? 'auto' : 'tall'}
      ariaLabel={lang('WishTitle')}
      onClose={handleClose}
    >
      {isEditing ? renderEditForm() : (
        <>
          <Island className={styles.summary}>
            <div className={styles.title} dir="auto">{title}</div>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={`transform: scaleX(${percent / PERCENT})`} />
            </div>
            <div className={styles.stats}>
              {lang('WishProgress', {
                raised: lang.number(raisedGram),
                target: lang.number(targetGram),
                percent,
                supporters: lang('WishSupporters', { count: supporters.length }, { pluralValue: supporters.length }),
              })}
            </div>
          </Island>
          <Island className={styles.island}>
            <TabList
              tabs={tabs}
              activeTab={activeTab}
              className={styles.tabs}
              centered
              onSwitchTab={setActiveTab}
            />
            {renderSupporters()}
          </Island>
          {isOwner && renderOwnerSettings()}
        </>
      )}
    </Modal>
  );
};

function formatSupportTime(lang: LangFn, timestamp: number) {
  const elapsed = Math.max(0, getServerTime() - timestamp);
  if (elapsed < SECONDS_IN_MINUTE) return lang('WishTimeJustNow');
  if (elapsed < SECONDS_IN_HOUR) return lang('WishTimeMinutesAgo', { count: Math.floor(elapsed / SECONDS_IN_MINUTE) });
  if (elapsed < SECONDS_IN_DAY) return lang('WishTimeHoursAgo', { count: Math.floor(elapsed / SECONDS_IN_HOUR) });
  if (elapsed < SECONDS_IN_DAY * 2) return lang('WishTimeYesterday');
  return lang('WishTimeDaysAgo', { count: Math.floor(elapsed / SECONDS_IN_DAY) });
}

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => ({
    wish: selectWish(global, modal.ownerId),
    isOwner: modal.ownerId === global.currentUserId,
    usersById: global.users.byId,
  }),
)(WishModal));
