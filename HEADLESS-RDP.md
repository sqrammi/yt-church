# Headless GPU-accelerated OBS over RDP

Verified on Ubuntu 26.04.1 Desktop, GNOME 50, and Intel Raptor Lake graphics. This setup provides a persistent GPU-accelerated desktop, one RDP login, and access through an SSH tunnel without an HDMI dummy plug.

Run commands over SSH as the desktop user (`draper` below). Replace the username and server IP for other systems. Use `sudo` only where shown. Ubuntu Desktop/GDM must already be installed.

## 1. Install packages

```bash
sudo apt update
sudo apt install gnome-remote-desktop obs-studio \
  intel-media-va-driver-non-free vainfo ffmpeg openssl
```

The Intel driver package is specific to Intel graphics; other GPUs require their corresponding drivers and encoder configuration.

## 2. Disable console automatic login and system Remote Login

```bash
sudoedit /etc/gdm3/custom.conf
```

Under the existing `[daemon]` section, make sure this is set:

```ini
AutomaticLoginEnable=false
```

Disable the separate system RDP login service:

```bash
sudo systemctl disable --now gnome-remote-desktop.service
```

Do not disable GDM. It creates the dedicated headless session. Run this from SSH because it can disconnect an existing Remote Login connection.

## 3. Fix Ubuntu's headless-session launcher

Ubuntu 26.04's packaged service can fail with `Failed: The connection is closed`: its dynamic account cannot connect to the system D-Bus. Use the existing static GDM account for the launcher. The desktop itself still runs as `draper`.

```bash
sudo mkdir -p \
  /etc/systemd/system/gnome-headless-session@draper.service.d

sudo tee \
  /etc/systemd/system/gnome-headless-session@draper.service.d/static-user.conf \
  >/dev/null <<'UNIT'
[Service]
DynamicUser=no
User=gdm
RestartSec=5s
UNIT

sudo systemctl daemon-reload
```

This workaround was required on the verified system; check whether newer Ubuntu packages have fixed it before applying it elsewhere. Other distributions may use a different GDM account.

## 4. Configure single-user RDP

Generate a certificate as `draper`, without sudo:

```bash
umask 077
mkdir -p ~/.local/share/gnome-remote-desktop/headless

openssl req -new -newkey rsa:3072 -nodes -x509 -days 365 \
  -subj '/CN=headless-rdp' \
  -keyout ~/.local/share/gnome-remote-desktop/headless/rdp.key \
  -out ~/.local/share/gnome-remote-desktop/headless/rdp.crt
```

Configure the headless endpoint:

```bash
grdctl --headless rdp set-tls-key \
  "$HOME/.local/share/gnome-remote-desktop/headless/rdp.key"

grdctl --headless rdp set-tls-cert \
  "$HOME/.local/share/gnome-remote-desktop/headless/rdp.crt"

grdctl --headless rdp set-port 3389
grdctl --headless rdp disable-port-negotiation
grdctl --headless rdp disable-view-only
grdctl --headless rdp set-credentials
grdctl --headless rdp enable
```

Enter the RDP username/password interactively. They need not match the Linux account. AI agents should leave password entry to the user. Do not put passwords in command arguments, scripts, or chat.

Renew the certificate before its one-year expiration. Do not overwrite an existing certificate/key unintentionally when repeating these steps.

## 5. Disable locking and suspend

These settings leave the desktop unlocked between connections and prevent automatic suspend. RDP still authenticates each new connection.

```bash
gsettings set org.gnome.desktop.screensaver lock-enabled false
gsettings set org.gnome.desktop.session idle-delay 0

gsettings set org.gnome.settings-daemon.plugins.power \
  sleep-inactive-ac-type nothing

gsettings set org.gnome.settings-daemon.plugins.power \
  sleep-inactive-battery-type nothing
```

## 6. Apply the Windows App compatibility workaround

FreeRDP 3.32.0/3.32.1 can hang during authentication from Windows App on macOS. Check installed versions:

```bash
dpkg-query -W libfreerdp3-3 libfreerdp-server3-3
```

For affected versions:

```bash
sudo mkdir -p /etc/FreeRDP/FreeRDP
sudoedit /etc/FreeRDP/FreeRDP/HKLM.reg
```

