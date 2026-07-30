import type {
  Editor,
  EditorEvents,
  NodeViewProps,
  NodeViewRenderer,
  NodeViewRendererOptions,
  NodeViewRendererProps,
} from '@tiptap/core';
import { isNodeViewSelected, NodeView } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Decoration, DecorationSource } from '@tiptap/pm/view';
import type { FC } from '../../lib/teact/teact';

import { requestMutation } from '../../lib/fasterdom/fasterdom';

import { TeactNodeViewContext } from './TeactNodeViewContext';
import TeactRenderer from './TeactRenderer';

export type TeactNodeViewComponentProps = NodeViewProps & {
  contentDOMElement?: HTMLElement;
};

export type TeactNodeViewComponent = FC<TeactNodeViewComponentProps>;

export type TeactNodeViewRendererOptions = Partial<NodeViewRendererOptions> & {
  as?: string;
  className?: string;
  contentDOMClassName?: string;
  shouldUpdateOnTransaction?: (event: EditorEvents['transaction']) => boolean;
};

type TeactNodeViewOptions = NodeViewRendererOptions & {
  as: string;
  className?: string;
  contentDOMClassName?: string;
  shouldUpdateOnTransaction?: (event: EditorEvents['transaction']) => boolean;
};

type TeactNodeViewRootProps = {
  Component: TeactNodeViewComponent;
  componentProps: TeactNodeViewComponentProps;
  contentDOMElement?: HTMLElement;
};

type TeactNodeViewEventHandler = AnyToVoidFunction;

const DEFAULT_NODE_VIEW_ELEMENT_TAG = 'div';
const DEFAULT_CONTENT_DOM_ELEMENT_TAG = 'div';

const renderers = new WeakMap<TeactNodeView, TeactRenderer<TeactNodeViewRootProps>>();
const contentDOMElements = new WeakMap<TeactNodeView, HTMLElement>();
const selectedStates = new WeakMap<TeactNodeView, boolean>();
const selectionUpdateHandlers = new WeakMap<TeactNodeView, TeactNodeViewEventHandler>();
const transactionHandlers = new WeakMap<TeactNodeView, TeactNodeViewEventHandler>();

const TeactNodeViewRoot = ({
  Component,
  componentProps,
  contentDOMElement,
}: TeactNodeViewRootProps) => {
  const contextValue = { contentDOMElement };

  return (
    <TeactNodeViewContext.Provider value={contextValue}>
      <Component {...componentProps} />
    </TeactNodeViewContext.Provider>
  );
};

class TeactNodeView extends NodeView<TeactNodeViewComponent, Editor, TeactNodeViewOptions> {
  public mount() {
    const element = document.createElement(this.options.as);
    if (this.options.className) {
      element.className = this.options.className;
    }

    if (!this.node.isLeaf && !this.node.isAtom) {
      const contentDOMElement = document.createElement(this.options.contentDOMElementTag);
      contentDOMElement.dataset.nodeViewContent = '';
      if (this.options.contentDOMClassName) {
        contentDOMElement.className = this.options.contentDOMClassName;
      }
      contentDOMElements.set(this, contentDOMElement);
    }

    selectedStates.set(this, this.isSelected());
    renderers.set(this, new TeactRenderer(TeactNodeViewRoot, {
      element,
      props: this.buildRootProps(),
    }));

    const handleSelectionUpdate = () => {
      this.updateSelection();
    };
    selectionUpdateHandlers.set(this, handleSelectionUpdate);
    this.editor.on('selectionUpdate', handleSelectionUpdate);

    const { shouldUpdateOnTransaction, trackNodeViewPosition } = this.options;
    if (trackNodeViewPosition || shouldUpdateOnTransaction) {
      const handleTransaction = (event: EditorEvents['transaction']) => {
        if (trackNodeViewPosition || shouldUpdateOnTransaction?.(event)) {
          this.updateRenderer();
        }
      };
      transactionHandlers.set(this, handleTransaction);
      this.editor.on('transaction', handleTransaction);
    }
  }

  public get dom(): HTMLElement {
    return renderers.get(this)!.element;
  }

