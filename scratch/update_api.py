import paramiko
import sys
import os

HOST = '100.85.95.46'
USER = 'vorstieg'
PASSWORD = 'V0rst!eg'
API_DIR_REMOTE = '/home/vorstieg/fels-api'
LOCAL_API_FILE = 'C:\\Users\\Robin\\IdeaProjects\\Felsverzeichnis\\fels-api\\index.js'

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=10)
    
    sftp = ssh.open_sftp()
    sftp.put(LOCAL_API_FILE, f"{API_DIR_REMOTE}/index.js")
    sftp.close()
    
    stdin, stdout, stderr = ssh.exec_command(f"cd {API_DIR_REMOTE} && pm2 restart fels-api")
    print(stdout.read().decode())
    ssh.close()
    print("API updated successfully.")
except Exception as e:
    print(f"Failed to update API: {e}")
    sys.exit(1)
