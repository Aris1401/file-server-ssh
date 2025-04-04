// Global variable to track the current directory.
// Starting directory is "public_html"
var currentPath = ".";

// Update the breadcrumb navigation based on the current path.
function updateBreadcrumb(path) {
  var breadcrumbHtml = '<li class="breadcrumb-item"><a href="#" class="breadcrumb-home" data-path=".">Home</a></li>';
  var parts = path.split('/').filter(function(part) { return part.length > 0; });
  var cumulative = "";
  
  parts.forEach(function(part, index) {
    cumulative += (index === 0 ? part : '/' + part);
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
  if (file.type === 'folder') {
    icon = 'folder-fill text-warning';
  } else if (file.name.endsWith('.html')) {
    icon = 'file-earmark-text';
  } else if (file.name.endsWith('.js')) {
    icon = 'file-earmark-code';
  } else {
    icon = 'file-earmark';
  }

  var $row = $('<tr></tr>');
  
  // If it's a folder, make the entire row clickable.
  if (file.type === 'folder') {
    $row.attr('data-dir', file.path);
    $row.css('cursor', 'pointer');
    // No longer wrap the name in an <a>; plain text is enough.
    var nameCell = `<td><i class="bi bi-${icon} me-2"></i>${file.name}</td>`;
    $row.append(nameCell);
  } else {
    // For files, simply render the name.
    var nameCell = `<td><i class="bi bi-${icon} me-2"></i>${file.name}</td>`;
    $row.append(nameCell);
  }
  
  // Build the rest of the cells.
  $row.append(`<td>${file.type.charAt(0).toUpperCase() + file.type.slice(1)}</td>`);
  $row.append(`<td>${file.size !== '-' ? formatSize(file.size) : '-'}</td>`);
  $row.append(`<td>${file.modified}</td>`);
  
  var downloadBtn = file.type === 'file'
    ? `<a href="/api/download?path=${encodeURIComponent(file.path)}" class="btn btn-sm btn-outline-success" title="Download">
         <i class="bi bi-download"></i>
       </a>`
    : '';
  var actionCell = `<td class="text-end">
                        ${downloadBtn}
                        <button class="btn btn-sm btn-outline-danger"><i class="bi bi-trash"></i></button>
                      </td>`;
  $row.append(actionCell);
  
  $('table tbody').append($row);
}

// Format file sizes in human-readable format.
function formatSize(size) {
  if (size < 1024) return size + ' B';
  else if (size < 1024 * 1024) return (size / 1024).toFixed(2) + ' KB';
  else if (size < 1024 * 1024 * 1024) return (size / (1024 * 1024)).toFixed(2) + ' MB';
  else return (size / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

// Load files from a given directory and update the table and breadcrumb.
function loadFiles(dir) {
  currentPath = dir;
  updateBreadcrumb(currentPath);
  $.get('/api/list', { dir: currentPath }, function(data) {
    if (data.error) {
      alert("Error loading files: " + data.error);
      return;
    }
    var $tbody = $('table tbody');
    $tbody.empty();
    data.files.forEach(function(file) {
      addFileToList(file);
    });
  }).fail(function(jqXHR, textStatus, errorThrown) {
    alert("Failed to load files: " + errorThrown);
  });
}

// Document ready handler
$(document).ready(function() {
  // Initial load of files for the starting directory.
  loadFiles(currentPath);
  
  // Delegate click event for folder rows.
  $('table tbody').on('click', 'tr[data-dir]', function(e) {
    // Prevent click if user clicks on an interactive element like a button or link.
    if ($(e.target).closest('a, button').length > 0) return;
    var newDir = $(this).data('dir');
    loadFiles(newDir);
  });
  
  // Delegate click event for breadcrumb links.
  $('.breadcrumb').on('click', '.breadcrumb-link, .breadcrumb-home', function(e) {
    e.preventDefault();
    var newDir = $(this).data('path');
    loadFiles(newDir);
  });
});

// Handle new folder creation
function createNewFolder() {
    var folderName = prompt("Enter folder name:");
    if (!folderName) return; // User cancelled or entered empty string
    
    var newFolderPath = currentPath === '.' ? 
                        folderName : 
                        currentPath + '/' + folderName;
    
    $.ajax({
      url: '/api/create-folder',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        path: newFolderPath
      }),
      success: function(response) {
        if (response.success) {
          // Reload current directory to show the new folder
          loadFiles(currentPath);
        } else {
          alert("Error creating folder: " + response.error);
        }
      },
      error: function(jqXHR, textStatus, errorThrown) {
        alert("Failed to create folder: " + errorThrown);
      }
    });
  }
  
  // Handle file creation form submission
  function handleCreateFileSubmit(e) {
    e.preventDefault();
    
    var filename = $('#filename').val();
    var content = $('#filecontent').val();
    
    if (!filename) {
      alert("Please enter a file name.");
      return;
    }
    
    var filePath = currentPath === '.' ? 
                   filename : 
                   currentPath + '/' + filename;
    
    $.ajax({
      url: '/api/create-file',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        path: filePath,
        content: content
      }),
      success: function(response) {
        if (response.success) {
          // Close modal and reload current directory
          $('#createFileModal').modal('hide');
          loadFiles(currentPath);
          // Clear form fields
          $('#filename').val('');
          $('#filecontent').val('');
        } else {
          alert("Error creating file: " + response.error);
        }
      },
      error: function(jqXHR, textStatus, errorThrown) {
        alert("Failed to create file: " + errorThrown);
      }
    });
  }