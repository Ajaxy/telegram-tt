import { ChangeEvent, RefObject } from 'react';
import React, {
  FC, memo, useCallback, useEffect, useLayoutEffect, useRef, useState,
} from '../../../lib/teact/teact';

import { ApiNewPoll } from '../../../api/types';

import captureEscKeyListener from '../../../util/captureEscKeyListener';
import parseMessageInput from './helpers/parseMessageInput';
import useLang from '../../../hooks/useLang';

import Button from '../../ui/Button';
import Modal from '../../ui/Modal';
import InputText from '../../ui/InputText';
import Checkbox from '../../ui/Checkbox';
import RadioGroup from '../../ui/RadioGroup';

import './PollModal.scss';

export type OwnProps = {
  isOpen: boolean;
  onSend: (pollSummary: ApiNewPoll) => void;
  onClear: () => void;
};

const MAX_LIST_HEIGHT = 320;
const MAX_OPTIONS_COUNT = 10;
const MAX_OPTION_LENGTH = 100;
const MAX_QUESTION_LENGTH = 255;
const MAX_SOLUTION_LENGTH = 200;

const PollModal: FC<OwnProps> = ({ isOpen, onSend, onClear }) => {
  // eslint-disable-next-line no-null/no-null
  const questionInputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line no-null/no-null
  const optionsListRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const solutionRef = useRef<HTMLDivElement>(null);

  const [question, setQuestion] = useState<string>('');
  const [options, setOptions] = useState<string[]>(['']);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [isMultipleAnswers, setIsMultipleAnswers] = useState(false);
  const [isQuizMode, setIsQuizMode] = useState(false);
  const [solution, setSolution] = useState<string>();
  const [correctOption, setCorrectOption] = useState<string>();
  const [hasErrors, setHasErrors] = useState<boolean>(false);

  const lang = useLang();

  const focusInput = useCallback((ref: RefObject<HTMLInputElement>) => {
    if (isOpen && ref.current) {
      ref.current.focus();
    }
  }, [isOpen]);

  useEffect(() => (isOpen ? captureEscKeyListener(onClear) : undefined), [isOpen, onClear]);
  useEffect(() => {
    if (!isOpen) {
      setQuestion('');
      setOptions(['']);
      setIsAnonymous(true);
      setIsMultipleAnswers(false);
      setIsQuizMode(false);
      setSolution('');
      setCorrectOption('');
      setHasErrors(false);
    }
  }, [isOpen]);

  useEffect(() => focusInput(questionInputRef), [focusInput, isOpen]);

  useLayoutEffect(() => {
    const solutionEl = solutionRef.current;

    if (solutionEl && solution !== solutionEl.innerHTML) {
      solutionEl.innerHTML = solution;
    }
  }, [solution]);

  const addNewOption = useCallback((newOptions: string[] = []) => {
    setOptions([...newOptions, '']);
    requestAnimationFrame(() => {
      const list = optionsListRef.current;
      if (!list) {
        return;
      }

      list.classList.toggle('overflown', list.scrollHeight > MAX_LIST_HEIGHT);
      list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
    });
  }, []);

  const handleCreate = useCallback(() => {
    setHasErrors(false);
    if (!isOpen) {
      return;
    }

    const questionTrimmed = question.trim().substring(0, MAX_QUESTION_LENGTH);
    const optionsTrimmed = options.map((o) => o.trim().substring(0, MAX_OPTION_LENGTH)).filter((o) => o.length);

    if (!questionTrimmed || optionsTrimmed.length < 2) {
      setQuestion(questionTrimmed);
      if (optionsTrimmed.length) {
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

    if (isQuizMode && (!correctOption || !optionsTrimmed[Number(correctOption)])) {
      setHasErrors(true);
      return;
    }

    const answers = optionsTrimmed
      .map((text, index) => ({
        text: text.trim(),
        option: String(index),
        ...(String(index) === correctOption && { correct: true }),
      }));

    const payload: ApiNewPoll = {
      summary: {
        question: questionTrimmed,
        answers,
        ...(!isAnonymous && { isPublic: true }),
        ...(isMultipleAnswers && { multipleChoice: true }),
        ...(isQuizMode && { quiz: true }),
      },
    };

    if (isQuizMode) {
      const { text, entities } = (solution && parseMessageInput(solution.substring(0, MAX_SOLUTION_LENGTH))) || {};

      payload.quiz = {
        correctAnswers: [correctOption],
        ...(text && { solution: text }),
        ...(entities && { solutionEntities: entities }),
      };
    }

    onSend(payload);
  }, [
    isOpen,
    question,
    options,
    isQuizMode,
    correctOption,
    isAnonymous,
    isMultipleAnswers,
    onSend,
    addNewOption,
    solution,
  ]);

  const updateOption = useCallback((index: number, text: string) => {
    const newOptions = [...options];
    newOptions[index] = text;
    if (newOptions[newOptions.length - 1].trim().length && newOptions.length < MAX_OPTIONS_COUNT) {
      addNewOption(newOptions);
    } else {
      setOptions(newOptions);
    }
  }, [options, addNewOption]);

  const removeOption = useCallback((index: number) => {
    const newOptions = [...options];
    newOptions.splice(index, 1);
    setOptions(newOptions);
    requestAnimationFrame(() => {
      if (!optionsListRef.current) {
        return;
      }

      optionsListRef.current.classList.toggle('overflown', optionsListRef.current.scrollHeight > MAX_LIST_HEIGHT);
    });
  }, [options]);

  const handleCorrectOptionChange = useCallback((newValue: string) => {
    setCorrectOption(newValue);
  }, [setCorrectOption]);

  const handleIsAnonymousChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setIsAnonymous(e.target.checked);
  }, []);

  const handleMultipleAnswersChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setIsMultipleAnswers(e.target.checked);
  }, []);

  const handleQuizModeChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setIsQuizMode(e.target.checked);
  }, []);

  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.keyCode === 13) {
      handleCreate();
    }
  }, [handleCreate]);

  const getQuestionError = useCallback(() => {
    if (hasErrors && !question.trim().length) {
      return lang('lng_polls_choose_question');
    }

    return undefined;
  }, [hasErrors, lang, question]);

  const getOptionsError = useCallback((index: number) => {
    const optionsTrimmed = options.map((o) => o.trim()).filter((o) => o.length);
    if (hasErrors && optionsTrimmed.length < 2 && !options[index].trim().length) {
      return lang('lng_polls_choose_answers');
    }
    return undefined;
  }, [hasErrors, lang, options]);

  function renderHeader() {
    return (
      <div className="modal-header-condensed">
        <Button round color="translucent" size="smaller" ariaLabel="Cancel poll creation" onClick={onClear}>
          <i className="icon-close" />
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
            onClick={() => removeOption(index)}
          >
            <i className="icon-close" />
          </Button>
        )}
      </div>
    ));
  }

  function renderRadioOptions() {
    return renderOptions()
      .map((label, index) => ({ value: String(index), label, hidden: index === options.length - 1 }));
  }

  function renderQuizNoOptionError() {
    const optionsTrimmed = options.map((o) => o.trim()).filter((o) => o.length);

    return isQuizMode && (!correctOption || !optionsTrimmed[Number(correctOption)]) && (
      <p className="error">{lang('lng_polls_choose_correct')}</p>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClear} header={renderHeader()} className="PollModal">
      <InputText
        ref={questionInputRef}
        label={lang('AskAQuestion')}
        value={question}
        error={getQuestionError()}
        onChange={(e) => setQuestion(e.currentTarget.value)}
        onKeyPress={handleKeyPress}
      />
      <div className="options-divider" />

      <div className="options-list custom-scroll" ref={optionsListRef}>
        <h3 className="options-header">Options</h3>

        {hasErrors && renderQuizNoOptionError()}
        {isQuizMode ? (
          <RadioGroup
            name="correctOption"
            options={renderRadioOptions()}
            onChange={handleCorrectOptionChange}
          />
        ) : (
          renderOptions()
        )}

      </div>

      <div className="options-divider" />

      <div className="quiz-mode">
        <Checkbox
          label={lang('PollAnonymous')}
          checked={isAnonymous}
          onChange={handleIsAnonymousChange}
        />
        <Checkbox
          label={lang('PollMultiple')}
          checked={isMultipleAnswers}
          disabled={isQuizMode}
          onChange={handleMultipleAnswersChange}
        />
        <Checkbox
          label={lang('PollQuiz')}
          checked={isQuizMode}
          disabled={isMultipleAnswers}
          onChange={handleQuizModeChange}
        />
        {isQuizMode && (
          <>
            <h3 className="options-header">Solution</h3>
            <div
              ref={solutionRef}
              className="form-control"
              contentEditable
              dir="auto"
              onChange={(e) => setSolution(e.currentTarget.innerHTML)}
            />
            <div className="note">{lang('CreatePoll.ExplanationInfo')}</div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default memo(PollModal);
