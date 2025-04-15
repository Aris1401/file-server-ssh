/**
 * Store connection information
 */
let connectionInfo = {};

/**
 * Update the connection command display
 * @param {string} command - Connection command
 */
function updateConnectionCommand(command) {
  $(".connexion-command").text(command);
}

/**
 * Get connection information from server
 * @return {Promise} Connection info promise
 */
function getConnectionInfo() {
  return new Promise((resolve, reject) => {
    $.ajax({
      url: "api/infos",
      contentType: "application/json",
      success: (response) => {
        connectionInfo = response.data;
        updateConnectionCommand(connectionInfo.cmd);
        resolve(connectionInfo);
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}

/**
 * Get stored connection information
 * @return {Object} Connection info
 */
function getStoredConnectionInfo() {
  return connectionInfo;
}

export { getConnectionInfo, getStoredConnectionInfo, updateConnectionCommand };