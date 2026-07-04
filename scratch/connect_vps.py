import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

key_path = r'C:\Users\Robin\.ssh\id_ed25519'
vps_ip = '147.93.126.130'
usernames = ['root', 'vorstieg', 'ubuntu', 'robin']
passwords = ['V0rst!eg', None]

def try_connect():
    for user in usernames:
        for pwd in passwords:
            print(f"Trying {user} with {'password' if pwd else 'key'}...")
            try:
                ssh = paramiko.SSHClient()
                ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
                if pwd:
                    ssh.connect(vps_ip, username=user, password=pwd, timeout=5)
                else:
                    key = paramiko.Ed25519Key.from_private_key_file(key_path)
                    ssh.connect(vps_ip, username=user, pkey=key, timeout=5)
                print(f"SUCCESS with {user}!")
                return ssh, user
            except Exception as e:
                pass
    return None, None

ssh, user = try_connect()
if ssh:
    print(f"Connected as {user}. Running commands...")
    commands = [
        "ls -la /etc/nginx/sites-available/",
        "cat /etc/nginx/sites-available/vorstieg.eu"
    ]
    for cmd in commands:
        print(f"--- Running: {cmd} ---")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        out = stdout.read().decode('utf-8', errors='ignore').strip()
        err = stderr.read().decode('utf-8', errors='ignore').strip()
        if out: print(out)
        if err: print("ERROR:", err)
    ssh.close()
else:
    print("Could not connect to VPS with available credentials.")
