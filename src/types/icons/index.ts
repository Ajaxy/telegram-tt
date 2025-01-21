import type { DeviceIconName } from './device';
import type { FontIconName } from './font';

export type CharacterIconName = 'char';
export type PlaceholderIconName = 'placeholder';

export type IconName = FontIconName | DeviceIconName | CharacterIconName | PlaceholderIconName;
