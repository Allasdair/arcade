"""Tilecraft letter values and tile counts, worked out from ENABLE (kickoff section 4).

  python3 tools/letters.py          prints the table and checks it against src/engine.js
  python3 tools/letters.py --json   prints the table as JSON

Method (reproduces the confirmed table exactly):
  Frequency  every letter occurrence in ENABLE words of 2-8 letters (each word in the list once).
  Values     value = clamp(round(1 + a*ln(fE/f) - 1.2), 1, 10), a = 9/ln(fE/fQ).
  Counts     share of the letter tiles proportional to frequency, vowels (A E I O U) weighted x1.12.
             S is fixed first (capped at 3 / 5 / 7) and the rest share the remaining tiles:
             each letter gets max(1, floor(share)), then the leftover tiles go by largest remainder
             to letters whose share is at least 1.
  Adjustments by design: S capped (above); Q value 9 -> 10 (most Q words need a U);
             Medium E 13 -> 12 and F 1 -> 2 (so racks don't fill up with E).
Bags: Small 68 letters + 2 blanks = 70, Medium 98 + 2 = 100, Large 147 + 3 = 150.
"""
import math, os, sys, json, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
VOWELS = 'AEIOU'
BAGS = [('small', 68, 2, 3), ('medium', 98, 2, 5), ('large', 147, 3, 7)]  # id, letters, blanks, S cap


def words():
    with open(os.path.join(ROOT, 'data', 'enable1.txt')) as f:
        return [w.strip().upper() for w in f if w.strip()]


def frequencies(ws):
    f = {c: 0 for c in L}
    for w in ws:
        if 2 <= len(w) <= 8:
            for ch in w:
                f[ch] += 1
    return f


def values(f):
    fE, fQ = f['E'], f['Q']
    a = 9 / math.log(fE / fQ)
    v = {c: max(1, min(10, round(1 + a * math.log(fE / f[c]) - 1.2))) for c in L}
    v['Q'] = 10  # adjustment: most Q words need a U
    return v


def counts(f, letters, scap):
    wt = {c: f[c] * (1.12 if c in VOWELS else 1) for c in L if c != 'S'}
    total = letters - scap
    tw = sum(wt.values())
    raw = {c: wt[c] / tw * total for c in wt}
    cnt = {c: max(1, math.floor(raw[c])) for c in wt}
    left = total - sum(cnt.values())
    for c in sorted(raw, key=lambda c: -(raw[c] - math.floor(raw[c]))):
        if left <= 0:
            break
        if raw[c] >= 1:
            cnt[c] += 1
            left -= 1
    cnt['S'] = scap
    return cnt


def table():
    f = frequencies(words())
    v = values(f)
    out = {'values': v, 'freq': f}
    for bag, letters, blanks, scap in BAGS:
        c = counts(f, letters, scap)
        if bag == 'medium':
            c['E'] -= 1  # 13 -> 12
            c['F'] += 1  # 1 -> 2
        assert sum(c.values()) == letters, (bag, sum(c.values()))
        out[bag] = c
        out[bag + '_blanks'] = blanks
    return out


if __name__ == '__main__':
    t = table()
    if '--json' in sys.argv:
        print(json.dumps({k: t[k] for k in ['values', 'small', 'medium', 'large']}, indent=1))
        sys.exit(0)
    order = sorted(L, key=lambda c: (-t['medium'][c], t['values'][c], c))
    print('Letter Value Small Medium Large')
    for c in order:
        print(f'  {c}     {t["values"][c]:>2}    {t["small"][c]:>2}    {t["medium"][c]:>2}    {t["large"][c]:>2}')
    vow = sum(t['medium'][c] for c in VOWELS) / 98
    pts = sum(t['medium'][c] * t['values'][c] for c in L)
    print(f'Vowels {vow:.1%} of Medium letters; Medium bag {pts} points')
    # check against the engine's table
    src = open(os.path.join(ROOT, 'src', 'engine.js'), encoding='utf-8').read()
    m = re.search(r"const LETTERS=\{(.*?)\};", src, re.S)
    if m:
        eng = dict(re.findall(r"([A-Z]):\[([\d,]+)\]", m.group(1)))
        bad = [c for c in L if [int(x) for x in eng[c].split(',')] != [t['values'][c], t['small'][c], t['medium'][c], t['large'][c]]]
        print('engine.js LETTERS matches' if not bad else f'engine.js LETTERS differs for {bad}')
        sys.exit(1 if bad else 0)
