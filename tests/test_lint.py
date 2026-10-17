"""Source lint: catch a line comment that swallows code. The sources pack many statements on one line, so a
`// note` dropped mid-line silently comments out everything after it, and the result often still parses.
This has bitten the project several times (ammo HUD, saloon lamps, grade uniforms, horse swimming)."""
import re, glob, sys, os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CODE_AFTER = re.compile(r';\s*(this\.|const |let |var |if \(|for \(|return\b|[A-Za-z_$][\w$]*(\.[\w$]+)+\s*(\(|=[^=]))')
def strip_strings(line):  # blank out string/template/regex-ish literals so '//' inside them is ignored
    out, q, i = [], None, 0
    while i < len(line):
        c = line[i]
        if q:
            if c == '\\': out.append('  '); i += 2; continue
            if c == q: q = None
            out.append(' '); i += 1; continue
        if c in '\'"`': q = c; out.append(' '); i += 1; continue
        out.append(c); i += 1
    return ''.join(out)
bad = []
for f in sorted(glob.glob(os.path.join(ROOT, 'src', '[0-9]*.js'))):
    in_tpl = False
    for n, line in enumerate(open(f, encoding='utf-8'), 1):
        if line.count('`') % 2: in_tpl = not in_tpl  # skip shader template literals (GLSL comments end at the newline)
        if in_tpl and line.count('`') == 0: continue
        s = strip_strings(line)
        k = s.find('//')
        while k >= 0 and (s[k - 1:k] == ':'):  # URLs like https://
            k = s.find('//', k + 2)
        if k < 0: continue
        if CODE_AFTER.search(line[k:]): bad.append(f'{f}:{n}: {line.strip()[:160]}')
for b in bad: print('FAIL', b)
print(f"\n{'0' if not bad else len(bad)} comment-swallows-code findings")
if bad: sys.exit(1)
