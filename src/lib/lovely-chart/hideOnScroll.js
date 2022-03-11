import { debounce } from './utils';

export const hideOnScroll = (() => {
  const chartEls = [];
  const showAllDebounced = debounce(showAll, 500, true, false);
  const hideScrolledDebounced = debounce(hideScrolled, 500, false, true);

  function setup(chartEl) {
    chartEls.push(chartEl);

    if (chartEls.length === 1) {
      window.onscroll = () => {
        showAllDebounced();
        hideScrolledDebounced();
      };
    } else {
      hideScrolledDebounced();
    }
  }

  function showAll() {
    chartEls.forEach((chartEl) => {
      chartEl.classList.remove('lovely-chart--state-invisible');
    });
  }

  function hideScrolled() {
    chartEls.forEach((chartEl) => {
      const { top, bottom } = chartEl.getBoundingClientRect();
      const shouldHide = bottom < 0 || top > window.innerHeight;

      if (!chartEl.classList.contains('lovely-chart--state-invisible')) {
        chartEl.style.width = `${chartEl.scrollWidth}px`;
        chartEl.style.height = `${chartEl.scrollHeight}px`;
      }

      chartEl.classList.toggle('lovely-chart--state-invisible', shouldHide);
    });
  }

  return setup;
})();
