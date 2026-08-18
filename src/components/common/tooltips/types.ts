import type { Range as TiptapRange } from '@tiptap/core';
import type { SuggestionProps } from '@tiptap/suggestion';

import type {
  ApiBotCommand,
  ApiBotInlineMediaResult,
  ApiBotInlineResult,
  ApiChatMember,
  ApiMessage,
  ApiQuickReply,
  ApiSticker,
  ApiUser,
} from '../../../api/types';
import type { GlobalActions } from '../../../global';
import type { InlineBotSettings, ThreadId } from '../../../types';

export type RichEditorTooltipContext = {
  chatId: string;
  threadId?: ThreadId;
  currentUserId?: string;
  currentUser?: ApiUser;
  groupChatMembers?: ApiChatMember[];
  topInlineBotIds?: string[];
  topGuestBotIds?: string[];
  recentEmojiIds?: string[];
  baseEmojiKeywords?: Record<string, string[]>;
  emojiKeywords?: Record<string, string[]>;
  inlineBots?: Record<string, false | InlineBotSettings>;
  botCommands?: ApiBotCommand[] | false;
  chatBotCommands?: ApiBotCommand[];
  quickReplies?: Record<number, ApiQuickReply>;
  quickReplyMessages?: Record<number, ApiMessage>;
  isSavedMessages?: boolean;
  isInScheduledList?: boolean;
  isCurrentUserPremium?: boolean;
  canSendGifs?: boolean;
  isRichInputExpanded?: boolean;
  isFormatterDisabled?: boolean;
  isFormatterContextMenuOpen?: boolean;
};

export type RichEditorTooltipSurface = 'emoji' | 'customEmoji' | 'mention' | 'sticker' | 'command' | 'inlineBot';
export type RichEditorTooltipItem =
  Emoji
  | ApiSticker
  | ApiUser
  | ApiBotCommand
  | ApiQuickReply
  | ApiBotInlineResult
  | ApiBotInlineMediaResult;

export type RichEditorTooltipSuggestion = SuggestionProps<RichEditorTooltipItem, RichEditorTooltipItem>;

export type RichEditorFormatterControl = 'date' | 'link';

export type RichEditorFormatterState = {
  range: TiptapRange;
  capabilities: 'basic' | 'full';
  controlRequest?: {
    control: RichEditorFormatterControl;
  };
};

type RichEditorTooltipSurfaceConfig = {
  isEnabled: () => boolean;
};

type RichEditorFormatterConfig = {
  isEnabled: () => boolean;
  capabilities: 'basic' | 'full';
};

type RichEditorEmojiTooltipConfig = RichEditorTooltipSurfaceConfig & {
  addRecentEmoji: GlobalActions['addRecentEmoji'];
  addRecentCustomEmoji: GlobalActions['addRecentCustomEmoji'];
};

type RichEditorCustomEmojiTooltipConfig = RichEditorTooltipSurfaceConfig & {
  addRecentCustomEmoji: GlobalActions['addRecentCustomEmoji'];
};

type RichEditorStickerTooltipConfig = RichEditorTooltipSurfaceConfig & {
  onSelect: (sticker: ApiSticker, isSilent?: boolean, shouldSchedule?: boolean) => void;
};

type RichEditorCommandTooltipConfig = RichEditorTooltipSurfaceConfig & {
  onSelect: NoneToVoidFunction;
};

type RichEditorInlineBotTooltipConfig = RichEditorTooltipSurfaceConfig & {
  onSelect: (
    botId: string,
    result: ApiBotInlineResult | ApiBotInlineMediaResult,
    isSilent?: boolean,
    shouldSchedule?: boolean,
  ) => void;
  onHelpChange: (help?: string) => void;
};

export type RichEditorTooltipsConfig = {
  emoji?: RichEditorEmojiTooltipConfig;
  customEmoji?: RichEditorCustomEmojiTooltipConfig;
  mention?: RichEditorTooltipSurfaceConfig;
  sticker?: RichEditorStickerTooltipConfig;
  command?: RichEditorCommandTooltipConfig;
  inlineBot?: RichEditorInlineBotTooltipConfig;
  formatter?: RichEditorFormatterConfig;
  getTooltipBoundary?: () => HTMLElement | undefined;
  getContext: () => RichEditorTooltipContext;
};
