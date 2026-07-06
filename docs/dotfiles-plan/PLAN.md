# Dotfiles Version Control -- BA Spec

Kanban: #360301ec | Assignee: Kronk (implementáció, sign-off után)
Dátum: 2026-06-30 | Szerző: Yzma

---

## Háttér

2026-06-27 cleanup során kiderült:
- `~/.bashrc`-ben plaintext OAuth token volt (Cuzcoo kitakarította)
- 7x duplikált PATH export
- WSL2-n elhasadó `setxkbmap` hívás
- Token átköltözött `~/.config/claude/auth`-ba (chmod 600, source-olva)
- Backup: `~/.bashrc.bak.20260627` (törlésre kerül ~2026-07-01, #82)

Cél: visszafordítható változáskezelés, gép-migráció egyszerűsítése, secret-ek védelme.

---

## 1. Tool javaslat: yadm

### Összehasonlítás

| Tool | UX (nem-fejlesztőnek) | Secret kezelés | WSL2 compat | Függőség |
|------|----------------------|----------------|-------------|----------|
| bare-git | Rossz (manual alias setup, csúnya) | Nincs | OK | Git |
| **yadm** | **Jó (git wrapper, egyszerű API)** | **Beépített GPG encrypt** | **Kiváló** | **Egy binary** |
| chezmoi | Közepes (Go binary, saját template DSL) | Excellent (pass/bitwarden) | OK | Go binary |
| dotbot | Gyenge (Python, YAML konfig, symlink-fókusz) | Nincs | OK | Python |

### Döntés: yadm

Indoklás:
- Parancsok 1:1 a git-tel: `yadm add`, `yadm commit`, `yadm push` -- ha Jocoo ismeri a git alapjait, azonnal használható
- Beépített `yadm encrypt` lista: érzékeny fájlok GPG-titkosítva commitálhatók (vagy kizárhatók)
- WSL2-n natívan fut, nincs Windows-specifikus buktató
- Single binary install: `curl -fLo ~/.local/bin/yadm ... && chmod +x`
- Nincs "framework overhead" -- a dotfiles továbbra is sima fájlok a home-ban

---

## 2. Repo láthatóság: private GitHub

### Érvek

- Local-only elveszhet: WSL reset, disk fail, gép csere -- épp ezért csináljuk
- Private repo: Jocoo GitHub fiókján belül marad, más nem látja
- Secret-ek SOHA nem kerülnek be (lásd: tracking lista és kizárások)
- `yadm encrypt` fájl titkosít commit előtt GPG-vel -- még privát repóba sem mehet plaintext token

### Repo neve (javaslat)

`jocoo/dotfiles` -- private, GitHub.com

---

## 3. Tracking lista

### Konzervatív minimum (javasolt)

| Fájl | Megjegyzés |
|------|-----------|
| `~/.bashrc` | Elsődleges shell konfig |
| `~/.profile` | Login shell, PATH alap |
| `~/.gitconfig` | Git user/alias konfig |

### Opcionális (Jocoo dönt)

| Fájl | Megjegyzés |
|------|-----------|
| `~/.gitignore_global` | Ha létezik / létrehozandó |
| `~/.config/claude/CLAUDE.md` | Cuzcoo user-prefs, ha van ilyen |
| `~/.inputrc` | readline konfig, ha testre van szabva |

### Explicit kizárások (SOSEM track, sosem encrypt lista sem)

| Fájl/Mappa | Ok |
|-----------|-----|
| `~/.ssh/` | Private key -- abszolút tilalom |
| `~/.config/claude/auth` | OAuth token -- source-olva van, nem commitálható |
| `~/.bashrc.bak.*` | Backup fájlok, nem konfig |
| `~/.local/share/` | Alkalmazás state, nem konfig |
| `.yadm/bootstrap` | Csak ha tartalmaz credentialt |

Implementáció részeként Kronk létrehozza a `~/.config/yadm/gitignore` fájlt a kizárásokkal.

---

## 4. Backup strategy -- bevezetés napjára

### Lépések sorrendben (Kronk implementálja)

1. **Pre-init snapshot** (before touching anything):
   ```bash
   SNAP=~/.dotfiles-backup-$(date +%Y%m%d-%H%M%S)
   mkdir -p "$SNAP"
   cp ~/.bashrc ~/.profile ~/.gitconfig "$SNAP/"
   echo "Snapshot: $SNAP" 
   ```

2. **yadm init + fájlok hozzáadása** -- Kronk csinálja, lépésről lépésre

3. **Első commit előtt ellenőrzés**:
   ```bash
   yadm status         # mit lát
   yadm diff           # mi kerül be
   grep -r "token\|secret\|key\|password" ~/.bashrc ~/.profile ~/.gitconfig
   ```
   Ha az utolsó grep bármit visszaad: STOP, Jocoo-t értesíteni.

4. **Remote push csak Jocoo explicit jóváhagyásával** -- Kronk nem pusholja automatikusan

5. **Visszafordítás** (ha valami rosszul jön ki):
   ```bash
   # Option A: backup visszaállítás
   cp ~/.dotfiles-backup-DATUM/.bashrc ~/
   
   # Option B: yadm reset (ha már commitolva van)
   yadm reset --hard HEAD~1
   ```

---

## Nyitott kérdések Jocoo-nak (sign-off kell)

1. yadm OK, vagy valamelyik más tool preferált?
2. Private GitHub repo OK (`jocoo/dotfiles`)?
3. Konzervatív 3 fájl lista, vagy bővebb scope (`.gitignore_global`, Claude config)?
4. Repo létrehozása előtt: Kronk csináljon GPG key-t az encrypt funkcióhoz, vagy inkább a token-t csak kizárjuk (nem encrypt)?

---

## Implementációs scope (Kronk számára, sign-off után)

1. `yadm` binary install (`~/.local/bin/`)
2. `~/.config/yadm/gitignore` kizáráslista
3. `yadm init` + tracking fájlok hozzáadása
4. GPG setup az encrypt funkcióhoz (ha Jocoo kéri)
5. GitHub private repo létrehozás (`gh repo create jocoo/dotfiles --private`)
6. Első commit + push
7. Smoke check: `yadm status` clean, `yadm log` 1 commit látszik
8. `~/.bashrc.bak.20260627` törlés (ha backup ott van és yadm track-eli az éles verzót)
