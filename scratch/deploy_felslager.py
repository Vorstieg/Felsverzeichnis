import paramiko
import sys
import os

HOST = '100.85.95.46'
USER = 'vorstieg'
PASSWORD = 'V0rst!eg'
LOCAL_API_DIR = 'C:\\Users\\Robin\\IdeaProjects\\Felsverzeichnis\\fels-api'
REMOTE_API_DIR = '/home/vorstieg/felslager'

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=10)
    
    # Kill old PM2 process and rename folder
    ssh.exec_command('pm2 delete fels-api')
    ssh.exec_command('mv /home/vorstieg/fels-api /home/vorstieg/felslager')
    ssh.exec_command(f'mkdir -p {REMOTE_API_DIR}')
    
    # Upload new files
    sftp = ssh.open_sftp()
    sftp.put(f"{LOCAL_API_DIR}/index.js", f"{REMOTE_API_DIR}/index.js")
    sftp.put(f"{LOCAL_API_DIR}/package.json", f"{REMOTE_API_DIR}/package.json")
    sftp.close()
    
    # Start PM2 as felslager
    start_cmd = f"cd {REMOTE_API_DIR} && npm install && pm2 start index.js --name felslager"
    stdin, stdout, stderr = ssh.exec_command(start_cmd)
    
    # Wait for completion
    stdout.channel.recv_exit_status()
    ssh.close()
    print("Deployed and started as felslager")
except Exception as e:
    sys.exit(1)
