import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

HOST = '100.85.95.46'
USER = 'vorstieg'
PASSWORD = 'V0rst!eg'
LOCAL_API_DIR = 'C:\\Users\\Robin\\IdeaProjects\\Felsverzeichnis\\fels-api'
REMOTE_API_DIR = '/home/vorstieg/felslager'

try:
    print("Connecting to server...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=10)
    
    print("Uploading index.js and package.json...")
    sftp = ssh.open_sftp()
    sftp.put(f"{LOCAL_API_DIR}\\index.js", f"{REMOTE_API_DIR}/index.js")
    sftp.put(f"{LOCAL_API_DIR}\\package.json", f"{REMOTE_API_DIR}/package.json")
    sftp.close()
    
    commands = [
        f"cd {REMOTE_API_DIR} && npm install",
        f"cd {REMOTE_API_DIR} && pm2 restart felslager || pm2 start index.js --name felslager"
    ]
    
    for cmd in commands:
        print(f"--- Running: {cmd} ---")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        
        exit_status = stdout.channel.recv_exit_status()
        out = stdout.read().decode('utf-8', errors='ignore').strip()
        err = stderr.read().decode('utf-8', errors='ignore').strip()
        if out:
            print(out)
        if err:
            print("ERROR:", err)
        if exit_status != 0:
            print(f"Command failed with status {exit_status}")
            
    ssh.close()
    print("Deployed and restarted felslager successfully.")
except Exception as e:
    print(f"Failed to connect or execute: {e}")
    sys.exit(1)
