"""Gets a new version ready to release.

    python3 release.py 1.8.3

Sets the version in config.json and server/package.json, builds the page, and starts docs/releases/1.8.3.md for the
notes if it isn't there yet. Then write the notes, run the full suite, and merge to main: the Release workflow
(.github/workflows/release.yml) deploys the server to Scaleway and publishes the GitHub release. See RELEASING.md."""
import json, pathlib, re, subprocess, sys

here = pathlib.Path(__file__).resolve().parent
if len(sys.argv) != 2 or not re.fullmatch(r'\d+\.\d+(\.\d+)?', sys.argv[1]):
    sys.exit('Usage: python3 release.py X.Y.Z')
v = sys.argv[1]

for path in (here / 'config.json', here / 'server' / 'package.json'):
    text = path.read_text(encoding='utf-8')
    old = json.loads(text)['version']
    path.write_text(re.sub(r'("version":\s*")[^"]*(")', rf'\g<1>{v}\g<2>', text, count=1), encoding='utf-8')
    print(f'{path.relative_to(here)}: {old} -> {v}')

subprocess.run([sys.executable, str(here / 'build.py')], check=True, cwd=here)

notes = here / 'docs' / 'releases' / f'{v}.md'
if not notes.exists():
    notes.parent.mkdir(parents=True, exist_ok=True)
    notes.write_text("## What's new\n\n### \n\n### Unchanged\n", encoding='utf-8')
    print(f'Started {notes.relative_to(here)}: write the notes there.')
print('Next: write the notes, run the full suite, open a PR and merge. The Release workflow does the rest.')
