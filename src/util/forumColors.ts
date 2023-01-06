import blue from '../assets/icons/forumTopic/blue.svg';
import green from '../assets/icons/forumTopic/green.svg';
import grey from '../assets/icons/forumTopic/grey.svg';
import red from '../assets/icons/forumTopic/red.svg';
import rose from '../assets/icons/forumTopic/rose.svg';
import violet from '../assets/icons/forumTopic/violet.svg';
import yellow from '../assets/icons/forumTopic/yellow.svg';

// eslint-disable-next-line max-len
// https://github.com/telegramdesktop/tdesktop/blob/1aece79a471d99a8b63d826b1bce1f36a04d7293/Telegram/SourceFiles/data/data_forum_topic.cpp#L50
const TOPIC_MAPPING: Record<number, [string, string]> = {
  0x6FB9F0: [blue, 'blue'],
  0xFFD67E: [yellow, 'yellow'],
  0xCB86DB: [violet, 'violet'],
  0x8EEE98: [green, 'green'],
  0xFF93B2: [rose, 'rose'],
  0xFB6F5F: [red, 'red'],
};

export function getTopicColors() {
  return Object.keys(TOPIC_MAPPING).map((key) => parseInt(key, 10));
}

export function getTopicDefaultIcon(iconColor?: number) {
  return (iconColor && TOPIC_MAPPING[iconColor as keyof typeof TOPIC_MAPPING][0]) || grey;
}

export function getTopicColorCssVariable(iconColor?: number) {
  const color = (iconColor && TOPIC_MAPPING[iconColor as keyof typeof TOPIC_MAPPING][1]) || 'grey';
  return `--color-topic-${color}`;
}
