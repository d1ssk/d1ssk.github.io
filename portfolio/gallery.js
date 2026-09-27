(() => {
  const gallery = document.querySelector(".gallery");
  const works = [...gallery.querySelectorAll(".work")];
  const links = works.map((work) => work.querySelector(".work-link"));
  let layoutFrame;

  // Small grid rows let every work keep its own height and its place in the HTML.
  function layoutGallery() {
    window.layoutPortfolio(gallery);
  }

  function scheduleLayout() {
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(layoutGallery);
  }

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(scheduleLayout);
    works.forEach((work) => observer.observe(work));
  }

  window.addEventListener("resize", scheduleLayout);
  gallery.querySelectorAll("img").forEach((image) => {
    image.addEventListener("load", scheduleLayout);
  });
  document.fonts?.ready.then(scheduleLayout);
  scheduleLayout();

  const viewer = document.querySelector("#viewer");
  if (typeof viewer.showModal !== "function") return;

  const image = document.querySelector("#viewer-image");
  const title = document.querySelector("#viewer-title");
  const description = document.querySelector("#viewer-description");
  const information = document.querySelector("#viewer-info");
  const details = document.querySelector("#viewer-details");
  const viewerWork = document.querySelector("#viewer-work");
  const count = document.querySelector("#viewer-count");
  const close = document.querySelector("#viewer-close");
  const previous = document.querySelector("#viewer-previous");
  const next = document.querySelector("#viewer-next");
  let activeIndex = 0;
  let opener;
  let informationVersion = 0;
  const informationCache = new Map();
  const settingsLabels = ["Aperture", "Shutter speed", "ISO"];
  const mobileViewer = window.matchMedia("(max-width: 43rem)");
  let viewerLayoutFrame;

  function layoutViewer() {
    if (!viewer.open) return;
    if (!mobileViewer.matches) {
      viewerWork.style.removeProperty("--viewer-image-max-height");
      return;
    }

    // Fit the image to the available viewport; its information scrolls below it.
    viewerWork.style.setProperty("--viewer-image-max-height", `${viewerWork.clientHeight}px`);
  }

  function scheduleViewerLayout() {
    cancelAnimationFrame(viewerLayoutFrame);
    viewerLayoutFrame = requestAnimationFrame(layoutViewer);
  }

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(scheduleViewerLayout);
    observer.observe(viewerWork);
  }
  window.addEventListener("resize", scheduleViewerLayout);
  document.fonts?.ready.then(scheduleViewerLayout);

  function clearInformation() {
    title.textContent = "";
    title.hidden = true;
    description.textContent = "";
    description.hidden = true;
    details.replaceChildren();
    information.hidden = true;
    viewerWork.classList.remove("has-info");
    viewer.removeAttribute("aria-labelledby");
    scheduleViewerLayout();
  }

  function displayInformation(rawInfo) {
    const info = window.portfolioInformation(rawInfo);
    title.textContent = (info.title || "").trim();
    title.hidden = !title.textContent;
    description.textContent = (info.description || "").trim();
    description.hidden = !description.textContent;
    const entries = [...info.details];
    if (info.location?.trim()) entries.unshift({ label: "Location", value: info.location });

    function appendDetail(label, value) {
      const pair = document.createElement("div");
      const term = document.createElement("dt");
      const definition = document.createElement("dd");
      term.textContent = label;
      definition.textContent = value;
      pair.append(term, definition);
      details.append(pair);
      return pair;
    }

    ["Camera", "Lens"].forEach((label) => {
      entries.filter((entry) => entry.label === label).forEach((entry) => {
        const pair = appendDetail(entry.label, entry.value);
        pair.querySelector("dt").className = "visually-hidden";
      });
    });

    const settings = settingsLabels.flatMap((label) => entries.filter((entry) => entry.label === label));
    if (settings.length) {
      const pair = appendDetail("Shooting settings", "");
      pair.className = "viewer-settings";
      pair.querySelector("dt").className = "visually-hidden";
      settings.forEach((entry) => {
        const value = document.createElement("span");
        value.textContent = entry.label === "ISO" ? `ISO ${entry.value}` : entry.value;
        pair.querySelector("dd").append(value);
      });
    }

    entries.filter((entry) => !["Camera", "Lens", ...settingsLabels].includes(entry.label))
      .forEach((entry) => appendDetail(entry.label, entry.value));

    const hasInformation = Boolean(title.textContent || description.textContent || details.childElementCount);
    information.hidden = !hasInformation;
    viewerWork.classList.toggle("has-info", hasInformation);
    if (title.textContent) viewer.setAttribute("aria-labelledby", "viewer-title");
    scheduleViewerLayout();
  }

  function loadInformation(url) {
    if (!informationCache.has(url)) {
      const request = fetch(url, { cache: "no-cache" }).then((response) => {
        if (!response.ok) throw new Error("Image information could not be loaded.");
        return response.json();
      }).catch((error) => {
        informationCache.delete(url);
        throw error;
      });
      informationCache.set(url, request);
    }
    return informationCache.get(url);
  }

  function showWork(index) {
    activeIndex = (index + links.length) % links.length;
    const link = links[activeIndex];
    const version = ++informationVersion;
    // Browsers can keep painting the previous image while the new source loads.
    image.style.visibility = "hidden";
    image.src = link.href;
    image.alt = link.querySelector("img").alt;
    image.decode().then(() => {
      if (version === informationVersion) image.style.removeProperty("visibility");
    }).catch(() => {
      // Keep failed or superseded image requests out of the viewer.
    });
    count.textContent = `${activeIndex + 1} / ${links.length}`;
    clearInformation();
    viewerWork.scrollTop = 0;
    information.scrollTop = 0;
    loadInformation(link.dataset.info).then((info) => {
      if (version === informationVersion) displayInformation(info);
    }).catch(() => {
      if (version === informationVersion) {
        displayInformation({ description: "Image details could not be loaded." });
      }
    });
  }

  previous.hidden = next.hidden = links.length < 2;

  links.forEach((link, index) => {
    link.addEventListener("click", (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      opener = link;
      showWork(index);
      viewer.showModal();
      document.documentElement.classList.add("viewer-open");
      close.focus({ preventScroll: true });
    });
  });

  close.addEventListener("click", () => viewer.close());
  previous.addEventListener("click", () => showWork(activeIndex - 1));
  next.addEventListener("click", () => showWork(activeIndex + 1));

  viewer.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    if (event.key === "Tab") {
      const buttons = [close, previous, next].filter((button) => !button.hidden);
      const first = buttons[0];
      const last = buttons[buttons.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      showWork(activeIndex + (event.key === "ArrowRight" ? 1 : -1));
    }
  });

  viewer.addEventListener("click", (event) => {
    if (event.target === viewer || event.target.id === "viewer-stage") viewer.close();
  });

  viewer.addEventListener("close", () => {
    informationVersion += 1;
    document.documentElement.classList.remove("viewer-open");
    opener?.focus({ preventScroll: true });
  });
})();
