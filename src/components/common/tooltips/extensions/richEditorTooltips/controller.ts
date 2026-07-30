import { type Editor, posToDOMRect, type Range as TiptapRange } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { exitSuggestion } from '@tiptap/suggestion';

import type {
  OwnProps as RichEditorTooltipContainerProps,
} from '../../RichEditorTooltipContainer';
import type {
  RichEditorFormatterControl,
  RichEditorTooltipItem,
  RichEditorTooltipsConfig,
  RichEditorTooltipSuggestion,
  RichEditorTooltipSurface,
} from '../../types';

import { requestMeasure, requestMutation } from '../../../../../lib/fasterdom/fasterdom';
import captureKeyboardListeners from '../../../../../util/captureKeyboardListeners';
import cycleRestrict from '../../../../../util/cycleRestrict';
import TeactRenderer from '../../../../../util/tiptap/TeactRenderer';
import { parseInlineBotQuery, PLUGIN_KEYS, TOOLTIP_GAP_PX } from './suggestion';

import RichEditorTooltipContainer from '../../RichEditorTooltipContainer';

const FADE_DURATION_MS = 150;
const FORMATTER_HOST_CLASS = 'is-formatter';
const MAX_FORMATTER_POSITION_ATTEMPTS = 10;
const SUGGESTION_HOST_CLASS = 'is-suggestion';
const SURFACE_PRIORITY: RichEditorTooltipSurface[] = [
  'inlineBot', 'command', 'mention', 'emoji', 'customEmoji', 'sticker',
];

export class RichEditorTooltipsController {
  private editor: Editor;

  private config: RichEditorTooltipsConfig;

  private renderer: TeactRenderer<RichEditorTooltipContainerProps>;

  private suggestions = new Map<RichEditorTooltipSurface, RichEditorTooltipSuggestion>();

  private closingSuggestions = new Map<RichEditorTooltipSurface, RichEditorTooltipSuggestion>();

  private closingFormatterRange?: TiptapRange;

  private fadeTimeouts = new Map<string, number>();

  private mountedSurface?: RichEditorTooltipSurface;

  private unmountSuggestion?: NoneToVoidFunction;

  private renderGeneration = 0;

  private mountGeneration = 0;

  private releaseKeyboardListener: NoneToVoidFunction;

  private resizeObserver: ResizeObserver;

  private formatterRange?: TiptapRange;

  private formatterControlRequest?: {
    control: RichEditorFormatterControl;
  };

  private selectedIndex = -1;

  private isFormatterDismissalBlocked = false;

  private isDestroyed = false;

  constructor(editor: Editor, config: RichEditorTooltipsConfig) {
    this.editor = editor;
    this.config = config;
    this.renderer = new TeactRenderer<RichEditorTooltipContainerProps>(RichEditorTooltipContainer, {
      props: this.buildRendererProps(),
    });
    const tooltipBoundary = config.getTooltipBoundary?.() || editor.view.dom.parentElement!;
    this.renderer.element.classList.add('rich-editor-tooltips-host');
    tooltipBoundary.append(this.renderer.element);
    window.addEventListener('resize', this.handleFormatterViewportChange);
    document.addEventListener('scroll', this.handleFormatterViewportChange, true);
    document.addEventListener('pointerdown', this.handleDocumentPointerDown, true);
    this.releaseKeyboardListener = captureKeyboardListeners({
      onEnter: this.handleEnter,
      onEsc: this.handleEscape,
    });
    this.resizeObserver = new ResizeObserver(this.handleTooltipResize);
    this.resizeObserver.observe(this.renderer.element);
    this.hideHost();
  }

  public updateSuggestion(surface: RichEditorTooltipSurface, props: RichEditorTooltipSuggestion) {
    if (this.isDestroyed || !this.config[surface]?.isEnabled()) {
      return;
    }

    this.suggestions.set(surface, props);
    this.clearFade(surface);
    this.closingSuggestions.delete(surface);
    this.clearFade('formatter');
    this.closingFormatterRange = undefined;
    this.formatterRange = undefined;
    this.formatterControlRequest = undefined;
    this.render();
  }

  public removeSuggestion(surface: RichEditorTooltipSurface) {
    if (this.isDestroyed) {
      return;
    }

    const suggestion = this.suggestions.get(surface);
    this.suggestions.delete(surface);
    if (suggestion) {
      this.closingSuggestions.set(surface, suggestion);
      this.scheduleFade(surface, () => this.closingSuggestions.delete(surface));
    }
    this.render();
  }

