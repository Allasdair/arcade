# Word list

`enable1.txt` is ENABLE (Enhanced North American Benchmark Lexicon), 172,823 words, which its authors placed in the
public domain. Copy used: https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt (downloaded 2026-11-24).

Tilecraft's dictionary (`src/dict.js`) is built from it by `tools/build_dict.py`: uppercased, words of 2–19 letters,
minus a banned-word list that is kept private (not in this repository), so the game never accepts slurs or obscenities. That review started from the "List of Dirty, Naughty, Obscene and Otherwise
Bad Words" by the LDNOOBW contributors (github.com/LDNOOBW), licensed CC BY 4.0
(https://creativecommons.org/licenses/by/4.0/).
