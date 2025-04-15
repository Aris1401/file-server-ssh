import { formatSize } from './utils.js';

let currentPath = ".";

/**
 * Update the breadcrumb navigation
 * @param {string} path - Current directory path
 */
function updateBreadcrumb(path) {
  var breadcrumbHtml =
    '<li class="breadcrumb-item"><a href="#" class="breadcrumb-home" data-path=".">Home</a></li>';
  var parts = path.split("/").filter(function (part) {
    return part.length > 0;
  });
  var cumulative = "";

  parts.forEach(function (part, index) {
    cumulative += index === 0 ? part : "/" + part;
    if (index === parts.length - 1) {
      breadcrumbHtml += `<li class="breadcrumb-item active" aria-current="page">${part}</li>`;
    } else {
      breadcrumbHtml += `<li class="breadcrumb-item"><a href="#" class="breadcrumb-link" data-path="${cumulative}">${part}</a></li>`;
    }
  });

  $(".breadcrumb").html(breadcrumbHtml);
}

/**
 * Add a file or folder to the file list UI
 * @param {Object} file - File information object
 */
function addFileToList(file) {
  var icon;
  if (file.type === "folder") {
    icon = "folder-fill text-warning";
  } else if (file.name.endsWith(".html")) {
    icon = "file-earmark-text";
  } else if (file.name.endsWith(".js")) {
    icon = "file-earmark-code";
  } else {
    icon = "file-earmark";
  }

  var $row = $("<tr></tr>");

  if (file.type === "folder") {
    $row.attr("data-dir", file.path);
    $row.css("cursor", "pointer");
    var nameCell = `<td><i class="bi bi-${icon} me-2"></i>${file.name}</td>`;
    $row.append(nameCell);
  } else {
    var nameCell = `<td><i class="bi bi-${icon} me-2"></i>${file.name}</td>`;
    $row.append(nameCell);
  }

  $row.append(
    `<td>${file.type.charAt(0).toUpperCase() + file.type.slice(1)}</td>`
  );
  $row.append(`<td>${file.size !== "-" ? formatSize(file.size) : "-"}</td>`);
  $row.append(`<td>${file.modified}</td>`);

  var downloadBtn =
    file.type === "file"
      ? `<a href="/api/download?path=${encodeURIComponent(
          file.path
        )}" class="btn btn-sm btn-outline-success me-1" title="Download">
           <i class="bi bi-download"></i>
         </a>`
      : "";

  var renameBtn = `<button class="btn btn-sm btn-outline-primary me-1 rename-btn" 
                     data-path="${file.path}" 
                     data-name="${file.name}" 
                     data-type="${file.type}" 
                     title="Rename">
                     <i class="bi bi-pencil"></i>
                   </button>`;

  var deleteBtn = `<button class="btn btn-sm btn-outline-danger delete-btn" 
                     data-path="${file.path}" 
                     data-name="${file.name}" 
                     data-type="${file.type}" 
                     title="Delete">
                     <i class="bi bi-trash"></i>
                   </button>`;

  var editBtn =
    file.type === "file"
      ? `<button class="btn btn-sm btn-outline-secondary me-1 edit-btn"
                                               data-path="${file.path}" 
                                               data-name="${file.name}" 
                                               title="Edit">
                                               <i class="bi bi-pencil-square"></i>
                                            </button>`
      : "";

  var actionCell = `<td class="text-end">
                      ${downloadBtn}
                      ${editBtn}
                      ${renameBtn}
                      ${deleteBtn}
                    </td>`;

  $row.append(actionCell);

  $("table tbody").append($row);
}

/**
 * Load files and folders in the specified directory
 * @param {string} dir - Directory path
 * @param {boolean} force - Whether to force reload (bypass cache)
 */
