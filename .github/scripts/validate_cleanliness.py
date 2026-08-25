#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
FILES = [
    'index.html','about.html','programs.html','housing.html','behind-the-wall.html',
    'outreach.html','gallery.html','events.html','contact.html','team.html','404.html',
    'assets/js/site.js','assets/js/config.js','assets/js/home-media.js','assets/js/gallery.js',
    'assets/css/styles.css','assets/css/qc.css','assets/css/gallery.css',
]
FORBIDDEN = {
    'debugger;': 'JavaScript debugger statement',
    'console.log(': 'console logging',
    'lorem ipsum': 'placeholder lorem ipsum text',
    'http://localhost': 'localhost URL',
    'https://localhost': 'localhost URL',
    '127.0.0.1': 'loopback URL',
    'file://': 'local file URL',
    'fonts.googleapis.com': 'external Google Fonts dependency',
    'website redesign in development at this temporary github pages address.': 'temporary development footer',
}


def main():
    errors=[]
    for rel in FILES:
        path=ROOT/rel
        if not path.exists():
            errors.append(f'{rel}: missing expected public file')
            continue
        text=path.read_text(encoding='utf-8').lower()
        for needle,label in FORBIDDEN.items():
            if needle in text:
                errors.append(f'{rel}: contains {label}: {needle}')
        for marker in ('todo:', 'fixme:'):
            if marker in text:
                errors.append(f'{rel}: contains unfinished marker: {marker}')
    if errors:
        print('Production cleanliness validation FAILED:',file=sys.stderr)
        for error in errors:
            print(f' - {error}',file=sys.stderr)
        sys.exit(1)
    print(f'Production cleanliness validation passed for {len(FILES)} published-site files.')

if __name__=='__main__':
    main()
