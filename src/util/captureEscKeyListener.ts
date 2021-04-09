import captureKeyboardListener from './captureKeyboardListeners';

type IHandlerFunction = () => void;

export default function captureEscKeyListener(handler: IHandlerFunction) {
  return captureKeyboardListener({ onEsc: handler });
}
