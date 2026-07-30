import type { Editor } from '@tiptap/core';
import { memo, useEffect } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiBotCommand,
  ApiBotInlineMediaResult,
  ApiBotInlineResult,
  ApiQuickReply,
  ApiSticker,
  ApiUser,
} from '../../../api/types';
import type {
  RichEditorFormatterState,
  RichEditorTooltipContext,
  RichEditorTooltipItem,
  RichEditorTooltipsConfig,
  RichEditorTooltipSuggestion,
  RichEditorTooltipSurface,
} from './types';

import { selectTabState } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { parseInlineBotQuery } from './extensions/richEditorTooltips/suggestion';

import useLastCallback from '../../../hooks/useLastCallback';

import TextFormatter from '../../ui/textInput/TextFormatter';
import ChatCommandTooltip from './ChatCommandTooltip.async';
import CustomEmojiTooltip from './CustomEmojiTooltip.async';
import EmojiTooltip from './EmojiTooltip.async';
import InlineBotTooltip from './InlineBotTooltip.async';
import MentionTooltip from './MentionTooltip.async';
import RichEditorTooltipPanel from './RichEditorTooltipPanel';
import StickerTooltip from './StickerTooltip.async';

import styles from './RichEditorTooltipContainer.module.scss';

const RE_MULTIPLE_NEWLINES = /\n{2,}/;

export type OwnProps = {
  editor: Editor;
  surface?: RichEditorTooltipSurface;
  suggestion?: RichEditorTooltipSuggestion;
  customEmojiSuggestion?: RichEditorTooltipSuggestion;
  stickerSuggestion?: RichEditorTooltipSuggestion;
  formatter?: RichEditorFormatterState;
  isOpen: boolean;
  isCustomEmojiOpen: boolean;
  isStickerOpen: boolean;
  isFormatterOpen: boolean;
  selectedIndex: number;
  config: RichEditorTooltipsConfig;
  context: RichEditorTooltipContext;
  onCloseFormatter: NoneToVoidFunction;
  onFormatterDismissalChange: (isBlocked: boolean) => void;
};

type StateProps = {
  customEmoji?: ApiSticker[];
  stickers?: ApiSticker[];
  inlineBots?: RichEditorTooltipContext['inlineBots'];
};

