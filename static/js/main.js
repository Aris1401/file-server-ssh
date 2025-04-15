import { loadFiles } from './fileManager.js';
import { getConnectionInfo } from './connectionManager.js';
import { initEventHandlers } from './uiHandlers.js';
import { initEditor } from './editorManager.js';

/**
 * Initialize the application
 */
function init() {
  loadFiles(".");
  
  getConnectionInfo();
  
  initEventHandlers();

  initEditor();
}

// Initialize the application when the document is ready
$(document).ready(init);