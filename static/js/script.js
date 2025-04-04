// Global variable to track the current directory.
// Starting directory is "public_html"
var currentPath = ".";

// Update the breadcrumb navigation based on the current path.
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

// Append a file or folder as a new row in the file table.
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

  // If it's a folder, make the entire row clickable.
  if (file.type === "folder") {
    $row.attr("data-dir", file.path);
    $row.css("cursor", "pointer");
    // No longer wrap the name in an <a>; plain text is enough.
    var nameCell = `<td><i class="bi bi-${icon} me-2"></i>${file.name}</td>`;
    $row.append(nameCell);
  } else {
    // For files, simply render the name.
    var nameCell = `<td><i class="bi bi-${icon} me-2"></i>${file.name}</td>`;
    $row.append(nameCell);
  }

  // Build the rest of the cells.
  $row.append(
    `<td>${file.type.charAt(0).toUpperCase() + file.type.slice(1)}</td>`
  );
  $row.append(`<td>${file.size !== "-" ? formatSize(file.size) : "-"}</td>`);
  $row.append(`<td>${file.modified}</td>`);

  // Download button for files only
  var downloadBtn =
    file.type === "file"
      ? `<a href="/api/download?path=${encodeURIComponent(
          file.path
        )}" class="btn btn-sm btn-outline-success me-1" title="Download">
           <i class="bi bi-download"></i>
         </a>`
      : "";

  // Add rename button
  var renameBtn = `<button class="btn btn-sm btn-outline-primary me-1 rename-btn" 
                       data-path="${file.path}" 
                       data-name="${file.name}" 
                       data-type="${file.type}" 
                       title="Rename">
                       <i class="bi bi-pencil"></i>
                     </button>`;

  // Add delete button
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

