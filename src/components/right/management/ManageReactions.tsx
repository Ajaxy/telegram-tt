import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo,
  useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiAvailableReaction, ApiChat, ApiChatReactions, ApiReaction,
} from '../../../api/types';

import { isSameReaction } from '../../../global/helpers';
import { selectChat, selectChatFullInfo } from '../../../global/selectors';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';

import ReactionStaticEmoji from '../../common/ReactionStaticEmoji';
import Checkbox from '../../ui/Checkbox';
import FloatingActionButton from '../../ui/FloatingActionButton';
import RadioGroup from '../../ui/RadioGroup';
import Spinner from '../../ui/Spinner';

type OwnProps = {
  chatId: string;
  onClose: NoneToVoidFunction;
  isActive: boolean;
};

type StateProps = {
  chat?: ApiChat;
  availableReactions?: ApiAvailableReaction[];
  enabledReactions?: ApiChatReactions;
};

const ManageReactions: FC<OwnProps & StateProps> = ({
  availableReactions,
  enabledReactions,
  chat,
  isActive,
  onClose,
}) => {
  const { setChatEnabledReactions } = getActions();

  const lang = useLang();
  const [isTouched, setIsTouched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [localEnabledReactions, setLocalEnabledReactions] = useState<ApiChatReactions | undefined>(enabledReactions);

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  const reactionsOptions = useMemo(() => [{
    value: 'all',
    label: lang('AllReactions'),
  }, {
    value: 'some',
    label: lang('SomeReactions'),
  }, {
    value: 'none',
    label: lang('NoReactions'),
  }], [lang]);

  const handleSaveReactions = useCallback(() => {
    if (!chat) return;
    setIsLoading(true);

    setChatEnabledReactions({
      chatId: chat.id,
      enabledReactions: localEnabledReactions,
    });
  }, [chat, localEnabledReactions, setChatEnabledReactions]);

  useEffect(() => {
    setIsLoading(false);
    setIsTouched(false);
    setLocalEnabledReactions(enabledReactions);
  }, [enabledReactions]);

  const availableActiveReactions = useMemo<ApiAvailableReaction[] | undefined>(
    () => availableReactions?.filter(({ isInactive }) => !isInactive),
    [availableReactions],
  );

  const handleReactionsOptionChange = useCallback((value: string) => {
    if (value === 'all') {
      setLocalEnabledReactions({ type: 'all' });
    } else if (value === 'some') {
      setLocalEnabledReactions({
        type: 'some',
        allowed: enabledReactions?.type === 'some' ? enabledReactions.allowed : [],
      });
    } else {
      setLocalEnabledReactions(undefined);
    }
    setIsTouched(true);
  }, [enabledReactions]);

  const handleReactionChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!chat || !availableActiveReactions) return;

    const { name, checked } = e.currentTarget;
    if (localEnabledReactions?.type === 'some') {
      const reaction = { emoticon: name } as ApiReaction;
      if (checked) {
        setLocalEnabledReactions({
          type: 'some',
          allowed: [...localEnabledReactions.allowed, reaction],
        });
      } else {
        setLocalEnabledReactions({
          type: 'some',
          allowed: localEnabledReactions.allowed.filter((local) => !isSameReaction(local, reaction)),
        });
      }
    }
    setIsTouched(true);
  }, [availableActiveReactions, chat, localEnabledReactions]);

  return (
    <div className="Management">
      <div className="custom-scroll">
        <div className="section">
          <h3 className="section-heading">
            {lang('AvailableReactions')}
          </h3>
          <RadioGroup
            selected={localEnabledReactions?.type || 'none'}
            name="reactions"
            options={reactionsOptions}
            onChange={handleReactionsOptionChange}
          />
          <p className="section-info mt-4">
            {localEnabledReactions?.type === 'all' && lang('EnableAllReactionsInfo')}
            {localEnabledReactions?.type === 'some' && lang('EnableSomeReactionsInfo')}
            {!localEnabledReactions && lang('DisableReactionsInfo')}
          </p>
        </div>
        {localEnabledReactions?.type === 'some' && (
          <div className="section">
            <h3 className="section-heading">
              {lang('AvailableReactions')}
            </h3>
            {availableActiveReactions?.map(({ reaction, title }) => (
              <div className="ListItem">
                <Checkbox
                  name={reaction.emoticon}
                  checked={localEnabledReactions?.allowed.some((r) => isSameReaction(reaction, r))}
                  label={(
                    <div className="Reaction">
                      <ReactionStaticEmoji reaction={reaction} availableReactions={availableReactions} />
                      {title}
                    </div>
                  )}
                  onChange={handleReactionChange}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <FloatingActionButton
        isShown={isTouched}
        onClick={handleSaveReactions}
        ariaLabel={lang('Save')}
        disabled={isLoading}
      >
        {isLoading ? (
          <Spinner color="white" />
        ) : (
          <i className="icon icon-check" />
        )}
      </FloatingActionButton>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId)!;

    return {
      enabledReactions: selectChatFullInfo(global, chatId)?.enabledReactions,
      availableReactions: global.reactions.availableReactions,
      chat,
    };
  },
  (global, { chatId }) => {
    return Boolean(selectChat(global, chatId));
  },
)(ManageReactions));
