/* Decorative effects never intercept input; honor reduced-motion preferences. */
(() => {
  let lastBurst = 0, toastTimer;
  window.celebrate = (message = '', big = false) => {
    const toast = document.getElementById('magic-toast');
    if (message) {
      toast.textContent = `✨ ${message}`;
      toast.classList.add('visible');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('visible'), 2800);
    }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || Date.now() - lastBurst < 600) return;
    lastBurst = Date.now();
    const layer = document.createElement('div');
    layer.className = 'magic-layer'; layer.setAttribute('aria-hidden', 'true');
    // Place effects inside a modal when one is open so they remain visible.
    (document.querySelector('dialog[open]') || document.body).appendChild(layer);
    for (let i = 0; i < (big ? 18 : 7); i += 1) {
      const spark = document.createElement('span');
      spark.textContent = (big ? ['✨', '🌈', '🦄', '⭐'] : ['✨', '✦', '⭐'])[i % (big ? 4 : 3)];
      spark.style.cssText = `--x:${(Math.random() - .5) * 300}px;--y:${-70 - Math.random() * 180}px;--turn:${(Math.random() - .5) * 100}deg;left:${35 + Math.random() * 30}%;top:65%;animation-delay:${i * 25}ms`;
      layer.appendChild(spark);
    }
    setTimeout(() => layer.remove(), 1800);
  };
})();
