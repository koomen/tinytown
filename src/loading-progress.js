// One overall value for the entire load. A phase or a saved timing profile
// can update the caption, but can never move the bar backwards.
export function loadingProgress(bar, caption) {
  let value = Math.max(0, Math.min(1, parseFloat(bar.style.width) / 100 || 0));
  return (target, label) => {
    if (Number.isFinite(target)) value = Math.max(value, Math.min(1, target));
    bar.style.width = `${value * 100}%`;
    bar.parentElement.setAttribute('aria-valuenow', String(Math.round(value * 100)));
    if (label) caption.textContent = label;
    return value;
  };
}
