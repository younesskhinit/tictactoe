const toasts = ['connect', 'full', 'invalid', 'loading', 'ended', 'tie', 'won'];

function hideToast(toast) {
  toast.classList.add('hidden');
  toast.classList.remove('absolute');
}

function toast(name, delay) {
  toasts.forEach((toastToHide) =>
    hideToast(document.getElementById(`${toastToHide}-toast`))
  );

  // Show toast
  const toast = document.getElementById(`${name}-toast`);

  toast.classList.remove('hidden');

  'absolute animate__animated animate__slideInRight'
    .split(' ')
    .forEach((className) => toast.classList.add(className));

  // Hide toast
  setTimeout(() => {
    toast.classList.remove('animate__slideInRight');
    toast.classList.add('animate__fadeOutDown');
    setTimeout(() => hideToast(toast), 1000);
  }, delay || 2000);
}
