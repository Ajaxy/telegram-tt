export const formatTemperature = (temperatureC: number) => {
  const isFahrenheit = Boolean(navigator.language === 'en-US');
  return isFahrenheit ? `${Math.round((temperatureC * 9) / 5 + 32)}°F` : `${Math.round(temperatureC)}°C`;
};
