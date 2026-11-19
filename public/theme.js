(() => {
  const key = 'morning-edition:appearance';
  const system = matchMedia('(prefers-color-scheme: dark)');
  const root = document.documentElement;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const paper = {light:'#fafaf7', dark:'#0b0b0e'};
  // Dark is the default; "system" follows the device.
  const resolve = value => value === 'light' || value === 'system' ? value : 'dark';
  let choice = 'dark';
  try { choice = resolve(localStorage.getItem(key)); } catch { /* Use the system appearance. */ }

  function apply() {
    const appearance = choice === 'system' ? (system.matches ? 'dark' : 'light') : choice;
    root.dataset.appearance = appearance;
    themeColor.content = paper[appearance];
  }

  apply();
  system.addEventListener('change', apply);
  document.addEventListener('DOMContentLoaded', () => {
    const options = document.getElementById('appearance');
    const updateControls = () => {
      for (const radio of options?.querySelectorAll('input') ?? []) radio.checked = radio.value === choice;
    };
    updateControls();
    options?.addEventListener('change', event => {
      choice = resolve(event.target.value);
      apply();
      try { localStorage.setItem(key, choice); } catch { /* The setting still applies to this page. */ }
    });
    window.addEventListener('storage', event => {
      if (event.key !== key && event.key !== null) return;
      choice = resolve(event.newValue);
      apply();
      updateControls();
    });
  }, {once:true});
})();
