import { getCodeMirrorMode } from './utils.js';

let codeMirrorEditor;

/**
 * Initialize the CodeMirror editor
 */
function initEditor() {
  if (!codeMirrorEditor) {
    codeMirrorEditor = CodeMirror.fromTextArea(
      document.getElementById("editFileContent"),
      {
        lineNumbers: true,
        mode: "javascript",
        theme: "material-darker",
        tabSize: 2,
        indentWithTabs: true,
      }
    );
    codeMirrorEditor.setSize("100%", "500px");
  } else {
    codeMirrorEditor.refresh();
  }
}

/**
 * Set editor mode based on filename
 * @param {string} fileName - Name of the file
 */
function setEditorMode(fileName) {
  if (codeMirrorEditor) {
    const mode = getCodeMirrorMode(fileName);
    codeMirrorEditor.setOption("mode", mode);
  }
}

/**
 * Set editor content
 * @param {string} content - File content
 */
function setEditorContent(content) {
  if (codeMirrorEditor) {
    codeMirrorEditor.setValue(content);
    
    // This timeout ensures the editor content is properly set
    // after the modal animation completes
    setTimeout(() => {
      codeMirrorEditor.refresh();
    }, 300);
  }
}

/**
 * Get editor content
 * @return {string} Content from editor
 */
function getEditorContent() {
  return codeMirrorEditor ? codeMirrorEditor.getValue() : '';
}

export { 
  initEditor, 
  setEditorMode, 
  setEditorContent, 
  getEditorContent 
};