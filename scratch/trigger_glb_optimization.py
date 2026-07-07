import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

HOST = '100.85.95.46'
USER = 'vorstieg'
PASSWORD = 'V0rst!eg'

try:
    print("Connecting to server...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=10)
    
    script = """
    cd /home/vorstieg/felslager
    source .env 2>/dev/null || true
    
    API_USER=${API_USER:-admin}
    API_PASS=${API_PASSWORD:-password}
    
    DATA_DIR=/home/vorstieg/fels-data/entries
    
    # Process each GLB file
    find "$DATA_DIR" -type f -name "*.glb" ! -name "*-low.glb" | while read -r filepath; do
        echo "Processing $filepath..."
        
        # Determine the API path (relative to DATA_DIR)
        api_path="${filepath#$DATA_DIR/}"
        
        # URL encode the api_path using jq if available, otherwise just use it
        # Actually curl doesn't need url encoding for the path if we just use it raw, but we'll try without first
        
        # Move the file out of the data directory to a temp file
        temp_file="/tmp/$(basename "$filepath")"
        mv "$filepath" "$temp_file"
        
        # URL encode the api_path
        encoded_path=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1]))" "$api_path")
        url="http://localhost:3001/api/fs/$encoded_path"
        echo "Uploading to $url..."
        
        # Use curl to trigger the PUT request (re-uploading triggers compression)
        curl -s -u "$API_USER:$API_PASS" -X PUT --data-binary @"$temp_file" "$url"
        
        echo "Done with $api_path"
        echo "--------------------------"
    done
    """
    
    print("Executing optimization script on server...")
    stdin, stdout, stderr = ssh.exec_command(script)
    
    while True:
        line = stdout.readline()
        if not line:
            break
        print(line.strip())
        
    err = stderr.read().decode('utf-8')
    if err:
        print("ERROR:", err)
        
    ssh.close()
    print("All models processed.")
except Exception as e:
    print(f"Failed to connect or execute: {e}")
    sys.exit(1)
