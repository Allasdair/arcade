"""Build src/dict.js: ENABLE minus the banned list, uppercased, at most 19 letters, as a packed DAWG.

  python3 tools/build_dict.py

The word graph is minimised with Daciuk's incremental algorithm (words added in sorted order, equivalent
suffix nodes shared). It is stored as a flat array of edges; a node is a run of edges ending with a 'last' flag.
Each edge is 3 bytes (24 bits, big-endian):
    bit 23..19  letter (0 = A .. 25 = Z)
    bit 18      end of word (the path up to and including this letter is a word)
    bit 17      last edge of its node
    bit 16..0   index of the child node's first edge (0 = no children)
Edge 0 is unused; the root node starts at edge 1. dict.js holds the bytes as base64 plus the lookup helpers.
"""
import os, re, base64, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAXLEN = 19


def banned():
    # The list is private: it is not in the public repo. Put a copy at src/banned.js (git ignores it)
    # or point TILECRAFT_BANNED at it. The copy is in the Tilecraft ZIP in the Arcade Game Lab project.
    path = os.environ.get('TILECRAFT_BANNED', os.path.join(ROOT, 'src', 'banned.js'))
    if not os.path.exists(path):
        raise SystemExit('The private banned-word list is needed to rebuild the dictionary. '
                         'Put it at src/banned.js or set TILECRAFT_BANNED=<path>. src/dict.js is unchanged.')
    src = open(path, encoding='utf-8').read()
    out = set()
    for name in ['BANNED_SLURS', 'BANNED_OBSCENE', 'BANNED_ABUSE']:
        m = re.search(r'const ' + name + r'=`(.*?)`', src, re.S)
        out.update(m.group(1).split())
    return out


def word_list():
    with open(os.path.join(ROOT, 'data', 'enable1.txt')) as f:
        ws = [w.strip().upper() for w in f if w.strip()]
    ban = banned()
    keep = sorted(set(w for w in ws if w not in ban and 2 <= len(w) <= MAXLEN and w.isalpha()))
    return ws, ban, keep


class Node:
    __slots__ = ('edges', 'final', 'id')

    def __init__(self):
        self.edges = {}   # letter -> child
        self.final = False
        self.id = None

    def key(self):
        return (self.final, tuple((c, id(n)) for c, n in sorted(self.edges.items())))


def build_dawg(words):
    root = Node()
    reg = {}
    unchecked = []  # (parent, letter, child)
    prev = ''

    def minimise(down_to):
        while len(unchecked) > down_to:
            parent, letter, child = unchecked.pop()
            k = child.key()
            if k in reg:
                parent.edges[letter] = reg[k]
            else:
                reg[k] = child

    for w in words:
        cp = 0
        while cp < min(len(w), len(prev)) and w[cp] == prev[cp]:
            cp += 1
        minimise(cp)
        node = unchecked[-1][2] if unchecked else root
        for ch in w[cp:]:
            nxt = Node()
            node.edges[ch] = nxt
            unchecked.append((node, ch, nxt))
            node = nxt
        node.final = True
        prev = w
    minimise(0)
    return root


def pack(root):
    # Lay out nodes breadth-first; each non-empty node gets a run of edges.
    order, seen, q = [], set(), [root]
    while q:
        n = q.pop(0)
        if id(n) in seen:
            continue
        seen.add(id(n))
        order.append(n)
        for c in sorted(n.edges):
            ch = n.edges[c]
            if id(ch) not in seen:
                q.append(ch)
    pos, at = {}, 1
    for n in order:
        if n.edges:
            pos[id(n)] = at
            at += len(n.edges)
    total = at
    assert total < (1 << 17), f'too many edges for 17-bit pointers: {total}'
    out = bytearray(3 * total)
    for n in order:
        if not n.edges:
            continue
        i = pos[id(n)]
        ks = sorted(n.edges)
        for j, c in enumerate(ks):
            ch = n.edges[c]
            v = ((ord(c) - 65) << 19) | ((1 if ch.final else 0) << 18) | ((1 if j == len(ks) - 1 else 0) << 17) | (pos.get(id(ch), 0))
            out[3 * i] = v >> 16
            out[3 * i + 1] = (v >> 8) & 255
            out[3 * i + 2] = v & 255
            i += 1
    return bytes(out), total


