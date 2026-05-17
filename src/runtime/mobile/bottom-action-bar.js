// Mobile bottom action bar for Editor
// Appears on mobile for quick moment creation
const MOBILE_BREAKPOINT = 768;

export function initMobileActionBar() {
  if (window.innerWidth > MOBILE_BREAKPOINT) return;
  
  createActionBar();
  setupPositionListeners();
}

function createActionBar() {
  const bar = document.createElement('div');
  bar.id = 'mobile-action-bar';
  bar.className = 'mobile-bottom-bar';
  bar.innerHTML = `
    <button class="fab-action" title="New Moment">
      <span class="material-icons">add</span>
    </button>
    <button class="fab-action" title="Search">
      <span class="material-icons">search</span>
    </button>
    <button class="fab-action" title="Save">
      <span class="material-icons">save</span>
    </button>
  `;
  
  document.body.appendChild(bar);
  bindMobileEvents(bar);
}

function bindMobileEvents(bar) {
  bar.querySelector('[title="New Moment"]')?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('create-new-moment'));
  });
  
  bar.querySelector('[title="Save"]')?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('save-editor'));
  });
}

function setupPositionListeners() {
  window.addEventListener('resize', () => {
    if (window.innerWidth > MOBILE_BREAKPOINT) {
      $('#mobile-action-bar')?.remove();
    }
  });
}