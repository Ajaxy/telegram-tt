const units = ['bytes', 'kB', 'MB', 'GB', 'TB', 'PB'];

export default (bytes: number) => {
  const number = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / 1024 ** Math.floor(number)).toFixed(1)} ${units[number]}`;
};
