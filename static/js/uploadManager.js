import { formatSize } from './utils.js';
import { getCurrentPath } from './fileManager.js';

/**
 * Handle file upload
 * @param {FormData} formData - Form data containing files to upload
 * @return {Promise} Upload promise
 */
function uploadFiles(formData) {
  const uploadId = Date.now().toString();
  formData.append("uploadId", uploadId);
  formData.append("path", getCurrentPath());

  // Hide the main progress bar as we'll use individual ones
  const progressBar = $("#uploadProgress");
  progressBar.addClass("d-none");

  // Add progress bars to each file in the list
  $("#fileList ul li").each(function() {
    const fileName = $(this).find("span").first().text();
    $(this).find(".file-progress").remove(); // Remove any existing progress bars
    $(this).find("div").first().after(`
      <div class="file-progress mt-2">
        <div class="progress">
          <div class="progress-bar" role="progressbar" style="width: 0%" 
               aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">0%</div>
        </div>
      </div>
    `);
  });

  pollProgress(uploadId);

  return $.ajax({
    url: "/api/upload-multiple",
    type: "POST",
    data: formData,
    processData: false,
    contentType: false,
    complete: function() {
      // Mark any remaining files as complete
      $("#fileList ul li").each(function() {
        const progressBar = $(this).find(".progress-bar");
        if (parseInt(progressBar.attr("aria-valuenow")) < 100) {
          progressBar.css("width", "100%");
          progressBar.attr("aria-valuenow", "100");
          progressBar.text("100%");
        }
      });
    }
  });
}

/**
 * Poll upload progress
 * @param {string} uploadId - Upload ID
 */
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

        if (data.filename) {
          const percent = Math.round(data.progress);
          
          // Find the list item for this file and update its progress bar
          $("#fileList ul li").each(function() {
            const fileName = $(this).find("span").first().text();
            if (fileName === data.filename) {
              const progressBar = $(this).find(".progress-bar");
              progressBar.css("width", percent + "%");
              progressBar.attr("aria-valuenow", percent);
              progressBar.text(percent + "%");
            }
          });
        }

        // Stop polling if all files have reached 100%
        let allComplete = true;
        $("#fileList ul li").each(function() {
          const progressBar = $(this).find(".progress-bar");
          if (parseInt(progressBar.attr("aria-valuenow")) < 100) {
            allComplete = false;
          }
        });
        
        if (allComplete) {
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

/**
 * Update file list display with selected files
 * @param {FileList} files - Selected files
 * @param {Object} connectionInfo - Connection information
 */
function updateFileListDisplay(files, connectionInfo) {
  const fileList = $("#fileList");
  const fileListUl = fileList.find("ul");
  fileListUl.empty();

  if (files.length > 0) {
    fileList.removeClass("d-none");

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const size = formatSize(file.size);

      const copyPath = getCurrentPath().replace(
        ".",
        "/mnt/www/" + connectionInfo?.domain ?? ""
      );

      fileListUl.append(`
        <li class="list-group-item d-flex flex-column">
          <div class="d-flex justify-content-between align-items-center">
            <span>${file.name}</span>
            <span class="badge bg-secondary">${size}</span>
          </div>
          <div class="file-progress mt-2">
            <div class="progress">
              <div class="progress-bar" role="progressbar" style="width: 0%" 
                   aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">0%</div>
            </div>
          </div>
          <span class="mt-2">
            <p class="border rounded p-3 text-nowrap bg-black text-white overflow-auto">
              scp -P 2222 -o "ProxyJump=bastion@${connectionInfo?.infra ?? ""}.linkuma.ovh:2200" "[CHEMIN]\\${file.name}" ${connectionInfo?.domain ?? ""}@apache.group${connectionInfo?.group ?? ""}.svc.cluster.local:${copyPath}
            </p>
          </span>
        </li>`);
    }
  } else {
    fileList.addClass("d-none");
  }
}

export { uploadFiles, updateFileListDisplay };