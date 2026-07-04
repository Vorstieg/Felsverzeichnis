# Remote RealityCapture CLI & Wine Export Guide

This document describes how to connect to the remote Ubuntu server, locate the relevant files/paths, run RealityCapture (`realityscan-cli`) commands under Wine, and troubleshoot common export issues.

---

## 1. Connection Credentials

*   **Host:** `100.85.95.46`
*   **User:** `vorstieg`
*   **Password:** `V0rst!eg`
*   **SSH Port:** `22` (Standard)
*   **VNC Port:** `5900` (Direct access to virtual frame buffer display `:99`)

---

## 2. Remote SSH Commands & Automation

To run commands on the remote machine programmatically or via a shell, you can use SSH. Below is a Python script snippet using `paramiko` to run commands and read output in real time.

```python
import paramiko

# Establish connection
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('100.85.95.46', username='vorstieg', password='V0rst!eg')

# Execute a command
stdin, stdout, stderr = ssh.exec_command("ls -la /home/vorstieg/.realityscan/realityscan/drive_c/")

# Print the output
for line in stdout:
    print(line.strip())

ssh.close()
```

---

## 3. Remote Directory Layout & Key Paths

### Linux Paths
*   **Wine Drive C:** `/home/vorstieg/.realityscan/realityscan/drive_c/`
*   **Project Path:** `/home/vorstieg/runs/dji_2411_only_run/DJI_2411/reconstruction/`
*   **RealityScan CLI Script:** `/usr/bin/realityscan-cli` (Wine wrapper script for `RealityScan.exe`)
*   **WINEPREFIX:** `/home/vorstieg/.realityscan/realityscan`

### Wine Drive Mapping Equivalent (inside RealityCapture / Wine commands)
*   **C Drive Root (`C:\`):** `/home/vorstieg/.realityscan/realityscan/drive_c/`
*   **Z Drive Root (`Z:\`):** Root of the remote Linux filesystem (`/`)
*   **Settings XML (`C:\export_settings.xml`):** `/home/vorstieg/.realityscan/realityscan/drive_c/export_settings.xml`
*   **Project File (`Z:\home\vorstieg\...`):** `Z:\home\vorstieg\runs\dji_2411_only_run\DJI_2411\reconstruction\project.rsproj`

---

## 4. How to Run RealityCapture Commands

RealityCapture is run via Epic Games' `realityscan-cli` Wine wrapper. Because it requires a graphics context (DirectX/OpenGL), running it purely headless without a display buffer fails.

### Option A: Running Headlessly (with virtual framebuffer `xvfb-run`)
Using `xvfb-run -a` automatically spawns a temporary virtual display buffer, configures the environment, and runs the command. 

```bash
# Export camera registration to the local C drive (recommended to avoid network I/O issues)
xvfb-run -a realityscan-cli -headless -stdConsole \
  -load 'Z:\home\vorstieg\runs\dji_2411_only_run\DJI_2411\reconstruction\project.rsproj' \
  -selectMaximalComponent \
  -exportRegistration 'C:\registration_test.csv' 'C:\export_settings.xml' \
  -quit
```
*Note: Always export to `C:\...` first and then copy the resulting `.csv` file to the target Linux folder. Writing directly to network-mapped drives (like `Z:\...`) under Wine can cause random I/O crashes.*

### Option B: Running with a Persistent Display & VNC (Inspecting the GUI)
A virtual framebuffer is running persistently on display `:99` along with `x11vnc` on port `5900`. You can connect with any VNC client (using the credentials above) and launch commands directly:

```bash
# Launch on persistent display :99 to view the GUI via VNC
DISPLAY=:99 realityscan-cli -stdConsole \
  -load 'Z:\home\vorstieg\runs\dji_2411_only_run\DJI_2411\reconstruction\project.rsproj'
```

---

## 5. Exporter Configuration Details

When exporting camera registrations (OpenCV format), you must pass a settings XML file. 

*   **Format GUID:** `{B5331837-609D-4B12-A931-2863653D19F7}` (represents `OpenCV-compliant Internal/External Camera Parameters`)
*   **Export Settings XML Structure:** The settings file MUST use `<Registration>` as the root tag. Using `<ReconstructionExportSettings>` causes RealityCapture to crash or hang.
*   **Settings Template (`C:\export_settings.xml`):**
    ```xml
    <?xml version="1.0" encoding="utf-8"?>
    <Registration exportCoordinateSystemType="0" formatId="{B5331837-609D-4B12-A931-2863653D19F7}" exportCameras="1" exportPoints="0" exportCamerasAsModelPart="0">
      <Header magic="5786959" version="1"/>
    </Registration>
    ```

---

## 6. Troubleshooting & Common Pitfalls

1.  **Error `0x887a0004` (DXGI_ERROR_UNSUPPORTED):**
    *   *Cause:* Occurs when RealityCapture fails to initialize a graphics device (e.g. running outside of a display server context).
    *   *Fix:* Prepend the command with `xvfb-run -a` or set `DISPLAY=:99` if the persistent Xvfb display is active.
2.  **Command hangs/freezes infinitely:**
    *   *Cause A:* RealityCapture is showing an interactive dialog box (e.g. asking for export file locations, registration coordinates system, or license validation). Because it is running headlessly, the dialog is invisible and blocks indefinitely.
    *   *Fix A:* Ensure you pass both the target export path and the settings XML file path explicitly. Check if you can connect via VNC on port `5900` to interact with any blocking popups.
    *   *Cause B:* MSXML native library overrides. Ensure Wine is configured to use the stable built-in DLLs instead of native placeholders.
3.  **Process Cleanup:**
    If RealityCapture gets stuck, you can clean up all Wine/RealityScan processes using:
    ```bash
    killall -9 RealityScan.exe winedevice.exe explorer.exe rpcss.exe
    ```
