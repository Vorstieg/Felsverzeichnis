import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

HOST = '100.85.95.46'
USER = 'vorstieg'
PASSWORD = 'V0rst!eg'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD)

sftp = ssh.open_sftp()
sftp.put('fels-api/index.js', '/home/vorstieg/felslager/index.js')
sftp.close()

stdin, stdout, stderr = ssh.exec_command('''
cd /home/vorstieg/felslager
pm2 restart felslager

cd /home/vorstieg/fels-data/entries
find . -name "*.glb" ! -name "*-low.glb" | while read filepath; do
    dir=$(dirname "$filepath")
    base=$(basename "$filepath" .glb)
    low_path="${dir}/${base}-low.glb"
    
    echo "Generating $low_path from $filepath"
    # Overwrite the old low-res model that was generated from the corrupted 3MB file
    npx -y @gltf-transform/cli resize "$filepath" "$low_path" --width 512 --height 512
    npx -y @gltf-transform/cli optimize "$low_path" "$low_path" --texture-compress webp
done
''')
stdout.channel.recv_exit_status()
print(stdout.read().decode('utf-8', errors='ignore'))
print(stderr.read().decode('utf-8', errors='ignore'))

ssh.close()
