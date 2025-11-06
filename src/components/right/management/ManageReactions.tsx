import type { FC } from '../../../lib/teact/teact';
import type React from '../../../lib/teact/teact';
import {
  memo, useCallback, useEffect, useMemo,
  useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiAvailableReaction, ApiChat, ApiChatReactions, ApiReaction,
} from '../../../api/types';

import { isChatChannel, isSameReaction } from '../../../global/helpers';
import { selectChat, selectChatFullInfo } from '../../../global/selectors';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useOldLang from '../../../hooks/useOldLang';

import ReactionStaticEmoji from '../../common/reactions/ReactionStaticEmoji';
import Checkbox from '../../ui/Checkbox';
import FloatingActionButton from '../../ui/FloatingActionButton';
import RadioGroup from '../../ui/RadioGroup';
import RangeSlider from '../../ui/RangeSlider';

type OwnProps = {
  chatId: string;
  onClose: NoneToVoidFunction;
  isActive: boolean;
};

type StateProps = {
  chat?: ApiChat;
  availableReactions?: ApiAvailableReaction[];
  enabledReactions?: ApiChatReactions;
  maxUniqueReactions: number;
  reactionsLimit?: number;
  isChannel?: boolean;
};

const ManageReactions: FC<OwnProps & StateProps> = ({
  availableReactions,
  enabledReactions,
  chat,
  isActive,
  onClose,
  maxUniqueReactions,
  reactionsLimit,
  isChannel,
}) => {
  const { setChatEnabledReactions } = getActions();

  const lang = useOldLang();
  const [isTouched, setIsTouched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [localEnabledReactions, setLocalEnabledReactions] = useState<ApiChatReactions | undefined>(enabledReactions);

  const [localReactionsLimit, setLocalReactionsLimit] = useState(reactionsLimit);

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
      reactionsLimit: localReactionsLimit,
    });
  }, [chat, localEnabledReactions, setChatEnabledReactions, localReactionsLimit]);

  useEffect(() => {
    setIsLoading(false);
    setIsTouched(false);
    setLocalEnabledReactions(enabledReactions);
    setLocalReactionsLimit(reactionsLimit);
  }, [enabledReactions, reactionsLimit]);

  const availableActiveReactions = useMemo<ApiAvailableReaction[] | undefined>(
    () => availableReactions?.filter(({ isInactive }) => !isInactive),
    [availableReactions],
  );

  useEffect(() => {
    if (localReactionsLimit !== undefined && localReactionsLimit !== reactionsLimit) {
      setIsTouched(true);
      return;
    }

    if (localEnabledReactions?.type === 'some') {
      const isReactionsDisabled = enabledReactions?.type !== 'all' && enabledReactions?.type !== 'some';

      if (isReactionsDisabled && localEnabledReactions.allowed.length === 0) {
        setIsTouched(false);
        return;
      }
    }

    if (localEnabledReactions?.type !== enabledReactions?.type) {
      setIsTouched(true);
      return;
    }

    if (localEnabledReactions?.type === 'some' && enabledReactions?.type === 'some') {
      const localAllowedReactions = localEnabledReactions.allowed;
      const enabledAllowedReactions = enabledReactions?.allowed;

      if (localAllowedReactions.length !== enabledAllowedReactions.length
        || localAllowedReactions.reverse().some(
          (localReaction) => !enabledAllowedReactions.find(
            (enabledReaction) => isSameReaction(localReaction, enabledReaction),
          ),
        )) {
        setIsTouched(true);
        return;
      }
    }

    setIsTouched(false);
  }, [
    localReactionsLimit,
    reactionsLimit,
    localEnabledReactions,
    enabledReactions,
  ]);

  const handleReactionsOptionChange = useCallback((value: string) => {
    if (value === 'all') {
      setLocalEnabledReactions({ type: 'all' });
      setLocalReactionsLimit(reactionsLimit);
    } else if (value === 'some') {
      setLocalEnabledReactions({
        type: 'some',
        allowed: enabledReactions?.type === 'some' ? enabledReactions.allowed : [],
      });
      setLocalReactionsLimit(reactionsLimit);
    } else {
      setLocalEnabledReactions(undefined);
      setLocalReactionsLimit(undefined);
    }
  }, [enabledReactions, reactionsLimit]);

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
  }, [availableActiveReactions, chat, localEnabledReactions]);

  const handleReactionsLimitChange = useCallback((value: number) => {
    setLocalReactionsLimit(value);
  }, []);

  const renderReactionsMaxCountValue = useCallback((value: number) => {
    return lang('PeerInfo.AllowedReactions.MaxCountValue', value);
  }, [lang]);

  const shouldShowReactionsLimit = isChannel
    && (localEnabledReactions?.type === 'all' || localEnabledReactions?.type === 'some');

  return (
    <div className="Management">
      <div className="panel-content custom-scroll">
        {Boolean(localReactionsLimit && shouldShowReactionsLimit) && (
          <div className="section">
            <h3 className="section-heading">
              {lang('MaximumReactionsHeader')}
            </h3>
            <RangeSlider
              min={1}
              max={maxUniqueReactions}
              value={localReactionsLimit!}
              onChange={handleReactionsLimitChange}
              renderValue={renderReactionsMaxCountValue}
              isCenteredLayout
            />
            <p className="section-info section-info_push">
              {lang('ChannelReactions.MaxCount.Info')}
            </p>
          </div>
        )}
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
          <p className="section-info section-info_push">
            {localEnabledReactions?.type === 'all' && lang('EnableAllReactionsInfo')}
            {localEnabledReactions?.type === 'some' && lang('EnableSomeReactionsInfo')}
            {!localEnabledReactions && lang('DisableReactionsInfo')}
          </p>
        </div>
        {localEnabledReactions?.type === 'some' && (
          <div className="section section-with-fab">
            <h3 className="section-heading">
              {lang('OnlyAllowThisReactions')}
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
                  withIcon
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
        iconName="check"
        isLoading={isLoading}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): Complete<StateProps> => {
    const chat = selectChat(global, chatId)!;
    const { maxUniqueReactions } = global.appConfig;

    const chatFullInfo = selectChatFullInfo(global, chatId);
    const reactionsLimit = chatFullInfo?.reactionsLimit || maxUniqueReactions;
    const isChannel = isChatChannel(chat);

    return {
      enabledReactions: chatFullInfo?.enabledReactions,
      availableReactions: global.reactions.availableReactions,
      chat,
      maxUniqueReactions,
      reactionsLimit,
      isChannel,
    };
  },
  (global, { chatId }) => {
    return Boolean(selectChat(global, chatId));
  },
)(ManageReactions));
