/**
 * Format file size into human-readable form
 * @param {number} size - Size in bytes
 * @return {string} Formatted size
 */
function formatSize(size) {
    if (size < 1024) return size + " B";
    else if (size < 1024 * 1024) return (size / 1024).toFixed(2) + " KB";
    else if (size < 1024 * 1024 * 1024)
      return (size / (1024 * 1024)).toFixed(2) + " MB";
    else return (size / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  }
  
  /**
   * Determine CodeMirror mode based on file extension
   * @param {string} fileName - Name of the file
   * @return {string} CodeMirror mode
   */
  function getCodeMirrorMode(fileName) {
    if (fileName.endsWith(".js")) return "javascript";
    if (fileName.endsWith(".html")) return "htmlmixed";
    if (fileName.endsWith(".css")) return "css";
    if (fileName.endsWith(".json")) return "application/json";
    if (fileName.endsWith(".py")) return "python";
    if (fileName.endsWith(".php")) return "php";
    if (fileName.endsWith(".sh")) return "shell";
    if (fileName.endsWith(".md")) return "markdown";
    if (fileName.endsWith(".txt")) return "text/plain";
    if (fileName.endsWith(".xml")) return "xml";
    if (fileName.endsWith(".yml") || fileName.endsWith(".yaml")) return "yaml";
    return "text/plain";
  }
  
  export { formatSize, getCodeMirrorMode };