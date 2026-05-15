import type { TeactNode } from '../../../lib/teact/teact';
import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChat, ApiNewPoll } from '../../../api/types';
import type { TabState } from '../../../global/types';
import type { MessageList } from '../../../types';
import type { IconName } from '../../../types/icons';
import { MAIN_THREAD_ID } from '../../../api/types';

import { requestMeasure } from '../../../lib/fasterdom/fasterdom';
import { isChatChannel } from '../../../global/helpers';
import { getChatNotifySettings } from '../../../global/helpers/notifications';
import { getPeerTitle } from '../../../global/helpers/peers';
import {
  selectChat,
  selectNotifyDefaults,
  selectNotifyException,
  selectPeerPaidMessagesStars,
  selectTabState,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { formatDateTimeToString, formatShortDuration } from '../../../util/dates/oldDateFormat';
import { DAY, HOUR } from '../../../util/dates/units';
import { generateUniqueNumberId } from '../../../util/generateUniqueId';
import { getServerTime } from '../../../util/serverTime';

import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useReorderableList from '../../../hooks/useReorderableList';
import useSchedule from '../../../hooks/useSchedule';
import usePaidMessageConfirmation from '../../middle/composer/hooks/usePaidMessageConfirmation';

import CalendarModal from '../../common/CalendarModal.async';
import Icon from '../../common/icons/Icon';
import PaymentMessageConfirmDialog from '../../common/PaymentMessageConfirmDialog';
import CustomSendMenu from '../../middle/composer/CustomSendMenu.async';
import Button from '../../ui/Button';
import InputText from '../../ui/InputText';
import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';
import TextArea from '../../ui/TextArea';
import Control, {
  ControlAfter,
  ControlDescription,
  ControlIcon,
  ControlLabel,
} from '@gili/layout/Control';
import Interactive from '@gili/layout/Interactive';
import Island, {
  IslandDescription,
  IslandTitle,
} from '@gili/layout/Island';
import Modal, {
  ModalCloseButton,
  ModalHeader,
  ModalHeaderAction,
  ModalTitle,
} from '@gili/modal/Modal';
import Checkbox from '@gili/primitives/Checkbox';
import Radio from '@gili/primitives/Radio';
import Switch from '@gili/primitives/Switch';

import styles from './PollModal.module.scss';

const MAX_OPTION_LENGTH = 100;
const MAX_QUESTION_LENGTH = 255;
const MAX_SOLUTION_LENGTH = 200;

const CLOSE_PERIOD_OPTIONS = [
  HOUR,
  3 * HOUR,
  8 * HOUR,
  DAY,
  3 * DAY,
];

const ICON_COLORS = {
  anonymous: '#0a84ff',
  multiple: '#ffb300',
  quiz: '#34c759',
  addAnswers: '#2faeff',
  revote: '#6a5cff',
  shuffle: '#b75bff',
  duration: '#ff5e3a',
  results: '#3a8cff',
} as const;

export type OwnProps = {
  modal: NonNullable<TabState['pollModal']>;
  isOpen: boolean;
};

type StateProps = {
  chat?: ApiChat;
  isChannel?: boolean;
  pollMaxAnswers: number;
  pollClosePeriodMax: number;
  paidMessagesStars?: number;
  isPaymentMessageConfirmDialogOpen: boolean;
  starsBalance: number;
  isStarsBalanceModalOpen: boolean;
  isSilentPosting?: boolean;
};

type SettingRowProps = {
  iconName?: IconName;
  iconBackgroundColor?: string;
  label: TeactNode;
  description?: TeactNode;
  checked: boolean;
  disabled?: boolean;
  locked?: boolean;
  onChange: (checked: boolean) => void;
};

type ValueRowProps = {
  iconName?: IconName;
  iconBackgroundColor?: string;
  label: TeactNode;
  value: TeactNode;
  onClick: (e: React.MouseEvent<HTMLElement>) => void;
};

type PollOption = {
  id: string;
  text: string;
};

const PollModal = ({
  modal,
  isOpen,
  chat,
  isChannel,
  pollMaxAnswers,
  pollClosePeriodMax,
  paidMessagesStars,
  isPaymentMessageConfirmDialogOpen,
  starsBalance,
  isStarsBalanceModalOpen,
  isSilentPosting,
}: OwnProps & StateProps) => {
  const {
    closePollModal,
    sendMessage,
  } = getActions();

  const lang = useLang();

  const mainButtonRef = useRef<HTMLButtonElement>();
  const optionListRef = useRef<HTMLDivElement>();
  const durationMenuRef = useRef<HTMLDivElement>();

  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState<PollOption[]>(() => [createPollOption()]);
  const [isPublic, setIsPublic] = useState(true);
  const [isMultipleAnswers, setIsMultipleAnswers] = useState(true);
  const [isQuizMode, setIsQuizMode] = useState(Boolean(modal.isQuiz));
  const [correctAnswerIds, setCorrectAnswerIds] = useState<string[]>([]);
  const [solution, setSolution] = useState('');
  const [canAddAnswers, setCanAddAnswers] = useState(true);
  const [canRevote, setCanRevote] = useState(true);
  const [shouldShuffleAnswers, setShouldShuffleAnswers] = useState(false);
  const [closePeriod, setClosePeriod] = useState<number | undefined>();
  const [closeDate, setCloseDate] = useState<number | undefined>();
  const [durationAnchorAt, setDurationAnchorAt] = useState(() => getServerTime());
  const [shouldHideResultsUntilClose, setShouldHideResultsUntilClose] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isCloseDatePickerOpen, setIsCloseDatePickerOpen] = useState(false);

  const [requestCalendar, calendar] = useSchedule();

  const {
    isContextMenuOpen: isCustomSendMenuOpen,
    handleContextMenu,
    handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(mainButtonRef, !isOpen || modal.messageListType === 'scheduled');

  const {
    isContextMenuOpen: isDurationMenuOpen,
    handleContextMenu: handleDurationMenuOpen,
    handleContextMenuClose: handleDurationMenuClose,
    handleContextMenuHide: handleDurationMenuHide,
  } = useContextMenuHandlers(durationMenuRef, !isOpen);

  const {
    closeConfirmDialog,
    dialogHandler,
    shouldAutoApprove,
    setAutoApprove,
    handleWithConfirmation,
  } = usePaidMessageConfirmation(
    paidMessagesStars || 0,
    isStarsBalanceModalOpen,
    starsBalance,
    true,
  );

  useEffect(() => {
    if (isChannel) {
      setIsPublic(false);
      setCanAddAnswers(false);
    }
  }, [isChannel]);

  useEffect(() => {
    if (isQuizMode || !isPublic) {
      setCanAddAnswers(false);
    }
  }, [isPublic, isQuizMode]);

  useEffect(() => {
    if (closePeriod || closeDate) {
      return;
    }

    setShouldHideResultsUntilClose(false);
  }, [closeDate, closePeriod]);

  useEffect(() => {
    if (!isMultipleAnswers && correctAnswerIds.length > 1) {
      setCorrectAnswerIds(correctAnswerIds.slice(0, 1));
    }
  }, [correctAnswerIds, isMultipleAnswers]);

  const filledOptions = useMemo(() => {
    return options.map((option) => ({
      id: option.id,
      text: option.text.trim().substring(0, MAX_OPTION_LENGTH),
    })).filter(({ text }) => Boolean(text));
  }, [options]);

  const correctAnswerPositions = useMemo(() => {
    return correctAnswerIds.reduce<number[]>((result, id) => {
      const answerIndex = filledOptions.findIndex((option) => option.id === id);

      if (answerIndex >= 0) {
        result.push(answerIndex);
      }

      return result;
    }, []);
  }, [correctAnswerIds, filledOptions]);

  const reorderableOptionIds = useMemo(() => {
    return filledOptions.map(({ id }) => id);
  }, [filledOptions]);

  const trimmedQuestion = useMemo(() => question.trim().substring(0, MAX_QUESTION_LENGTH), [question]);
  const isInScheduledList = modal.messageListType === 'scheduled';
  const canSchedule = Boolean(!paidMessagesStars && !chat?.isMonoforum);
  const isCorrectAnswerInvalid = hasSubmitted && isQuizMode && !correctAnswerPositions.length;
  const isAddAnswersDisabled = isQuizMode || !isPublic;
  const remainingOptionsCount = Math.max(pollMaxAnswers - filledOptions.length, 0);
  const isSendDisabled = !trimmedQuestion
    || filledOptions.length < 1
    || (isQuizMode && !correctAnswerPositions.length);

  const hasLimitedDuration = closePeriod !== undefined || closeDate !== undefined;
  const closeDateLabel = closeDate !== undefined
    ? formatDateTimeToString(closeDate * 1000, lang.code, true)
    : closePeriod !== undefined
      ? formatShortDuration(lang, closePeriod)
      : lang('PollSelectCloseDate');
  const maxCloseDateAt = (durationAnchorAt + pollClosePeriodMax) * 1000;
  const closeDatePickerSelectedAt = closeDate !== undefined
    ? closeDate * 1000
    : (durationAnchorAt + (closePeriod || DAY)) * 1000;
  const messageList: MessageList = {
    chatId: modal.chatId,
    threadId: modal.threadId || MAIN_THREAD_ID,
    type: modal.messageListType === 'scheduled' ? 'scheduled' : 'thread',
  };

  const handleClose = useLastCallback(() => {
    closePollModal();
  });

  const handleReorderOptions = useLastCallback((optionIds: string[]) => {
    setOptions((currentOptions) => {
      const optionsById = new Map(currentOptions.map((option) => [option.id, option]));
      const nextOptions = optionIds.reduce<PollOption[]>((result, id) => {
        const option = optionsById.get(id);

        if (option) {
          result.push(option);
        }

        return result;
      }, []);

      return normalizeOptions(nextOptions, pollMaxAnswers);
    });
  });

  const {
    draggedId: draggedOptionId,
    getRowProps: getReorderableRowProps,
    getDragElementProps: getReorderableDragElementProps,
    getHandleProps: getReorderableHandleProps,
    getPlaceholderStyle: getReorderablePlaceholderStyle,
    getDragStyle: getReorderableDragStyle,
  } = useReorderableList({
    itemIds: reorderableOptionIds,
    withAutoscroll: true,
    onReorder: handleReorderOptions,
  });

  const updateOption = useLastCallback((id: string, value: string) => {
    const nextOptions = options.map((option) => (
      option.id === id ? { ...option, text: value } : option
    ));

    setOptions(normalizeOptions(nextOptions, pollMaxAnswers));
  });

  const handleRemoveOption = useLastCallback((id: string) => {
    const nextOptions = normalizeOptions(options.filter((option) => option.id !== id), pollMaxAnswers);
    setOptions(nextOptions);
    setCorrectAnswerIds(correctAnswerIds.filter((correctAnswerId) => correctAnswerId !== id));
  });

  const handleToggleCorrectAnswer = useLastCallback((id: string) => {
    if (!isMultipleAnswers) {
      setCorrectAnswerIds([id]);
      return;
    }

    setCorrectAnswerIds((prevCorrectAnswers) => (
      prevCorrectAnswers.includes(id)
        ? prevCorrectAnswers.filter((currentId) => currentId !== id)
        : [...prevCorrectAnswers, id]
    ));
  });

  const handleOptionKeyDown = useLastCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();

    if (!optionListRef.current) {
      return;
    }

    const inputs = optionListRef.current.querySelectorAll<HTMLInputElement>(`.${styles.optionTextInput} input`);
    const lastInput = inputs[inputs.length - 1];

    if (!lastInput) {
      return;
    }

    requestMeasure(() => {
      lastInput.focus();
    });
  });

  const handleQuestionChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuestion(e.currentTarget.value);
  });

  const handleDescriptionChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDescription(e.currentTarget.value);
  });

  const handleSolutionChange = useLastCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSolution(e.currentTarget.value);
  });

  const handleQuizModeChange = useLastCallback((checked: boolean) => {
    setIsQuizMode(checked);
  });

  const handleMultipleAnswersChange = useLastCallback((checked: boolean) => {
    setIsMultipleAnswers(checked);
  });

  const handleLimitedDurationChange = useLastCallback((checked: boolean) => {
    if (!checked) {
      setClosePeriod(undefined);
      setCloseDate(undefined);
      setShouldHideResultsUntilClose(false);
      return;
    }

    const nowAt = Math.floor(Date.now() / 1000);
    setDurationAnchorAt(nowAt);
    setClosePeriod(DAY);
    setCloseDate(undefined);
  });

  const handleCloseDateSave = useLastCallback((date: Date) => {
    setClosePeriod(undefined);
    setCloseDate(Math.round(date.getTime() / 1000));
    setIsCloseDatePickerOpen(false);
  });

  const handleCloseCloseDatePicker = useLastCallback(() => {
    setIsCloseDatePickerOpen(false);
  });

  const handleOpenCloseDatePicker = useLastCallback(() => {
    setDurationAnchorAt(Math.floor(Date.now() / 1000));
    setIsCloseDatePickerOpen(true);
  });

  const handleSelectClosePeriod = useLastCallback((period: number) => {
    setClosePeriod(period);
    setCloseDate(undefined);
  });

  const buildPoll = useLastCallback((): ApiNewPoll | undefined => {
    const normalizedOptions = normalizeOptions(
      options.map((option) => ({
        ...option,
        text: option.text.trim().substring(0, MAX_OPTION_LENGTH),
      })),
      pollMaxAnswers,
    );

    setQuestion(trimmedQuestion);
    setOptions(normalizedOptions);
    setHasSubmitted(true);

    if (!trimmedQuestion || filledOptions.length < 1) {
      return undefined;
    }

    if (isQuizMode && !correctAnswerPositions.length) {
      return undefined;
    }

    const answers = filledOptions.map(({ text }, index) => ({
      text: { text },
      option: String(index),
    }));

    const payload: ApiNewPoll = {
      summary: {
        id: generateUniqueNumberId().toString(),
        hash: '0',
        question: {
          text: trimmedQuestion,
        },
        answers,
        isPublic: !isChannel && isPublic ? true : undefined,
        isMultipleChoice: isMultipleAnswers ? true : undefined,
        isQuiz: isQuizMode ? true : undefined,
        canAddAnswers: !isChannel && isPublic && canAddAnswers ? true : undefined,
        isRevoteDisabled: !canRevote ? true : undefined,
        shouldShuffleAnswers: shouldShuffleAnswers ? true : undefined,
        shouldHideResultsUntilClose: shouldHideResultsUntilClose ? true : undefined,
        closePeriod,
        closeDate,
        isCreator: true,
      },
      correctAnswers: isQuizMode ? correctAnswerPositions : undefined,
      solution: isQuizMode ? solution.trim().substring(0, MAX_SOLUTION_LENGTH) : undefined,
    };

    return payload;
  });

  const submitPoll = useLastCallback((
    poll: ApiNewPoll,
    isSilent?: boolean,
    scheduledAt?: number,
    scheduleRepeatPeriod?: number,
  ) => {
    sendMessage({
      messageList,
      text: description,
      poll,
      isSilent: scheduledAt ? undefined : (isSilent || isSilentPosting),
      scheduledAt,
      scheduleRepeatPeriod,
    });
    closePollModal();
  });

  const handleSendNow = useLastCallback((isSilent?: boolean) => {
    const poll = buildPoll();

    if (!poll) {
      return;
    }

    handleWithConfirmation(submitPoll, poll, isSilent);
  });

  const handleSendScheduled = useLastCallback((scheduledAt: number, scheduleRepeatPeriod?: number) => {
    const poll = buildPoll();

    if (!poll) {
      return;
    }

    handleWithConfirmation(submitPoll, poll, undefined, scheduledAt, scheduleRepeatPeriod);
  });

  const handlePrimarySend = useLastCallback(() => {
    if (isInScheduledList) {
      requestCalendar(handleSendScheduled);
      return;
    }

    handleSendNow();
  });

  const handleSilentSend = useLastCallback(() => {
    handleSendNow(true);
  });

  const handleScheduleSend = useLastCallback(() => {
    requestCalendar(handleSendScheduled);
  });

  const renderHeader = useMemo(() => (
    <ModalHeader>
      <ModalCloseButton />
      <ModalTitle>{lang('NewPoll')}</ModalTitle>
      <ModalHeaderAction>
        <Button
          ref={mainButtonRef}
          color="primary"
          pill
          disabled={isSendDisabled}
          noForcedUpperCase
          size="smaller"
          onClick={handlePrimarySend}
          onContextMenu={!isInScheduledList ? handleContextMenu : undefined}
        >
          {lang('Send')}
        </Button>
        {!isInScheduledList && (
          <CustomSendMenu
            isOpen={isCustomSendMenuOpen}
            canSchedule={canSchedule}
            onSendSilent={handleSilentSend}
            onSendSchedule={handleScheduleSend}
            onClose={handleContextMenuClose}
            onCloseAnimationEnd={handleContextMenuHide}
          />
        )}
      </ModalHeaderAction>
    </ModalHeader>
  ), [canSchedule, handleContextMenu, handleContextMenuClose, handleContextMenuHide,
    isCustomSendMenuOpen, isInScheduledList, isSendDisabled, lang]);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        header={renderHeader}
        ariaLabel={lang('NewPoll')}
        width="slim"
      >
        <IslandTitle>{lang('PollModalQuestionTitle')}</IslandTitle>
        <Island>
          <InputText
            className={styles.input}
            label={lang('AskAQuestion')}
            value={question}
            maxLength={MAX_QUESTION_LENGTH}
            autoFocus
            error={hasSubmitted && !trimmedQuestion ? lang('PollsChooseQuestion') : undefined}
            onChange={handleQuestionChange}
          />
          <InputText
            className={styles.input}
            label={lang('DescriptionOptionalPlaceholder')}
            value={description}
            onChange={handleDescriptionChange}
          />
        </Island>

        <IslandTitle>{lang('PollModalOptionsTitle')}</IslandTitle>
        <Island ref={optionListRef} className={styles.optionList} teactFastList>
          {options.map((option, index) => {
            const isFilledOption = Boolean(option.text.trim());
            const isAddOptionRow = !isFilledOption && index === options.length - 1;
            const isCorrectAnswerChecked = correctAnswerIds.includes(option.id);
            const shouldShowRemoveButton = options.length > 1 && !isAddOptionRow;
            const shouldShowOptionError = hasSubmitted && !filledOptions.length && index === 0;
            const rowProps = isFilledOption ? getReorderableRowProps(option.id) : undefined;
            const handleProps = isFilledOption ? getReorderableHandleProps(option.id) : undefined;
            const dragElementProps = isFilledOption ? getReorderableDragElementProps(option.id) : undefined;
            const placeholderStyle = isFilledOption ? getReorderablePlaceholderStyle(option.id) : undefined;
            const dragStyle = isFilledOption ? getReorderableDragStyle(option.id) : undefined;

            return (
              <div
                key={option.id}
                ref={rowProps?.ref}
                className={styles.optionRowFrame}
                style={placeholderStyle}
              >
                <div
                  ref={dragElementProps?.ref}
                  style={dragStyle}
                  className={buildClassName(
                    styles.optionRow,
                    isAddOptionRow && styles.optionRowAdd,
                    draggedOptionId === option.id && styles.optionRowDragging,
                  )}
                >
                  <div
                    className={buildClassName(
                      styles.optionLeadingIcon,
                      isAddOptionRow && styles.optionLeadingIconAdd,
                      isFilledOption && styles.optionDragHandle,
                    )}
                    role={handleProps?.role}
                    tabIndex={handleProps?.tabIndex}
                    aria-label={isFilledOption ? lang('DragToSortAria') : undefined}
                    onMouseDown={handleProps?.onMouseDown}
                    onTouchStart={handleProps?.onTouchStart}
                    onKeyDown={handleProps?.onKeyDown}
                    ref={handleProps?.ref}
                  >
                    <Icon
                      name={isAddOptionRow ? 'add' : 'sort'}
                      className={styles.optionLeadingIconGlyph}
                    />
                  </div>
                  {isQuizMode && (
                    <div className={styles.optionSelector}>
                      {isMultipleAnswers ? (
                        <Checkbox
                          checked={isCorrectAnswerChecked}
                          disabled={isAddOptionRow}
                          isInvalid={isCorrectAnswerInvalid && !isCorrectAnswerChecked && !isAddOptionRow}
                          onChange={() => handleToggleCorrectAnswer(option.id)}
                        />
                      ) : (
                        <Radio
                          value={option.id}
                          checked={isCorrectAnswerChecked}
                          disabled={isAddOptionRow}
                          className={isCorrectAnswerInvalid && !isCorrectAnswerChecked && !isAddOptionRow
                            ? styles.optionRadioInvalid
                            : undefined}
                          onChange={() => handleToggleCorrectAnswer(option.id)}
                        />
                      )}
                    </div>
                  )}
                  <InputText
                    className={buildClassName(
                      styles.optionInput,
                      styles.optionTextInput,
                      isAddOptionRow && styles.optionInputAdd,
                    )}
                    placeholder={isAddOptionRow ? lang('CreatePollAddOption') : lang('OptionHint')}
                    value={option.text}
                    maxLength={MAX_OPTION_LENGTH}
                    error={shouldShowOptionError ? lang('PollsChooseAnswers') : undefined}
                    onChange={(e) => updateOption(option.id, e.currentTarget.value)}
                    onKeyDown={handleOptionKeyDown}
                  />
                  {shouldShowRemoveButton && (
                    <Button
                      round
                      size="tiny"
                      color="translucent"
                      className={styles.optionRemove}
                      ariaLabel={lang('Delete')}
                      iconName="close"
                      onClick={() => handleRemoveOption(option.id)}
                    />
                  )}
                </div>
              </div>
            );
          })}
          {isCorrectAnswerInvalid && (
            <IslandDescription key="correct-answer-error" className={styles.errorDescription}>
              {lang('PollsChooseCorrect')}
            </IslandDescription>
          )}
        </Island>
        <IslandDescription>
          {remainingOptionsCount > 0 ? (
            lang('PollModalAddMoreText', { count: remainingOptionsCount }, { pluralValue: remainingOptionsCount })
          ) : lang('PollModalAddNoMore')}
        </IslandDescription>

        <IslandTitle>{lang('PollModalSettingsTitle')}</IslandTitle>
        <Island>
          {!isChannel && (
            <SettingRow
              iconName="eye"
              iconBackgroundColor={ICON_COLORS.anonymous}
              label={lang('PollAnswersVisible')}
              description={lang('PollAnswersVisibleDescription')}
              checked={isPublic}
              onChange={setIsPublic}
            />
          )}
          <SettingRow
            iconName="choice-selected"
            iconBackgroundColor={ICON_COLORS.multiple}
            label={lang('PollMultiple')}
            description={lang('PollMultipleDescription')}
            checked={isMultipleAnswers}
            onChange={handleMultipleAnswersChange}
          />
          {!isChannel && (
            <SettingRow
              iconName="add-filled"
              iconBackgroundColor={ICON_COLORS.addAnswers}
              label={lang('PollAllowAddingAnswers')}
              description={lang('PollAllowAddingAnswersDescription')}
              checked={canAddAnswers}
              disabled={isAddAnswersDisabled}
              locked={isAddAnswersDisabled}
              onChange={setCanAddAnswers}
            />
          )}
          <SettingRow
            iconName="reload"
            iconBackgroundColor={ICON_COLORS.revote}
            label={lang('PollAllowVoteChanges')}
            description={lang('PollAllowVoteChangesDescription')}
            checked={canRevote}
            onChange={setCanRevote}
          />
          <SettingRow
            iconName="replace-round"
            iconBackgroundColor={ICON_COLORS.shuffle}
            label={lang('PollRandomOrder')}
            description={lang('PollRandomOrderDescription')}
            checked={shouldShuffleAnswers}
            onChange={setShouldShuffleAnswers}
          />
          <SettingRow
            iconName="check-filled"
            iconBackgroundColor={ICON_COLORS.quiz}
            label={lang('PollQuiz')}
            description={lang('PollQuizDescription')}
            checked={isQuizMode}
            onChange={handleQuizModeChange}
          />
          <SettingRow
            iconName="timer-filled"
            iconBackgroundColor={ICON_COLORS.duration}
            label={lang('PollLimitedDuration')}
            description={lang('PollLimitedDurationDescription')}
            checked={hasLimitedDuration}
            onChange={handleLimitedDurationChange}
          />
          {hasLimitedDuration ? (
            <>
              <div ref={durationMenuRef} className={styles.durationMenuWrapper}>
                <ValueRow
                  label={lang('PollDuration')}
                  value={closeDateLabel}
                  onClick={handleDurationMenuOpen}
                />
                <Menu
                  isOpen={isDurationMenuOpen}
                  className={buildClassName('with-menu-transitions', styles.durationMenu)}
                  positionX="right"
                  positionY="bottom"
                  autoClose
                  onClose={handleDurationMenuClose}
                  onCloseAnimationEnd={handleDurationMenuHide}
                >
                  {CLOSE_PERIOD_OPTIONS.map((period) => (
                    <MenuItem
                      key={period}
                      disabled={period > pollClosePeriodMax}
                      onClick={() => handleSelectClosePeriod(period)}
                    >
                      {formatShortDuration(lang, period)}
                    </MenuItem>
                  ))}
                  <MenuItem onClick={handleOpenCloseDatePicker}>
                    {lang('PollDurationOther')}
                  </MenuItem>
                </Menu>
              </div>
              <SettingRow
                label={lang('PollHideResultsUntilClose')}
                checked={shouldHideResultsUntilClose}
                onChange={setShouldHideResultsUntilClose}
              />
            </>
          ) : undefined}
        </Island>

        {isQuizMode && (
          <>
            <IslandTitle>{lang('PollsSolutionTitle')}</IslandTitle>
            <Island>
              <TextArea
                className={styles.textArea}
                value={solution}
                label={lang('PollsSolutionTitle')}
                maxLength={MAX_SOLUTION_LENGTH}
                noReplaceNewlines
                onChange={handleSolutionChange}
              />
            </Island>
            <IslandDescription>{lang('CreatePollExplanationInfo')}</IslandDescription>
          </>
        )}
      </Modal>
      {calendar}
      <CalendarModal
        isOpen={isCloseDatePickerOpen}
        selectedAt={closeDatePickerSelectedAt}
        maxAt={maxCloseDateAt}
        isFutureMode
        withTimePicker
        submitButtonLabel={lang('Save')}
        onClose={handleCloseCloseDatePicker}
        onSubmit={handleCloseDateSave}
      />
      <PaymentMessageConfirmDialog
        isOpen={isPaymentMessageConfirmDialogOpen}
        onClose={closeConfirmDialog}
        userName={chat ? getPeerTitle(lang, chat) : undefined}
        messagePriceInStars={paidMessagesStars || 0}
        messagesCount={1}
        shouldAutoApprove={shouldAutoApprove}
        setAutoApprove={setAutoApprove}
        confirmHandler={dialogHandler}
      />
    </>
  );
};

