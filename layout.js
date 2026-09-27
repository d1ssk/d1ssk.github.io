(() => {
  const root = document.documentElement;
  const header = document.querySelector(".site-header");
  const main = document.querySelector(".home-sections");
  const footer = document.querySelector(".site-footer");
  const desktop = window.matchMedia("(min-width: 60rem)");
  if (!header || !main || !footer) return;
  let frame;

  function fitLayout() {
    if (!desktop.matches) {
      root.style.removeProperty("--layout-step");
      return;
    }

    // Temporarily remove the main area's growth so we can measure its contents.
    root.classList.add("is-measuring");
    try {
      const availableHeight = window.innerHeight - 1;
      function measure(step) {
        root.style.setProperty("--layout-step", `${step}rem`);
        return [header, main, footer].reduce((height, element) =>
          height + element.getBoundingClientRect().height, 0);
      }

      if (measure(1) <= availableHeight) return;
      if (measure(0) > availableHeight) return;

      let low = 0;
      let high = 1;
      for (let iteration = 0; iteration < 12; iteration += 1) {
        const middle = (low + high) / 2;
        if (measure(middle) <= availableHeight) low = middle;
        else high = middle;
      }
      root.style.setProperty("--layout-step", `${low}rem`);
    } finally {
      root.classList.remove("is-measuring");
    }
  }

  function scheduleFit() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(fitLayout);
  }

  window.addEventListener("resize", scheduleFit, { passive: true });
  window.addEventListener("pageshow", scheduleFit);
  document.fonts?.ready.then(scheduleFit);
  new MutationObserver(scheduleFit).observe(document.body, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  fitLayout();
})();