  public updateFormatter(range?: TiptapRange, hasDocChanged = false) {
    if (this.isDestroyed) {
      return;
    }

    if (hasDocChanged && !range) {
      this.clearFade('formatter');
      this.closingFormatterRange = undefined;
      this.formatterControlRequest = undefined;
      if (this.formatterRange) {
        this.formatterRange = undefined;
        this.render();
      }
      return;
    }

    const hadClosingFormatter = Boolean(this.closingFormatterRange);
    const hadRenderedFormatter = Boolean(this.formatterRange || this.closingFormatterRange);
    if (hasDocChanged && hadClosingFormatter) {
      this.clearFade('formatter');
      this.closingFormatterRange = undefined;
    }

    if (isSameRange(this.formatterRange, range)) {
      if (range) {
        if (hasDocChanged) {
          this.formatterRange = range;
          this.render(true);
        }
        this.positionFormatter();
      } else if (hadClosingFormatter) {
        this.render();
      }
      return;
    }

    if (range) {
      this.clearFade('formatter');
      this.closingFormatterRange = undefined;
    } else if (this.formatterRange) {
      this.closingFormatterRange = this.formatterRange;
      this.scheduleFade('formatter', () => {
        this.closingFormatterRange = undefined;
      });
    }
    this.formatterControlRequest = undefined;
    this.formatterRange = range;
    if (range && hadRenderedFormatter) {
      this.positionFormatter();
      this.render(true);
    } else {
      this.render();
    }
  }

  public handleSuggestionKeyDown(surface: RichEditorTooltipSurface, event: KeyboardEvent) {
    if (surface !== this.getElectedSurface() || event.isComposing) {
      return false;
    }

    if (event.key === 'Escape' || event.key === 'Esc') {
      event.preventDefault();
      this.closeSuggestions();
      return true;
    }

    const items = this.getKeyboardItems(surface);
    const isInlineGallery = surface === 'inlineBot' && this.getInlineBot()?.isGallery;
    const isPointerDriven = surface === 'customEmoji' || surface === 'sticker';
    const isHorizontal = surface === 'emoji';
    const direction = isHorizontal
      ? event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : undefined
      : event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : undefined;

    if (direction && !isPointerDriven && !isInlineGallery && items.length) {
      event.preventDefault();
      this.selectedIndex = cycleRestrict(items.length, this.selectedIndex + direction);
      this.render();
      return true;
    }

    const canSelect = event.key === 'Enter' || (event.key === 'Tab' && surface === 'mention');
    if (!canSelect || isPointerDriven || this.selectedIndex < 0) {
      return false;
    }

    const item = items[this.selectedIndex];
    if (!item) {
      return false;
    }

    event.preventDefault();
    requestMutation(() => {
      if (!this.isDestroyed && !this.editor.isDestroyed && surface === this.getElectedSurface()) {
        this.selectItem(surface, item);
      }
    });
    return true;
  }

  public openFormatterControl(control: RichEditorFormatterControl) {
    if (this.isDestroyed || !this.formatterRange || this.editor.isDestroyed) {
      return false;
    }

    this.formatterControlRequest = { control };
    this.render(true);
    return true;
  }

  public closeFormatter = () => {
    if (!this.formatterRange || this.editor.isDestroyed) {
      return;
    }

    const range = this.formatterRange;
    const head = Math.max(range.from, Math.min(this.editor.state.selection.head, range.to));
    this.closingFormatterRange = range;
    this.formatterControlRequest = undefined;
    this.scheduleFade('formatter', () => {
      this.closingFormatterRange = undefined;
    });
    this.formatterRange = undefined;
    this.editor.view.dispatch(this.editor.state.tr.setSelection(TextSelection.create(this.editor.state.doc, head)));
    this.render();
  };

  public hasActiveTooltip() {
    return Boolean(this.formatterRange || this.suggestions.size);
  }

  public setFormatterDismissalBlocked = (isBlocked: boolean) => {
    this.isFormatterDismissalBlocked = isBlocked;
  };

