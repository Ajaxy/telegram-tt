type QrCodeStylingOptions = {
  width?: number;
  height?: number;
  data?: string;
  image?: string;
  margin?: number;
  type?: 'svg' | 'canvas';
  dotsOptions?: {
    type?: string;
  };
  cornersSquareOptions?: {
    type?: string;
  };
  imageOptions?: {
    imageSize?: number;
    margin?: number;
  };
  qrOptions?: {
    errorCorrectionLevel?: string;
  };
};

export default class QrCodeStyling {
  constructor(options: QrCodeStylingOptions);

  update(options: QrCodeStylingOptions): void;

  append(container?: HTMLElement): void;
}
