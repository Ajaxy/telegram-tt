import React from '../lib/teact/teact';

export default (e: React.UIEvent | Event) => {
  e.stopPropagation();
  e.preventDefault();
};
