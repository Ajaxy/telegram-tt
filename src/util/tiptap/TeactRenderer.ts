import type { FC, VirtualElement } from '../../lib/teact/teact';
import Teact from '../../lib/teact/teact';
import TeactDOM from '../../lib/teact/teact-dom';

import { suppressStrict } from '../../lib/fasterdom/fasterdom';

type TeactRendererOptions<Props extends AnyLiteral> = {
  props: Props;
  element?: HTMLElement;
};

const DEFAULT_RENDERER_ELEMENT_TAG = 'div';

export default class TeactRenderer<Props extends AnyLiteral = AnyLiteral> {
  private Component: FC<Props>;

  private props: Props;

  public element: HTMLElement;

  constructor(Component: FC<Props>, options: TeactRendererOptions<Props>) {
    this.Component = Component;
    this.props = options.props;
    this.element = options.element || document.createElement(DEFAULT_RENDERER_ELEMENT_TAG);

    suppressStrict(() => this.render());
  }

  public updateProps(props: Props) {
    this.props = props;
    this.render();
  }

  public destroy() {
    TeactDOM.render(undefined, this.element);
  }

  private render() {
    TeactDOM.render(
      Teact.createElement(this.Component, this.props) as VirtualElement,
      this.element,
    );
  }
}
