#!/usr/bin/env python3
from pathlib import Path
import html
import json
import re

ROOT = Path(__file__).resolve().parents[2]
PROD_BASE = 'https://www.veteransjusticeleague.com'
PREVIEW_IMAGE = 'https://wjbono.github.io/veterans-justice-league/assets/images/vjl-logo.png'
PUBLIC_PAGES = [
    'index.html','about.html','programs.html','housing.html','behind-the-wall.html',
    'outreach.html','gallery.html','events.html','contact.html','team.html'
]
QC_VERSION = '20260824-2026'


def first(pattern, text, flags=0):
    match = re.search(pattern, text, flags)
    return match.group(1).strip() if match else ''


def insert_before_head_close(text, markup):
    if '</head>' not in text.lower():
        raise ValueError('missing </head>')
    pos = text.lower().index('</head>')
    return text[:pos] + markup + text[pos:]


def page_metadata(filename, text):
    title = html.unescape(first(r'<title>(.*?)</title>', text, re.I | re.S))
    desc = html.unescape(first(r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']\s*/?>', text, re.I | re.S))
    if not title or not desc:
        raise ValueError(f'{filename}: title/description missing before metadata build')
    canonical_path = '/' if filename == 'index.html' else '/' + filename
    canonical = PROD_BASE + canonical_path
    return title, desc, canonical


def build_public_metadata(filename, title, desc, canonical):
    attrs = lambda value: html.escape(value, quote=True)
    pieces = [
        f'<link rel="stylesheet" data-vjl-qc href="assets/css/qc.css?v={QC_VERSION}">',
        f'<link rel="canonical" href="{attrs(canonical)}">',
        '<link rel="icon" type="image/png" href="assets/images/vjl-logo.png">',
        f'<meta property="og:title" content="{attrs(title)}">',
        f'<meta property="og:description" content="{attrs(desc)}">',
        '<meta property="og:type" content="website">',
        f'<meta property="og:url" content="{attrs(canonical)}">',
        f'<meta property="og:image" content="{attrs(PREVIEW_IMAGE)}">',
        '<meta property="og:image:width" content="235">',
        '<meta property="og:image:height" content="200">',
        '<meta property="og:site_name" content="Veterans Justice League">',
        '<meta name="twitter:card" content="summary">',
        f'<meta name="twitter:title" content="{attrs(title)}">',
        f'<meta name="twitter:description" content="{attrs(desc)}">',
        f'<meta name="twitter:image" content="{attrs(PREVIEW_IMAGE)}">',
        '<meta name="theme-color" content="#3b7d23">',
    ]
    if filename == 'index.html':
        schema = {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            'name': 'Veterans Justice League',
            'url': PROD_BASE + '/',
            'logo': PROD_BASE + '/assets/images/vjl-logo.png',
            'telephone': '+1-719-306-8947',
            'address': {
                '@type': 'PostalAddress',
                'streetAddress': '3617 Betty Dr. STE G',
                'addressLocality': 'Colorado Springs',
                'addressRegion': 'CO',
                'postalCode': '80917',
                'addressCountry': 'US',
            },
        }
        pieces.append('<script type="application/ld+json" id="vjl-org-schema">' + json.dumps(schema, separators=(',', ':')) + '</script>')
    return ''.join(pieces)


def strip_generated(text):
    patterns = [
        r'<link\s+[^>]*data-vjl-qc[^>]*>',
        r'<link\s+rel=["\']canonical["\'][^>]*>',
        r'<link\s+rel=["\']icon["\'][^>]*>',
        r'<meta\s+(?:property|name)=["\'](?:og:[^"\']+|twitter:[^"\']+|theme-color)["\'][^>]*>',
        r'<script\s+type=["\']application/ld\+json["\']\s+id=["\']vjl-org-schema["\']>.*?</script>',
    ]
    for pattern in patterns:
        text = re.sub(pattern, '', text, flags=re.I | re.S)
    return text


def prepare_public_page(filename):
    path = ROOT / filename
    text = strip_generated(path.read_text(encoding='utf-8'))
    title, desc, canonical = page_metadata(filename, text)
    text = insert_before_head_close(text, build_public_metadata(filename, title, desc, canonical))
    path.write_text(text, encoding='utf-8')


def add_noindex(path, icon_href, qc_href):
    text = path.read_text(encoding='utf-8')
    text = re.sub(r'<meta\s+name=["\']robots["\'][^>]*>', '', text, flags=re.I)
    text = re.sub(r'<link\s+rel=["\']icon["\'][^>]*>', '', text, flags=re.I)
    text = re.sub(r'<link\s+[^>]*data-vjl-qc[^>]*>', '', text, flags=re.I)
    markup = (
        '<meta name="robots" content="noindex,nofollow,noarchive">'
        f'<link rel="icon" type="image/png" href="{icon_href}">'
        f'<link rel="stylesheet" data-vjl-qc href="{qc_href}?v={QC_VERSION}">'
    )
    text = insert_before_head_close(text, markup)
    path.write_text(text, encoding='utf-8')


def main():
    for filename in PUBLIC_PAGES:
        prepare_public_page(filename)
    add_noindex(ROOT / '404.html', 'assets/images/vjl-logo.png', 'assets/css/qc.css')
    add_noindex(ROOT / 'admin/index.html', '../assets/images/vjl-logo.png', '../assets/css/qc.css')
    print(f'Prepared static launch metadata for {len(PUBLIC_PAGES)} public pages plus noindex pages.')

if __name__ == '__main__':
    main()
