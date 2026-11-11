import { IS_EMOJI_SUPPORTED } from './browser/windowEnvironment';
import splitEmoji from './emoji/splitEmoji';

// Where the app draws emoji with its images, widgets do too, as tdesktop does in its widget painter
export default async function loadWidgetSandbox() {
  const sandbox = await import('../lib/widget-sandbox');
  if (!IS_EMOJI_SUPPORTED) sandbox.ShadowDomRenderer.emoji = splitWidgetEmoji;
  return sandbox;
}

function splitWidgetEmoji(text: string) {
  const parts = splitEmoji(text, 'small');
  return parts.some((part) => typeof part !== 'string') ? parts : undefined;
}
