(function () {
  'use strict';

  try {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
  } catch (e) {}

  try {
    window.scrollTo(0, 0);
  } catch (e) {}
})();
