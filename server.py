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