For a new file, enter:

```ini
Windows Registry Editor Version 5.00

[HKEY_LOCAL_MACHINE\Software\FreeRDP\FreeRDP\Server]
"ExtSecurity"=dword:00000000
```

Preserve other settings if the file exists. This disables HYBRID_EX while retaining ordinary NLA and TLS. Reassess the workaround when upgrading FreeRDP.

The Windows App setting `use redirection server name:i:1` is relevant to GNOME's separate multi-user Remote Login mode. This guide connects directly to the single-user endpoint and does not use that GDM login handover.

## 7. Enable services and reboot

```bash
systemctl --user enable gnome-remote-desktop-headless.service

sudo systemctl enable gdm3.service
sudo systemctl enable gnome-headless-session@draper.service
sudo systemctl set-default graphical.target
```

Save all work, then reboot to clear any existing graphical session for `draper`:

```bash
sudo reboot
```

## 8. Connect through SSH

Run on the client:

```bash
ssh -N -o ExitOnForwardFailure=yes \
  -L 127.0.0.1:3389:127.0.0.1:3389 \
  draper@172.9.0.95
```

Configure Windows App:

- PC: `127.0.0.1:3389`
- User account: **Ask When Required**
- Credentials: the RDP credentials from step 4

Expect a certificate prompt on first connection. The desktop should open directly, without an Ubuntu login screen.

No firewall opening is needed for this tunnel. The RDP daemon may still listen on all server interfaces; tunneling alone does not restrict that listener. Keep the intended firewall restrictions in place.

Disconnect when finished; do not log out of Ubuntu if OBS should keep running.

## 9. Verify startup and GPU support

Over SSH, before using any other graphical login:

```bash
systemctl status gnome-headless-session@draper.service --no-pager
systemctl --user status gnome-remote-desktop-headless.service --no-pager
grdctl --headless status
ss -ltn 'sport = :3389'
```

Check Intel hardware encoding:

```bash
vainfo --display drm --device /dev/dri/renderD128

ffmpeg -hide_banner \
  -vaapi_device /dev/dri/renderD128 \
  -f lavfi -i testsrc2=size=1920x1080:rate=30 \
  -vf 'format=nv12,hwupload' \
  -c:v h264_vaapi -b:v 6M -t 5 \
  -f null -
```

The FFmpeg test should finish 150 frames without errors. Confirm the actual render device path on systems with multiple GPUs.

Inside OBS:

- Confirm its log identifies Mesa Intel Graphics, rather than `llvmpipe`.
- Select H.264 VA-API for hardware encoding.
- Use Screen Capture (PipeWire) for desktop capture.
- Make a short recording to verify rendering, capture, and encoding together.

## Troubleshooting

```bash
journalctl -b -u gnome-headless-session@draper.service --no-pager
journalctl --user -b -u gnome-remote-desktop-headless.service --no-pager
```

- **Nothing listening after reboot:** check the headless session service, especially the D-Bus launcher issue in step 3. Starting RDP alone does not create the desktop.
- **Port conflict:** ensure the system `gnome-remote-desktop.service` is disabled. The intended user service is `gnome-remote-desktop-headless.service`.
- **Stuck securing connection:** check the FreeRDP workaround in step 6.
- **Keyring prompt:** an automatically started desktop does not receive the Linux password to unlock an encrypted login keyring. Application keyring prompts are separate from RDP authentication; do not remove keyring encryption without considering the other secrets it protects.

## Rare local debugging

Local GDM login remains available. Prefer a separate debugging account so OBS can continue running.

To log in locally as `draper`, first save work and stop the headless desktop over SSH. This closes its applications, including OBS:

```bash
sudo systemctl stop gnome-headless-session@draper.service
```

After debugging, log out locally and restart the headless desktop over SSH:

```bash
sudo systemctl start gnome-headless-session@draper.service
```

## References

- [GNOME single-user headless configuration](https://github.com/GNOME/gnome-remote-desktop/blob/gnome-50/README.md#headless-single-user)
- [Ubuntu headless launcher bug](https://bugs.launchpad.net/ubuntu/+source/gdm3/+bug/2171951)
- [FreeRDP HYBRID_EX authentication regression](https://github.com/FreeRDP/FreeRDP/issues/13549)
