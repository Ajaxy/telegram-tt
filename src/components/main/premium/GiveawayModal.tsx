import {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type {
  ApiCountry,
  ApiPremiumGiftCodeOption,
  ApiPrepaidGiveaway,
  ApiPrepaidStarsGiveaway,
  ApiStarGiveawayOption,
  ApiTypePrepaidGiveaway,
} from '../../../api/types';
import type { RegularLangKey } from '../../../types/language';
import type { IconBackdropColor } from '../../gili/primitives/IconBackdrop';

import {
  GIVEAWAY_BOOST_PER_PREMIUM,
  GIVEAWAY_MAX_ADDITIONAL_CHANNELS,
  GIVEAWAY_MAX_ADDITIONAL_COUNTRIES,
  GIVEAWAY_MAX_ADDITIONAL_USERS,
  STARS_CURRENCY_CODE,
} from '../../../config';
import { getUserFullName, isChatChannel } from '../../../global/helpers';
import {
  selectChat,
  selectTabState,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { unique } from '../../../util/iteratees';
import { formatDateTime } from '../../../util/localization/dateFormat';
import renderText from '../../common/helpers/renderText';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import BadgeButton from '../../common/BadgeButton';
import CalendarModal from '../../common/CalendarModal';
import CountryPickerModal from '../../common/CountryPickerModal.async';
import GroupChatInfo from '../../common/GroupChatInfo';
import Icon from '../../common/icons/Icon';
import StarTopupOptionList from '../../modals/stars/StarTopupOptionList';
import Button from '../../ui/Button';
import ConfirmDialog from '../../ui/ConfirmDialog';
import InputText from '../../ui/InputText';
import Link from '../../ui/Link';
import ListItem from '../../ui/ListItem';
import Modal from '../../ui/Modal';
import RadioGroup from '../../ui/RadioGroup';
import RangeSliderWithMarks from '../../ui/RangeSliderWithMarks';
import Switcher from '../../ui/Switcher';
import GiveawayChannelPickerModal from './GiveawayChannelPickerModal';
import GiveawayTypeOption from './GiveawayTypeOption';
import GiveawayUserPickerModal from './GiveawayUserPickerModal';
import PremiumSubscriptionOption from './PremiumSubscriptionOption';

import styles from './GiveawayModal.module.scss';

import PremiumLogo from '../../../assets/premium/PremiumStar.svg';

export type OwnProps = {
  isOpen?: boolean;
  userIds?: string[];
};

type StateProps = {
  chatId?: string;
  gifts?: ApiPremiumGiftCodeOption[];
  selectedMemberList?: string[] | undefined;
  selectedChannelList?: string[] | undefined;
  giveawayBoostPerPremiumLimit?: number;
  userSelectionLimit?: number;
  countryList: ApiCountry[];
  prepaidGiveaway?: ApiTypePrepaidGiveaway;
  countrySelectionLimit: number | undefined;
  isChannel?: boolean;
  isStarsGiftEnabled?: boolean;
  starsGiftOptions?: ApiStarGiveawayOption[] | undefined;
};

type GiveawayAction = 'createPremiumGiveaway' | 'createStarsGiveaway';
type ApiGiveawayType = 'premium_giveaway' | 'stars_giveaway';
type SubscribersType = 'all' | 'new';

interface TypeOption {
  name: RegularLangKey;
  text: RegularLangKey;
  value: ApiGiveawayType;
  actions?: GiveawayAction;
  isLink: boolean;
  onClickAction?: () => void;
}

const DEFAULT_CUSTOM_EXPIRE_DATE = 86400 * 3 * 1000; // 3 days
const MAX_ADDITIONAL_CHANNELS = 9;
const DEFAULT_BOOST_COUNT = 5;

const GIVEAWAY_COLOR_BY_MONTH: Partial<Record<number, IconBackdropColor>> = {
  3: 'green',
  6: 'blue',
  12: 'red',
};

const GiveawayModal = ({
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
  isStarsGiftEnabled,
  starsGiftOptions,
}: OwnProps & StateProps) => {
  const {
    closeGiveawayModal, openInvoice, openPremiumModal,
    launchPrepaidGiveaway, launchPrepaidStarsGiveaway, showNotification,
  } = getActions();

  const lang = useLang();
  const dialogRef = useRef<HTMLDivElement>();
  const [isCalendarOpened, openCalendar, closeCalendar] = useFlag();
  const [isCountryPickerModalOpen, openCountryPickerModal, closeCountryPickerModal] = useFlag();
  const [isConfirmModalOpen, openConfirmModal, closeConfirmModal] = useFlag();
  const [isUserPickerModalOpen, openUserPickerModal, closeUserPickerModal] = useFlag();
  const [isChannelPickerModalOpen, openChannelPickerModal, closeChannelPickerModal] = useFlag();

  const TYPE_OPTIONS: TypeOption[] = [{
    name: 'TelegramPremium',
    text: 'BoostingWinnersRandomly',
    value: 'premium_giveaway',
    actions: 'createPremiumGiveaway',
    isLink: true,
    onClickAction: () => {
      openUserPickerModal();
    },
  }];

  if (isStarsGiftEnabled) {
    TYPE_OPTIONS.push({
      name: 'TelegramStars',
      text: 'BoostingWinnersRandomly',
      value: 'stars_giveaway',
      actions: 'createStarsGiveaway',
      isLink: false,
    });
  }

  const [customExpireDate, setCustomExpireDate] = useState<number>(() => Date.now() + DEFAULT_CUSTOM_EXPIRE_DATE);
  const [isHeaderHidden, setIsHeaderHidden] = useState(true);
  const [selectedRandomUserCount, setSelectedRandomUserCount] = useState<number>(DEFAULT_BOOST_COUNT);
  const [selectedGiveawayOption, setSelectedGiveawayOption] = useState<ApiGiveawayType>(TYPE_OPTIONS[0].value);
  const [selectedStarOption, setSelectedStarOption] = useState<ApiStarGiveawayOption | undefined>();
  const [selectedSubscriberOption, setSelectedSubscriberOption] = useState<SubscribersType>('all');
  const [selectedMonthOption, setSelectedMonthOption] = useState<number | undefined>();
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [selectedCountryIds, setSelectedCountryIds] = useState<string[] | undefined>([]);
  const [shouldShowWinners, setShouldShowWinners] = useState<boolean>(false);
  const [shouldShowPrizes, setShouldShowPrizes] = useState<boolean>(false);
  const [prizeDescription, setPrizeDescription] = useState<string | undefined>(undefined);
  const [dataPrepaidGiveaway, setDataPrepaidGiveaway] = useState<ApiPrepaidGiveaway | undefined>(undefined);
  const [
    dataStarsPrepaidGiveaway, setDataStarsPrepaidGiveaway,
  ] = useState<ApiPrepaidStarsGiveaway | undefined>(undefined);

  const isPremiumGiveaway = selectedGiveawayOption === 'premium_giveaway';
  const isStarsGiveaway = selectedGiveawayOption === 'stars_giveaway';
  const selectedUserCount = isPremiumGiveaway
    && !selectedUserIds.length ? selectedRandomUserCount : selectedUserIds.length;
  const boostQuantity = selectedUserCount * giveawayBoostPerPremiumLimit;
  const boostStarsQuantity = selectedStarOption?.yearlyBoosts;

  const SUBSCRIBER_OPTIONS = useMemo(() => [
    {
      value: 'all',
      label: lang(isChannel ? 'BoostingAllSubscribers' : 'BoostingAllMembers'),
      subLabel: selectedCountryIds && selectedCountryIds.length > 0
        ? lang(
          'GiveawayReceiverTypeCountries',
          { count: selectedCountryIds.length },
          { pluralValue: selectedCountryIds.length },
        )
        : lang('BoostingFromAllCountries'),
    },
    {
      value: 'new',
      label: lang(isChannel ? 'BoostingNewSubscribers' : 'BoostingNewMembers'),
      subLabel: selectedCountryIds && selectedCountryIds.length > 0
        ? lang(
          'GiveawayReceiverTypeCountries',
          { count: selectedCountryIds.length },
          { pluralValue: selectedCountryIds.length },
        )
        : lang('BoostingFromAllCountries'),
    },
  ], [isChannel, lang, selectedCountryIds]);

  const monthQuantity = selectedMonthOption === undefined
    ? '' : lang('Months', { count: selectedMonthOption }, { pluralValue: selectedMonthOption });
  const isStarsPrepaidGiveaway = prepaidGiveaway?.type === 'starsGiveaway';
  const isPremiumPrepaidGiveaway = prepaidGiveaway?.type === 'giveaway';

  const selectedGift = useMemo(() => {
    return gifts?.find((gift) => gift.months === selectedMonthOption && gift.users === selectedUserCount);
  }, [gifts, selectedMonthOption, selectedUserCount]);

  const selectedStarsGift = useMemo(() => {
    return starsGiftOptions?.find((gift) => {
      return isStarsPrepaidGiveaway && gift.stars === (dataStarsPrepaidGiveaway?.stars);
    });
  }, [dataStarsPrepaidGiveaway, starsGiftOptions, isStarsPrepaidGiveaway]);

  const filteredGifts = useMemo(() => {
    return gifts?.filter((gift) => gift.users === selectedUserCount && gift.currency !== STARS_CURRENCY_CODE);
  }, [gifts, selectedUserCount]);

  const fullMonthlyAmount = useMemo(() => {
    const basicGift = filteredGifts?.reduce((acc, gift) => {
      return gift.amount < acc.amount ? gift : acc;
    }, filteredGifts[0]);

    return basicGift && Math.floor(basicGift.amount / basicGift.months);
  }, [filteredGifts]);

  const userCountOptions = useMemo(() => {
    return unique((gifts?.filter((gift) => gift.currency !== STARS_CURRENCY_CODE)
      ?.map((winner) => winner.users) || [])).sort((a, b) => a - b);
  }, [gifts]);

  const winnerCountOptions = useMemo(() => {
    return unique((selectedStarOption?.winners?.map((winner) => winner.users) || [])).sort((a, b) => a - b);
  }, [selectedStarOption]);

  useEffect(() => {
    if (isOpen && gifts?.length && !isStarsPrepaidGiveaway) {
      setSelectedMonthOption(gifts?.[0].months);
    }
  }, [isOpen, gifts, isStarsPrepaidGiveaway]);

  useEffect(() => {
    if (isOpen && starsGiftOptions?.length && !isPremiumPrepaidGiveaway) {
      setSelectedStarOption(starsGiftOptions?.[0]);
    }
  }, [isOpen, starsGiftOptions, isPremiumPrepaidGiveaway]);

  useEffect(() => {
    if (isOpen && isStarsPrepaidGiveaway) {
      setSelectedRandomUserCount(prepaidGiveaway.quantity);
      setDataStarsPrepaidGiveaway(prepaidGiveaway);
    }
  }, [isOpen, isStarsPrepaidGiveaway, prepaidGiveaway]);

  useEffect(() => {
    if (isOpen && isPremiumPrepaidGiveaway) {
      setSelectedRandomUserCount(prepaidGiveaway.quantity);
      setDataPrepaidGiveaway(prepaidGiveaway);
      setSelectedMonthOption(prepaidGiveaway.months);
    }
  }, [isOpen, isPremiumPrepaidGiveaway, prepaidGiveaway]);

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

  const handleClose = useLastCallback(() => {
    setDataStarsPrepaidGiveaway(undefined);
    setDataPrepaidGiveaway(undefined);
    setSelectedStarOption(undefined);
    setSelectedMonthOption(undefined);
    setSelectedRandomUserCount(DEFAULT_BOOST_COUNT);
    closeGiveawayModal();
  });

  const handleClick = useLastCallback(() => {
    if (isPremiumGiveaway) {
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
          countries: selectedCountryIds,
          areWinnersVisible: shouldShowWinners,
          prizeDescription,
          untilDate: customExpireDate / 1000,
          currency: selectedGift!.currency,
          amount: selectedGift!.amount,
          option: selectedGift!,
        });
      }
    } else {
      openInvoice({
        type: 'starsgiveaway',
        chatId: chatId!,
        additionalChannelIds: selectedChannelIds,
        isOnlyForNewSubscribers: selectedSubscriberOption === 'new',
        countries: selectedCountryIds,
        areWinnersVisible: shouldShowWinners,
        prizeDescription,
        untilDate: customExpireDate / 1000,
        currency: selectedStarOption!.currency,
        amount: selectedStarOption!.amount,
        stars: selectedStarOption!.stars,
        users: selectedRandomUserCount,
      });
    }

    handleClose();
  });

  const confirmLaunchPrepaidGiveaway = useLastCallback(() => {
    if (isStarsPrepaidGiveaway) {
      launchPrepaidStarsGiveaway({
        chatId: chatId!,
        giveawayId: dataStarsPrepaidGiveaway!.id,
        paymentPurpose: {
          additionalChannelIds: selectedChannelIds,
          countries: selectedCountryIds,
          prizeDescription,
          areWinnersVisible: shouldShowWinners,
          untilDate: customExpireDate / 1000,
          stars: dataStarsPrepaidGiveaway!.stars,
          currency: selectedStarsGift!.currency,
          amount: selectedStarsGift!.amount,
          users: dataStarsPrepaidGiveaway!.quantity,
        },
      });
    } else {
      launchPrepaidGiveaway({
        chatId: chatId!,
        giveawayId: dataPrepaidGiveaway!.id,
        paymentPurpose: {
          additionalChannelIds: selectedChannelIds,
          countries: selectedCountryIds,
          prizeDescription,
          areWinnersVisible: shouldShowWinners,
          untilDate: customExpireDate / 1000,
          currency: selectedGift!.currency,
          amount: selectedGift!.amount,
        },
      });
    }

    closeConfirmModal();
    handleClose();
  });

  const handleRandomUserCountChange = useLastCallback((newValue) => {
    setSelectedRandomUserCount(newValue);
  });

  const handleWinnerCountChange = useLastCallback((newValue) => {
    setSelectedRandomUserCount(newValue);
  });

  const handlePrizeDescriptionChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPrizeDescription(e.target.value);
  });

  const userNames = useMemo(() => {
    const usersById = getGlobal().users.byId;
    return selectedUserIds?.map((userId) => getUserFullName(lang, usersById[userId])).join(', ');
  }, [selectedUserIds, lang]);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const { scrollTop } = e.currentTarget;

    setIsHeaderHidden(scrollTop <= 150);
  }

  const handleChangeSubscriberOption = useLastCallback((value) => {
    setSelectedSubscriberOption(value);
  });

  const handleChangeTypeOption = useLastCallback((value: ApiGiveawayType) => {
    setSelectedGiveawayOption(value);
    setSelectedUserIds([]);
    setSelectedRandomUserCount(DEFAULT_BOOST_COUNT);
  });

  const handleExpireDateChange = useLastCallback((date: Date) => {
    setCustomExpireDate(date.getTime());
    closeCalendar();
  });

  const handleSetCountriesListChange = useLastCallback((value: string[]) => {
    setSelectedCountryIds(value);
  });

  const handleCountrySelectionLimit = useLastCallback((selectionLimit: number) => {
    showNotification({
      message: {
        key: 'GiveawayCountryLimit',
        variables: { count: selectionLimit },
        options: {
          pluralValue: selectionLimit,
          withNodes: true,
          withMarkdown: true,
          renderTextFilters: ['br', 'links'],
        },
      },
    });
  });

  const handleSelectedUserIdsChange = useLastCallback((newSelectedIds: string[]) => {
    setSelectedUserIds(newSelectedIds);
    if (!newSelectedIds.length) {
      setSelectedGiveawayOption('premium_giveaway');
    }
  });

  const handleSelectedChannelIdsChange = useLastCallback((newSelectedIds: string[]) => {
    setSelectedChannelIds(newSelectedIds);
  });

  const onClickActionHandler = useLastCallback(() => {
    openCountryPickerModal();
  });

  const handleStarClick = useLastCallback((option) => {
    setSelectedStarOption(option);
  });

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
            fullMonthlyAmount={fullMonthlyAmount}
            checked={gift.months === selectedMonthOption}
            onChange={setSelectedMonthOption}
          />
        ))}
      </div>
    );
  }

  function renderPremiumFeaturesLink() {
    return (
      <p className={styles.premiumFeatures}>
        {lang('GiftPremiumFeaturesTerms', {
          link: <Link isPrimary onClick={handlePremiumClick}>{lang('GiftPremiumFeaturesTermsLink')}</Link>,
        }, { withNodes: true })}
      </p>
    );
  }

  function deleteParticipantsHandler(id: string) {
    const filteredChannelIds = selectedChannelIds.filter((channelId) => channelId !== id);
    setSelectedChannelIds(filteredChannelIds);
  }

  function renderStarOptionList() {
    return (
      <StarTopupOptionList
        className={styles.starOptions}
        options={starsGiftOptions}
        selectedStarCount={selectedRandomUserCount}
        selectedStarOption={selectedStarOption}
        onClick={handleStarClick}
      />
    );
  }

  function renderGiveawayOptionList() {
    return (
      <>
        <div className={styles.section}>
          <h2 className={styles.giveawayTitle}>
            {lang('BoostingChannelsGroupsIncludedGiveaway')}
          </h2>

          <ListItem
            inactive
            className="chat-item-clickable contact-list-item"
          >
            <GroupChatInfo
              chatId={chatId!}
              status={lang(isChannel ? 'BoostingChannelWillReceiveBoost' : 'BoostingGroupWillReceiveBoost', {
                count: boostQuantity || boostStarsQuantity || 0,
              }, { pluralValue: boostQuantity || boostStarsQuantity || 0 })}
            />
          </ListItem>

          {selectedChannelIds?.map((channelId) => {
            return (
              <ListItem
                ripple
                key={channelId}
                className="chat-item-clickable contact-list-item"

                onClick={() => deleteParticipantsHandler(channelId)}
                rightElement={(<Icon name="close" className={styles.removeChannel} />)}
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
              onClick={openChannelPickerModal}
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
          {renderText(lang(isChannel ? 'BoostGiftLimitSubscribersInfo' : 'GiveawayUsersAboutGroup'))}
        </div>

        <div className={styles.section}>
          <div className={styles.checkboxSection}>
            <h2 className={styles.title}>
              {lang('BoostingGiveawayAdditionalPrizes')}
            </h2>

            <Switcher
              label={lang('BoostingGiveawayAdditionalPrizes')}
              checked={shouldShowPrizes}
              onCheck={setShouldShowPrizes}
            />
          </div>

          {shouldShowPrizes && (
            <div className={styles.prizesSection}>
              <h2 className={styles.title}>
                {selectedRandomUserCount}
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
          !isStarsGiveaway && !isStarsPrepaidGiveaway ? (
            <div className={styles.subscription}>
              {prizeDescription?.length ? lang('BoostingGiveawayAdditionPrizeCountNameHint', {
                count: dataPrepaidGiveaway?.quantity ?? selectedUserCount,
                prize: prizeDescription,
                duration: monthQuantity,
              }, { pluralValue: selectedMonthOption ?? 0, withNodes: true, withMarkdown: true })
                : lang('BoostingGiveawayAdditionPrizeCountHint', {
                  count: dataPrepaidGiveaway?.quantity ?? selectedUserCount,
                  duration: monthQuantity,
                }, { pluralValue: selectedMonthOption ?? 0, withNodes: true, withMarkdown: true })}
            </div>
          ) : undefined
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
              onCheck={setShouldShowWinners}
            />
          </div>
        </div>

        <div className={styles.subscription}>
          {renderText(lang('BoostingGiveawayShowWinnersHint'))}
        </div>

        <div className={buildClassName(styles.section,
          (dataPrepaidGiveaway || dataStarsPrepaidGiveaway || isStarsGiveaway) && styles.subscriptionFooter)}
        >
          <h2 className={styles.giveawayTitle}>
            {lang('BoostingDateWhenGiveawayEnds')}
          </h2>

          <Button
            ariaLabel={lang('BoostGiftDateEnds')}
            className={buildClassName(styles.dateButton, 'expire-limit')}
            isText
            onClick={openCalendar}
          >
            <h3 className={styles.title}>
              {lang('BoostGiftDateEnds')}
            </h3>
            {formatDateTime(lang, new Date(customExpireDate), { date: 'short', time: 'long' })}
          </Button>
        </div>
      </>
    );
  }

  return (
    <Modal
      className={styles.root}
      onClose={handleClose}
      isOpen={isOpen}
      dialogRef={dialogRef}
      onEnter={(dataPrepaidGiveaway || dataStarsPrepaidGiveaway) ? openConfirmModal : handleClick}
      hasAbsoluteCloseButton
    >
      <div className={buildClassName(styles.main, 'custom-scroll')} onScroll={handleScroll}>
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
        {(dataPrepaidGiveaway || dataStarsPrepaidGiveaway) ? (
          <ListItem
            className={styles.prepaidGiveaway}
            icon={dataStarsPrepaidGiveaway ? 'star' : 'gift-filled'}
            iconClassName={styles.prepaidIcon}
            iconBg={dataStarsPrepaidGiveaway ? 'orange'
              : GIVEAWAY_COLOR_BY_MONTH[dataPrepaidGiveaway!.months] || 'green'}
            multiline
            isStatic
            rightElement={(
              <BadgeButton className={styles.boostBadge}>
                <Icon name="boost" className="in-text-icon" />
                {dataStarsPrepaidGiveaway ? dataStarsPrepaidGiveaway.boosts
                  : dataPrepaidGiveaway!.quantity * giveawayBoostPerPremiumLimit}
              </BadgeButton>
            )}
          >
            <span className="title list-item-ellipsis">
              {dataStarsPrepaidGiveaway ? lang('GiveawayStarsPrepaidTitle', { count: dataStarsPrepaidGiveaway.stars })
                : lang(
                  'BoostingTelegramPremiumCountPlural',
                  { count: dataPrepaidGiveaway!.quantity },
                  { pluralValue: dataPrepaidGiveaway!.quantity },
                )}
            </span>
            <span className="subtitle">
              {dataStarsPrepaidGiveaway ? lang(
                'GiveawayStarsPrepaidDesc',
                { count: dataStarsPrepaidGiveaway.quantity },
                { pluralValue: dataStarsPrepaidGiveaway.quantity },
              )
                : lang(
                  'PrepaidGiveawayMonths',
                  { count: dataPrepaidGiveaway!.months },
                  { pluralValue: dataPrepaidGiveaway!.months },
                )}
            </span>
          </ListItem>
        ) : (
          <div className={buildClassName(styles.section, styles.types)}>
            {renderTypeOptions()}
          </div>
        )}

        {isPremiumGiveaway && !selectedUserIds?.length && (
          <>
            {!dataPrepaidGiveaway && !dataStarsPrepaidGiveaway && (
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
                    onChange={handleRandomUserCountChange}
                  />
                </div>

                <div className={styles.subscription}>
                  {renderText(lang('BoostingChooseHowMany'))}
                </div>
              </>
            )}

            {renderGiveawayOptionList()}
          </>
        )}

        {isStarsGiveaway && (
          <>
            {!dataStarsPrepaidGiveaway && !dataPrepaidGiveaway && (
              <>
                <div className={styles.section}>
                  <div className={styles.quantity}>
                    <h2 className={styles.giveawayTitle}>
                      {lang('BoostingStarsOptions')}
                    </h2>
                    <div className={buildClassName(styles.floatingBadge, styles.floatingBadgeColor)}>
                      <Icon name="boost" className={styles.floatingBadgeIcon} />
                      <div className={styles.floatingBadgeValue} dir={lang.isRtl ? 'rtl' : undefined}>
                        {boostStarsQuantity}
                      </div>
                    </div>
                  </div>

                  {renderStarOptionList()}
                </div>

                <div className={buildClassName(styles.subscription, styles.starSubscription)}>
                  {renderText(lang('BoostGiftStarsInfo'))}
                </div>

                <div className={styles.section}>
                  <h2 className={styles.giveawayTitle}>
                    {lang('BoostingStarsQuantityPrizes')}
                  </h2>

                  <RangeSliderWithMarks
                    rangeCount={selectedRandomUserCount}
                    marks={winnerCountOptions}
                    onChange={handleWinnerCountChange}
                  />

                  <div className={styles.subscription}>
                    {renderText(lang('BoostingStarsQuantityPrizesInfo'))}
                  </div>
                </div>
              </>
            )}

            {renderGiveawayOptionList()}
          </>
        )}

        {!dataPrepaidGiveaway && !dataStarsPrepaidGiveaway && isPremiumGiveaway && (
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
            <Button
              className={styles.button}
              onClick={(dataPrepaidGiveaway || dataStarsPrepaidGiveaway) ? openConfirmModal : handleClick}
            >
              {lang('BoostingStartGiveaway')}
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
        initialSelectedCountryIds={selectedCountryIds}
        selectionLimit={countrySelectionLimit}
        title={lang('BoostingSelectCountry')}
        onSelectionLimit={handleCountrySelectionLimit}
      />
      <GiveawayUserPickerModal
        isOpen={isUserPickerModalOpen}
        onClose={closeUserPickerModal}
        onSelectedIdsConfirmed={handleSelectedUserIdsChange}
        initialSelectedIds={selectedUserIds}
        selectionLimit={userSelectionLimit}
        giveawayChatId={chatId}
      />
      <GiveawayChannelPickerModal
        isOpen={isChannelPickerModalOpen}
        onClose={closeChannelPickerModal}
        initialSelectedIds={selectedChannelIds}
        onSelectedIdsConfirmed={handleSelectedChannelIdsChange}
        selectionLimit={GIVEAWAY_MAX_ADDITIONAL_CHANNELS}
        giveawayChatId={chatId}
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

export default memo(withGlobal<OwnProps>((global): Complete<StateProps> => {
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
    giveawayBoostPerPremiumLimit: global.appConfig.giveawayBoostsPerPremium,
    isStarsGiftEnabled: global.appConfig.isStarsGiftEnabled,
    userSelectionLimit: global.appConfig.giveawayAddPeersMax,
    countrySelectionLimit: global.appConfig.giveawayCountriesMax,
    countryList: global.countryList.general,
    prepaidGiveaway: giveawayModal?.prepaidGiveaway,
    isChannel,
    starsGiftOptions: giveawayModal?.starOptions,
  };
})(GiveawayModal));
