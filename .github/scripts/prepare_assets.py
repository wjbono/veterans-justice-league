#!/usr/bin/env python3
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[2]
styles=ROOT/'assets/css/styles.css'
text=styles.read_text(encoding='utf-8')
text,count=re.subn(r"^@import\s+url\(['\"]https://fonts\.googleapis\.com/[^\n]+\n?",'',text,count=1,flags=re.I)
if not count and 'fonts.googleapis.com' in text.lower():
    raise SystemExit('Unable to remove Google Fonts import from production stylesheet')
styles.write_text(text,encoding='utf-8')
print('Prepared production assets without external Google Fonts dependency.')
