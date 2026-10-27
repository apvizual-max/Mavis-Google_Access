#!/usr/bin/env python3
"""sync-container-source.py - copy the live container source into this repo.

The image content lives in ONE place at a time. This script copies the
authoritative source (the folder the image is built from) into ./container,
so the repository can rebuild the identical image.

Rules:
- secrets are NEVER copied (data/, logs/, and every *.json credential)
- the copy is byte-exact for the files it copies
- a file that is missing on the source side is reported, not silently kept

Usage: python scripts/sync-container-source.py [--source <dir>] [--check]
       --check  only report the difference, write nothing
"""
import argparse
import hashlib
import os
import shutil
import sys

FILES = [
    "Dockerfile",
    ".dockerignore",
    "server.mjs",
    "provision-grant.cjs",
    "consent-watcher.mjs",
    "mcp-call.mjs",
    "probe.mjs",
    "probe-services.mjs",
    "extendlm-provision.mjs",
    "watch-reauth.ps1",
]

# Diagnostic tools that live in state/ on the live machine.
EXTRA = {
    "state/probe-token.mjs": "scripts/probe-token.mjs",
    "state/extendlm-register-probe.mjs": "scripts/extendlm-register-probe.mjs",
    "state/patch-api-hosts.py": "scripts/patch-api-hosts.py",
}

GITIGNORE = """# The credential never enters this repository.
data/
logs/
state/
*.tmp
*.log
__pycache__/
"""


def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        h.update(fh.read())
    return h.hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default=r"C:\Users\apviz\.minimax\google-access")
    ap.add_argument("--dest", default=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "container"))
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()

    os.makedirs(args.dest, exist_ok=True)
    problems = []
    copied = 0
    for name in FILES:
        src = os.path.join(args.source, name)
        dst = os.path.join(args.dest, name)
        if not os.path.isfile(src):
            problems.append("MISSING_SOURCE " + name)
            continue
        if os.path.isfile(dst) and sha(src) == sha(dst):
            continue
        if args.check:
            problems.append("DIFFERS " + name)
            continue
        shutil.copy2(src, dst)
        copied += 1
        print("COPIED %s sha256=%s" % (name, sha(dst)[:16]))

    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for rel, dest_rel in EXTRA.items():
        src = os.path.join(args.source, rel)
        dst = os.path.join(repo_root, dest_rel)
        if not os.path.isfile(src):
            problems.append("MISSING_SOURCE " + rel)
            continue
        if os.path.isfile(dst) and sha(src) == sha(dst):
            continue
        if args.check:
            problems.append("DIFFERS " + dest_rel)
            continue
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)
        copied += 1
        print("COPIED %s sha256=%s" % (dest_rel, sha(dst)[:16]))

    gi = os.path.join(repo_root, ".gitignore")
    if not args.check and (not os.path.isfile(gi) or open(gi, encoding="utf-8").read() != GITIGNORE):
        with open(gi, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(GITIGNORE)
        print("WROTE .gitignore")

    # A credential inside the repo would be a leak, not a copy.
    for root, _dirs, names in os.walk(args.dest):
        for n in names:
            if n.endswith(".json"):
                problems.append("JSON_IN_IMAGE_FOLDER " + os.path.join(root, n))

    print("COPIED_COUNT=%d PROBLEMS=%d" % (copied, len(problems)))
    for p in problems:
        print("  " + p)
    return 0 if not problems else 2


if __name__ == "__main__":
    sys.exit(main())
