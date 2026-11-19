import type { SharedSettings } from '../../global/types';
import type { RegularLangKey } from '../../types/language';

import { IS_MAC_OS } from '../browser/windowEnvironment';

export type KeyboardShortcutId =
  'globalSearch' | 'quickChatPicker' | 'savedMessages' | 'archivedChats' | 'openSettings' | 'lockScreen'
  | 'closeOrGoBack'
  | 'previousChat' | 'nextChat' | 'openChatByNumber' | 'openFolderByNumber'
  | 'searchInChat' | 'focusMessageInput' | 'editLastMessage' | 'replyToPreviousMessage' | 'replyToNextMessage'
  | 'collapseRichInput' | 'copySelectedMessages' | 'deleteSelectedMessages' | 'copyFormats' | 'pauseVoiceRecording'
  | 'sendMessage' | 'newLine'
  | 'bold' | 'italic' | 'underline' | 'strikethrough' | 'monospace' | 'spoiler' | 'link' | 'date' | 'blockquote'
  | 'clearFormatting' | 'subscript' | 'superscript' | 'paragraph' | 'headings' | 'codeBlock' | 'bulletList'
  | 'orderedList' | 'undo' | 'redo'
  | 'toggleRoundVideoPlayback' | 'exitRoundVideoFullscreen'
  | 'closeMediaViewer' | 'previousMedia' | 'nextMedia' | 'toggleVideoPlayback' | 'seekVideo'
  | 'closeStoryViewer' | 'toggleStoryPlayback' | 'previousStory' | 'nextStory'
  | 'closeMediaEditor' | 'mediaEditorUndo' | 'mediaEditorRedo' | 'deleteLayer'
  | 'mediaEditorPlayback' | 'mediaEditorSeek' | 'mediaEditorFrameStep' | 'mediaEditorMute';

export type KeyboardShortcutScope =
  'global' | 'chatList' | 'chat' | 'composer' | 'messageSelection' | 'mediaViewer' | 'storyViewer' | 'mediaEditor';

export type KeyboardShortcutCondition = 'hasSelection' | 'noSelection' | 'isInputEmpty';

type KeyboardShortcutSection =
  'sending' | 'general' | 'chatList' | 'chat' | 'formatting' | 'roundVideo' | 'mediaViewer' | 'storyViewer'
  | 'mediaEditor';

export type KeyboardShortcutDefault = {
  combo: string;
  condition?: KeyboardShortcutCondition;
  platform?: 'mac' | 'windows';
  environment?: 'app' | 'notFirefox' | 'notMacApp';
  sendKeyCombo?: SharedSettings['messageSendKeyCombo'];
};

type KeyboardShortcut = {
  section: KeyboardShortcutSection;
  scope: KeyboardShortcutScope;
  titleKey: RegularLangKey;
  descriptionKey?: RegularLangKey;
  condition?: KeyboardShortcutCondition;
  isEditable?: true;
  defaults: KeyboardShortcutDefault[];
  displayKeys?: string[];
};

// Option reveals alternate items on macOS, Shift reveals extended items on Windows
export const EXTENDED_MENU_KEY = IS_MAC_OS ? 'Alt' : 'Shift';

export const KEYBOARD_SHORTCUT_SECTIONS: {
  section: KeyboardShortcutSection;
  titleKey: RegularLangKey;
  descriptionKey?: RegularLangKey;
}[] = [
  { section: 'sending', titleKey: 'ShortcutsSectionSending' },
  { section: 'general', titleKey: 'ShortcutsSectionGeneral' },
  { section: 'chatList', titleKey: 'ShortcutsSectionChatList' },
  { section: 'chat', titleKey: 'ShortcutsSectionChat' },
  { section: 'formatting', titleKey: 'ShortcutsSectionFormatting', descriptionKey: 'ShortcutsFormattingInfo' },
  { section: 'roundVideo', titleKey: 'ShortcutsSectionRoundVideo' },
  { section: 'mediaViewer', titleKey: 'ShortcutsSectionMediaViewer' },
  { section: 'storyViewer', titleKey: 'ShortcutsSectionStories' },
  { section: 'mediaEditor', titleKey: 'ShortcutsSectionMediaEditor' },
];

