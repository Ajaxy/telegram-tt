import { createElement } from './minifiers';
import { captureEvents } from './captureEvents';

export function createTools(container, data, filterCallback) {
  let _element;

  _setupLayout();
  _updateFilter();

  function redraw() {
    if (_element) {
      const oldElement = _element;
      oldElement.classList.add('lovely-chart--state-hidden');
      setTimeout(() => {
        oldElement.parentNode.removeChild(oldElement);
      }, 500);
    }

    _setupLayout();
    _element.classList.add('lovely-chart--state-transparent');
    requestAnimationFrame(() => {
      _element.classList.remove('lovely-chart--state-transparent');
    });
  }

  function _setupLayout() {
    _element = createElement();
    _element.className = 'lovely-chart--tools';

    if (data.datasets.length < 2) {
      _element.className += ' lovely-chart--state-hidden';
    }

    data.datasets.forEach(({ key, name }) => {
      const control = createElement('a');
      control.href = '#';
      control.dataset.key = key;
      control.className = `lovely-chart--button lovely-chart--color-${data.colors[key].slice(1)} lovely-chart--state-checked`;
      control.innerHTML = `<span class="lovely-chart--button-check"></span><span class="lovely-chart--button-label">${name}</span>`;

      control.addEventListener('click', (e) => {
        e.preventDefault();

        if (!control.dataset.clickPrevented) {
          _updateFilter(control);
        }

        delete control.dataset.clickPrevented;
      });

      captureEvents(control, {
        onLongPress: () => {
          control.dataset.clickPrevented = 'true';

          _updateFilter(control, true);
        },
      });

      _element.appendChild(control);
    });

    container.appendChild(_element);
  }

  function _updateFilter(button, isLongPress = false) {
    const buttons = Array.from(_element.getElementsByTagName('a'));
    const isSingleChecked = _element.querySelectorAll('.lovely-chart--state-checked').length === 1;

    if (button) {
      if (button.classList.contains('lovely-chart--state-checked') && isSingleChecked) {
        if (isLongPress) {
          buttons.forEach((b) => b.classList.add('lovely-chart--state-checked'));
          button.classList.remove('lovely-chart--state-checked');
        } else {
          button.classList.remove('lovely-chart--state-shake');
          requestAnimationFrame(() => {
            button.classList.add('lovely-chart--state-shake');
          });
        }
      } else if (isLongPress) {
        buttons.forEach((b) => b.classList.remove('lovely-chart--state-checked'));
        button.classList.add('lovely-chart--state-checked');
      } else {
        button.classList.toggle('lovely-chart--state-checked');
      }
    }

    const filter = {};

    buttons.forEach((input) => {
      filter[input.dataset.key] = input.classList.contains('lovely-chart--state-checked');
    });

    filterCallback(filter);
  }

  return {
    redraw,
  };
}
