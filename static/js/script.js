var currentPath = ".";
var connectionInformations = {};

function updateConnectionCommand(command) {
  $(".connexion-command").text(command);
}

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

function formatSize(size) {
  if (size < 1024) return size + " B";
  else if (size < 1024 * 1024) return (size / 1024).toFixed(2) + " KB";
  else if (size < 1024 * 1024 * 1024)
    return (size / (1024 * 1024)).toFixed(2) + " MB";
  else return (size / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}

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
          <span class="ms-3">Chargement des fichiers...</span>
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
      $("#loader").remove();

      if (data.error) {
        toastr.error("Erreur de chargement des fichiers: " + data.error);
        return;
      }

      var $tbody = $("table tbody");
      $tbody.empty();
      data.files.forEach(function (file) {
        addFileToList(file);
      });
    },
    error: function (jqXHR, textStatus, errorThrown) {
      $("#loader").remove();
      toastr.error("Erreur de chargement des fichiers: " + errorThrown);
    },
  });
}

$(document).ready(function () {
  loadFiles(currentPath);

  $("table tbody").on("click", "tr[data-dir]", function (e) {
    if ($(e.target).closest("a, button").length > 0) return;
    var newDir = $(this).data("dir");
    loadFiles(newDir);
  });

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
        $("#createFolderModal").modal("hide");
        loadFiles(currentPath);
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
        $("#createFileModal").modal("hide");
        loadFiles(currentPath);
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

function handleFileUpload(e) {
  e.preventDefault();

  const fileInput = document.getElementById("fileUpload");
  if (!fileInput.files.length) {
    alert("Please select at least one file to upload");
    return;
  }

  const files = fileInput.files;
  const formData = new FormData();

  const uploadId = Date.now().toString();
  formData.append("uploadId", uploadId);

  for (let i = 0; i < files.length; i++) {
    formData.append("files", files[i]);
  }

  formData.append("path", currentPath);

  const progressBar = $("#uploadProgress");
  const progressBarInner = progressBar.find(".progress-bar");
  progressBar.removeClass("d-none");
  progressBarInner.css("width", "0%");

  pollProgress(uploadId);

  $.ajax({
    url: "/api/upload-multiple",
    type: "POST",
    data: formData,
    processData: false,
    contentType: false,
    success: function (response) {
      if (response.success) {
        const filesUploaded = response.filesUploaded || 0;
        alert(`Successfully uploaded ${filesUploaded} file(s)`);

        $("#uploadModal").modal("hide");
        loadFiles(currentPath);

        $("#uploadForm")[0].reset();
        $("#fileList").addClass("d-none").find("ul").empty();

        progressBar.addClass("d-none");
      } else {
        alert("Error uploading files: " + response.error);
      }
    },
    error: function (jqXHR, textStatus, errorThrown) {
      console.log(errorThrown);
      alert("Failed to upload files: " + errorThrown);
      progressBar.addClass("d-none");
    },
  });
}

function pollProgress(uploadId) {
  let tries = 0;

  const interval = setInterval(() => {
    $.ajax({
      url: `/api/upload-progress?uploadId=${uploadId}`,
      method: "GET",
      success: function (data) {
        if (data.error) {
          tries += 1;

          if (tries >= 5) {
            clearInterval(interval);
            alert("Upload failed: " + data.error);
            return;
          }
        }

        const percent = Math.round(data.progress);
        progressBarInner.css("width", percent + "%");
        progressBarInner.text(percent + "%");

        if (percent >= 100) {
          clearInterval(interval);
        }
      },
      error: function () {
        tries += 1;

        if (tries >= 5) {
          clearInterval(interval);
          alert("Upload failed: Network error");
        }
      },
    });
  }, 500);
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

// Obtenir les informations de la connection
function getConnectionInformations() {
  $.ajax({
    url: "api/infos",
    contentType: "application/json",
    success: (response) => {
      connectionInformations = response.data;

      // Mettre a jour les informations de connextion SSH
      updateConnectionCommand(connectionInformations.cmd);
    },
  });
}

$("table tbody").on("click", ".edit-btn", function (e) {
  e.stopPropagation();

  const path = $(this).data("path");
  const name = $(this).data("name");

  $("#editFilePath").val(path);
  $("#editFileModalLabel").text(`Editing: ${name}`);

  $.get("/api/read-file", { path: path }, function (data) {
    if (data.success) {
      $("#editFileModal").modal("show");

      const mode = getCodeMirrorMode(name);
      codeMirrorEditor.setOption("mode", mode);
      codeMirrorEditor.setValue(data.content);

      setTimeout(() => {
        codeMirrorEditor.setValue(data.content);
      }, 300);
    } else {
      alert("Failed to load file: " + data.error);
    }
  });
});

$("#editFileForm").on("submit", function (e) {
  e.preventDefault();

  const path = $("#editFilePath").val();
  const content = codeMirrorEditor.getValue();

  $.ajax({
    url: "/api/update-file",
    method: "POST",
    contentType: "application/json",
    data: JSON.stringify({ path, content }),
    success: function (response) {
      if (response.success) {
        $("#editFileModal").modal("hide");
        loadFiles(currentPath);
      } else {
        alert("Error saving file: " + response.error);
      }
    },
    error: function (jqXHR, textStatus, errorThrown) {
      alert("Failed to save file: " + errorThrown);
    },
  });
});

$("table tbody").on("click", "tr[data-dir]", function (e) {
  if ($(e.target).closest("a, button").length > 0) return;
  var newDir = $(this).data("dir");
  loadFiles(newDir);
});

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
  getConnectionInformations();

  const fileList = $("#fileList");
  const fileListUl = fileList.find("ul");
  fileListUl.empty();

  if (this.files.length > 0) {
    fileList.removeClass("d-none");

    for (let i = 0; i < this.files.length; i++) {
      const file = this.files[i];
      const size = formatSize(file.size);

      const copyPath = currentPath.replace(
        ".",
        "/mnt/www/" + connectionInformations.domain
      );

      fileListUl.append(`
        <li class="list-group-item d-flex flex-column">
          <div class="d-flex justify-content-between align-items-center">
            <span>${file.name}</span>
            <span class="badge bg-secondary">${size}</span>
          </div>
          <span class="mt-2">
            <p class="border rounded p-3 text-nowrap bg-black text-white overflow-auto">
              scp -P 2222 -o "ProxyJump=bastion@${connectionInformations.infra}.linkuma.ovh:2200" "[CHEMIN]\\${file.name}" ${connectionInformations.domain}@apache.group${connectionInformations.group}.svc.cluster.local:${copyPath}
            </p>
          </span>
        </li>`);
    }
  } else {
    fileList.addClass("d-none");
  }
});

$("table tbody").on("click", ".delete-btn", function (e) {
  e.stopPropagation();
  const path = $(this).data("path");
  const name = $(this).data("name");
  const isFolder = $(this).data("type") === "folder";
  handleDelete(path, name, isFolder);
});

$("table tbody").on("click", ".rename-btn", function (e) {
  e.stopPropagation();
  const path = $(this).data("path");
  const name = $(this).data("name");
  const isFolder = $(this).data("type") === "folder";
  handleRename(path, name, isFolder);
});

$(document).ready(function () {
  // Obtenir les informations de la connection
  getConnectionInformations();

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

  // ----------------------------------- Refresh button click event
  $("#refreshBtn").on("click", function () {
    const $btn = $(this);
    const originalHtml = $btn.html();
    $btn.html(
      '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Refreshing...'
    );
    $btn.prop("disabled", true);

    loadFiles(currentPath, true);

    setTimeout(function () {
      $btn.html(originalHtml);
      $btn.prop("disabled", false);
    }, 1000);
  });

  // ----------------------------------- Create file button click event
  $("#createFileForm").on("submit", handleCreateFileSubmit);

  $("#createFolderForm").on("submit", handleCreateFolderSubmit);

  $("#createFileModal, #createFolderModal").on("hidden.bs.modal", function () {
    $(this).find("form")[0].reset();
  });

  // ----------------------------------- Upload button opens modal
  $("#uploadBtn").on("click", function () {
    $("#uploadModal").modal("show");
  });

  $("#uploadForm").on("submit", handleFileUpload);

  $("#uploadModal").on("hidden.bs.modal", function () {
    $(this).find("form")[0].reset();
    $("#uploadProgress").addClass("d-none");
    $("#fileList").addClass("d-none").find("ul").empty();
  });
});

let codeMirrorEditor;

$("#editFileModal").on("shown.bs.modal", function () {
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
});

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
