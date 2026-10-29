# 🎩 Superspillet

Planleggingsbase for et online mafiaspill til mobil – tekstspill-mekanikk à la nordicmafia.no, med en isometrisk 3D-by à la *The Simpsons: Tapped Out*.

**Nettside:** https://joastorfjell.github.io/superspillet/

## Hvor ting bor

| Hva | Hvor | Hvordan endre |
|---|---|---|
| Ideer, spørsmål, oppgaver | [Issues](https://github.com/joastorfjell/superspillet/issues) | Lag nytt issue, stem med 👍, diskuter i kommentarer |
| Design-dokumenter | [`docs/`](docs/) | Rediger Markdown-filer, commit og push |
| Handlinger, ventetider, belønning | [`data/handlinger.json`](data/handlinger.json) | Lek i fanen *Tid & økonomi* → Kopier JSON → commit |
| Bygg til byplanleggeren | [`data/bygninger.json`](data/bygninger.json) | Rediger JSON, commit og push |
| Selve nettsiden | `index.html`, `assets/` | Ren HTML/CSS/JS – ingen byggesteg |

## Idétavla

Kortene flyttes mellom kolonnene slik:

- **Nye** – åpent issue
- **Diskuteres** – sett label `diskuteres`
- **Bestemt / ferdig** – sett label `bestemt`, eller lukk issuet som *completed*
- **Forkastet** – lukk issuet som *not planned*

## Ny i Git?

Les [docs/LAER-GIT.md](docs/LAER-GIT.md). Første oppgave: legg deg til i [docs/team.md](docs/team.md).

## Kjøre siden lokalt

```bash
python -m http.server 8000
# åpne http://localhost:8000
```

(Å åpne `index.html` direkte i nettleseren fungerer ikke, fordi siden henter filer med `fetch`.)