  public destroy() {
    if (this.isDestroyed) {
      return;
    }

    this.isDestroyed = true;
    this.renderGeneration++;
    this.mountGeneration++;
    this.unmountSuggestion?.();
    this.unmountSuggestion = undefined;
    window.removeEventListener('resize', this.handleFormatterViewportChange);
    document.removeEventListener('scroll', this.handleFormatterViewportChange, true);
    document.removeEventListener('pointerdown', this.handleDocumentPointerDown, true);
    this.releaseKeyboardListener();
    this.resizeObserver.disconnect();
    this.fadeTimeouts.forEach((timeout) => window.clearTimeout(timeout));
    this.fadeTimeouts.clear();
    this.renderer.destroy();
    this.renderer.element.remove();
  }

  private render(shouldKeepFormatterVisible = false) {
    if (this.isDestroyed) {
      return;
    }

    const surface = this.getElectedSurface();
    const itemCount = surface ? this.getKeyboardItems(surface).length : 0;
    if (this.mountedSurface !== surface) {
      this.selectedIndex = surface === 'emoji' || this.getInlineBot()?.isGallery ? -1 : 0;
    } else if (this.selectedIndex >= itemCount) {
      this.selectedIndex = itemCount ? 0 : -1;
    }

    const rendererProps = this.buildRendererProps();
    const shouldPositionFormatter = Boolean(rendererProps.formatter);
    const shouldHideHost = !rendererProps.formatter && !rendererProps.surface;
    const renderGeneration = ++this.renderGeneration;
    requestMutation(() => {
      if (this.isDestroyed || renderGeneration !== this.renderGeneration) {
        return;
      }

      const isSuggestion = Boolean(rendererProps.surface);
      this.renderer.element.classList.toggle(FORMATTER_HOST_CLASS, Boolean(rendererProps.formatter));
      this.renderer.element.classList.toggle(SUGGESTION_HOST_CLASS, isSuggestion);
      if (this.formatterRange && !shouldKeepFormatterVisible) {
        this.renderer.element.style.visibility = 'hidden';
      }
      this.renderer.updateProps(rendererProps);
      this.mountSuggestion(surface);
      if (shouldPositionFormatter) {
        this.prepareFormatterHost();
        if (!shouldKeepFormatterVisible) {
          this.positionFormatter();
        }
      } else if (shouldHideHost) {
        this.renderer.element.style.visibility = 'hidden';
      }
    });
  }

  private buildRendererProps(): RichEditorTooltipContainerProps {
    const surface = this.getRenderedSurface();
    const formatterRange = this.formatterRange || this.closingFormatterRange;
    return {
      editor: this.editor,
      surface,
      suggestion: surface ? this.getSuggestion(surface) : undefined,
      customEmojiSuggestion: this.getSuggestion('customEmoji'),
      stickerSuggestion: this.getSuggestion('sticker'),
      formatter: formatterRange && this.config.formatter ? {
        range: formatterRange,
        capabilities: this.config.formatter.capabilities,
        controlRequest: this.formatterControlRequest,
      } : undefined,
      isOpen: Boolean(surface && this.suggestions.has(surface)),
      isCustomEmojiOpen: this.suggestions.has('customEmoji'),
      isStickerOpen: this.suggestions.has('sticker'),
      isFormatterOpen: Boolean(this.formatterRange),
      selectedIndex: this.selectedIndex,
      config: this.config,
      context: this.config.getContext(),
      onCloseFormatter: this.closeFormatter,
      onFormatterDismissalChange: this.setFormatterDismissalBlocked,
    };
  }

  private getElectedSurface() {
    if (this.formatterRange || this.closingFormatterRange) {
      return undefined;
    }

    return SURFACE_PRIORITY.find((surface) => this.suggestions.has(surface));
  }

  private getRenderedSurface() {
    if (this.formatterRange || this.closingFormatterRange) {
      return undefined;
    }

    return this.getElectedSurface()
      || SURFACE_PRIORITY.find((surface) => this.closingSuggestions.has(surface));
  }

  private getSuggestion(surface: RichEditorTooltipSurface) {
    return this.suggestions.get(surface) || this.closingSuggestions.get(surface);
  }

