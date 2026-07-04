import paramiko
import os

HOST = '100.85.95.46'
USER = 'vorstieg'
PASSWORD = 'V0rst!eg'
LOCAL_DIR = r'C:\Users\Robin\IdeaProjects\Felsverzeichnis\src\entries'
REMOTE_DIR = '/home/vorstieg/fels-data/entries'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD)

sftp = ssh.open_sftp()

def upload_dir(local_path, remote_path):
    try:
        sftp.mkdir(remote_path)
    except IOError:
        pass
        
    for item in os.listdir(local_path):
        lp = os.path.join(local_path, item)
        rp = remote_path + '/' + item
        if os.path.isdir(lp):
            upload_dir(lp, rp)
        else:
            print(f'Uploading {lp} to {rp}')
            sftp.put(lp, rp)

print('Starting upload...')
upload_dir(LOCAL_DIR, REMOTE_DIR)
print('Done!')
sftp.close()
ssh.close()