// Format file sizes in human-readable format.
function formatSize(size) {
  if (size < 1024) return size + " B";
  else if (size < 1024 * 1024) return (size / 1024).toFixed(2) + " KB";
  else if (size < 1024 * 1024 * 1024)
    return (size / (1024 * 1024)).toFixed(2) + " MB";
  else return (size / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}

// Load files from a given directory and update the table and breadcrumb.
function loadFiles(dir) {
  currentPath = dir;
  updateBreadcrumb(currentPath);
  $.get("/api/list", { dir: currentPath }, function (data) {
    if (data.error) {
      alert("Error loading files: " + data.error);
      return;
    }
    var $tbody = $("table tbody");
    $tbody.empty();
    data.files.forEach(function (file) {
      addFileToList(file);
    });
  }).fail(function (jqXHR, textStatus, errorThrown) {
    alert("Failed to load files: " + errorThrown);
  });
}

// Document ready handler
$(document).ready(function () {
  // Initial load of files for the starting directory.
  loadFiles(currentPath);

  // Delegate click event for folder rows.
  $("table tbody").on("click", "tr[data-dir]", function (e) {
    // Prevent click if user clicks on an interactive element like a button or link.
    if ($(e.target).closest("a, button").length > 0) return;
    var newDir = $(this).data("dir");
    loadFiles(newDir);
  });

  // Delegate click event for breadcrumb links.
  $(".breadcrumb").on(
    "click",
    ".breadcrumb-link, .breadcrumb-home",
    function (e) {
      e.preventDefault();
      var newDir = $(this).data("path");
      loadFiles(newDir);
    }
  );
});

// Handle new folder creation
function handleCreateFolderSubmit(e) {
  e.preventDefault();

  var folderName = $("#foldername").val();

  if (!folderName) {
    alert("Please enter a folder name.");
    return;
  }

  var folderPath =
    currentPath === "." ? folderName : currentPath + "/" + folderName;

  $.ajax({
    url: "/api/create-folder",
    method: "POST",
    contentType: "application/json",
    data: JSON.stringify({
      path: folderPath,
    }),
    success: function (response) {
      if (response.success) {
        // Close modal and reload current directory
        $("#createFolderModal").modal("hide");
        loadFiles(currentPath);
        // Clear form field
        $("#foldername").val("");
      } else {
        alert("Error creating folder: " + response.error);
      }
    },
    error: function (jqXHR, textStatus, errorThrown) {
      alert("Failed to create folder: " + errorThrown);
    },
  });
}

// Handle file creation form submission
function handleCreateFileSubmit(e) {
  e.preventDefault();

  var filename = $("#filename").val();
  var content = $("#filecontent").val();

  if (!filename) {
    alert("Please enter a file name.");
    return;
  }

  var filePath = currentPath === "." ? filename : currentPath + "/" + filename;

  $.ajax({
    url: "/api/create-file",
    method: "POST",
    contentType: "application/json",
    data: JSON.stringify({
      path: filePath,
      content: content,
    }),
    success: function (response) {
      if (response.success) {
        // Close modal and reload current directory
        $("#createFileModal").modal("hide");
        loadFiles(currentPath);
        // Clear form fields
        $("#filename").val("");
        $("#filecontent").val("");
      } else {
        alert("Error creating file: " + response.error);
      }
    },
    error: function (jqXHR, textStatus, errorThrown) {
      alert("Failed to create file: " + errorThrown);
    },
  });
}

// Handle file upload
function handleFileUpload(e) {
  e.preventDefault();

  const fileInput = document.getElementById("fileUpload");
  if (!fileInput.files.length) {
    alert("Please select at least one file to upload");
    return;
  }

  const files = fileInput.files;
  const formData = new FormData();

  // Append all files to the form data
  for (let i = 0; i < files.length; i++) {
    formData.append("files", files[i]);
  }

  formData.append("path", currentPath); // Add current path

  // Show progress bar
  const progressBar = $("#uploadProgress");
  const progressBarInner = progressBar.find(".progress-bar");
  progressBar.removeClass("d-none");
  progressBarInner.css("width", "0%");

  $.ajax({
    url: "/api/upload-multiple",
    type: "POST",
    data: formData,
    processData: false,
    contentType: false,
    xhr: function () {
      const xhr = new window.XMLHttpRequest();
      xhr.upload.addEventListener(
        "progress",
        function (e) {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            progressBarInner.css("width", percent + "%");
            progressBarInner.text(percent + "%");
          }
        },
        false
      );
      return xhr;
    },
    success: function (response) {
      if (response.success) {
        // Show success message with number of files uploaded
        const filesUploaded = response.filesUploaded || 0;
        alert(`Successfully uploaded ${filesUploaded} file(s)`);

        // Close modal and reload current directory
        $("#uploadModal").modal("hide");
        loadFiles(currentPath);

        // Clear form and file list
        $("#uploadForm")[0].reset();
        $("#fileList").addClass("d-none").find("ul").empty();

        // Hide progress bar
        progressBar.addClass("d-none");
      } else {
        alert("Error uploading files: " + response.error);
      }
    },
    error: function (jqXHR, textStatus, errorThrown) {
      alert("Failed to upload files: " + errorThrown);
      progressBar.addClass("d-none");
    },
  });
}

function handleDelete(path, name, isFolder) {
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
          // Reload current directory
          loadFiles(currentPath);
        } else {
          alert(
            `Error deleting ${isFolder ? "folder" : "file"}: ${response.error}`
          );
        }
      },
      error: function (jqXHR, textStatus, errorThrown) {
        alert(
          `Failed to delete ${isFolder ? "folder" : "file"}: ${errorThrown}`
        );
      },
    });
  }
}

function handleRename(oldPath, oldName, isFolder) {
  const newName = prompt(
    `Enter new name for this ${isFolder ? "folder" : "file"}:`,
    oldName
  );

  if (!newName || newName === oldName) {
    return; // User canceled or didn't change the name
  }

  // Calculate new path based on current directory
  let newPath;
  if (currentPath === ".") {
    newPath = newName;
  } else {
    // Get parent directory from old path
    const pathParts = oldPath.split("/");
    pathParts.pop(); // Remove filename/foldername
    pathParts.push(newName); // Add new name
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
        // Reload current directory
        loadFiles(currentPath);
      } else {
        alert(
          `Error renaming ${isFolder ? "folder" : "file"}: ${response.error}`
        );
      }
    },
    error: function (jqXHR, textStatus, errorThrown) {
      alert(`Failed to rename ${isFolder ? "folder" : "file"}: ${errorThrown}`);
    },
  });
}

