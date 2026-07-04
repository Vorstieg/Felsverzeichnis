import paramiko

HOST = '100.85.95.46'
USER = 'vorstieg'
PASSWORD = 'V0rst!eg'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD)

stdin, stdout, stderr = ssh.exec_command('curl -s "http://127.0.0.1:3001/api/fs/?recursive=true"')
print(stdout.read().decode()[:500])
ssh.close()
