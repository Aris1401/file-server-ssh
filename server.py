from flask import Flask, request, jsonify, send_file, render_template, url_for, session, redirect, flash
import paramiko
import io
import os
import stat
import time
from datetime import datetime

from throttled_stream import ThrottledStream

app = Flask(__name__)
app.secret_key = 'tsarajoro-key'

# Prendre en compte l'avencement des uploads
upload_progress = {}

@app.route('/files')
def index():
    return render_template('index.html')

@app.route('/', methods=['GET'])
def login():
    return render_template('login.html')

@app.route('/login', methods=['POST'])
def do_login():
    domain_name = request.form['domainName']
    group = request.form['group']
    infra = request.form['infra']

    session['domain_name'] = domain_name
    session['group'] = group
    session['infra'] = infra

    flash("Connexion reussi")
    
    return redirect(url_for('index'))

@app.route('/terminal', methods=['GET'])
def terminal():
    return render_template('terminal.html', domain=session['domain_name'], group=session['group'])

# ----------------- API ----------------------

SSH_CONFIG = {
    'ip': "localhost",
    'port': 22,
    'username': "cesta",
    'password': "iantenaina"
}

# def create_ssh_connection():
#     bastion_host =  session['infra'] + '.linkuma.ovh'
#     bastion_port = 2200
#     bastion_user = 'bastion'
#     bastion_key = 'D:/ssh/tech-tsarajoro'

#     final_host = 'apache.group' + session['group'] + '.svc.cluster.local'
#     final_port = 2222

#     bastion_client = paramiko.SSHClient()
#     bastion_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

#     bastion_client.connect(bastion_host, port=bastion_port, username=bastion_user, key_filename=bastion_key)

#     bastion_transport = bastion_client.get_transport()
#     dest_addr = (final_host, final_port)

#     channel = bastion_transport.open_channel('direct-tcpip', dest_addr, ('localhost', 0))

#     final_client = paramiko.SSHClient()
#     final_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
#     final_client.connect(final_host, port=final_port, username=session['domain_name'], sock=channel)

#     return final_client

def create_ssh_connection():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        SSH_CONFIG['ip'],
        port=SSH_CONFIG['port'],
        username=SSH_CONFIG['username'],
        password=SSH_CONFIG['password']
    )
    return client

@app.route('/api/infos', methods=['GET'])
def get_connection_infos():
    infos = {
        'domain': session['domain_name'],
        'group': session['group'],
        'infra': session['infra'],
        'cmd': 'ssh -o "ProxyJump=bastion@' + session['infra'] + '.linkuma.ovh:2200" -p 2222 ' + session['domain_name'] + '@apache.group' + session['group'] + '.svc.cluster.local' 
    }

    return jsonify({ 'data': infos })