// DEdit
$("table tbody").on("click", ".edit-btn", function (e) {
  e.stopPropagation();

  const path = $(this).data("path");
  const name = $(this).data("name");

  // Store path
  $("#editFilePath").val(path);
  $("#editFileModalLabel").text(`Editing: ${name}`);

  // Fetch file content
  $.get("/api/read-file", { path: path }, function (data) {
    if (data.success) {
      $("#editFileContent").val(data.content);
      $("#editFileModal").modal("show");
    } else {
      alert("Failed to load file: " + data.error);
    }
  }).fail(function (jqXHR, textStatus, errorThrown) {
    alert("Error loading file: " + errorThrown);
  });
});

$("#editFileForm").on("submit", function (e) {
  e.preventDefault();

  const path = $("#editFilePath").val();
  const content = $("#editFileContent").val();

  $.ajax({
    url: "/api/update-file",
    method: "POST",
    contentType: "application/json",
    data: JSON.stringify({ path, content }),
    success: function (response) {
      if (response.success) {
        $("#editFileModal").modal("hide");
        loadFiles(currentPath); // Optional: refresh list
      } else {
        alert("Error saving file: " + response.error);
      }
    },
    error: function (jqXHR, textStatus, errorThrown) {
      alert("Failed to save file: " + errorThrown);
    },
  });
});

// Delegate click event for folder rows.
$("table tbody").on("click", "tr[data-dir]", function (e) {
  // Prevent click if user clicks on an interactive element like a button or link.
  if ($(e.target).closest("a, button").length > 0) return;
  var newDir = $(this).data("dir");
  loadFiles(newDir);
});

// Delegate click event for breadcrumb links.
$(".breadcrumb").on(
  "click",
  ".breadcrumb-link, .breadcrumb-home",
  function (e) {
    e.preventDefault();
    var newDir = $(this).data("path");
    loadFiles(newDir);
  }
);

// ----------------------------------- File upload form submission handler
$("#fileUpload").on("change", function () {
  const fileList = $("#fileList");
  const fileListUl = fileList.find("ul");
  fileListUl.empty();

  if (this.files.length > 0) {
    fileList.removeClass("d-none");

    for (let i = 0; i < this.files.length; i++) {
      const file = this.files[i];
      const size = formatSize(file.size);
      fileListUl.append(`<li class="list-group-item d-flex justify-content-between align-items-center">
          <span>${file.name}</span>
          <span class="badge bg-secondary">${size}</span>
        </li>`);
    }
  } else {
    fileList.addClass("d-none");
  }
});

$("table tbody").on("click", ".delete-btn", function (e) {
  e.stopPropagation(); // Prevent row click for folders
  const path = $(this).data("path");
  const name = $(this).data("name");
  const isFolder = $(this).data("type") === "folder";
  handleDelete(path, name, isFolder);
});

// Rename button click handler - using event delegation
$("table tbody").on("click", ".rename-btn", function (e) {
  e.stopPropagation(); // Prevent row click for folders
  const path = $(this).data("path");
  const name = $(this).data("name");
  const isFolder = $(this).data("type") === "folder";
  handleRename(path, name, isFolder);
});

$(document).ready(function () {
  // ----------------------------------- Refresh button click event
  $("#refreshBtn").on("click", function () {
    // Show a small loading indicator on the button
    const $btn = $(this);
    const originalHtml = $btn.html();
    $btn.html(
      '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Refreshing...'
    );
    $btn.prop("disabled", true);

    // Reload files for the current path
    loadFiles(currentPath);

    // Reset button after a short delay
    setTimeout(function () {
      $btn.html(originalHtml);
      $btn.prop("disabled", false);
    }, 1000);
  });

  // ----------------------------------- Create file button click event
  // Create file form submission handler
  $("#createFileForm").on("submit", handleCreateFileSubmit);

  // Create folder form submission handler
  $("#createFolderForm").on("submit", handleCreateFolderSubmit);

  // Reset modal forms when hidden to clear inputs
  $("#createFileModal, #createFolderModal").on("hidden.bs.modal", function () {
    $(this).find("form")[0].reset();
  });

  // ----------------------------------- Upload button opens modal
  $("#uploadBtn").on("click", function () {
    $("#uploadModal").modal("show");
  });

  // Upload form submission
  $("#uploadForm").on("submit", handleFileUpload);

  // Reset upload form and hide progress bar when modal is closed
  $("#uploadModal").on("hidden.bs.modal", function () {
    $(this).find("form")[0].reset();
    $("#uploadProgress").addClass("d-none");
    $("#fileList").addClass("d-none").find("ul").empty();
  });
});