const CHAT_NUMBERS = ['1', '2', '3', '4', '5', '6', '7', '8'];
const FOLDER_NUMBERS = [...CHAT_NUMBERS, '9'];
const HEADING_NUMBERS = ['1', '2', '3', '4', '5', '6'];

export const KEYBOARD_SHORTCUTS: Record<KeyboardShortcutId, KeyboardShortcut> = {
  globalSearch: {
    section: 'general',
    scope: 'global',
    titleKey: 'ShortcutGlobalSearch',
    isEditable: true,
    defaults: [{ combo: 'Mod+Shift+F' }],
  },
  quickChatPicker: {
    section: 'general',
    scope: 'global',
    titleKey: 'ShortcutQuickChatPicker',
    condition: 'noSelection',
    isEditable: true,
    defaults: [{ combo: 'Mod+K' }],
  },
  savedMessages: {
    section: 'general',
    scope: 'global',
    titleKey: 'SavedMessages',
    isEditable: true,
    defaults: [
      { combo: 'Mod+Shift+S', environment: 'notFirefox' },
      { combo: 'Ctrl+Shift+0' },
      { combo: 'Mod+0', environment: 'app' },
    ],
  },
  archivedChats: {
    section: 'general',
    scope: 'global',
    titleKey: 'ArchivedChats',
    isEditable: true,
    defaults: [{ combo: 'Mod+9', environment: 'app' }],
  },
  openSettings: {
    section: 'general',
    scope: 'global',
    titleKey: 'Settings',
    isEditable: true,
    defaults: [{ combo: 'Mod+,', platform: 'mac', environment: 'app' }],
  },
  lockScreen: {
    section: 'general',
    scope: 'global',
    titleKey: 'ShortcutsControllerOthersLockByPasscode',
    isEditable: true,
    defaults: [
      { combo: 'Ctrl+Shift+L' },
      { combo: 'Meta+Shift+L', platform: 'mac' },
      { combo: 'Mod+L', environment: 'app' },
    ],
  },
  closeOrGoBack: {
    section: 'general',
    scope: 'global',
    titleKey: 'ShortcutCloseOrGoBack',
    defaults: [{ combo: 'Escape' }],
  },
  previousChat: {
    section: 'chatList',
    scope: 'chatList',
    titleKey: 'ShortcutPreviousChat',
    isEditable: true,
    defaults: [{ combo: 'Alt+ArrowUp' }],
  },
  nextChat: {
    section: 'chatList',
    scope: 'chatList',
    titleKey: 'ShortcutNextChat',
    isEditable: true,
    defaults: [{ combo: 'Alt+ArrowDown' }],
  },
  openChatByNumber: {
    section: 'chatList',
    scope: 'chatList',
    titleKey: 'ShortcutChatByNumber',
    defaults: CHAT_NUMBERS.map((digit) => ({ combo: `Mod+${digit}`, environment: 'app' })),
    displayKeys: ['Mod', '1–8'],
  },
  openFolderByNumber: {
    section: 'chatList',
    scope: 'global',
    titleKey: 'ShortcutFolderByNumber',
    defaults: FOLDER_NUMBERS.map((digit) => ({ combo: `Ctrl+Shift+${digit}` })),
    displayKeys: ['Ctrl', 'Shift', '1–9'],
  },
  searchInChat: {
    section: 'chat',
    scope: 'chat',
    titleKey: 'ShortcutSearchInChat',
    isEditable: true,
    defaults: [{ combo: 'Mod+F', environment: 'app' }],
  },
  focusMessageInput: {
    section: 'chat',
    scope: 'chat',
    titleKey: 'ShortcutFocusMessageInput',
    defaults: [{ combo: 'Tab' }],
  },
  editLastMessage: {
    section: 'chat',
    scope: 'composer',
    titleKey: 'ShortcutEditLastMessage',
    condition: 'isInputEmpty',
    isEditable: true,
    defaults: [{ combo: 'ArrowUp' }],
  },
  replyToPreviousMessage: {
    section: 'chat',
    scope: 'composer',
    titleKey: 'ShortcutReplyToPrevious',
    condition: 'isInputEmpty',
    isEditable: true,
    defaults: [{ combo: 'Mod+ArrowUp' }],
  },
  replyToNextMessage: {
    section: 'chat',
    scope: 'composer',
    titleKey: 'ShortcutReplyToNext',
    condition: 'isInputEmpty',
    isEditable: true,
    defaults: [{ combo: 'Mod+ArrowDown' }],
  },
  collapseRichInput: {
    section: 'chat',
    scope: 'composer',
    titleKey: 'AriaComposerCloseRichInput',
    defaults: [{ combo: 'Escape' }],
  },
  copySelectedMessages: {
    section: 'chat',
    scope: 'messageSelection',
    titleKey: 'ShortcutCopySelected',
    defaults: [{ combo: 'Mod+C' }],
  },
  deleteSelectedMessages: {
    section: 'chat',
    scope: 'messageSelection',
    titleKey: 'ShortcutDeleteSelected',
    defaults: [{ combo: 'Delete' }, { combo: 'Backspace' }],
  },
  copyFormats: {
    section: 'chat',
    scope: 'chat',
    titleKey: 'ShortcutCopyFormats',
    descriptionKey: 'ShortcutHoldInMessageMenu',
    defaults: [{ combo: EXTENDED_MENU_KEY }],
    displayKeys: [EXTENDED_MENU_KEY],
  },
  pauseVoiceRecording: {
    section: 'chat',
    scope: 'chat',
    titleKey: 'ShortcutPauseRecording',
    defaults: [{ combo: 'Space' }],
  },
  sendMessage: {
    section: 'sending',
    scope: 'composer',
    titleKey: 'ShortcutSendMessage',
    defaults: [
      { combo: 'Enter', sendKeyCombo: 'enter' },
      { combo: 'Mod+Enter', sendKeyCombo: 'ctrl-enter' },
    ],
  },
  newLine: {
    section: 'sending',
    scope: 'composer',
    titleKey: 'ShortcutNewLine',
    defaults: [
      { combo: 'Shift+Enter', sendKeyCombo: 'enter' },
      { combo: 'Enter', sendKeyCombo: 'ctrl-enter' },
      { combo: 'Shift+Enter', sendKeyCombo: 'ctrl-enter' },
    ],
  },
  bold: {
    section: 'formatting',
    scope: 'composer',
    titleKey: 'ShortcutBold',
    isEditable: true,
    defaults: [{ combo: 'Mod+B' }],
  },
  italic: {
    section: 'formatting',
    scope: 'composer',
    titleKey: 'ShortcutItalic',
    isEditable: true,
    defaults: [{ combo: 'Mod+I' }],
  },
  underline: {
    section: 'formatting',
    scope: 'composer',
    titleKey: 'ShortcutUnderline',
    isEditable: true,
    defaults: [{ combo: 'Mod+U' }],
  },
  strikethrough: {
    section: 'formatting',
    scope: 'composer',
    titleKey: 'ShortcutStrikethrough',
    isEditable: true,
    defaults: [{ combo: 'Mod+S', condition: 'hasSelection' }],
  },
  monospace: {
    section: 'formatting',
    scope: 'composer',
    titleKey: 'ShortcutMonospace',
    isEditable: true,
    defaults: [{ combo: 'Mod+Shift+M' }, { combo: 'Mod+M', condition: 'hasSelection' }],
  },
  spoiler: {
    section: 'formatting',
    scope: 'composer',
    titleKey: 'Spoiler',
    isEditable: true,
    defaults: [{ combo: 'Mod+Shift+P', environment: 'notFirefox' }, { combo: 'Mod+P', condition: 'hasSelection' }],
  },
  link: {
    section: 'formatting',
    scope: 'composer',
    titleKey: 'FormattingAddLinkAria',
    condition: 'hasSelection',
    isEditable: true,
    defaults: [{ combo: 'Mod+K' }],
  },
  date: {
    section: 'formatting',
    scope: 'composer',
    titleKey: 'FormattingAddDateAria',
    condition: 'hasSelection',
    isEditable: true,
    defaults: [{ combo: 'Mod+D' }],
  },
  blockquote: {
    section: 'formatting',
    scope: 'composer',
    titleKey: 'RichEditorBlockquote',
    isEditable: true,
    defaults: [{ combo: 'Mod+Shift+B' }],
  },
  clearFormatting: {
    section: 'formatting',
    scope: 'composer',
    titleKey: 'FormattingClearAria',
    isEditable: true,
    defaults: [{ combo: 'Mod+N', environment: 'app' }],
  },
  subscript: {
    section: 'formatting',
    scope: 'composer',
    titleKey: 'ShortcutSubscript',
    isEditable: true,
    defaults: [{ combo: 'Mod+,', environment: 'notMacApp' }],
  },
  superscript: {
    section: 'formatting',
    scope: 'composer',
    titleKey: 'ShortcutSuperscript',
    isEditable: true,
    defaults: [{ combo: 'Mod+.' }],
  },
  paragraph: {
    section: 'formatting',
    scope: 'composer',
    titleKey: 'CodeLanguagePlainText',
    isEditable: true,
    defaults: [{ combo: 'Mod+Alt+0' }],
  },
  headings: {
    section: 'formatting',
    scope: 'composer',
    titleKey: 'ShortcutHeadings',
    defaults: HEADING_NUMBERS.map((digit) => ({ combo: `Mod+Alt+${digit}` })),
    displayKeys: ['Mod', 'Alt', '1–6'],
  },
  codeBlock: {
    section: 'formatting',
    scope: 'composer',
    titleKey: 'RichEditorCodeBlock',
    isEditable: true,
    defaults: [{ combo: 'Mod+Alt+C' }],
  },
  bulletList: {
    section: 'formatting',
    scope: 'composer',
    titleKey: 'RichEditorBulletList',
    isEditable: true,
    defaults: [{ combo: 'Mod+Shift+8', platform: 'mac' }],
  },
  orderedList: {
    section: 'formatting',
    scope: 'composer',
    titleKey: 'RichEditorOrderedList',
    isEditable: true,
    defaults: [{ combo: 'Mod+Shift+7', platform: 'mac' }],
  },
  undo: {
    section: 'formatting',
    scope: 'composer',
    titleKey: 'Undo',
    defaults: [{ combo: 'Mod+Z' }],
  },
  redo: {
    section: 'formatting',
    scope: 'composer',
    titleKey: 'Redo',
    defaults: [{ combo: 'Mod+Shift+Z' }, { combo: 'Mod+Y' }],
  },
  toggleRoundVideoPlayback: {
    section: 'roundVideo',
    scope: 'chat',
    titleKey: 'ShortcutPlayPause',
    descriptionKey: 'ShortcutInFullscreen',
    defaults: [{ combo: 'Space' }, { combo: 'Enter' }],
  },
  exitRoundVideoFullscreen: {
    section: 'roundVideo',
    scope: 'chat',
    titleKey: 'AccExitFullscreen',
    defaults: [{ combo: 'Escape' }],
  },
  closeMediaViewer: {
    section: 'mediaViewer',
    scope: 'mediaViewer',
    titleKey: 'Close',
    defaults: [{ combo: 'Escape' }],
  },
  previousMedia: {
    section: 'mediaViewer',
    scope: 'mediaViewer',
    titleKey: 'ShortcutPreviousMedia',
    defaults: [{ combo: 'ArrowLeft' }],
  },
  nextMedia: {
    section: 'mediaViewer',
    scope: 'mediaViewer',
    titleKey: 'ShortcutNextMedia',
    defaults: [{ combo: 'ArrowRight' }],
  },
  toggleVideoPlayback: {
    section: 'mediaViewer',
    scope: 'mediaViewer',
    titleKey: 'ShortcutPlayPause',
    defaults: [{ combo: 'Space' }, { combo: 'Enter' }],
  },
  seekVideo: {
    section: 'mediaViewer',
    scope: 'mediaViewer',
    titleKey: 'ShortcutSeekVideo',
    descriptionKey: 'ShortcutInFullscreen',
    defaults: [{ combo: 'ArrowLeft' }, { combo: 'ArrowRight' }],
  },
  closeStoryViewer: {
    section: 'storyViewer',
    scope: 'storyViewer',
    titleKey: 'Close',
    defaults: [{ combo: 'Escape' }],
  },
  toggleStoryPlayback: {
    section: 'storyViewer',
    scope: 'storyViewer',
    titleKey: 'ShortcutPlayPause',
    defaults: [{ combo: 'Space' }],
  },
  previousStory: {
    section: 'storyViewer',
    scope: 'storyViewer',
    titleKey: 'ShortcutPreviousStory',
    defaults: [{ combo: 'ArrowLeft' }],
  },
  nextStory: {
    section: 'storyViewer',
    scope: 'storyViewer',
    titleKey: 'ShortcutNextStory',
    defaults: [{ combo: 'ArrowRight' }],
  },
  closeMediaEditor: {
    section: 'mediaEditor',
    scope: 'mediaEditor',
    titleKey: 'Close',
    defaults: [{ combo: 'Escape' }],
  },
  mediaEditorUndo: {
    section: 'mediaEditor',
    scope: 'mediaEditor',
    titleKey: 'Undo',
    defaults: [{ combo: 'Mod+Z' }],
  },
  mediaEditorRedo: {
    section: 'mediaEditor',
    scope: 'mediaEditor',
    titleKey: 'Redo',
    defaults: [{ combo: 'Mod+Shift+Z' }, { combo: 'Ctrl+Y', platform: 'windows' }],
  },
  deleteLayer: {
    section: 'mediaEditor',
    scope: 'mediaEditor',
    titleKey: 'ShortcutDeleteLayer',
    defaults: [{ combo: 'Delete' }, { combo: 'Backspace' }],
  },
  mediaEditorPlayback: {
    section: 'mediaEditor',
    scope: 'mediaEditor',
    titleKey: 'ShortcutPlayPause',
    defaults: [{ combo: 'Space' }],
  },
  mediaEditorSeek: {
    section: 'mediaEditor',
    scope: 'mediaEditor',
    titleKey: 'ShortcutSeekVideo',
    defaults: [{ combo: 'ArrowLeft' }, { combo: 'ArrowRight' }],
  },
  mediaEditorFrameStep: {
    section: 'mediaEditor',
    scope: 'mediaEditor',
    titleKey: 'ShortcutFrameStep',
    defaults: [{ combo: 'Shift+ArrowLeft' }, { combo: 'Shift+ArrowRight' }],
  },
  mediaEditorMute: {
    section: 'mediaEditor',
    scope: 'mediaEditor',
    titleKey: 'ShortcutMuteUnmute',
    defaults: [{ combo: 'M' }],
  },
};

export const KEYBOARD_SHORTCUT_IDS = Object.keys(KEYBOARD_SHORTCUTS) as KeyboardShortcutId[];

export const DROPPED_EDITOR_COMBOS = ['Mod+Shift+I', 'Mod+Shift+U'];

export const TEXT_EDITING_COMBOS = ['Mod+C', 'Mod+V', 'Mod+X', 'Mod+A', 'Mod+Z', 'Mod+Shift+Z', 'Mod+Y'];
