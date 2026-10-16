(() => {
  const phone = navigator.userAgentData?.mobile || /iPhone|iPod|Android.*Mobile|Windows Phone|IEMobile|BlackBerry|Opera Mini/i.test(navigator.userAgent);
  if (phone) return;
  document.querySelectorAll('a[href^="tel:"]').forEach(link => {
    const number = link.getAttribute('href').slice(4);
    const label = link.textContent;
    let reset;
    link.title = 'Copy phone number';
    link.setAttribute('aria-live', 'polite');
    link.addEventListener('click', async event => {
      event.preventDefault();
      clearTimeout(reset);
      try {
        await navigator.clipboard.writeText(number);
        link.textContent = '☎ Copied!';
      } catch {
        // Keep the number available if the browser blocks clipboard access.
        window.prompt('Copy phone number:', number);
      }
      reset = setTimeout(() => { link.textContent = label; }, 2500);
    });
  });
})();
