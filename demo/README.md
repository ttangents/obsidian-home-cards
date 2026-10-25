# Demo vault

A sample vault for screenshots and for readers who want to try Home Cards before pointing it at their own notes. It belongs to an imaginary reader of nineteenth-century books, science and art: 163 notes in ten folders, 87 public-domain images, two bases, seven pages and a CSS snippet that styles two of them by their page class.

- `content.py` holds every note: people, books, places, paintings, projects, research, meetings, ideas and journal entries. Facts come from Wikipedia; the summaries are written for the vault. Dates are offsets from the day of the build.
- `images.py` downloads each note's image, the lead image of a Wikipedia article, and keeps it only if Wikimedia Commons marks it public domain or CC0.
- `build.py` writes the vault, sets each note's modification time, installs the plugin from the repository root with a `data.json` of sections and pages, and writes `mtimes.tsv` beside the vault.

```sh
python3 -I demo/images.py /tmp/demo-images
python3 -I demo/build.py "/tmp/demo/Home Cards Demo" /tmp/demo-images .
```

Rebuild the vault for each release: due dates, "this week" sections and On this day are relative to the build date. Copies that drop modification times can restore them from `mtimes.tsv`:

```sh
cd "Home Cards Demo" && while IFS=$'\t' read -r p t; do touch -d "$t" "$p"; done < ../mtimes.tsv
```
