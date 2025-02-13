import type { ChangeEvent, RefObject } from 'react';
import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useRef, useState,
} from '../../../lib/teact/teact';

import type { ApiNewPoll } from '../../../api/types';

import { requestMeasure, requestNextMutation } from '../../../lib/fasterdom/fasterdom';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import parseHtmlAsFormattedText from '../../../util/parseHtmlAsFormattedText';

import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import Checkbox from '../../ui/Checkbox';
import InputText from '../../ui/InputText';
import Modal from '../../ui/Modal';
import RadioGroup from '../../ui/RadioGroup';
import TextArea from '../../ui/TextArea';

import './PollModal.scss';

export type OwnProps = {
  isOpen: boolean;
  shouldBeAnonymous?: boolean;
  isQuiz?: boolean;
  onSend: (pollSummary: ApiNewPoll) => void;
  onClear: () => void;
};

const MAX_LIST_HEIGHT = 320;
const MAX_OPTIONS_COUNT = 10;
const MAX_OPTION_LENGTH = 100;
const MAX_QUESTION_LENGTH = 255;
const MAX_SOLUTION_LENGTH = 200;

const PollModal: FC<OwnProps> = ({
  isOpen, isQuiz, shouldBeAnonymous, onSend, onClear,
}) => {
  // eslint-disable-next-line no-null/no-null
  const questionInputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line no-null/no-null
  const optionsListRef = useRef<HTMLDivElement>(null);

  const [question, setQuestion] = useState<string>('');
  const [options, setOptions] = useState<string[]>(['']);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [isMultipleAnswers, setIsMultipleAnswers] = useState(false);
  const [isQuizMode, setIsQuizMode] = useState(isQuiz || false);
  const [solution, setSolution] = useState<string>('');
  const [correctOption, setCorrectOption] = useState<number | undefined>();
  const [hasErrors, setHasErrors] = useState<boolean>(false);

  const lang = useOldLang();

  const handleSolutionChange = useLastCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setSolution(e.target.value);
  });

  const focusInput = useLastCallback((ref: RefObject<HTMLInputElement>) => {
    if (isOpen && ref.current) {
      ref.current.focus();
    }
  });

  useEffect(() => (isOpen ? captureEscKeyListener(onClear) : undefined), [isOpen, onClear]);
  useEffect(() => {
    if (!isOpen) {
      setQuestion('');
      setOptions(['']);
      setIsAnonymous(true);
      setIsMultipleAnswers(false);
      setIsQuizMode(isQuiz || false);
      setSolution('');
      setCorrectOption(undefined);
      setHasErrors(false);
    }
  }, [isQuiz, isOpen]);

  useEffect(() => focusInput(questionInputRef), [focusInput, isOpen]);

  const addNewOption = useLastCallback((newOptions: string[] = []) => {
    setOptions([...newOptions, '']);

    requestNextMutation(() => {
      const list = optionsListRef.current;
      if (!list) {
        return;
      }

      requestMeasure(() => {
        list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
      });
    });
  });

  const handleCreate = useLastCallback(() => {
    setHasErrors(false);
    if (!isOpen) {
      return;
    }

    const isNoCorrectOptionError = isQuizMode && (correctOption === undefined || !options[correctOption].trim());

    const answers = options
      .map((text, index) => {
        text = text.trim();

        if (!text) return undefined;

        return {
          text: {
            text,
          },
          option: String(index),
          ...(index === correctOption && { correct: true }),
        };
      }).filter(Boolean);

    const questionTrimmed = question.trim().substring(0, MAX_QUESTION_LENGTH);
    if (!questionTrimmed || answers.length < 2) {
      setQuestion(questionTrimmed);
      if (answers.length) {
        const optionsTrimmed = options.map((o) => o.trim().substring(0, MAX_OPTION_LENGTH)).filter(Boolean);
        if (optionsTrimmed.length < 2) {
          addNewOption(optionsTrimmed);
        } else {
          setOptions(optionsTrimmed);
        }
      } else {
        addNewOption();
      }
      setHasErrors(true);
      return;
    }

    if (isNoCorrectOptionError) {
      setHasErrors(true);
      return;
    }

    const payload: ApiNewPoll = {
      summary: {
        question: {
          text: questionTrimmed,
        },
        answers,
        ...(!isAnonymous && { isPublic: true }),
        ...(isMultipleAnswers && { multipleChoice: true }),
        ...(isQuizMode && { quiz: true }),
      },
    };

    if (isQuizMode) {
      const { text, entities } = (solution && parseHtmlAsFormattedText(solution.substring(0, MAX_SOLUTION_LENGTH)))
        || {};

      payload.quiz = {
        correctAnswers: [String(correctOption)],
        ...(text && { solution: text }),
        ...(entities && { solutionEntities: entities }),
      };
    }

    onSend(payload);
  });

  const updateOption = useLastCallback((index: number, text: string) => {
    const newOptions = [...options];
    newOptions[index] = text;
    if (newOptions[newOptions.length - 1].trim().length && newOptions.length < MAX_OPTIONS_COUNT) {
      addNewOption(newOptions);
    } else {
      setOptions(newOptions);
    }
  });

  const removeOption = useLastCallback((index: number) => {
    const newOptions = [...options];
    newOptions.splice(index, 1);
    setOptions(newOptions);

    if (correctOption !== undefined) {
      if (correctOption === index) {
        setCorrectOption(undefined);
      } else if (index < correctOption) {
        setCorrectOption(correctOption - 1);
      }
    }

    requestNextMutation(() => {
      if (!optionsListRef.current) {
        return;
      }

      optionsListRef.current.classList.toggle('overflown', optionsListRef.current.scrollHeight > MAX_LIST_HEIGHT);
    });
  });

  const handleCorrectOptionChange = useLastCallback((newValue: string) => {
    setCorrectOption(Number(newValue));
  });

  const handleIsAnonymousChange = useLastCallback((e: ChangeEvent<HTMLInputElement>) => {
    setIsAnonymous(e.target.checked);
  });

  const handleMultipleAnswersChange = useLastCallback((e: ChangeEvent<HTMLInputElement>) => {
    setIsMultipleAnswers(e.target.checked);
  });

  const handleQuizModeChange = useLastCallback((e: ChangeEvent<HTMLInputElement>) => {
    setIsQuizMode(e.target.checked);
  });

  const handleKeyPress = useLastCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.keyCode === 13) {
      handleCreate();
    }
  });

  const handleQuestionChange = useLastCallback((e: ChangeEvent<HTMLInputElement>) => {
    setQuestion(e.target.value);
  });

  const getQuestionError = useLastCallback(() => {
    if (hasErrors && !question.trim().length) {
      return lang('lng_polls_choose_question');
    }

    return undefined;
  });

  const getOptionsError = useLastCallback((index: number) => {
    const optionsTrimmed = options.map((o) => o.trim()).filter((o) => o.length);
    if (hasErrors && optionsTrimmed.length < 2 && !options[index].trim().length) {
      return lang('lng_polls_choose_answers');
    }
    return undefined;
  });

  function renderHeader() {
    return (
      <div className="modal-header-condensed">
        <Button round color="translucent" size="smaller" ariaLabel="Cancel poll creation" onClick={onClear}>
          <Icon name="close" />
        </Button>
        <div className="modal-title">{lang('NewPoll')}</div>
        <Button
          color="primary"
          size="smaller"
          className="modal-action-button"
          onClick={handleCreate}
        >
          {lang('Create')}
        </Button>
      </div>
    );
  }

  function renderOptions() {
    return options.map((option, index) => (
      <div className="option-wrapper">
        <InputText
          label={index !== options.length - 1 || options.length === MAX_OPTIONS_COUNT
            ? lang('OptionHint')
            : lang('CreatePoll.AddOption')}
          error={getOptionsError(index)}
          value={option}
          // eslint-disable-next-line react/jsx-no-bind
          onChange={(e) => updateOption(index, e.currentTarget.value)}
          onKeyPress={handleKeyPress}
        />
        {index !== options.length - 1 && (
          <Button
            className="option-remove-button"
            round
            color="translucent"
            size="smaller"
            ariaLabel={lang('Delete')}
            // eslint-disable-next-line react/jsx-no-bind
            onClick={() => removeOption(index)}
          >
            <Icon name="close" />
          </Button>
        )}
      </div>
    ));
  }

  function renderRadioOptions() {
    return renderOptions()
      .map((label, index) => ({ value: String(index), label, hidden: !options[index].trim() }));
  }

  function renderQuizNoOptionError() {
    const optionsTrimmed = options.map((o) => o.trim()).filter((o) => o.length);

    return isQuizMode && (correctOption === undefined || !optionsTrimmed[correctOption]) && (
      <p className="poll-error">{lang('lng_polls_choose_correct')}</p>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClear} header={renderHeader()} className="PollModal">
      <InputText
        ref={questionInputRef}
        label={lang('AskAQuestion')}
        value={question}
        error={getQuestionError()}
        onChange={handleQuestionChange}
        onKeyPress={handleKeyPress}
      />
      <div className="options-divider" />

      <div className="options-list custom-scroll" ref={optionsListRef}>
        <h3 className="options-header">{lang('PollOptions')}</h3>

        {hasErrors && renderQuizNoOptionError()}
        {isQuizMode ? (
          <RadioGroup
            name="correctOption"
            options={renderRadioOptions()}
            selected={String(correctOption)}
            onChange={handleCorrectOptionChange}
          />
        ) : (
          renderOptions()
        )}

      </div>

      <div className="options-divider" />

      <div className="quiz-mode">
        {!shouldBeAnonymous && (
          <Checkbox
            className="dialog-checkbox"
            label={lang('PollAnonymous')}
            checked={isAnonymous}
            onChange={handleIsAnonymousChange}
          />
        )}
        <Checkbox
          className="dialog-checkbox"
          label={lang('PollMultiple')}
          checked={isMultipleAnswers}
          disabled={isQuizMode}
          onChange={handleMultipleAnswersChange}
        />
        <Checkbox
          className="dialog-checkbox"
          label={lang('PollQuiz')}
          checked={isQuizMode}
          disabled={isMultipleAnswers || isQuiz !== undefined}
          onChange={handleQuizModeChange}
        />
        {isQuizMode && (
          <>
            <h3 className="options-header">{lang('lng_polls_solution_title')}</h3>
            <TextArea
              value={solution}
              onChange={handleSolutionChange}
              noReplaceNewlines
            />
            <div className="note">{lang('CreatePoll.ExplanationInfo')}</div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default memo(PollModal);
