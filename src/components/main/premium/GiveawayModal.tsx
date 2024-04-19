import type { ChangeEvent } from 'react';
import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type {
  ApiCountry, ApiPremiumGiftCodeOption, ApiPrepaidGiveaway, ApiUser,
} from '../../../api/types';

import {
  GIVEAWAY_BOOST_PER_PREMIUM,
  GIVEAWAY_MAX_ADDITIONAL_CHANNELS,
  GIVEAWAY_MAX_ADDITIONAL_COUNTRIES,
  GIVEAWAY_MAX_ADDITIONAL_USERS,
} from '../../../config';
import { getUserFullName, isChatChannel } from '../../../global/helpers';
import {
  selectChat,
  selectTabState,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { formatDateTimeToString } from '../../../util/date/dateFormat';
import renderText from '../../common/helpers/renderText';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import CalendarModal from '../../common/CalendarModal';
import CountryPickerModal from '../../common/CountryPickerModal';
import GroupChatInfo from '../../common/GroupChatInfo';
import Icon from '../../common/Icon';
import Button from '../../ui/Button';
import ConfirmDialog from '../../ui/ConfirmDialog';
import InputText from '../../ui/InputText';
import Link from '../../ui/Link';
import ListItem from '../../ui/ListItem';
import Modal from '../../ui/Modal';
import RadioGroup from '../../ui/RadioGroup';
import RangeSliderWithMarks from '../../ui/RangeSliderWithMarks';
import Switcher from '../../ui/Switcher';
import AppendEntityPickerModal from '../AppendEntityPickerModal';
import GiveawayTypeOption from './GiveawayTypeOption';
import PremiumSubscriptionOption from './PremiumSubscriptionOption';

import styles from './GiveawayModal.module.scss';

import GiftBlueRound from '../../../assets/premium/GiftBlueRound.svg';
import GiftGreenRound from '../../../assets/premium/GiftGreenRound.svg';
import GiftRedRound from '../../../assets/premium/GiftRedRound.svg';
import GiveawayUsersRound from '../../../assets/premium/GiveawayUsersRound.svg';
import PremiumLogo from '../../../assets/premium/PremiumLogo.svg';

export type OwnProps = {
  isOpen?: boolean;
  userIds?: string[];
};

type StateProps = {
  chatId?: string;
  gifts?: ApiPremiumGiftCodeOption[];
  isOpen?: boolean;
  fromUser?: ApiUser;
  selectedMemberList?: string[] | undefined;
  selectedChannelList?: string[] | undefined;
  giveawayBoostPerPremiumLimit?: number;
  userSelectionLimit?: number;
  countryList: ApiCountry[];
  prepaidGiveaway?: ApiPrepaidGiveaway;
  countrySelectionLimit: number | undefined;
  isChannel?: boolean;
};

type GiveawayAction = 'createRandomlyUsers' | 'createSpecificUsers';
type ApiGiveawayType = 'random_users' | 'specific_users';
type SubscribersType = 'all' | 'new';

interface TypeOption {
  name: string;
  text: string;
  value: ApiGiveawayType;
  img: string;
  actions?: GiveawayAction;
  isLink: boolean;
  onClickAction?: () => void;
}

const DEFAULT_CUSTOM_EXPIRE_DATE = 86400 * 3 * 1000; // 3 days
const MAX_ADDITIONAL_CHANNELS = 9;
const DEFAULT_BOOST_COUNT = 5;

const GIVEAWAY_IMG_LIST: { [key: number]: string } = {
  3: GiftGreenRound,
  6: GiftBlueRound,
  12: GiftRedRound,
};

const GiveawayModal: FC<OwnProps & StateProps> = ({
  chatId,
  gifts,
  isOpen,
  isChannel,
  selectedMemberList,
  selectedChannelList,
  giveawayBoostPerPremiumLimit = GIVEAWAY_BOOST_PER_PREMIUM,
  countryList,
  prepaidGiveaway,
  countrySelectionLimit = GIVEAWAY_MAX_ADDITIONAL_COUNTRIES,
  userSelectionLimit = GIVEAWAY_MAX_ADDITIONAL_USERS,
}) => {
  // eslint-disable-next-line no-null/no-null
  const dialogRef = useRef<HTMLDivElement>(null);
  const {
    closeGiveawayModal, openInvoice, openPremiumModal,
    launchPrepaidGiveaway,
  } = getActions();

  const lang = useLang();
  const [isCalendarOpened, openCalendar, closeCalendar] = useFlag();
  const [isCountryPickerModalOpen, openCountryPickerModal, closeCountryPickerModal] = useFlag();
  const [isConfirmModalOpen, openConfirmModal, closeConfirmModal] = useFlag();
  const [isEntityPickerModalOpen, openEntityPickerModal, closeEntityPickerModal] = useFlag();
  const [entityType, setEntityType] = useState<'members' | 'channels' | undefined>(undefined);

  const TYPE_OPTIONS: TypeOption[] = [{
    name: 'BoostingCreateGiveaway',
    text: 'BoostingWinnersRandomly',
    value: 'random_users',
    img: GiftBlueRound,
    actions: 'createRandomlyUsers',
    isLink: false,
  }, {
    name: 'BoostingAwardSpecificUsers',
    text: 'BoostingSelectRecipients',
    value: 'specific_users',
    img: GiveawayUsersRound,
    actions: 'createSpecificUsers',
    isLink: true,
    onClickAction: () => {
      openEntityPickerModal();
      setEntityType('members');
    },
  }];

  const [customExpireDate, setCustomExpireDate] = useState<number>(Date.now() + DEFAULT_CUSTOM_EXPIRE_DATE);
  const [isHeaderHidden, setHeaderHidden] = useState(true);
  const [selectedUserCount, setSelectedUserCount] = useState<number>(DEFAULT_BOOST_COUNT);
  const [selectedGiveawayOption, setGiveawayOption] = useState<ApiGiveawayType>(TYPE_OPTIONS[0].value);
  const [selectedSubscriberOption, setSelectedSubscriberOption] = useState<SubscribersType>('all');
  const [selectedMonthOption, setSelectedMonthOption] = useState<number | undefined>();
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [selectedCountriesIds, setSelectedCountriesIds] = useState<string[] | undefined>([]);
  const [shouldShowWinners, setShouldShowWinners] = useState<boolean>(false);
  const [shouldShowPrizes, setShouldShowPrizes] = useState<boolean>(false);
  const [prizeDescription, setPrizeDescription] = useState<string | undefined>(undefined);
  const [dataPrepaidGiveaway, setDataPrepaidGiveaway] = useState<ApiPrepaidGiveaway | undefined>(undefined);
  const boostQuantity = selectedUserCount * giveawayBoostPerPremiumLimit;
  const isRandomUsers = selectedGiveawayOption === 'random_users';

  const SUBSCRIBER_OPTIONS = useMemo(() => [
    {
      value: 'all',
      label: lang(isChannel ? 'BoostingAllSubscribers' : 'BoostingAllMembers'),
      subLabel: selectedCountriesIds && selectedCountriesIds.length > 0
        ? lang('Giveaway.ReceiverType.Countries', selectedCountriesIds.length)
        : lang('BoostingFromAllCountries'),
    },
    {
      value: 'new',
      label: lang(isChannel ? 'BoostingNewSubscribers' : 'BoostingNewMembers'),
      subLabel: selectedCountriesIds && selectedCountriesIds.length > 0
        ? lang('Giveaway.ReceiverType.Countries', selectedCountriesIds.length)
        : lang('BoostingFromAllCountries'),
    },
  ], [isChannel, lang, selectedCountriesIds]);

  const monthQuantity = lang('Months', selectedMonthOption);

  const selectedGift = useMemo(() => {
    return gifts!.find((gift) => gift.months === selectedMonthOption && gift.users === selectedUserCount);
  }, [gifts, selectedMonthOption, selectedUserCount]);

  const filteredGifts = useMemo(() => {
    return gifts?.filter((gift) => gift.users
      === (selectedUserIds?.length ? selectedUserIds?.length : selectedUserCount));
  }, [gifts, selectedUserIds, selectedUserCount]);

  const fullMonthlyAmount = useMemo(() => {
    if (!filteredGifts?.length) {
      return undefined;
    }

    const basicGift = filteredGifts.reduce((acc, gift) => {
      return gift.amount < acc.amount ? gift : acc;
    });

    return Math.floor(basicGift.amount / basicGift.months);
  }, [filteredGifts]);

  const userCountOptions = useMemo(() => {
    const uniqueUserCounts = new Set(gifts?.map((gift) => gift.users));
    return Array.from(uniqueUserCounts).sort((a, b) => a - b);
  }, [gifts]);

  useEffect(() => {
    if (isOpen) {
      setSelectedMonthOption(prepaidGiveaway ? prepaidGiveaway.months : gifts?.[0].months);
    }
  }, [gifts, isOpen, prepaidGiveaway]);

  useEffect(() => {
    if (prepaidGiveaway) {
      setSelectedUserCount(prepaidGiveaway.quantity);
      setDataPrepaidGiveaway(prepaidGiveaway);
    }
  }, [prepaidGiveaway]);

  useEffect(() => {
    if (selectedMemberList) {
      setSelectedUserIds(selectedMemberList);
    }
  }, [selectedMemberList]);

  useEffect(() => {
    if (selectedChannelList) {
      setSelectedChannelIds(selectedChannelList);
    }
  }, [selectedChannelList]);

  const handlePremiumClick = useLastCallback(() => {
    openPremiumModal();
  });

  const handleClick = useLastCallback(() => {
    if (selectedUserIds?.length) {
      openInvoice({
        type: 'giftcode',
        boostChannelId: chatId!,
        userIds: selectedUserIds,
        currency: selectedGift!.currency,
        amount: selectedGift!.amount,
        option: selectedGift!,
      });
    } else {
      openInvoice({
        type: 'giveaway',
        chatId: chatId!,
        additionalChannelIds: selectedChannelIds,
        isOnlyForNewSubscribers: selectedSubscriberOption === 'new',
        countries: selectedCountriesIds,
        areWinnersVisible: shouldShowWinners,
        prizeDescription,
        untilDate: customExpireDate / 1000,
        currency: selectedGift!.currency,
        amount: selectedGift!.amount,
        option: selectedGift!,
      });
    }

    closeGiveawayModal();
  });

  const confirmLaunchPrepaidGiveaway = useLastCallback(() => {
    launchPrepaidGiveaway({
      chatId: chatId!,
      giveawayId: dataPrepaidGiveaway!.id,
      paymentPurpose: {
        additionalChannelIds: selectedChannelIds,
        countries: selectedCountriesIds,
        prizeDescription,
        areWinnersVisible: shouldShowWinners,
        untilDate: customExpireDate / 1000,
        currency: selectedGift!.currency,
        amount: selectedGift!.amount,
      },
    });

    closeConfirmModal();
    closeGiveawayModal();
  });

  const handleUserCountChange = useLastCallback((newValue) => {
    setSelectedUserCount(newValue);
  });

  const handlePrizeDescriptionChange = useLastCallback((e: ChangeEvent<HTMLInputElement>) => {
    setPrizeDescription(e.target.value);
  });

  const userNames = useMemo(() => {
    const usersById = getGlobal().users.byId;
    return selectedUserIds?.map((userId) => getUserFullName(usersById[userId])).join(', ');
  }, [selectedUserIds]);

  const handleAdd = useLastCallback(() => {
    openEntityPickerModal();
    setEntityType('channels');
  });

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const { scrollTop } = e.currentTarget;

    setHeaderHidden(scrollTop <= 150);
  }

  const handleChangeSubscriberOption = useLastCallback((value) => {
    setSelectedSubscriberOption(value);
  });

  const handleChangeTypeOption = useLastCallback((value: ApiGiveawayType) => {
    setGiveawayOption(value);
    setSelectedUserIds([]);
  });

  const handleExpireDateChange = useLastCallback((date: Date) => {
    setCustomExpireDate(date.getTime());
    closeCalendar();
  });

  const handleSetCountriesListChange = useLastCallback((value: string[]) => {
    setSelectedCountriesIds(value);
  });

  const handleSetIdsListChange = useLastCallback((value: string[]) => {
    return entityType === 'members'
      ? (value?.length ? setSelectedUserIds(value) : setGiveawayOption('random_users'))
      : setSelectedChannelIds(value);
  });

  const handleClose = useLastCallback(() => {
    closeGiveawayModal();
  });

  const handleShouldShowWinnersChange = useLastCallback((e: ChangeEvent<HTMLInputElement>) => {
    setShouldShowWinners(e.target.checked);
  });

  const handleShouldShowPrizesChange = useLastCallback((e: ChangeEvent<HTMLInputElement>) => {
    setShouldShowPrizes(e.target.checked);
  });

  const onClickActionHandler = useLastCallback(() => {
    openCountryPickerModal();
  });

  if (!gifts) return undefined;

  function renderTypeOptions() {
    return (
      <div className={styles.options}>
        {TYPE_OPTIONS.map((option) => {
          return (
            <GiveawayTypeOption
              key={option.name}
              name={option.name}
              text={option.text}
              option={option.value}
              img={option.img}
              onChange={handleChangeTypeOption}
              checked={selectedGiveawayOption === option.value}
              isLink={option.isLink}
              userNames={userNames}
              selectedMemberIds={selectedUserIds}
              onClickAction={option.onClickAction}
            />
          );
        })}
      </div>
    );
  }

  function renderSubscribersOptions() {
    return (
      <div className={styles.options}>
        <RadioGroup
          name="subscribers"
          options={SUBSCRIBER_OPTIONS}
          selected={selectedSubscriberOption}
          onChange={handleChangeSubscriberOption}
          onClickAction={onClickActionHandler}
          subLabelClassName={styles.subLabelClassName}
          isLink
        />
      </div>
    );
  }

  function renderSubscriptionOptions() {
    return (
      <div className={styles.options}>
        {filteredGifts?.map((gift) => (
          <PremiumSubscriptionOption
            isGiveaway
            key={gift.months}
            option={gift}
            fullMonthlyAmount={fullMonthlyAmount!}
            checked={gift.months === selectedMonthOption}
            onChange={setSelectedMonthOption}
          />
        ))}
      </div>
    );
  }

  function renderPremiumFeaturesLink() {
    const info = lang('GiftPremiumListFeaturesAndTerms');
    const parts = info.match(/([^*]*)\*([^*]+)\*(.*)/);

    if (!parts || parts.length < 4) {
      return undefined;
    }

    return (
      <p className={styles.premiumFeatures}>
        {parts[1]}
        <Link isPrimary onClick={handlePremiumClick}>{parts[2]}</Link>
        {parts[3]}
      </p>
    );
  }

  function deleteParticipantsHandler(id: string) {
    const filteredChannelIds = selectedChannelIds.filter((channelId) => channelId !== id);
    setSelectedChannelIds(filteredChannelIds);
  }

  return (
    <Modal
      className={styles.root}
      onClose={handleClose}
      isOpen={isOpen}
      dialogRef={dialogRef}
    >
      <div className={styles.main} onScroll={handleScroll}>
        <Button
          round
          size="smaller"
          className={styles.closeButton}
          color="translucent"
          onClick={handleClose}
          ariaLabel={lang('Close')}
        >
          <Icon name="close" />
        </Button>
        <img className={styles.logo} src={PremiumLogo} alt="" draggable={false} />
        <h2 className={styles.headerText}>
          {renderText(lang('BoostingBoostsViaGifts'))}
        </h2>
        <div className={styles.description}>
          {renderText(lang(isChannel ? 'BoostingGetMoreBoost' : 'BoostingGetMoreBoostsGroup'))}
        </div>
        <div className={buildClassName(styles.header, isHeaderHidden && styles.hiddenHeader)}>
          <h2 className={styles.premiumHeaderText}>
            {lang('BoostingBoostsViaGifts')}
          </h2>
        </div>
        {dataPrepaidGiveaway ? (
          <div className={styles.status}>
            <div>
              <img className={styles.prepaidImg} src={GIVEAWAY_IMG_LIST[dataPrepaidGiveaway.months]} alt="" />
            </div>
            <div className={styles.info}>
              <h3 className={styles.title}>
                {lang('BoostingTelegramPremiumCountPlural', dataPrepaidGiveaway.quantity)}
              </h3>
              <p className={styles.month}>{lang('PrepaidGiveawayMonths', dataPrepaidGiveaway.months)}</p>
            </div>
            <div className={styles.quantity}>
              <div className={buildClassName(styles.floatingBadge, styles.floatingBadgeColor)}>
                <Icon name="boost" className={styles.floatingBadgeIcon} />
                <div className={styles.floatingBadgeValue} dir={lang.isRtl ? 'rtl' : undefined}>
                  {dataPrepaidGiveaway.quantity * (giveawayBoostPerPremiumLimit ?? GIVEAWAY_BOOST_PER_PREMIUM)}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className={buildClassName(styles.section, styles.types)}>
            {renderTypeOptions()}
          </div>
        )}

        {isRandomUsers && (
          <>
            {!dataPrepaidGiveaway && (
              <>
                <div className={styles.section}>
                  <div className={styles.quantity}>
                    <h2 className={styles.giveawayTitle}>
                      {lang('BoostingQuantityPrizes')}
                    </h2>
                    <div className={buildClassName(styles.floatingBadge, styles.floatingBadgeColor)}>
                      <Icon name="boost" className={styles.floatingBadgeIcon} />
                      <div className={styles.floatingBadgeValue} dir={lang.isRtl ? 'rtl' : undefined}>
                        {boostQuantity}
                      </div>
                    </div>
                  </div>

                  <RangeSliderWithMarks
                    rangeCount={selectedUserCount}
                    marks={userCountOptions}
                    onChange={handleUserCountChange}
                  />
                </div>

                <div className={styles.subscription}>
                  {renderText(lang('BoostingChooseHowMany'))}
                </div>
              </>
            )}

            <div className={styles.section}>
              <h2 className={styles.giveawayTitle}>
                {lang('BoostingChannelsIncludedGiveaway')}
              </h2>

              <ListItem
                inactive
                className="chat-item-clickable contact-list-item"
              >
                <GroupChatInfo
                  chatId={chatId!}
                  status={lang(isChannel ? 'BoostingChannelWillReceiveBoost'
                    : 'BoostingGroupWillReceiveBoost', boostQuantity, 'i')}
                />
              </ListItem>

              {selectedChannelIds?.map((channelId) => {
                return (
                  <ListItem
                    ripple
                    key={channelId}
                    className="chat-item-clickable contact-list-item"
                    /* eslint-disable-next-line react/jsx-no-bind */
                    onClick={() => deleteParticipantsHandler(channelId)}
                    rightElement={(<Icon name="close" />)}
                  >
                    <GroupChatInfo
                      chatId={channelId.toString()}
                    />
                  </ListItem>
                );
              })}

              {selectedChannelIds.length < MAX_ADDITIONAL_CHANNELS && (
                <ListItem
                  icon="add"
                  ripple
                  onClick={handleAdd}
                  className={styles.addButton}
                  iconClassName={styles.addChannel}
                >
                  {lang('BoostingAddChannelOrGroup')}
                </ListItem>
              )}
            </div>

            <div className={styles.section}>
              <h2 className={styles.giveawayTitle}>
                {lang('BoostingEligibleUsers')}
              </h2>

              {renderSubscribersOptions()}
            </div>

            <div className={styles.subscription}>
              {renderText(lang(isChannel ? 'BoostGift.LimitSubscribersInfo' : 'lng_giveaway_users_about_group'))}
            </div>

            <div className={styles.section}>
              <div className={styles.checkboxSection}>
                <h2 className={styles.title}>
                  {lang('BoostingGiveawayAdditionalPrizes')}
                </h2>

                <Switcher
                  label={lang('BoostingGiveawayAdditionalPrizes')}
                  checked={shouldShowPrizes}
                  onChange={handleShouldShowPrizesChange}
                />
              </div>

              {shouldShowPrizes && (
                <div className={styles.prizesSection}>
                  <h2 className={styles.title}>
                    {dataPrepaidGiveaway ? dataPrepaidGiveaway.quantity : selectedUserCount}
                  </h2>
                  <InputText
                    className={styles.prizesInput}
                    value={prizeDescription}
                    onChange={handlePrizeDescriptionChange}
                    label={lang('BoostingGiveawayEnterYourPrize')}
                  />
                </div>
              )}
            </div>

            {shouldShowPrizes ? (
              <div className={styles.subscription}>
                {prizeDescription?.length ? renderText(lang('BoostingGiveawayAdditionPrizeCountNameHint',
                  dataPrepaidGiveaway
                    ? [dataPrepaidGiveaway.quantity, prizeDescription, monthQuantity]
                    : [selectedUserCount, prizeDescription, monthQuantity],
                  undefined,
                  selectedMonthOption), ['simple_markdown']) : renderText(lang('BoostingGiveawayAdditionPrizeCountHint',
                  dataPrepaidGiveaway
                    ? [dataPrepaidGiveaway.quantity, monthQuantity]
                    : [selectedUserCount, monthQuantity],
                  undefined,
                  selectedMonthOption), ['simple_markdown'])}
              </div>
            ) : (
              <div className={styles.subscription}>
                {renderText(lang('BoostingGiveawayAdditionPrizeHint'))}
              </div>
            )}

            <div className={styles.section}>
              <div className={styles.checkboxSection}>
                <h2 className={styles.title}>
                  {lang('BoostingGiveawayShowWinners')}
                </h2>

                <Switcher
                  label={lang('BoostingGiveawayAdditionalPrizes')}
                  checked={shouldShowWinners}
                  onChange={handleShouldShowWinnersChange}
                />
              </div>
            </div>

            <div className={styles.subscription}>
              {renderText(lang('BoostingGiveawayShowWinnersHint'))}
            </div>

            <div className={buildClassName(styles.section, dataPrepaidGiveaway && styles.subscriptionFooter)}>
              <h2 className={styles.giveawayTitle}>
                {lang('BoostingDateWhenGiveawayEnds')}
              </h2>

              <Button
                ariaLabel={lang('BoostGift.DateEnds')}
                className={buildClassName(styles.dateButton, 'expire-limit')}
                isText
                onClick={openCalendar}
              >
                <h3 className={styles.title}>
                  {lang('BoostGift.DateEnds')}
                </h3>
                {formatDateTimeToString(customExpireDate, lang.code)}
              </Button>
            </div>
          </>
        )}

        {!dataPrepaidGiveaway && (
          <>
            <div className={styles.section}>
              <h2 className={styles.giveawayTitle}>
                {lang('BoostingDurationOfPremium')}
              </h2>

              {renderSubscriptionOptions()}
            </div>

            <div className={buildClassName(styles.subscription, styles.subscriptionFooter)}>
              {renderPremiumFeaturesLink()}
            </div>
          </>
        )}

        {selectedGiveawayOption && (
          <div className={styles.footer}>
            <Button className={styles.button} onClick={dataPrepaidGiveaway ? openConfirmModal : handleClick}>
              {lang('BoostingStartGiveaway')}
              <div className={styles.quantity}>
                <div className={buildClassName(styles.floatingBadge, styles.floatingBadgeButtonColor)}>
                  <Icon name="boost" className={styles.floatingBadgeIcon} />
                  <div className={styles.floatingBadgeValue} dir={lang.isRtl ? 'rtl' : undefined}>
                    {dataPrepaidGiveaway ? dataPrepaidGiveaway.quantity : boostQuantity}
                  </div>
                </div>
              </div>
            </Button>
          </div>
        )}
      </div>
      <CalendarModal
        isOpen={isCalendarOpened}
        isFutureMode
        withTimePicker
        onClose={closeCalendar}
        onSubmit={handleExpireDateChange}
        selectedAt={customExpireDate}
        submitButtonLabel={lang('Save')}
      />
      <CountryPickerModal
        isOpen={isCountryPickerModalOpen}
        onClose={closeCountryPickerModal}
        countryList={countryList}
        onSubmit={handleSetCountriesListChange}
        selectionLimit={countrySelectionLimit}
      />
      <AppendEntityPickerModal
        key={entityType}
        isOpen={isEntityPickerModalOpen}
        onClose={closeEntityPickerModal}
        entityType={entityType}
        chatId={chatId}
        onSubmit={handleSetIdsListChange}
        selectionLimit={entityType === 'members' ? userSelectionLimit : GIVEAWAY_MAX_ADDITIONAL_CHANNELS}
      />
      <ConfirmDialog
        title={lang('BoostingStartGiveawayConfirmTitle')}
        text={lang('BoostingStartGiveawayConfirmText')}
        confirmLabel={lang('Start')}
        isOpen={isConfirmModalOpen}
        onClose={closeConfirmModal}
        confirmHandler={confirmLaunchPrepaidGiveaway}
      />
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const {
    giveawayModal,
  } = selectTabState(global);
  const chatId = giveawayModal?.chatId;
  const chat = chatId ? selectChat(global, chatId) : undefined;
  const isChannel = chat && isChatChannel(chat);

  return {
    chatId,
    gifts: giveawayModal?.gifts,
    selectedMemberList: giveawayModal?.selectedMemberIds,
    selectedChannelList: giveawayModal?.selectedChannelIds,
    giveawayBoostPerPremiumLimit: global.appConfig?.giveawayBoostsPerPremium,
    userSelectionLimit: global.appConfig?.giveawayAddPeersMax,
    countrySelectionLimit: global.appConfig?.giveawayCountriesMax,
    countryList: global.countryList.general,
    prepaidGiveaway: giveawayModal?.prepaidGiveaway,
    isChannel,
  };
})(GiveawayModal));
