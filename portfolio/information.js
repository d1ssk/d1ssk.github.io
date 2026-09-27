// The editor preview and public viewer use the same visibility defaults.
(() => {
  const hiddenByDefault = new Set(['Focal length', '35mm equivalent', 'Exposure compensation', 'Captured']);
  window.portfolioDetailVisible = entry => entry.show !== false &&
    (!hiddenByDefault.has(String(entry.label || '').trim()) || entry.show === true);
  window.portfolioInformation = info => ({
    title: info.visibility?.title === false ? '' : String(info.title || '').trim(),
    location: info.visibility?.location === false ? '' : String(info.location || '').trim(),
    description: info.visibility?.description === false ? '' : String(info.description || '').trim(),
    details: (Array.isArray(info.details) ? info.details : []).filter(entry => entry && window.portfolioDetailVisible(entry))
      .map(entry => ({ label: String(entry.label ?? '').trim(), value: String(entry.value ?? '').trim() }))
      .filter(entry => entry.label && entry.value),
  });
})();
