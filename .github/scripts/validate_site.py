#!/usr/bin/env python3
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import sys

ROOT = Path(__file__).resolve().parents[2]
PROD_BASE = 'https://www.veteransjusticeleague.com'
PREVIEW_IMAGE = 'https://wjbono.github.io/veterans-justice-league/assets/images/vjl-logo.png'
INDEXABLE_PAGES = [
    'index.html','about.html','programs.html','housing.html','behind-the-wall.html',
    'outreach.html','gallery.html','events.html','contact.html','team.html'
]
PUBLIC_PAGES = INDEXABLE_PAGES + ['404.html']
EXTERNAL_SCHEMES = {'http','https','mailto','tel','data','javascript'}
FORBIDDEN = ('googleusercontent.com',)

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title_depth = 0
        self.title_text = []
        self.meta = {}
        self.h1_count = 0
        self.has_nav = False
        self.has_skip = False
        self.has_qc = False
        self.refs = []
        self.blank_links = []
        self.canonicals = []
        self.icons = []
        self.has_org_schema = False

    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        if tag == 'title':
            self.title_depth += 1
        elif tag == 'meta':
            key = (data.get('name') or data.get('property') or '').lower()
            if key:
                self.meta[key] = data.get('content','').strip()
        elif tag == 'h1':
            self.h1_count += 1
        elif tag == 'nav':
            self.has_nav = True
        elif tag == 'script' and data.get('id') == 'vjl-org-schema' and data.get('type') == 'application/ld+json':
            self.has_org_schema = True
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
            rel = set(data.get('rel','').lower().split())
            if 'canonical' in rel:
                self.canonicals.append(href)
            if 'icon' in rel:
                self.icons.append(href)
            if 'data-vjl-qc' in data and 'stylesheet' in rel:
                self.has_qc = True
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
        return None
    return (page.parent / path).resolve()


def parse_page(name):
    page = ROOT / name
    if not page.exists():
        return None, '', [f'{name}: file is missing']
    text = page.read_text(encoding='utf-8')
    errors = []
    low = text.lower()
    for bad in FORBIDDEN:
        if bad in low:
            errors.append(f'{name}: forbidden external image host reference: {bad}')
    parser = PageParser()
    try:
        parser.feed(text)
    except Exception as exc:
        errors.append(f'{name}: HTML parser error: {exc}')
    return parser, text, errors


def expected_canonical(name):
    return PROD_BASE + ('/' if name == 'index.html' else '/' + name)


def validate_page(name):
    parser, text, errors = parse_page(name)
    if parser is None:
        return errors, None, None

    title = ''.join(parser.title_text).strip()
    desc = parser.meta.get('description','')
    if not title:
        errors.append(f'{name}: missing or empty <title>')
    if not desc:
        errors.append(f'{name}: missing or empty meta description')
    if parser.h1_count != 1:
        errors.append(f'{name}: expected exactly one <h1>, found {parser.h1_count}')
    if not parser.has_nav:
        errors.append(f'{name}: missing <nav>')
    if not parser.has_skip:
        errors.append(f'{name}: missing skip link')
    if not parser.has_qc:
        errors.append(f'{name}: missing build-time QC stylesheet')

    if name in INDEXABLE_PAGES:
        canonical = expected_canonical(name)
        if parser.canonicals != [canonical]:
            errors.append(f'{name}: canonical mismatch: {parser.canonicals!r}, expected {canonical}')
        expected_meta = {
            'og:title': title,
            'og:description': desc,
            'og:type': 'website',
            'og:url': canonical,
            'og:image': PREVIEW_IMAGE,
            'og:site_name': 'Veterans Justice League',
            'twitter:card': 'summary',
            'twitter:title': title,
            'twitter:description': desc,
            'twitter:image': PREVIEW_IMAGE,
            'theme-color': '#3b7d23',
        }
        for key, value in expected_meta.items():
            if parser.meta.get(key) != value:
                errors.append(f'{name}: {key} metadata mismatch or missing')
        if len(parser.icons) != 1:
            errors.append(f'{name}: expected one favicon link, found {len(parser.icons)}')
        if name == 'index.html' and not parser.has_org_schema:
            errors.append('index.html: missing Organization structured data')
        if 'noindex' in parser.meta.get('robots','').lower():
            errors.append(f'{name}: indexable page unexpectedly marked noindex')
    elif name == '404.html':
        robots = parser.meta.get('robots','').lower()
        if 'noindex' not in robots:
            errors.append('404.html: missing noindex robots directive')

    for href, rel in parser.blank_links:
        if 'noopener' not in rel:
            errors.append(f'{name}: target="_blank" link lacks rel="noopener": {href}')

    for attr, raw in parser.refs:
        target = local_target(ROOT / name, raw)
        if target is None:
            continue
        try:
            target.relative_to(ROOT)
        except ValueError:
            errors.append(f'{name}: {attr} escapes site root: {raw}')
            continue
        if not target.exists():
            errors.append(f'{name}: broken local {attr}: {raw}')
    return errors, title, desc


def validate_admin():
    errors = []
    parser, _, parse_errors = parse_page('admin/index.html')
    errors.extend(parse_errors)
    if parser is None:
        return errors
    robots = parser.meta.get('robots','').lower()
    if 'noindex' not in robots or 'nofollow' not in robots:
        errors.append('admin/index.html: missing noindex,nofollow robots directive')
    if not parser.has_qc:
        errors.append('admin/index.html: missing build-time QC stylesheet')
    for attr, raw in parser.refs:
        target = local_target(ROOT / 'admin/index.html', raw)
        if target is not None and not target.exists():
            errors.append(f'admin/index.html: broken local {attr}: {raw}')
    return errors


def main():
    errors = []
    titles = {}
    descriptions = {}
    for page in PUBLIC_PAGES:
        page_errors, title, desc = validate_page(page)
        errors.extend(page_errors)
        if page in INDEXABLE_PAGES and title:
            titles.setdefault(title, []).append(page)
        if page in INDEXABLE_PAGES and desc:
            descriptions.setdefault(desc, []).append(page)
    errors.extend(validate_admin())

    for title, pages in titles.items():
        if len(pages) > 1:
            errors.append(f'duplicate page title {title!r}: {pages}')
    for desc, pages in descriptions.items():
        if len(pages) > 1:
            errors.append(f'duplicate meta description across pages: {pages}')

    required = [
        'assets/images/vjl-logo.png',
        'assets/images/vjl-housing.jpg',
        'assets/images/vjl-training.jpg',
        'assets/images/vjl-outreach.jpg',
        'assets/images/vjl-team.jpg',
        'assets/css/styles.css','assets/css/qc.css',
        'assets/js/site.js','robots.txt','sitemap.xml'
    ]
    for rel in required:
        if not (ROOT / rel).exists():
            errors.append(f'missing required site file: {rel}')

    if errors:
        print('Static site validation FAILED:', file=sys.stderr)
        for error in errors:
            print(f' - {error}', file=sys.stderr)
        sys.exit(1)
    print(f'Static site validation passed for {len(PUBLIC_PAGES)} public pages plus admin safeguards.')

if __name__ == '__main__':
    main()
