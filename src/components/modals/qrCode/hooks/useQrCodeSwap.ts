import type { ElementRef } from '../../../../lib/teact/teact';
import { useLayoutEffect, useRef } from '../../../../lib/teact/teact';

import type { QrSwapEffect, QrSwapGeometry } from '../helpers/qrSwapEffect';

import { requestMeasure, requestMutation } from '../../../../lib/fasterdom/fasterdom';
import { animate } from '../../../../util/animation';
import { buildQrSwapCode, createQrSwapEffect, QR_SWAP_MARGIN } from '../helpers/qrSwapEffect';

import useLastCallback from '../../../../hooks/useLastCallback';
import useWindow from '../../../../hooks/useWindow';

const MAX_PIXEL_RATIO = 2;

export default function useQrCodeSwap({
  isOpen, canAnimate, svgSize, svgMargin, canvasRef, cardRef, containerRef,
}: {
  isOpen: boolean;
  canAnimate?: boolean;
  svgSize: number;
  svgMargin: number;
  canvasRef: ElementRef<HTMLCanvasElement>;
  cardRef: ElementRef<HTMLDivElement>;
  containerRef: ElementRef<HTMLDivElement>;
}) {
  const renderingWindow = useWindow();
  const effectRef = useRef<QrSwapEffect>();
  const generationRef = useRef(0);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const card = cardRef.current;
    if (!isOpen || !canAnimate || !canvas || !card) return undefined;

    const effect = createQrSwapEffect({
      canvas,
      cardElement: card,
      dpr: getPixelRatio(renderingWindow),
      schedule: (tick) => animate(tick, requestMutation),
    });
    effectRef.current = effect;

    return () => {
      generationRef.current += 1;
      effect.destroy();
      effectRef.current = undefined;
    };
  }, [isOpen, canAnimate, canvasRef, cardRef, renderingWindow]);

  const holdQrCode = useLastCallback((fromLink: string | undefined, toLink: string) => {
    return effectRef.current?.hold(fromLink, toLink) ?? false;
  });

  const presentQrCode = useLastCallback((
    link: string, svg: SVGSVGElement, moduleCount: number, isSwap: boolean,
  ) => {
    const effect = effectRef.current;
    if (!effect) return;

    generationRef.current += 1;
    const generation = generationRef.current;

    requestMeasure(() => {
      const geometry = measureGeometry(containerRef.current, cardRef.current);
      if (geometry) requestMutation(() => effect.setGeometry(geometry));
    });

    if (isSwap && effect.hasCode(link)) return;

    buildQrSwapCode({
      svg, link, moduleCount, svgSize, svgMargin, dpr: getPixelRatio(renderingWindow),
    }).then((code) => {
      if (generation !== generationRef.current) return;
      if (isSwap) {
        effect.swap(code);
      } else {
        effect.setCode(code);
      }
    }, () => {
      if (generation === generationRef.current) effect.release();
    });
  });

  const releaseQrCode = useLastCallback(() => {
    effectRef.current?.release();
  });

  return { holdQrCode, presentQrCode, releaseQrCode };
}

function measureGeometry(container?: HTMLElement, card?: HTMLElement): QrSwapGeometry | undefined {
  const outer = container?.offsetParent;
  if (!container || !card || !(outer instanceof HTMLElement)) return undefined;

  const left = QR_SWAP_MARGIN - outer.offsetLeft - container.offsetLeft;
  const top = QR_SWAP_MARGIN - outer.offsetTop - container.offsetTop;
  return {
    qrSize: container.offsetWidth,
    card: {
      left,
      top,
      right: left + card.offsetWidth,
      bottom: top + card.offsetHeight,
    },
  };
}

function getPixelRatio(renderingWindow: Window) {
  return Math.min(renderingWindow.devicePixelRatio || 1, MAX_PIXEL_RATIO);
}
