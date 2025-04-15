import {
  loadFiles,
  createFolder,
  createFile,
  deleteItem,
  renameItem,
  readFile,
  updateFile,
  getCurrentPath,
} from "./fileManager.js";
import { uploadFiles, updateFileListDisplay } from "./uploadManager.js";
import {
  getConnectionInfo,
  getStoredConnectionInfo,
} from "./connectionManager.js";
import {
  initEditor,
  setEditorMode,
  setEditorContent,
  getEditorContent,
} from "./editorManager.js";

/**
 * Initialize all UI event handlers
 */
function initEventHandlers() {
  // Directory navigation handlers
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

  // File operations handlers
  $("table tbody").on("click", ".delete-btn", function (e) {
    e.stopPropagation();
    const path = $(this).data("path");
    const name = $(this).data("name");
    const isFolder = $(this).data("type") === "folder";

    deleteItem(path, name, isFolder)
      .then(() => {
        loadFiles(getCurrentPath())
        toastr.success("Fichier supprimé avec succès !")
      })
      .catch((error) => alert(error));
  });

  $("table tbody").on("click", ".rename-btn", function (e) {
    e.stopPropagation();
    const path = $(this).data("path");
    const name = $(this).data("name");
    const isFolder = $(this).data("type") === "folder";

    renameItem(path, name, isFolder)
      .then(() => loadFiles(getCurrentPath()))
      .catch((error) => {
        if (error !== "Rename cancelled or no change") {
          alert(error);
        }
      });
  });

  // File editing handlers
  $("table tbody").on("click", ".edit-btn", function (e) {
    e.stopPropagation();
    const path = $(this).data("path");
    const name = $(this).data("name");

    $("#editFilePath").val(path);
    $("#editFileModalLabel").text(`Editing: ${name}`);

    toastr.info("Chargement du fichier...")

    readFile(path)
      .then((data) => {
        if (data.success) {
          setEditorMode(name);
          setEditorContent(data.content);
          $("#editFileModal").modal("show");
        } else {
          toastr.error("Erreur lors du chargement du fichier : " + data.error);
        }
      })
      .catch((error) => alert("Error loading file: " + error));
  });

  $("#editFileForm").on("submit", function (e) {
    e.preventDefault();
    const path = $("#editFilePath").val();
    const content = getEditorContent();

    toastr.info("Enregistrement du fichier...")

    updateFile(path, content)
      .then((response) => {
        if (response.success) {
          $("#editFileModal").modal("hide");
          loadFiles(getCurrentPath());
        } else {
          alert("Error saving file: " + response.error);
        }
      })
      .catch((error) => alert("Failed to save file: " + error));
  });

  // Create folder handler
  $("#createFolderForm").on("submit", function (e) {
    e.preventDefault();
    const folderName = $("#foldername").val();

    createFolder(folderName)
      .then((response) => {
        if (response.success) {
          $("#createFolderModal").modal("hide");
          loadFiles(getCurrentPath());
          $("#foldername").val("");

          toastr.success("Dossier créé avec succès !")
        } else {
          alert("Error creating folder: " + response.error);
        }
      })
      .catch((error) => alert("Failed to create folder: " + error));
  });

  // Create file handler
  $("#createFileForm").on("submit", function (e) {
    e.preventDefault();
    const filename = $("#filename").val();
    const content = $("#filecontent").val();

    createFile(filename, content)
      .then((response) => {
        if (response.success) {
          $("#createFileModal").modal("hide");
          loadFiles(getCurrentPath());
          $("#filename").val("");
          $("#filecontent").val("");

          toastr.success("Fichier créé avec succès !")
        } else {
          alert("Error creating file: " + response.error);
        }
      })
      .catch((error) => alert("Failed to create file: " + error));
  });

  // Upload file handlers
  $("#fileUpload").on("change", function () {
    getConnectionInfo()
      .then((connectionInfo) => {
        updateFileListDisplay(this.files, connectionInfo);
      })
      .catch((error) => {
        updateFileListDisplay(this.files, null);
      });
  });

  $("#uploadForm").on("submit", function (e) {
    e.preventDefault();

    const fileInput = document.getElementById("fileUpload");
    if (!fileInput.files.length) {
      alert("Please select at least one file to upload");
      return;
    }

    const formData = new FormData();
    for (let i = 0; i < fileInput.files.length; i++) {
      formData.append("files", fileInput.files[i]);
    }

    uploadFiles(formData)
      .then((response) => {
        if (response.success) {
          const filesUploaded = response.filesUploaded || 0;
          toastr.success(`Successfully uploaded ${filesUploaded} file(s)`);

          $("#uploadModal").modal("hide");
          loadFiles(getCurrentPath());

          $("#uploadForm")[0].reset();
          $("#fileList").addClass("d-none").find("ul").empty();
          $("#uploadProgress").addClass("d-none");
        } else {
          alert("Error uploading files: " + response.error);
        }
      })
      .catch((error) => {
        console.error(error);
        alert("Failed to upload files: " + error);
        $("#uploadProgress").addClass("d-none");
      });
  });

  // Refresh button handler
  $("#refreshBtn").on("click", function () {
    const $btn = $(this);
    const originalHtml = $btn.html();
    $btn.html(
      '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Refreshing...'
    );
    $btn.prop("disabled", true);

    loadFiles(getCurrentPath(), true);

    setTimeout(function () {
      $btn.html(originalHtml);
      $btn.prop("disabled", false);
    }, 1000);
  });

  // Modal event handlers
  $("#createFileModal, #createFolderModal").on("hidden.bs.modal", function () {
    $(this).find("form")[0].reset();
  });

  $("#uploadBtn").on("click", function () {
    $("#uploadModal").modal("show");
  });

  $("#uploadModal").on("hidden.bs.modal", function () {
    $(this).find("form")[0].reset();
    $("#uploadProgress").addClass("d-none");
    $("#fileList").addClass("d-none").find("ul").empty();
  });

  $("#editFileModal").on("shown.bs.modal", function () {
    initEditor();
  });
}

export { initEventHandlers };
