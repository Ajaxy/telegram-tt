import { type Editor, Extension } from '@tiptap/core';
import type { Plugin } from '@tiptap/pm/state';

import type { RichEditorFormatterControl, RichEditorTooltipsConfig } from '../types';

import { buildCommandSuggestion } from './richEditorTooltips/command';
import { RichEditorTooltipsController } from './richEditorTooltips/controller';
import { buildEmojiSuggestion } from './richEditorTooltips/emoji';
import { buildFormatterPlugin, refreshFormatter } from './richEditorTooltips/formatter';
import { buildInlineBotSuggestion } from './richEditorTooltips/inlineBot';
import { buildMentionSuggestion } from './richEditorTooltips/mention';
import { buildNativeEmojiSuggestion } from './richEditorTooltips/nativeEmoji';

type RichEditorTooltipsStorage = {
  config?: RichEditorTooltipsConfig;
  controller?: RichEditorTooltipsController;
};

export const RichEditorTooltips = Extension.create<RichEditorTooltipsConfig, RichEditorTooltipsStorage>({
  name: 'richEditorTooltips',

  addOptions() {
    return {
      getContext: () => ({ chatId: '' }),
    };
  },

  addStorage() {
    return {};
  },

  onCreate() {
    this.storage.config = this.options;
    this.storage.controller = new RichEditorTooltipsController(this.editor, this.options);
  },

  onDestroy() {
    this.storage.controller?.destroy();
    this.storage.controller = undefined;
    this.storage.config = undefined;
  },

  addProseMirrorPlugins() {
    const plugins: Plugin[] = [];
    const getController = () => this.storage.controller;

    if (this.options.inlineBot) {
      plugins.push(buildInlineBotSuggestion(this.editor, this.options, getController));
    }
    if (this.options.command) {
      plugins.push(buildCommandSuggestion(this.editor, this.options, getController));
    }
    if (this.options.mention) {
      plugins.push(buildMentionSuggestion(this.editor, this.options, getController));
    }
    if (this.options.emoji) {
      plugins.push(buildEmojiSuggestion(this.editor, this.options, getController));
    }
    if (this.options.customEmoji) {
      plugins.push(buildNativeEmojiSuggestion('customEmoji', this.editor, this.options, getController));
    }
    if (this.options.sticker) {
      plugins.push(buildNativeEmojiSuggestion('sticker', this.editor, this.options, getController));
    }
    if (this.options.formatter) {
      plugins.push(buildFormatterPlugin(this.editor, this.options, getController));
    }

    return plugins;
  },
});

export function buildRichEditorTooltips(config: RichEditorTooltipsConfig) {
  return RichEditorTooltips.configure(config);
}

export function refreshRichEditorTooltips(editor: Editor) {
  if (editor.isDestroyed) {
    return;
  }

  const storage = (editor.storage as AnyLiteral).richEditorTooltips as RichEditorTooltipsStorage | undefined;
  if (storage?.config) {
    refreshFormatter(editor, storage.config, () => storage.controller);
  }
}

export function openRichEditorFormatterControl(editor: Editor, control: RichEditorFormatterControl) {
  if (editor.isDestroyed) {
    return false;
  }

  const storage = (editor.storage as AnyLiteral).richEditorTooltips as RichEditorTooltipsStorage | undefined;
  return storage?.controller?.openFormatterControl(control) || false;
}

export function hasActiveRichEditorTooltip(editor: Editor) {
  if (editor.isDestroyed) {
    return false;
  }

  const storage = (editor.storage as AnyLiteral).richEditorTooltips as RichEditorTooltipsStorage | undefined;
  return Boolean(storage?.controller?.hasActiveTooltip());
}
