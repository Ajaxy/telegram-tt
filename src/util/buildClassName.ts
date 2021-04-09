type Parts = (string | false | undefined)[];

export default (...parts: Parts) => {
  return parts.filter(Boolean).join(' ');
};
