import blankUrl from '../../assets/blank.png';

const QR_MARGIN = 10;
const QR_IMAGE_SIZE_RATIO = 0.3;
const QR_IMAGE_MARGIN = 8;

type CreateStyledQrCodeOptions = {
  size: number;
  margin?: number;
  color?: string;
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
// When `color` is passed, the dots and corners are tinted with it.
export async function createStyledQrCode({
  size,
  margin = QR_MARGIN,
  color,
  image = blankUrl,
  imageSize = QR_IMAGE_SIZE_RATIO,
}: CreateStyledQrCodeOptions) {
  const QrCodeStyling = (await ensureQrCodeStyling()).default;

  // An undefined color would override the library default
  const colorOptions = color ? { color } : undefined;

  return new QrCodeStyling({
    width: size,
    height: size,
    image,
    margin,
    type: 'svg',
    dotsOptions: {
      type: 'rounded',
      ...colorOptions,
    },
    cornersSquareOptions: {
      type: 'extra-rounded',
      ...colorOptions,
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
