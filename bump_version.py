#!/usr/bin/env python3
"""
LasSim Semantic Versioning Helper (bump_version.py)

Usage:
  python3 bump_version.py show
  python3 bump_version.py patch [--note "EN note"] [--note-sk "SK note"]
  python3 bump_version.py minor [--note "EN note"] [--note-sk "SK note"]
  python3 bump_version.py major [--note "EN note"] [--note-sk "SK note"]
  python3 bump_version.py 1.2.3 [--note "EN note"] [--note-sk "SK note"]

Updates version.json, version.js, desktop/package.json, and CHANGELOG.md in sync.
"""

from datetime import date
from pathlib import Path
import argparse
import json
import re
import sys

ROOT = Path(__file__).parent
VERSION_JSON = ROOT / "version.json"
VERSION_JS = ROOT / "version.js"
DESKTOP_PKG = ROOT / "desktop" / "package.json"
CHANGELOG_MD = ROOT / "CHANGELOG.md"

SEMVER_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")


def parse_semver(version_str):
    m = SEMVER_RE.match(version_str.strip())
    if not m:
        raise ValueError(f"Invalid SemVer version: '{version_str}' (expected MAJOR.MINOR.PATCH)")
    return int(m.group(1)), int(m.group(2)), int(m.group(3))


def render_version_js(data):
    json_payload = json.dumps(data, indent=2, ensure_ascii=False)
    indented = "\n".join("  " + line for line in json_payload.splitlines())
    return (
        "(function (global) {\n"
        "  'use strict';\n\n"
        "  // Auto-synced with version.json & desktop/package.json via bump_version.py\n"
        f"  const VERSION_INFO = {indented.lstrip()};\n\n"
        "  global.LasSim = global.LasSim || {};\n"
        "  global.LasSim.VERSION = VERSION_INFO.version;\n"
        "  global.LasSim.VERSION_INFO = VERSION_INFO;\n"
        "})(typeof window !== 'undefined' ? window : globalThis);\n"
    )


def update_changelog(new_version, release_date, notes_en):
    if not CHANGELOG_MD.exists():
        return
    content = CHANGELOG_MD.read_text(encoding="utf-8")
    entry_lines = [f"## [{new_version}] - {release_date}", "", "### Changed"]
    for note in notes_en:
        entry_lines.append(f"- {note}")
    entry_block = "\n".join(entry_lines) + "\n\n"

    marker = "---\n\n"
    if marker in content:
        head, tail = content.split(marker, 1)
        CHANGELOG_MD.write_text(head + marker + entry_block + tail, encoding="utf-8")
    else:
        CHANGELOG_MD.write_text(content.rstrip() + "\n\n" + entry_block, encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="LasSim SemVer version manager")
    parser.add_argument("target", help="show | patch | minor | major | X.Y.Z")
    parser.add_argument("--note", action="append", default=[], help="English changelog note (repeatable)")
    parser.add_argument("--note-sk", action="append", default=[], help="Slovak changelog note (repeatable)")
    parser.add_argument("--channel", default=None, help="Optional release channel (e.g. stable, beta)")
    args = parser.parse_args()

    data = json.loads(VERSION_JSON.read_text(encoding="utf-8"))
    cur_major, cur_minor, cur_patch = parse_semver(data["version"])

    if args.target == "show":
        print(f"{data['name']} v{data['version']} ({data.get('channel', 'stable')}, {data.get('releaseDate', '')})")
        return

    if args.target == "patch":
        new_major, new_minor, new_patch = cur_major, cur_minor, cur_patch + 1
    elif args.target == "minor":
        new_major, new_minor, new_patch = cur_major, cur_minor + 1, 0
    elif args.target == "major":
        new_major, new_minor, new_patch = cur_major + 1, 0, 0
    else:
        new_major, new_minor, new_patch = parse_semver(args.target)

    new_version = f"{new_major}.{new_minor}.{new_patch}"
    today = date.today().isoformat()

    data["version"] = new_version
    data["major"] = new_major
    data["minor"] = new_minor
    data["patch"] = new_patch
    data["releaseDate"] = today
    if args.channel:
        data["channel"] = args.channel

    notes_en = args.note or [f"Release v{new_version}"]
    notes_sk = args.note_sk or notes_en
    changelog = data.get("changelog", [])
    changelog.insert(0, {"version": new_version, "date": today, "notes": {"en": notes_en, "sk": notes_sk}})
    data["changelog"] = changelog[:20]

    VERSION_JSON.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    VERSION_JS.write_text(render_version_js(data), encoding="utf-8")

    if DESKTOP_PKG.exists():
        pkg = json.loads(DESKTOP_PKG.read_text(encoding="utf-8"))
        pkg["version"] = new_version
        DESKTOP_PKG.write_text(json.dumps(pkg, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    update_changelog(new_version, today, notes_en)
    print(f"✓ Updated LasSim version: {cur_major}.{cur_minor}.{cur_patch} -> {new_version} ({today})")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"✗ Error: {exc}", file=sys.stderr)
        sys.exit(1)