  private mountSuggestion(surface?: RichEditorTooltipSurface) {
    if (surface === this.mountedSurface) {
      return;
    }

    const mountGeneration = ++this.mountGeneration;
    this.unmountSuggestion?.();
    this.unmountSuggestion = undefined;
    this.mountedSurface = surface;
    if (!surface) {
      return;
    }

    this.renderer.element.style.visibility = 'hidden';
    this.prepareSuggestionHost();
    // Floating UI measures synchronously outside the DOM mutation phase
    window.setTimeout(() => {
      if (!this.canMountSuggestion(surface, mountGeneration)) {
        return;
      }

      const suggestion = this.suggestions.get(surface);
      if (!suggestion) {
        return;
      }

      const unmountSuggestion = suggestion.mount(this.renderer.element, {
        onPosition: ({ y, placement }) => {
          this.positionSuggestion(surface, mountGeneration, y, placement.startsWith('top'));
        },
      });
      if (!this.canMountSuggestion(surface, mountGeneration)) {
        unmountSuggestion();
        return;
      }

      this.unmountSuggestion = unmountSuggestion;
    }, 0);
  }

  private canMountSuggestion(surface: RichEditorTooltipSurface, mountGeneration: number) {
    return !this.isDestroyed
      && mountGeneration === this.mountGeneration
      && surface === this.mountedSurface
      && surface === this.getElectedSurface();
  }

  private positionSuggestion(
    surface: RichEditorTooltipSurface,
    mountGeneration: number,
    y: number,
    isPlacedAbove: boolean,
  ) {
    requestMeasure(() => {
      if (!this.canMountSuggestion(surface, mountGeneration)) {
        return;
      }

      const element = this.renderer.element;
      // Top-placed tooltips grow upward without moving their bottom edge
      const anchoredY = isPlacedAbove ? y + element.getBoundingClientRect().height : y;
      requestMutation(() => {
        if (!this.canMountSuggestion(surface, mountGeneration)) {
          return;
        }

        element.style.top = `${anchoredY}px`;
        element.style.bottom = '';
        element.style.transform = isPlacedAbove ? 'translateY(-100%)' : '';
        element.style.visibility = '';
      });
    });
  }

  private positionFormatter(attempt = 0) {
    const range = this.formatterRange || this.closingFormatterRange;
    if (!range || this.editor.isDestroyed) {
      return;
    }

    requestMeasure(() => {
      const currentRange = this.formatterRange || this.closingFormatterRange;
      if (this.isDestroyed || !isSameRange(range, currentRange) || this.editor.isDestroyed) {
        return;
      }

      const selectionRect = posToDOMRect(this.editor.view, range.from, range.to);
      const element = this.renderer.element;
      const formatterElement = element.querySelector<HTMLElement>('[data-text-formatter]');
      const hostRect = element.getBoundingClientRect();
      const formatterRect = formatterElement?.getBoundingClientRect();
      if (!formatterRect?.width || !formatterRect.height || !hostRect.width) {
        if (attempt >= MAX_FORMATTER_POSITION_ATTEMPTS) {
          return;
        }

        requestMutation(() => {
          const nextRange = this.formatterRange || this.closingFormatterRange;
          if (this.isDestroyed || !isSameRange(range, nextRange)) {
            return;
          }

          element.style.visibility = 'hidden';
          this.positionFormatter(attempt + 1);
        });
        return;
      }

      const centeredLeft = selectionRect.left - hostRect.left
        + (selectionRect.width - formatterRect.width) / 2;
      const maxLeft = Math.max(0, hostRect.width - formatterRect.width);
      const left = Math.max(0, Math.min(centeredLeft, maxLeft));
      const shouldPlaceBelow = selectionRect.top < formatterRect.height + TOOLTIP_GAP_PX;
      const top = shouldPlaceBelow
        ? selectionRect.bottom + TOOLTIP_GAP_PX
        : selectionRect.top - TOOLTIP_GAP_PX - formatterRect.height;
      const position = getLocalPosition(element, hostRect, hostRect.left + left, top);

      requestMutation(() => {
        const nextRange = this.formatterRange || this.closingFormatterRange;
        if (this.isDestroyed || !isSameRange(range, nextRange)) {
          return;
        }

        element.style.setProperty('--text-formatter-left', `${position.left}px`);
        element.style.top = `${position.top}px`;
        element.style.bottom = '';
        element.style.visibility = '';
      });
    });
  }

  private closeSuggestions() {
    if (this.editor.isDestroyed) {
      return;
    }

    Object.values(PLUGIN_KEYS).forEach((pluginKey) => {
      exitSuggestion(this.editor.view, pluginKey);
    });
  }