  public get contentDOM(): NodeView<TeactNodeViewComponent, Editor, TeactNodeViewOptions>['contentDOM'] {
    return contentDOMElements.get(this) || super.contentDOM;
  }

  public update(
    node: ProseMirrorNode,
    decorations: readonly Decoration[],
    innerDecorations: DecorationSource,
  ) {
    if (node.type !== this.node.type) {
      return false;
    }

    this.node = node;
    this.decorations = decorations;
    this.innerDecorations = innerDecorations;
    const isSelectionUpdated = this.updateSelection(true);
    if (!isSelectionUpdated) {
      this.updateRenderer();
    }

    return true;
  }

  public selectNode() {
    this.setIsSelected(true);
  }

  public deselectNode() {
    this.setIsSelected(false);
  }

  public destroy() {
    const handleSelectionUpdate = selectionUpdateHandlers.get(this);
    if (handleSelectionUpdate) {
      this.editor.off('selectionUpdate', handleSelectionUpdate);
    }
    selectionUpdateHandlers.delete(this);

    const handleTransaction = transactionHandlers.get(this);
    if (handleTransaction) {
      this.editor.off('transaction', handleTransaction);
      transactionHandlers.delete(this);
    }

    renderers.get(this)?.destroy();
    renderers.delete(this);
    contentDOMElements.delete(this);
    selectedStates.delete(this);
  }

  private buildRootProps(): TeactNodeViewRootProps {
    const contentDOMElement = contentDOMElements.get(this);

    return {
      Component: this.component,
      componentProps: {
        editor: this.editor,
        node: this.node,
        decorations: this.decorations as NodeViewProps['decorations'],
        innerDecorations: this.innerDecorations,
        view: this.view,
        getPos: this.getPos,
        extension: this.extension,
        HTMLAttributes: this.HTMLAttributes,
        selected: selectedStates.get(this) || false,
        updateAttributes: this.updateAttributes.bind(this),
        deleteNode: this.deleteNode.bind(this),
        contentDOMElement,
      },
      contentDOMElement,
    };
  }

  private updateRenderer() {
    requestMutation(() => {
      renderers.get(this)?.updateProps(this.buildRootProps());
    });
  }

  private updateSelection(force?: boolean) {
    const isSelected = this.isSelected();
    if (!force && selectedStates.get(this) === isSelected) {
      return false;
    }

    return this.setIsSelected(isSelected);
  }

  private setIsSelected(isSelected: boolean) {
    if (selectedStates.get(this) === isSelected) {
      return false;
    }

    selectedStates.set(this, isSelected);
    this.updateRenderer();
    return true;
  }

  private isSelected() {
    const pos = this.getPos();
    if (typeof pos !== 'number') {
      return false;
    }

    return isNodeViewSelected({
      selection: this.editor.state.selection,
      pos,
      nodeSize: this.node.nodeSize,
      selectedOnTextSelection: this.options.selectedOnTextSelection,
    });
  }
}

export default function TeactNodeViewRenderer(
  Component: TeactNodeViewComponent,
  options: TeactNodeViewRendererOptions = {},
): NodeViewRenderer {
  const resolvedOptions = buildResolvedOptions(options);

  return (props: NodeViewRendererProps) => {
    return new TeactNodeView(Component, props, resolvedOptions);
  };
}

function buildResolvedOptions(options: TeactNodeViewRendererOptions): Partial<TeactNodeViewOptions> {
  const resolvedOptions: Partial<TeactNodeViewOptions> = {
    as: options.as || DEFAULT_NODE_VIEW_ELEMENT_TAG,
    className: options.className,
    contentDOMElementTag: options.contentDOMElementTag || DEFAULT_CONTENT_DOM_ELEMENT_TAG,
    contentDOMClassName: options.contentDOMClassName,
    selectedOnTextSelection: options.selectedOnTextSelection,
    shouldUpdateOnTransaction: options.shouldUpdateOnTransaction,
    trackNodeViewPosition: options.trackNodeViewPosition,
  };

  if (options.stopEvent !== undefined) {
    resolvedOptions.stopEvent = options.stopEvent;
  }

  if (options.ignoreMutation !== undefined) {
    resolvedOptions.ignoreMutation = options.ignoreMutation;
  }

  return resolvedOptions;
}
