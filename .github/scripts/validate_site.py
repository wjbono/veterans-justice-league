#!/usr/bin/env python3
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import sys

ROOT = Path(__file__).resolve().parents[2]
PUBLIC_PAGES = [
    'index.html','about.html','programs.html','housing.html','behind-the-wall.html',
    'outreach.html','gallery.html','events.html','contact.html','team.html','404.html'
]
EXTERNAL_SCHEMES = {'http','https','mailto','tel','data','javascript'}
FORBIDDEN = ('googleusercontent.com',)

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title_depth = 0
        self.title_text = []
        self.descriptions = []
        self.h1_count = 0
        self.has_nav = False
        self.has_skip = False
        self.refs = []
        self.blank_links = []

    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        if tag == 'title':
            self.title_depth += 1
        elif tag == 'meta' and data.get('name','').lower() == 'description':
            self.descriptions.append(data.get('content','').strip())
        elif tag == 'h1':
            self.h1_count += 1
        elif tag == 'nav':
            self.has_nav = True
        elif tag == 'a':
            href = data.get('href','')
            classes = set(data.get('class','').split())
            if 'skip' in classes and href.startswith('#'):
                self.has_skip = True
            if href:
                self.refs.append(('href', href))
            if data.get('target') == '_blank':
                self.blank_links.append((href, set(data.get('rel','').lower().split())))
        elif tag in ('img','script','iframe','source','video','audio'):
            src = data.get('src','')
            if src:
                self.refs.append(('src', src))
        elif tag == 'link':
            href = data.get('href','')
            if href:
                self.refs.append(('href', href))

    def handle_endtag(self, tag):
        if tag == 'title' and self.title_depth:
            self.title_depth -= 1

    def handle_data(self, data):
        if self.title_depth:
            self.title_text.append(data)


def local_target(page: Path, raw: str):
    raw = raw.strip()
    if not raw or raw.startswith('#') or raw.startswith('//'):
        return None
    parsed = urlsplit(raw)
    if parsed.scheme.lower() in EXTERNAL_SCHEMES or parsed.netloc:
        return None
    path = parsed.path
    if not path:
        return None
    if path.startswith('/'):
        # Root-relative URLs will target the eventual production domain, not the repo root.
        return None
    return (page.parent / path).resolve()


def validate_page(name):
    errors = []
    page = ROOT / name
    if not page.exists():
        return [f'{name}: file is missing']
    text = page.read_text(encoding='utf-8')
    low = text.lower()
    for bad in FORBIDDEN:
        if bad in low:
            errors.append(f'{name}: forbidden external image host reference: {bad}')

    parser = PageParser()
    try:
        parser.feed(text)
    except Exception as exc:
        errors.append(f'{name}: HTML parser error: {exc}')
        return errors

    title = ''.join(parser.title_text).strip()
    if not title:
        errors.append(f'{name}: missing or empty <title>')
    if not parser.descriptions or not any(parser.descriptions):
        errors.append(f'{name}: missing or empty meta description')
    if parser.h1_count != 1:
        errors.append(f'{name}: expected exactly one <h1>, found {parser.h1_count}')
    if not parser.has_nav:
        errors.append(f'{name}: missing <nav>')
    if not parser.has_skip:
        errors.append(f'{name}: missing skip link')

    for href, rel in parser.blank_links:
        if 'noopener' not in rel:
            errors.append(f'{name}: target="_blank" link lacks rel="noopener": {href}')

    for attr, raw in parser.refs:
        target = local_target(page, raw)
        if target is None:
            continue
        try:
            target.relative_to(ROOT)
        except ValueError:
            errors.append(f'{name}: {attr} escapes site root: {raw}')
            continue
        if not target.exists():
            errors.append(f'{name}: broken local {attr}: {raw}')
    return errors


def main():
    errors = []
    for page in PUBLIC_PAGES:
        errors.extend(validate_page(page))

    required = ['assets/images/vjl-logo.png','assets/css/styles.css','assets/js/site.js','robots.txt','sitemap.xml']
    for rel in required:
        if not (ROOT / rel).exists():
            errors.append(f'missing required site file: {rel}')

    if errors:
        print('Static site validation FAILED:', file=sys.stderr)
        for error in errors:
            print(f' - {error}', file=sys.stderr)
        sys.exit(1)
    print(f'Static site validation passed for {len(PUBLIC_PAGES)} public pages.')

if __name__ == '__main__':
    main()