  private getKeyboardItems(surface: RichEditorTooltipSurface): RichEditorTooltipItem[] {
    if (surface === 'inlineBot') {
      return this.getInlineBot()?.results || [];
    }

    return this.suggestions.get(surface)?.items || [];
  }

  private getInlineBot() {
    const suggestion = this.suggestions.get('inlineBot');
    const query = parseInlineBotQuery(suggestion?.text);
    if (!query) {
      return undefined;
    }

    return this.config.getContext().inlineBots?.[query.username.toLowerCase()] || undefined;
  }

  private selectItem(surface: RichEditorTooltipSurface, item: RichEditorTooltipItem) {
    if (surface === 'inlineBot') {
      const inlineBot = this.getInlineBot();
      if (inlineBot && 'queryId' in item) {
        this.config.inlineBot?.onSelect(inlineBot.id, item);
      }
      return;
    }

    this.suggestions.get(surface)?.command(item);
  }

  private hideHost() {
    requestMutation(() => {
      if (!this.isDestroyed) {
        this.renderer.element.style.visibility = 'hidden';
      }
    });
  }

  private prepareFormatterHost() {
    const element = this.renderer.element;
    element.style.transform = '';
    if (!element.style.top && !element.style.bottom) {
      element.style.top = '0px';
    }
  }

  private prepareSuggestionHost() {
    const element = this.renderer.element;
    element.style.bottom = '';
    element.style.transform = '';
    element.style.removeProperty('--text-formatter-left');
    if (!element.style.top) {
      element.style.top = '0px';
    }
  }

  private handleFormatterViewportChange = () => {
    if (this.formatterRange || this.closingFormatterRange) {
      this.positionFormatter();
    }
  };

  private handleTooltipResize = () => {
    if (this.formatterRange || this.closingFormatterRange) {
      this.positionFormatter();
    }
  };

  private handleEnter = (event: KeyboardEvent) => {
    const surface = this.getElectedSurface();
    return surface ? this.handleSuggestionKeyDown(surface, event) : false;
  };

  private handleEscape = (event: KeyboardEvent) => {
    if (this.formatterRange) {
      event.preventDefault();
      this.closeFormatter();
      return true;
    }

    if (this.suggestions.size) {
      event.preventDefault();
      this.closeSuggestions();
      return true;
    }

    return false;
  };

  private handleDocumentPointerDown = (event: PointerEvent) => {
    if (
      this.isDestroyed
      || this.editor.isDestroyed
      || !(event.target instanceof Node)
      || this.renderer.element.contains(event.target)
    ) {
      return;
    }

    // Multiple suggestion plugins can be active for the same input
    if (this.suggestions.size) {
      this.closeSuggestions();
    }

    if (this.formatterRange && !this.isFormatterDismissalBlocked) {
      this.closeFormatter();
    }
  };

  private scheduleFade(key: RichEditorTooltipSurface | 'formatter', onEnd: NoneToVoidFunction) {
    this.clearFade(key);
    const timeout = window.setTimeout(() => {
      this.fadeTimeouts.delete(key);
      onEnd();
      this.render();
    }, FADE_DURATION_MS);
    this.fadeTimeouts.set(key, timeout);
  }

  private clearFade(key: RichEditorTooltipSurface | 'formatter') {
    const timeout = this.fadeTimeouts.get(key);
    if (timeout) {
      window.clearTimeout(timeout);
      this.fadeTimeouts.delete(key);
    }
  }
}

function isSameRange(first?: TiptapRange, second?: TiptapRange) {
  return first?.from === second?.from && first?.to === second?.to;
}

function getLocalPosition(element: HTMLElement, rect: DOMRect, left: number, top: number) {
  const scaleX = element.offsetWidth ? rect.width / element.offsetWidth : 1;
  const scaleY = element.offsetHeight ? rect.height / element.offsetHeight : 1;
  const currentLeft = Number.parseFloat(element.style.left) || 0;
  const currentTop = Number.parseFloat(element.style.top) || 0;
  const originLeft = rect.left - currentLeft * scaleX;
  const originTop = rect.top - currentTop * scaleY;
  return {
    left: (left - originLeft) / scaleX,
    top: (top - originTop) / scaleY,
  };
}
