const units = ['bytes', 'kB', 'MB', 'GB', 'TB', 'PB'];

export default (bytes: number) => {
  const number = bytes === 0 ? 0 : Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / 1024 ** Math.floor(number)).toFixed(1)} ${units[number]}`;
};
