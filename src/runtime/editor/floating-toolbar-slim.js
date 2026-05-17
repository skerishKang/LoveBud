// Editor floating toolbar - Slim entrypoint
import { $, $$ } from '../utils/dom.js';

// Only essential operations
const toolbar = {
  init() {
    this.bindEvents();
  },
  
  bindEvents() {
    $('#toolbar-save')?.addEventListener('click', () => this.save());
    $('#toolbar-export')?.addEventListener('click', () => this.export());
  },
  
  save() {
    console.log('Save triggered');
  },
  
  export() {
    console.log('Export triggered');
  }
};

// Auto-init
if (document.readyState !== 'loading') {
  toolbar.init();
} else {
  document.addEventListener('DOMContentLoaded', () => toolbar.init());
}

export default toolbar;