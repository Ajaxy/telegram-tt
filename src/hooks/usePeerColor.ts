import { useRef } from '@teact';

import type { ApiPeer, ApiTypePeerColor } from '../api/types';
import type { CustomPeer, ThemeKey } from '../types';

import { getPeerColorCollectibleColorCount, getPeerColorCount, getPeerColorKey } from '../global/helpers';
import buildStyle from '../util/buildStyle';
import { generateColorVariations, generatePeerColorGradient } from '../util/theme';
import useSyncEffect from './useSyncEffect';

type PeerColorAttributes = {
  className?: string;
  style?: string;
};

type PeerColorProperties = PeerColorAttributes & {
  backgroundEmojiId?: string;
  giftEmojiId?: string;
};

export default function usePeerColor({
  peer,
  color,
  noUserColors,
  shouldReset,
  theme,
}: {
  peer?: ApiPeer | CustomPeer;
  color?: ApiTypePeerColor;
  noUserColors?: boolean;
  shouldReset?: boolean;
  theme: ThemeKey;
}): PeerColorProperties {
  const propertiesRef = useRef<PeerColorAttributes>({});
  const realPeer = peer && !('isCustomPeer' in peer) ? peer : undefined;

  useSyncEffect(() => {
    if (!peer) {
      if (!shouldReset) {
        propertiesRef.current = {};
        return;
      }

      propertiesRef.current = {
        className: noUserColors ? getPeerColorCountClass(1) : getPeerColorClass(0),
      };
      return;
    }

    if ('isCustomPeer' in peer) {
      if (peer.peerColorId === undefined) {
        propertiesRef.current = {};
        return;
      }

      propertiesRef.current = { className: `peer-color-${peer.peerColorId}`, style: undefined };
      return;
    }

    const peerColor = color || peer.color;
    const isCollectible = peerColor?.type === 'collectible';
    const colorCount = peer ? getPeerColorCount(peer)
      : isCollectible ? getPeerColorCollectibleColorCount(peerColor) : 1;
    const colorCountClass = getPeerColorCountClass(colorCount);
    const key = (isCollectible || !peerColor?.color) ? getPeerColorKey(peer) : peerColor.color;

    if (noUserColors) {
      propertiesRef.current = { className: colorCountClass };
      return;
    }

    if (peerColor?.type === 'collectible' && !noUserColors) {
      const accentColor = theme === 'dark' && peerColor.darkAccentColor
        ? peerColor.darkAccentColor : peerColor.accentColor;
      const colors = theme === 'dark' && peerColor.darkColors ? peerColor.darkColors : peerColor.colors;
      const gradient = generatePeerColorGradient(colors);
      const { bg, bgActive } = generateColorVariations(accentColor);
      propertiesRef.current = {
        className: colorCountClass,
        style: buildStyle(
          `--bar-gradient: ${gradient}`,
          `--accent-color: ${accentColor}`,
          `--accent-background-color: ${bg}`,
          `--accent-background-active-color: ${bgActive}`,
        ),
      };
      return;
    }

    const className = (noUserColors || key === undefined) ? colorCountClass : getPeerColorClass(key);
    propertiesRef.current = { className, style: undefined };
  }, [noUserColors, shouldReset, theme, color, peer]);

  return {
    style: propertiesRef.current.style,
    className: propertiesRef.current.className,
    backgroundEmojiId: realPeer?.color?.backgroundEmojiId,
    giftEmojiId: realPeer?.color?.type === 'collectible' ? realPeer.color.giftEmojiId : undefined,
  };
}

export function getPeerColorClass(colorIndex: number) {
  return `peer-color-${colorIndex}`;
}

export function getPeerColorCountClass(colorCount: number) {
  return `peer-color-count-${colorCount}`;
}
