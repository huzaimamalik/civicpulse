#!/usr/bin/env python3
"""Read-only, standard-library submission checks. Exit 1 for FAIL, 0 otherwise.

Image checks are textual heuristics, not YAML parsing or deployment validation.
Nothing is executed, downloaded, imported from the application, or written.
Local secret files are never required or read; Git tracking is not inspected.
"""

from pathlib import Path
import re


ROOT = Path(__file__).resolve().parent.parent
RESULTS = []


def report(status, message):
    RESULTS.append(status)
    print(f"{status}: {message}")


def check_paths(label, paths, directory=False):
    missing = []
    for relative in paths:
        path = ROOT / relative
        valid = path.is_dir() if directory else path.is_file()
        if not valid or (not directory and path.stat().st_size == 0):
            missing.append(relative)
    if missing:
        report("FAIL", f"{label}: missing, empty, or wrong type: {', '.join(missing)}")
    else:
        report("PASS", f"{label}: {', '.join(paths)}")


def check_adrs():
    for number in ("0001", "0002", "0003", "0004"):
        matches = sorted(
            path for path in (ROOT / "docs/adr").glob(f"{number}*.md")
            if re.match(rf"^{number}(?:[-_]|\.md$)", path.name)
            and path.is_file() and path.stat().st_size > 0
        )
        if matches:
            report("PASS", f"ADR {number}: " + ", ".join(p.name for p in matches))
        else:
            report("FAIL", f"ADR {number}: no nonempty docs/adr/{number}*.md")


def check_evidence():
    evidence = ROOT / "docs/evidence"
    if not evidence.is_dir():
        report("FAIL", "docs/evidence/ is missing")
        return
    files = [
        path for path in evidence.rglob("*")
        if path.is_file() and path.stat().st_size > 0
        and not any(part.startswith(".") for part in path.relative_to(evidence).parts)
        and path.name.lower() not in {"readme", "readme.md", "readme.txt", "thumbs.db"}
    ]
    if files:
        report("PASS", f"docs/evidence/: {len(files)} nonempty evidence files")
    else:
        report("FAIL", "docs/evidence/ contains no nonempty evidence files (excluding placeholders)")


def check_local_secrets():
    # Only inspect names in the project roots; never open potentially secret files.
    suspects = []
    for relative in (".", "backend", "frontend"):
        directory = ROOT / relative
        if not directory.is_dir():
            continue
        for path in sorted(directory.iterdir()):
            name = path.name.lower()
            if name.endswith((".example", ".sample", ".template")):
                continue
            if path.is_file() and (
                name == ".env" or name.startswith(".env.")
                or name in {"id_rsa", "id_ed25519", "credentials.json"}
                or name.endswith((".key", ".p12", ".pfx"))
            ):
                suspects.append(path.relative_to(ROOT).as_posix())
    if suspects:
        report("WARN", "Possible local secret files: " + ", ".join(suspects)
               + "; not read or required; Git tracking unknown")
    else:
        report("PASS", "No obvious secret filenames in root/backend/frontend; secrets not required")


