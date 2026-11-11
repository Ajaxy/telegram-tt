import captureKeyboardListener from './captureKeyboardListeners';

type IHandlerFunction = () => void;

export default function captureEscKeyListener(handler: IHandlerFunction, targetDocument = document) {
  return captureKeyboardListener({ onEsc: handler }, targetDocument);
}
