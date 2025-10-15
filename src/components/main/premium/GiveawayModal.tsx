import type { ChangeEvent } from 'react';
import type { FC } from '../../../lib/teact/teact';
import type React from '../../../lib/teact/teact';
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
import { formatDateTimeToString } from '../../../util/dates/dateFormat';
import { unique } from '../../../util/iteratees';
import renderText from '../../common/helpers/renderText';

import useFlag from '../../../hooks/useFlag';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

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

import GiftBlueRound from '../../../assets/premium/GiftBlueRound.svg';
import GiftGreenRound from '../../../assets/premium/GiftGreenRound.svg';
import GiftRedRound from '../../../assets/premium/GiftRedRound.svg';
import GiftStar from '../../../assets/premium/GiftStar.svg';
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

const GIVEAWAY_IMG_LIST: Partial<Record<number, string>> = {
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
  isStarsGiftEnabled,
  starsGiftOptions,
}) => {
  const dialogRef = useRef<HTMLDivElement>();
  const {
    closeGiveawayModal, openInvoice, openPremiumModal,
    launchPrepaidGiveaway, launchPrepaidStarsGiveaway,
  } = getActions();

  const lang = useOldLang();
  const [isCalendarOpened, openCalendar, closeCalendar] = useFlag();
  const [isCountryPickerModalOpen, openCountryPickerModal, closeCountryPickerModal] = useFlag();
  const [isConfirmModalOpen, openConfirmModal, closeConfirmModal] = useFlag();
  const [isUserPickerModalOpen, openUserPickerModal, closeUserPickerModal] = useFlag();
  const [isChannelPickerModalOpen, openChannelPickerModal, closeChannelPickerModal] = useFlag();

  const TYPE_OPTIONS: TypeOption[] = [{
    name: 'Premium.Title',
    text: 'BoostingWinnersRandomly',
    value: 'premium_giveaway',
    img: GiftBlueRound,
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
      img: GiftStar,
      actions: 'createStarsGiveaway',
      isLink: false,
    });
  }

  const [customExpireDate, setCustomExpireDate] = useState<number>(() => Date.now() + DEFAULT_CUSTOM_EXPIRE_DATE);
  const [isHeaderHidden, setHeaderHidden] = useState(true);
  const [selectedRandomUserCount, setSelectedRandomUserCount] = useState<number>(DEFAULT_BOOST_COUNT);
  const [selectedGiveawayOption, setGiveawayOption] = useState<ApiGiveawayType>(TYPE_OPTIONS[0].value);
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
        ? lang('Giveaway.ReceiverType.Countries', selectedCountryIds.length)
        : lang('BoostingFromAllCountries'),
    },
    {
      value: 'new',
      label: lang(isChannel ? 'BoostingNewSubscribers' : 'BoostingNewMembers'),
      subLabel: selectedCountryIds && selectedCountryIds.length > 0
        ? lang('Giveaway.ReceiverType.Countries', selectedCountryIds.length)
        : lang('BoostingFromAllCountries'),
    },
  ], [isChannel, lang, selectedCountryIds]);

  const monthQuantity = lang('Months', selectedMonthOption);
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

  const handlePrizeDescriptionChange = useLastCallback((e: ChangeEvent<HTMLInputElement>) => {
    setPrizeDescription(e.target.value);
  });

  const userNames = useMemo(() => {
    const usersById = getGlobal().users.byId;
    return selectedUserIds?.map((userId) => getUserFullName(usersById[userId])).join(', ');
  }, [selectedUserIds]);

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
    setSelectedRandomUserCount(DEFAULT_BOOST_COUNT);
  });

  const handleExpireDateChange = useLastCallback((date: Date) => {
    setCustomExpireDate(date.getTime());
    closeCalendar();
  });

  const handleSetCountriesListChange = useLastCallback((value: string[]) => {
    setSelectedCountryIds(value);
  });

  const handleSelectedUserIdsChange = useLastCallback((newSelectedIds: string[]) => {
    setSelectedUserIds(newSelectedIds);
    if (!newSelectedIds.length) {
      setGiveawayOption('premium_giveaway');
    }
  });

  const handleSelectedChannelIdsChange = useLastCallback((newSelectedIds: string[]) => {
    setSelectedChannelIds(newSelectedIds);
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
            fullMonthlyAmount={fullMonthlyAmount}
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
              status={lang(isChannel ? 'BoostingChannelWillReceiveBoost'
                : 'BoostingGroupWillReceiveBoost', boostQuantity || boostStarsQuantity, 'i')}
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
              onChange={handleShouldShowWinnersChange}
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
    );
  }

  return (
    <Modal
      className={styles.root}
      onClose={handleClose}
      isOpen={isOpen}
      dialogRef={dialogRef}
      onEnter={(dataPrepaidGiveaway || dataStarsPrepaidGiveaway) ? openConfirmModal : handleClick}
    >
      <div className={buildClassName(styles.main, 'custom-scroll')} onScroll={handleScroll}>
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
        {(dataPrepaidGiveaway || dataStarsPrepaidGiveaway) ? (
          <div className={styles.status}>
            <div>
              {dataStarsPrepaidGiveaway ? (
                <img className={styles.prepaidImg} src={GiftStar} alt="" />
              ) : (
                <img
                  className={styles.prepaidImg}
                  src={GIVEAWAY_IMG_LIST[dataPrepaidGiveaway!.months] || GIVEAWAY_IMG_LIST[3]}
                  alt=""
                />
              )}
            </div>
            <div className={styles.info}>
              <h3 className={styles.title}>
                {dataStarsPrepaidGiveaway ? lang('Giveaway.Stars.Prepaid.Title', dataStarsPrepaidGiveaway?.stars)
                  : lang('BoostingTelegramPremiumCountPlural', dataPrepaidGiveaway!.quantity)}
              </h3>
              <p className={styles.month}>
                {dataStarsPrepaidGiveaway ? lang('Giveaway.Stars.Prepaid.Desc', dataStarsPrepaidGiveaway?.quantity)
                  : lang('PrepaidGiveawayMonths', dataPrepaidGiveaway?.months)}
              </p>
            </div>
            <div className={styles.quantity}>
              <div className={buildClassName(styles.floatingBadge, styles.floatingBadgeColor)}>
                <Icon name="boost" className={styles.floatingBadgeIcon} />
                <div className={styles.floatingBadgeValue} dir={lang.isRtl ? 'rtl' : undefined}>
                  {dataStarsPrepaidGiveaway ? dataStarsPrepaidGiveaway?.boosts
                    : dataPrepaidGiveaway!.quantity * (giveawayBoostPerPremiumLimit ?? GIVEAWAY_BOOST_PER_PREMIUM)}
                </div>
              </div>
            </div>
          </div>
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
                  {renderText(lang('BoostGift.Stars.Info'))}
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
        selectionLimit={countrySelectionLimit}
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
