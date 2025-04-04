import paramiko
import time

# Dictionary mapping custom commands to functions that convert them
custom_commands = {
    ":copy": lambda args: f"cp {args[0]} {args[1]}",
    ":liste": lambda args: "ls -l" if not args else f"ls -l {args[0]}",
}

def process_custom_command(command_str):
    # Split the command string into parts
    parts = command_str.strip().split()
    if not parts:
        return command_str  # Return as is if empty

    # Check if the first part is a custom command
    cmd = parts[0]
    if cmd in custom_commands:
        try:
            # Call the function associated with the custom command and pass arguments
            return custom_commands[cmd](parts[1:])
        except Exception as e:
            print(f"Error processing custom command: {e}")
            return ""
    return command_str

def ssh_interactive(ip, port, username, password):
    # Create an SSH client instance
    client = paramiko.SSHClient()
    # Automatically add untrusted hosts (for testing purposes only)
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    # Connect to the remote server
    client.connect(ip, port=port, username=username, password=password)
    # Open an interactive shell session
    channel = client.invoke_shell()
    print("Interactive SSH session established. Type 'exit' to quit.")
    
    try:
        while True:
            # Read command input from the user
            command = input("$ ")
            if command.lower() in [':exit', ':quit']:
                print("Exiting session.")
                break
            
            # Process custom command if applicable
            processed_command = process_custom_command(command)
            if not processed_command:
                continue
            
            # Send the command to the remote server
            channel.send(processed_command + "\n")
            time.sleep(1)
            
            # Retrieve command output
            output = ""
            while channel.recv_ready():
                output += channel.recv(1024).decode("utf-8")
                time.sleep(0.1)
            
            print(output)
    finally:
        channel.close()
        client.close()

if __name__ == "__main__":
    ip = "localhost"
    username = "cesta"
    password = "iantenaina"
    
    ssh_interactive(ip, 22, username, password)