const RichEditorTooltipContainer = ({
  editor,
  surface,
  suggestion,
  customEmojiSuggestion,
  stickerSuggestion,
  formatter,
  isOpen,
  isCustomEmojiOpen,
  isStickerOpen,
  isFormatterOpen,
  selectedIndex,
  config,
  context,
  customEmoji,
  stickers,
  inlineBots,
  onCloseFormatter,
  onFormatterDismissalChange,
}: OwnProps & StateProps) => {
  const { queryInlineBot } = getActions();

  const inlineBotState = surface === 'inlineBot' ? parseInlineBotQuery(suggestion?.text) : undefined;
  const inlineBot = inlineBotState ? inlineBots?.[inlineBotState.username.toLowerCase()] || undefined : undefined;
  const canShowInlineBotHelp = inlineBotState?.query === '' && !RE_MULTIPLE_NEWLINES.test(suggestion?.text || '');
  const inlineBotHelp = canShowInlineBotHelp && inlineBot
    ? inlineBot.help
    : undefined;
  const inlineBotUsername = inlineBotState?.username;
  const onInlineBotHelpChange = config.inlineBot?.onHelpChange;

  const handleMentionSelect = useLastCallback((user: ApiUser) => suggestion?.command(user));
  const handleEmojiSelect = useLastCallback((emoji: string) => {
    const item = suggestion ? findEmojiItem(suggestion.items, emoji) : undefined;
    if (item) {
      suggestion!.command(item);
    }
  });
  const handleCustomEmojiSelect = useLastCallback((emoji: ApiSticker) => suggestion?.command(emoji));
  const handleStickerSelect = useLastCallback((
    sticker: ApiSticker,
    isSilent?: boolean,
    shouldSchedule?: boolean,
  ) => config.sticker?.onSelect(sticker, isSilent, shouldSchedule));
  const handleStackCustomEmojiSelect = useLastCallback((emoji: ApiSticker) => customEmojiSuggestion?.command(emoji));
  const handleCommandSelect = useLastCallback((command: ApiBotCommand) => suggestion?.command(command));
  const handleQuickReplySelect = useLastCallback((quickReply: ApiQuickReply) => suggestion?.command(quickReply));
  const handleInlineBotLoadMore = useLastCallback(() => {
    if (!inlineBotState || !inlineBot) {
      return;
    }

    queryInlineBot({
      chatId: context.chatId,
      username: inlineBotState.username.toLowerCase(),
      query: inlineBotState.query,
      offset: inlineBot.offset,
    });
  });
  const handleInlineBotResultSelect = useLastCallback((
    result: ApiBotInlineResult | ApiBotInlineMediaResult,
    isSilent?: boolean,
    shouldSchedule?: boolean,
  ) => {
    if (inlineBot) {
      config.inlineBot?.onSelect(inlineBot.id, result, isSilent, shouldSchedule);
    }
  });

  useEffect(() => {
    onInlineBotHelpChange?.(
      inlineBotHelp && inlineBotUsername ? `@${inlineBotUsername} ${inlineBotHelp}` : undefined,
    );
    return () => onInlineBotHelpChange?.();
  }, [inlineBotHelp, inlineBotUsername, onInlineBotHelpChange]);

  if (formatter && !editor.isDestroyed) {
    return (
      <div className={styles.formatter}>
        <RichEditorTooltipPanel isOpen={isFormatterOpen}>
          <TextFormatter
            editor={editor}
            range={formatter.range}
            capabilities={formatter.capabilities}
            controlRequest={formatter.controlRequest}
            isRichInputExpanded={context.isRichInputExpanded}
            onClose={onCloseFormatter}
            onDismissalChange={onFormatterDismissalChange}
          />
        </RichEditorTooltipPanel>
      </div>
    );
  }

  if (!surface || !suggestion) {
    return undefined;
  }

  if (surface === 'mention') {
    return (
      <div className={buildClassName(styles.root, styles.compact)}>
        <MentionTooltip
          isOpen={isOpen}
          selectedIndex={selectedIndex}
          filteredUsers={suggestion.items as ApiUser[]}
          onInsertUserName={handleMentionSelect}
        />
      </div>
    );
  }

  if (surface === 'emoji') {
    if (!config.emoji) {
      return undefined;
    }

    const emojis = suggestion.items.filter((item): item is Emoji => 'native' in item);
    const customEmojis = suggestion.items.filter((item): item is ApiSticker => !('native' in item));

    return (
      <div className={styles.root}>
        <EmojiTooltip
          isOpen={isOpen}
          selectedIndex={selectedIndex}
          emojis={emojis}
          customEmojis={customEmojis}
          onEmojiSelect={handleEmojiSelect}
          onCustomEmojiSelect={handleCustomEmojiSelect}
        />
      </div>
    );
  }

  if (surface === 'customEmoji' || surface === 'sticker') {
    const customEmojiConfig = config.customEmoji;
    return (
      <div className={styles.emojiStack}>
        {stickerSuggestion ? (
          <StickerTooltip
            isOpen={isStickerOpen}
            chatId={context.chatId}
            threadId={context.threadId}
            stickers={stickers}
            isSavedMessages={context.isSavedMessages}
            isCurrentUserPremium={context.isCurrentUserPremium}
            onStickerSelect={handleStickerSelect}
          />
        ) : undefined}
        {customEmojiSuggestion && customEmojiConfig ? (
          <CustomEmojiTooltip
            isOpen={isCustomEmojiOpen}
            customEmoji={customEmoji}
            isSavedMessages={context.isSavedMessages}
            isCurrentUserPremium={context.isCurrentUserPremium}
            addRecentCustomEmoji={customEmojiConfig.addRecentCustomEmoji}
            onCustomEmojiSelect={handleStackCustomEmojiSelect}
          />
        ) : undefined}
      </div>
    );
  }

  if (surface === 'command' && context.currentUser) {
    const botCommands = suggestion.items.filter((item): item is ApiBotCommand => 'botId' in item);
    const filteredQuickReplies = suggestion.items.filter((item): item is ApiQuickReply => 'shortcut' in item);

    return (
      <div className={buildClassName(styles.root, styles.compact, styles.command)}>
        <ChatCommandTooltip
          isOpen={isOpen}
          selectedIndex={selectedIndex}
          botCommands={botCommands}
          quickReplies={filteredQuickReplies}
          quickReplyMessages={context.quickReplyMessages}
          self={context.currentUser}
          onCommandSelect={handleCommandSelect}
          onQuickReplySelect={handleQuickReplySelect}
        />
      </div>
    );
  }

  if (surface === 'inlineBot' && inlineBot && inlineBotState) {
    return (
      <div className={styles.root}>
        <InlineBotTooltip
          isOpen={isOpen}
          selectedIndex={selectedIndex}
          botId={inlineBot.id}
          isGallery={inlineBot.isGallery}
          inlineBotResults={inlineBot.results}
          switchPm={inlineBot.switchPm}
          switchWebview={inlineBot.switchWebview}
          isSavedMessages={context.isSavedMessages}
          canSendGifs={context.canSendGifs}
          isCurrentUserPremium={context.isCurrentUserPremium}
          loadMore={handleInlineBotLoadMore}
          onSelectResult={handleInlineBotResultSelect}
        />
      </div>
    );
  }

  return undefined;
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const tabState = selectTabState(global);
    return {
      customEmoji: global.customEmojis.forEmoji.stickers,
      stickers: global.stickers.forEmoji.stickers,
      inlineBots: tabState.inlineBots.byUsername,
    };
  },
)(RichEditorTooltipContainer));

function findEmojiItem(items: RichEditorTooltipItem[], native: string) {
  return items.find((item): item is Emoji => 'native' in item && item.native === native);
}
