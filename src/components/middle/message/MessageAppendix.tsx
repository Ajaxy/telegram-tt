import React from '../../../lib/teact/teact';

interface OwnProps {
  isOwn?: boolean;
}

function MessageAppendix({ isOwn } : OwnProps) {
  const path = isOwn
    ? 'M6 17H0V0c.193 2.84.876 5.767 2.05 8.782.904 2.325 2.446 4.485 4.625 6.48A1 1 0 016 17z'
    : 'M3 17h6V0c-.193 2.84-.876 5.767-2.05 8.782-.904 2.325-2.446 4.485-4.625 6.48A1 1 0 003 17z';
  return (
    <svg width="9" height="20" className="svg-appendix">
      <defs>
        <filter x="-50%" y="-14.7%" width="200%" height="141.2%" filterUnits="objectBoundingBox" id="messageAppendix">
          <feOffset dy="1" in="SourceAlpha" result="shadowOffsetOuter1" />
          <feGaussianBlur stdDeviation="1" in="shadowOffsetOuter1" result="shadowBlurOuter1" />
          <feColorMatrix
            values="0 0 0 0 0.0621962482 0 0 0 0 0.138574144 0 0 0 0 0.185037364 0 0 0 0.15 0"
            in="shadowBlurOuter1"
          />
        </filter>
      </defs>
      <g fill="none" fill-rule="evenodd">
        <path d={path} fill="#000" filter="url(#messageAppendix)" />
        <path d={path} fill={isOwn ? '#EEFFDE' : 'FFF'} className="corner" />
      </g>
    </svg>
  );
}

export default MessageAppendix;