def check_production_images():
    # Include the shared base because production inherits its container images.
    paths = [ROOT / "compose.prod.yaml"]
    for relative in ("k8s/base", "k8s/overlays/prod"):
        paths.extend(sorted(
            path for path in (ROOT / relative).rglob("*")
            if path.is_file() and path.suffix.lower() in {".yaml", ".yml"}
        ))
    latest, unresolved, mutable, dynamic = [], [], [], []
    inspected = 0
    complete = True
    for path in paths:
        if not path.is_file():
            complete = False
            continue
        try:
            lines = path.read_text(encoding="utf-8-sig").splitlines()
        except (OSError, UnicodeError) as error:
            report("FAIL", f"Cannot inspect {path.relative_to(ROOT).as_posix()} ({type(error).__name__})")
            complete = False
            continue
        for number, line in enumerate(lines, 1):
            # Match image fields, not comments or unrelated values such as ubuntu-latest.
            match = re.match(r"^\s*(?:-\s*)?(image|newTag|IMAGE_TAG)\s*:\s*(.*?)\s*$", line)
            if not match:
                continue
            key, value = match.groups()
            value = re.split(r"\s+#", value, maxsplit=1)[0].strip().strip("\"'")
            location = f"{path.relative_to(ROOT).as_posix()}:{number}"
            inspected += 1
            lower = value.lower()
            tag = value.rsplit("/", 1)[-1].rsplit(":", 1)[-1]
            if lower == "latest" or re.search(r":(?:-)?latest(?=$|[}\s\"'])", lower):
                latest.append(location)
            elif "replace-with" in lower or "changeme" in lower:
                unresolved.append(location)
            elif "$" in value or "{{" in value:
                dynamic.append(location)
            elif not value or value in {"|", ">", "|-", ">-"}:
                unresolved.append(location)
            elif key == "image" and "@" not in value and ":" not in value.rsplit("/", 1)[-1]:
                latest.append(location)  # An untagged literal image implicitly uses latest.
            elif (key != "image" or "civicpulse-" in lower) and not (
                re.fullmatch(r"(?:sha-)?[0-9a-fA-F]{7,40}", tag)
                or re.search(r"@sha256:[0-9a-fA-F]{64}$", value)
            ):
                mutable.append(location)
    if latest:
        report("FAIL", "Production image fields use explicit/default/implicit latest: " + ", ".join(latest))
    elif inspected and complete:
        report("PASS", f"Production image scan: no obvious latest tags in {inspected} image/tag fields")
    else:
        report("WARN", "Production image scan incomplete; cannot confirm absence of latest tags")
    if unresolved:
        report("WARN", "Production image placeholders need deployment values: " + ", ".join(unresolved))
    if dynamic:
        report("WARN", "Production image variables require SHA values at deployment; not resolved: " + ", ".join(dynamic))
    if mutable:
        report("WARN", "Expected SHA-style application tags need review: " + ", ".join(mutable))


def main():
    RESULTS.clear()
    print("CivicPulse submission checker (read-only; offline; Python standard library)")
    checks = [
        ("Project directories", ("backend/app", "backend/alembic", "frontend/src", "docs", "scripts", "load"), True),
        ("Project files", ("backend/app/main.py", "backend/requirements.txt", "backend/pyproject.toml", "backend/alembic.ini", "frontend/package.json", "frontend/package-lock.json", "frontend/src/main.tsx"), False),
        ("README", ("README.md",), False),
        ("Runbook", ("docs/RUNBOOK.md",), False),
        ("Engineering notes", ("docs/ENGINEERING-NOTES.md",), False),
        ("AI usage", ("docs/AI-USAGE.md",), False),
        ("Dockerfiles", ("backend/Dockerfile", "frontend/Dockerfile"), False),
        ("Compose files", ("compose.yaml", "compose.prod.yaml"), False),
        ("Kubernetes directories", ("k8s/base", "k8s/overlays/dev", "k8s/overlays/prod"), True),
        ("Kustomizations", ("k8s/base/kustomization.yaml", "k8s/overlays/dev/kustomization.yaml", "k8s/overlays/prod/kustomization.yaml"), False),
        ("Kubernetes workloads", ("k8s/base/backend.yaml", "k8s/base/frontend.yaml", "k8s/base/postgres.yaml", "k8s/base/redis.yaml"), False),
        ("CI/CD workflows", (".github/workflows/ci.yml", ".github/workflows/cd.yml", ".github/workflows/release.yml"), False),
        ("Load script", ("load/k6-script.js",), False),
    ]
    for label, paths, directory in checks:
        try:
            check_paths(label, paths, directory)
        except OSError as error:
            report("FAIL", f"{label}: filesystem check failed ({type(error).__name__})")
    for check in (check_adrs, check_evidence, check_local_secrets, check_production_images):
        try:
            check()
        except OSError as error:
            report("FAIL", f"{check.__name__}: filesystem check failed ({type(error).__name__})")
    counts = {status: RESULTS.count(status) for status in ("PASS", "WARN", "FAIL")}
    print(f"\nSUMMARY: {counts['PASS']} PASS | {counts['WARN']} WARN | {counts['FAIL']} FAIL")
    overall = "FAIL" if counts["FAIL"] else "WARN" if counts["WARN"] else "PASS"
    print(f"OVERALL: {overall}")
    print("Scope: file presence and textual image checks; no runtime, evidence-content, or Git validation.")
    return 1 if counts["FAIL"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
