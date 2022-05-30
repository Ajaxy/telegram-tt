import type React from '../lib/teact/teact';

const stopEvent = (e: React.UIEvent | Event) => {
  e.stopPropagation();
  e.preventDefault();
};

export default stopEvent;