def check(data, words, sample_bad):
    def child(i):
        b = data[3 * i:3 * i + 3]
        v = (b[0] << 16) | (b[1] << 8) | b[2]
        return v >> 19, (v >> 18) & 1, (v >> 17) & 1, v & 0x1FFFF

    def has(w):
        node, end = 1, 0
        for ch in w:
            if node == 0:
                return False
            k = ord(ch) - 65
            i = node
            while True:
                l, e, last, c = child(i)
                if l == k:
                    node, end = c, e
                    break
                if last:
                    return False
                i += 1
        return end == 1
    for w in words:
        assert has(w), w
    for w in sample_bad:
        assert not has(w), w


def main():
    ws, ban, keep = word_list()
    root = build_dawg(keep)
    data, edges = pack(root)
    import random
    rnd = random.Random(1)
    S = set(keep)
    bad = []
    while len(bad) < 2000:
        w = ''.join(rnd.choice('ABCDEFGHIJKLMNOPRSTU') for _ in range(rnd.randint(2, 8)))
        if w not in S:
            bad.append(w)
    check(data, keep, bad + sorted(ban))
    b64 = base64.b64encode(data).decode()
    fp = hashlib.sha1('\n'.join(keep).encode()).hexdigest()[:8]
    js = f"""// ===================== Tilecraft dictionary (generated by tools/build_dict.py; do not edit) =====================
// ENABLE (public domain) minus the private banned list, uppercased, 2-{MAXLEN} letters: {len(keep)} words,
// as a minimised DAWG of {edges} edges, 3 bytes each (letter 5 bits, end-of-word, last-edge, child index 17 bits).
const DICT_WORDS={len(keep)}, DICT_EDGES={edges}, DICT_FP='{fp}', DICT_MAXLEN={MAXLEN};
const DICT_B64='{b64}';
let DAWG=null;
function dawg(){{ if(DAWG) return DAWG;
  const s=typeof atob==='function'?atob(DICT_B64):Buffer.from(DICT_B64,'base64').toString('binary'), n=s.length/3, L=new Uint8Array(n), F=new Uint8Array(n), C=new Uint32Array(n);
  for(let i=0;i<n;i++){{ const v=(s.charCodeAt(3*i)<<16)|(s.charCodeAt(3*i+1)<<8)|s.charCodeAt(3*i+2); L[i]=v>>>19; F[i]=((v>>>18)&1)|(((v>>>17)&1)<<1); C[i]=v&0x1FFFF; }}
  // F bit 0 = end of word, bit 1 = last edge of the node. Per-node 26-bit letter masks speed up cross-checks.
  return (DAWG={{L,F,C,root:1}}); }}
// the edge for letter k (0..25) out of the node starting at edge i, or -1
function dEdge(i,k){{ if(!i) return -1; const D=DAWG||dawg(); for(;;){{ const l=D.L[i]; if(l===k) return i; if(l>k||(D.F[i]&2)) return -1; i++; }} }}
// is the word (A-Z string) in the dictionary
function isWord(w){{ const D=DAWG||dawg(); let node=D.root, e=-1; if(w.length<2) return false;
  for(let j=0;j<w.length;j++){{ e=dEdge(node,w.charCodeAt(j)-65); if(e<0) return false; node=D.C[e]; }}
  return (D.F[e]&1)===1; }}
"""
    open(os.path.join(ROOT, 'src', 'dict.js'), 'w', encoding='utf-8').write(js)
    print(f'ENABLE {len(ws)} words, banned {len(ban)} ({len(ban & set(ws))} in ENABLE), longer than {MAXLEN}: '
          f'{sum(1 for w in ws if len(w) > MAXLEN)}; dictionary {len(keep)} words, {edges} edges, '
          f'{len(data)//1024} KB packed, {len(b64)//1024} KB base64, dict.js {len(js)//1024} KB, fingerprint {fp}')


if __name__ == '__main__':
    main()
