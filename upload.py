
#!/usr/bin/env python3

from ftplib import FTP
from pathlib import Path
import os
import sys

FTP_HOST = os.getenv("FTP_HOST", "ftp.tvojserver.sk")
FTP_USER = os.getenv("FTP_USER", "tvoje_meno")
FTP_PASSWORD = os.getenv("FTP_PASSWORD", "tvoje_heslo")

REMOTE_DIR = "/public_html/fyz"
LOCAL_DIR = Path(__file__).parent

EXCLUDED = {
    ".git",
    ".gitignore",
    ".kdenlive-mcp",
    ".venv",
    "__pycache__",
    "deploy.py",
    "upload.py",
    ".env",
    "desktop",
    "node_modules",
    "AGENTS.md",
    "README.md",
    "CHANGELOG.md",
    "bump_version.py",
}

def upload_folder(ftp, local_dir, remote_dir):
    try:
        ftp.cwd(remote_dir)
    except Exception:
        ftp.mkd(remote_dir)
        ftp.cwd(remote_dir)

    for item in local_dir.iterdir():
        if item.name in EXCLUDED:
            continue

        if item.is_dir():
            upload_folder(ftp, item, item.name)
            ftp.cwd("..")
        else:
            with item.open("rb") as file:
                ftp.storbinary(f"STOR {item.name}", file)
            print(f"✓ {item.relative_to(LOCAL_DIR)}")

def main():
    try:
        print("Connecting to FTP...")

        with FTP(FTP_HOST, timeout=30) as ftp:
            ftp.login(FTP_USER, FTP_PASSWORD)
            ftp.set_pasv(True)

            print(f"Uploading to {REMOTE_DIR}...")
            upload_folder(ftp, LOCAL_DIR, REMOTE_DIR)

        print("\n✓ Deployment completed!")

    except Exception as error:
        print(f"\n✗ Deployment failed: {error}")
        sys.exit(1)

if __name__ == "__main__":
    main()
