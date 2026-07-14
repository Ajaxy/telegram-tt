import type { QrCodeGradient } from 'qr-code-styling';

import blankUrl from '../../assets/blank.png';

const QR_MARGIN = 10;
const QR_IMAGE_SIZE_RATIO = 0.3;
const QR_IMAGE_MARGIN = 8;
const QR_GRADIENT_ROTATION = Math.PI / 4; // 45deg diagonal, matches the Telegram brand gradient direction

export type QrGradientStops = {
  from: string;
  to: string;
};

type CreateStyledQrCodeOptions = {
  size: number;
  gradient?: QrGradientStops;
  image?: string;
  imageSize?: number;
};

let qrCodeStylingPromise: Promise<typeof import('qr-code-styling')> | undefined;

function ensureQrCodeStyling() {
  if (!qrCodeStylingPromise) {
    qrCodeStylingPromise = import('qr-code-styling').catch((err) => {
      qrCodeStylingPromise = undefined;
      throw err;
    });
  }
  return qrCodeStylingPromise;
}

// Builds a Telegram-styled QR instance shared by the auth flow and the share-QR modal.
// When `gradient` is passed, the dots and corners are tinted with a diagonal linear gradient.
export async function createStyledQrCode({
  size,
  gradient,
  image = blankUrl,
  imageSize = QR_IMAGE_SIZE_RATIO,
}: CreateStyledQrCodeOptions) {
  const QrCodeStyling = (await ensureQrCodeStyling()).default;

  const dotsGradient: QrCodeGradient | undefined = gradient ? {
    type: 'linear',
    rotation: QR_GRADIENT_ROTATION,
    colorStops: [
      { offset: 0, color: gradient.from },
      { offset: 1, color: gradient.to },
    ],
  } : undefined;

  return new QrCodeStyling({
    width: size,
    height: size,
    image,
    margin: QR_MARGIN,
    type: 'svg',
    dotsOptions: {
      type: 'rounded',
      gradient: dotsGradient,
    },
    cornersSquareOptions: {
      type: 'extra-rounded',
      gradient: dotsGradient,
    },
    imageOptions: {
      imageSize,
      margin: QR_IMAGE_MARGIN,
    },
    qrOptions: {
      errorCorrectionLevel: 'M',
    },
  });
}