function loadFiles(dir, force = false) {
  var $tbody = $("table tbody");
  $tbody.empty();

  var loaderHTML = `
    <tr id="loader-row">
      <td colspan="100%" class="text-center">
        <div class="d-flex justify-content-center align-items-center">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <span class="ms-3">Loading files...</span>
        </div>
      </td>
    </tr>
  `;

  $tbody.append(loaderHTML);

  currentPath = dir;
  updateBreadcrumb(currentPath);
  $.ajax({
    url: "/api/list",
    method: "GET",
    data: { dir: currentPath },
    cache: !force,
    success: function (data) {
      $("#loader-row").remove();

      if (data.error) {
        toastr.error("Error loading files: " + data.error);
        return;
      }

      var $tbody = $("table tbody");
      $tbody.empty();
      data.files.forEach(function (file) {
        addFileToList(file);
      });
    },
    error: function (jqXHR, textStatus, errorThrown) {
      $("#loader-row").remove();
      toastr.error("Error loading files: " + errorThrown);
    },
  });
}

/**
 * Handle file/folder creation, deletion, and renaming
 */
function createFolder(folderName) {
  if (!folderName) {
    alert("Please enter a folder name.");
    return Promise.reject("No folder name provided");
  }

  var folderPath =
    currentPath === "." ? folderName : currentPath + "/" + folderName;

  return $.ajax({
    url: "/api/create-folder",
    method: "POST",
    contentType: "application/json",
    data: JSON.stringify({
      path: folderPath,
    }),
  });
}

function createFile(filename, content) {
  if (!filename) {
    alert("Please enter a file name.");
    return Promise.reject("No file name provided");
  }

  var filePath = currentPath === "." ? filename : currentPath + "/" + filename;

  return $.ajax({
    url: "/api/create-file",
    method: "POST",
    contentType: "application/json",
    data: JSON.stringify({
      path: filePath,
      content: content,
    }),
  });
}

function deleteItem(path, name, isFolder) {
  return new Promise((resolve, reject) => {
    if (
      confirm(
        `Are you sure you want to delete this ${
          isFolder ? "folder" : "file"
        }:\n${name}?`
      )
    ) {
      $.ajax({
        url: "/api/delete",
        method: "POST",
        contentType: "application/json",
        data: JSON.stringify({
          path: path,
        }),
        success: function (response) {
          if (response.success) {
            resolve(response);
          } else {
            reject(`Error deleting ${isFolder ? "folder" : "file"}: ${response.error}`);
          }
        },
        error: function (jqXHR, textStatus, errorThrown) {
          reject(`Failed to delete ${isFolder ? "folder" : "file"}: ${errorThrown}`);
        },
      });
    } else {
      reject("Delete operation cancelled");
    }
  });
}

function renameItem(oldPath, oldName, isFolder) {
  return new Promise((resolve, reject) => {
    const newName = prompt(
      `Enter new name for this ${isFolder ? "folder" : "file"}:`,
      oldName
    );

    if (!newName || newName === oldName) {
      reject("Rename cancelled or no change");
      return;
    }

    let newPath;
    if (currentPath === ".") {
      newPath = newName;
    } else {
      const pathParts = oldPath.split("/");
      pathParts.pop();
      pathParts.push(newName);
      newPath = pathParts.join("/");
    }

    $.ajax({
      url: "/api/rename",
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({
        oldPath: oldPath,
        newPath: newPath,
      }),
      success: function (response) {
        if (response.success) {
          resolve(response);
        } else {
          reject(`Error renaming ${isFolder ? "folder" : "file"}: ${response.error}`);
        }
      },
      error: function (jqXHR, textStatus, errorThrown) {
        reject(`Failed to rename ${isFolder ? "folder" : "file"}: ${errorThrown}`);
      },
    });
  });
}

function readFile(path) {
  return $.ajax({
    url: "/api/read-file",
    method: "GET",
    data: { path },
  });
}

function updateFile(path, content) {
  return $.ajax({
    url: "/api/update-file",
    method: "POST",
    contentType: "application/json",
    data: JSON.stringify({ path, content }),
  });
}

function getCurrentPath() {
  return currentPath;
}

export { 
  loadFiles, 
  createFolder, 
  createFile, 
  deleteItem, 
  renameItem, 
  readFile, 
  updateFile, 
  getCurrentPath 
};