@app.route('/api/list', methods=['GET'])
def list_files():
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

        files.sort(key= lambda file: file['name'])
        files.reverse()
        files.sort(key= lambda file: file['is_dir'])
        files.reverse()

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
    try:
        data = request.json
        file_path = data.get('path')
        content = data.get('content', '')
        
        if not file_path:
            return jsonify({'error': 'Missing file path'}), 400
            
        ssh_client = create_ssh_connection()
        sftp = ssh_client.open_sftp()
        
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
        
        sftp.mkdir(folder_path)
            
        sftp.close()
        ssh_client.close()
        
        return jsonify({'success': True, 'message': 'Folder created successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Callback de pourcentage d'upload
def progress_callback(upload_id, filename, total_size, bytes_transferred):
    """Callback function for tracking progress of a single file."""
    progress = 100

    print(f'Total Size: {total_size}')

    if (total_size > 0):
        progress = (bytes_transferred / total_size) * 100
    
    upload_progress[upload_id] = {
        'filename': filename,
        'progress': progress
    }
    
    print(f"Upload {filename}: {progress:.2f}% done.")

@app.route('/api/upload-multiple', methods=['POST'])
def upload_multiple_files():
    try:
        upload_id = request.form.get('uploadId')
        if not upload_id:
            upload_id = str(request.cookies.get("uploadId"))

        if not upload_id:
            upload_id = str(time.time())

        if 'files' not in request.files:
            return jsonify({'error': 'No file part'}), 400
            
        upload_progress[upload_id] = {'progress': 0}

        files = request.files.getlist('files')

        if len(files) == 0 or files[0].filename == '':
            return jsonify({'error': 'No selected files'}), 400
            
        path = request.form.get('path', '.')
            
        ssh_client = create_ssh_connection()
        sftp = ssh_client.open_sftp()
        
        files_uploaded = 0
        
        for file in files:
            if file.filename:
                if path == '.':
                    dest_path = file.filename
                else:
                    dest_path = path.rstrip('/') + '/' + file.filename
                
                file_data = file.read()
                total_size = len(file_data)

                # Wrap in BytesIO, then ThrottledStream
                file_buffer = io.BytesIO(file_data)
                
                slow_stream = ThrottledStream(file_buffer, chunk_size=4096, delay=0.02)
                
                # Modified version
                # The correct version
                sftp.putfo(slow_stream, dest_path, callback=lambda bytes_transferred, total_size_sftp: progress_callback(upload_id, file.filename, total_size, bytes_transferred))
                files_uploaded += 1
        
        sftp.close()
        ssh_client.close()
        
        return jsonify({
            'success': True, 
            'message': f'Uploaded {files_uploaded} files successfully',
            'filesUploaded': files_uploaded
        })
    except Exception as e:
        print(e)
        return jsonify({'error': str(e)}), 500

@app.route('/api/upload-progress')
def upload_progress_status():
    """Return the current upload progress for a given upload ID."""
    progress = upload_progress.get(request.args.get('uploadId'))
    if not progress:
        return jsonify({'error': 'Invalid upload ID'}), 404
    return jsonify(progress)

@app.route('/api/delete', methods=['POST'])
def delete_item():
    try:
        data = request.json
        item_path = data.get('path')
        
        if not item_path:
            return jsonify({'error': 'Missing path'}), 400
            
        ssh_client = create_ssh_connection()
        sftp = ssh_client.open_sftp()
        
        try:
            attr = sftp.stat(item_path)
            is_dir = stat.S_ISDIR(attr.st_mode)
            
            if is_dir:
                files = sftp.listdir(item_path)
                if files:
                    ssh_stdin, ssh_stdout, ssh_stderr = ssh_client.exec_command(f"rm -rf '{item_path}'")
                    if ssh_stderr.read():
                        return jsonify({'error': 'Failed to delete directory'}), 500
                else:
                    sftp.rmdir(item_path)
            else:
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
    try:
        data = request.json
        old_path = data.get('oldPath')
        new_path = data.get('newPath')
        
        if not old_path or not new_path:
            return jsonify({'error': 'Missing path information'}), 400
            
        ssh_client = create_ssh_connection()
        sftp = ssh_client.open_sftp()
        
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

@app.route('/api/exec', methods=['POST'])
def execute_command():
    data = request.get_json()
    command = data.get('command')

    if not command:
        return jsonify(success=False, error="Missing 'command'"), 400

    try:
        ssh_client = create_ssh_connection()
        stdin, stdout, stderr = ssh_client.exec_command(command)
        result = stdout.read().decode('utf-8')
        error = stderr.read().decode('utf-8')

        if error:
            print(error)
            return jsonify(success=False, error=error), 500

        formatted_result = format_table_for_terminal(result)

        return jsonify(success=True, result=formatted_result)

    except Exception as e:
        return jsonify(success=False, error=str(e)), 500

def format_table_for_terminal(result):
    # You may want to split the result into rows and columns based on your command's output
    # Here we assume the result is space-separated, but this can vary based on your command

    lines = result.splitlines()
    formatted_result = []

    for line in lines:
        # Split each line into columns (assuming space separation for simplicity)
        columns = line.split()
        formatted_result.append(" | ".join(columns))  # Join columns with " | " for a table-like format
    
    # Join all the formatted lines into a single string with new lines
    return "\n".join(formatted_result)