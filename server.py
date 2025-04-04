from flask import Flask, request, jsonify, send_file, render_template, url_for
import paramiko
import io
import os
import stat
from datetime import datetime

app = Flask(__name__)

@app.route('/')
def index():
    """Simple index route."""
    return render_template('index.html')

# ----------------- API ----------------------

# Configuration for your SSH connection
SSH_CONFIG = {
    'ip': "localhost",
    'port': 22,
    'username': "cesta",
    'password': "iantenaina"
}

def create_ssh_connection():
    """Creates and returns a connected SSH client."""
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        SSH_CONFIG['ip'],
        port=SSH_CONFIG['port'],
        username=SSH_CONFIG['username'],
        password=SSH_CONFIG['password']
    )
    return client

@app.route('/api/list', methods=['GET'])
def list_files():
    """List files in the specified directory on the remote Linux server with metadata."""
    directory = request.args.get('dir', '.')  # default directory is '.'
    try:
        ssh_client = create_ssh_connection()
        sftp = ssh_client.open_sftp()

        files = []
        for attr in sftp.listdir_attr(directory):
            filename = attr.filename
            # Join using forward slash to match Linux paths
            filepath = directory.rstrip('/') + '/' + filename
            is_dir = stat.S_ISDIR(attr.st_mode)

            files.append({
                'name': filename,
                'path': filepath,
                'is_dir': is_dir,
                'type': 'folder' if is_dir else 'file',
                'size': '-' if is_dir else attr.st_size,
                'modified': datetime.fromtimestamp(attr.st_mtime).strftime('%b %d, %Y %H:%M')
            })

        sftp.close()
        ssh_client.close()
        return jsonify({'files': files})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/download', methods=['GET'])
def download_file():
    """Download a file from the remote server."""
    file_path = request.args.get('path')
    if not file_path:
        return jsonify({'error': 'Missing file path'}), 400

    try:
        ssh_client = create_ssh_connection()
        sftp = ssh_client.open_sftp()
        
        file_obj = io.BytesIO()
        sftp.getfo(file_path, file_obj)
        sftp.close()
        ssh_client.close()
        
        file_obj.seek(0)
        return send_file(file_obj, as_attachment=True, download_name=file_path.split('/')[-1])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/create-file', methods=['POST'])
def create_file():
    """Create a new file on the remote server."""
    try:
        data = request.json
        file_path = data.get('path')
        content = data.get('content', '')
        
        if not file_path:
            return jsonify({'error': 'Missing file path'}), 400
            
        ssh_client = create_ssh_connection()
        sftp = ssh_client.open_sftp()
        
        # Create file with content
        with sftp.file(file_path, 'w') as f:
            f.write(content)
            
        sftp.close()
        ssh_client.close()
        
        return jsonify({'success': True, 'message': 'File created successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/create-folder', methods=['POST'])
def create_folder():
    """Create a new folder on the remote server."""
    try:
        data = request.json
        folder_path = data.get('path')
        
        if not folder_path:
            return jsonify({'error': 'Missing folder path'}), 400
            
        ssh_client = create_ssh_connection()
        sftp = ssh_client.open_sftp()
        
        # Create directory
        sftp.mkdir(folder_path)
            
        sftp.close()
        ssh_client.close()
        
        return jsonify({'success': True, 'message': 'Folder created successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/upload-multiple', methods=['POST'])
def upload_multiple_files():
    """Upload multiple files to the remote server."""
    try:
        # Check if files are included in request
        if 'files' not in request.files:
            return jsonify({'error': 'No file part'}), 400
            
        files = request.files.getlist('files')
        
        # If no files were selected
        if len(files) == 0 or files[0].filename == '':
            return jsonify({'error': 'No selected files'}), 400
            
        # Get destination path
        path = request.form.get('path', '.')
            
        # Create SSH connection
        ssh_client = create_ssh_connection()
        sftp = ssh_client.open_sftp()
        
        files_uploaded = 0
        
        # Upload each file
        for file in files:
            if file.filename:
                # Get the full path where to save the file
                if path == '.':
                    dest_path = file.filename
                else:
                    dest_path = path.rstrip('/') + '/' + file.filename
                
                # Upload the file
                file_obj = io.BytesIO(file.read())
                sftp.putfo(file_obj, dest_path)
                files_uploaded += 1
        
        sftp.close()
        ssh_client.close()
        
        return jsonify({
            'success': True, 
            'message': f'Uploaded {files_uploaded} files successfully',
            'filesUploaded': files_uploaded
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/delete', methods=['POST'])
def delete_item():
    """Delete a file or folder on the remote server."""
    try:
        data = request.json
        item_path = data.get('path')
        
        if not item_path:
            return jsonify({'error': 'Missing path'}), 400
            
        ssh_client = create_ssh_connection()
        sftp = ssh_client.open_sftp()
        
        # Check if it's a directory or file
        try:
            # Try to get attributes to determine if file or directory
            attr = sftp.stat(item_path)
            is_dir = stat.S_ISDIR(attr.st_mode)
            
            if is_dir:
                # For directories, we need to use SSH commands as SFTP doesn't have recursive delete
                # First check if directory is empty
                files = sftp.listdir(item_path)
                if files:
                    # Non-empty directory requires recursive delete
                    ssh_stdin, ssh_stdout, ssh_stderr = ssh_client.exec_command(f"rm -rf '{item_path}'")
                    if ssh_stderr.read():
                        return jsonify({'error': 'Failed to delete directory'}), 500
                else:
                    # Empty directory can be removed with SFTP
                    sftp.rmdir(item_path)
            else:
                # For files, we can use SFTP's remove
                sftp.remove(item_path)
            
            sftp.close()
            ssh_client.close()
            
            return jsonify({'success': True, 'message': 'Item deleted successfully'})
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/rename', methods=['POST'])
def rename_item():
    """Rename a file or folder on the remote server."""
    try:
        data = request.json
        old_path = data.get('oldPath')
        new_path = data.get('newPath')
        
        if not old_path or not new_path:
            return jsonify({'error': 'Missing path information'}), 400
            
        ssh_client = create_ssh_connection()
        sftp = ssh_client.open_sftp()
        
        # Rename the item (works for both files and directories)
        sftp.rename(old_path, new_path)
        
        sftp.close()
        ssh_client.close()
        
        return jsonify({'success': True, 'message': 'Item renamed successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/read-file', methods=['GET'])
def read_file():
    path = request.args.get('path')
    if not path:
        return jsonify(success=False, error="Missing 'path' parameter"), 400

    try:
        sftp = create_ssh_connection().open_sftp()
        with sftp.file(path, mode='r') as f:
            content = f.read().decode('utf-8')
        return jsonify(success=True, content=content)
    except Exception as e:
        return jsonify(success=False, error=str(e)), 500

@app.route('/api/update-file', methods=['POST'])
def update_file():
    data = request.get_json()
    path = data.get('path')
    content = data.get('content')

    if not path or content is None:
        return jsonify(success=False, error="Missing 'path' or 'content'"), 400

    try:
        sftp = create_ssh_connection().open_sftp()
        with sftp.file(path, mode='w') as f:
            f.write(content.encode('utf-8'))
        return jsonify(success=True)
    except Exception as e:
        return jsonify(success=False, error=str(e)), 500