const SettingRow = ({
  iconName,
  iconBackgroundColor,
  label,
  description,
  checked,
  disabled,
  locked,
  onChange,
}: SettingRowProps) => {
  return (
    <Interactive asLabel clickable disabled={disabled}>
      <Control inputEnd>
        <Switch checked={checked} disabled={disabled} locked={locked} onChange={onChange} />
        <ControlIcon iconName={iconName} backgroundColor={iconBackgroundColor} />
        <ControlLabel>{label}</ControlLabel>
        {description !== undefined ? (
          <ControlDescription>{description}</ControlDescription>
        ) : undefined}
      </Control>
    </Interactive>
  );
};

const ValueRow = ({
  iconName,
  iconBackgroundColor,
  label,
  value,
  onClick,
}: ValueRowProps) => {
  return (
    <Interactive clickable onClick={onClick}>
      <Control>
        <ControlIcon iconName={iconName} backgroundColor={iconBackgroundColor} />
        <ControlLabel>{label}</ControlLabel>
        <ControlAfter className={styles.rowValue}>
          {value}
        </ControlAfter>
      </Control>
    </Interactive>
  );
};

function createPollOption(text = ''): PollOption {
  return {
    id: generateUniqueNumberId().toString(),
    text,
  };
}

function normalizeOptions(options: PollOption[], maxOptionsCount: number) {
  const nextOptions = [...options];

  while (
    nextOptions.length > 1
    && !nextOptions[nextOptions.length - 1].text.trim()
    && !nextOptions[nextOptions.length - 2].text.trim()
  ) {
    nextOptions.pop();
  }

  if (!nextOptions.length) {
    nextOptions.push(createPollOption());
  }

  if (nextOptions.length < maxOptionsCount && nextOptions[nextOptions.length - 1].text.trim()) {
    nextOptions.push(createPollOption());
  }

  return nextOptions;
}

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => {
    const tabState = selectTabState(global);
    const { chatId } = modal;
    const chat = selectChat(global, chatId);

    return {
      chat,
      isChannel: chat ? isChatChannel(chat) : undefined,
      pollMaxAnswers: global.appConfig.pollMaxAnswers,
      pollClosePeriodMax: global.appConfig.pollClosePeriodMax,
      paidMessagesStars: selectPeerPaidMessagesStars(global, chatId),
      isPaymentMessageConfirmDialogOpen: tabState.isPaymentMessageConfirmDialogOpen,
      starsBalance: global.stars?.balance.amount || 0,
      isStarsBalanceModalOpen: Boolean(tabState.starsBalanceModal),
      isSilentPosting: chat ? getChatNotifySettings(
        chat,
        selectNotifyDefaults(global),
        selectNotifyException(global, chat.id),
      )?.isSilentPosting : undefined,
    };
  },
)(PollModal));
