# Lær Git på 10 minutter

Git er et system for å **lagre versjoner** av filer og **samarbeide** uten å overskrive hverandres arbeid. GitHub er nettsiden der den felles kopien av prosjektet bor.

## Ordbok

| Ord | Hva det betyr |
|---|---|
| **Repo** | Prosjektmappa, med hele historikken |
| **Commit** | Et lagringspunkt med en beskjed om hva du endret ("Legg til kasino i bygninger.json") |
| **Branch** | En parallell versjon der du kan jobbe uten å ødelegge for andre |
| **Push** | Send dine commits opp til GitHub |
| **Pull** | Hent andres commits ned til deg |
| **Pull request (PR)** | "Hei, se over endringene mine før vi slår dem sammen med `main`" |
| **Merge** | Slå sammen en branch med en annen |
| **Konflikt** | Dere har endret samme linje. Git spør hvem som vinner. |

## Steg 0 – Installer

- **Enklest:** [GitHub Desktop](https://desktop.github.com/) – knapper i stedet for kommandoer
- **Ekte hacker-modus:** [Git](https://git-scm.com/downloads) + en terminal + [VS Code](https://code.visualstudio.com/)

Første gang i terminalen, fortell Git hvem du er:

```bash
git config --global user.name "Ditt Navn"
git config --global user.email "eposten-du-bruker-på-github@eksempel.no"
```

## Steg 1 – Hent ned prosjektet (clone)

```bash
git clone https://github.com/joastorfjell/superspillet.git
cd superspillet
```

## Steg 2 – Lag en branch

```bash
git switch -c legg-meg-til-i-teamet
```

## Steg 3 – Endre noe

Åpne `docs/team.md` og fyll inn navnet ditt.

## Steg 4 – Commit

```bash
git status                 # hva har jeg endret?
git add docs/team.md       # velg filer som skal være med
git commit -m "Legg meg til i teamet"
```

## Steg 5 – Push og lag pull request

```bash
git push -u origin legg-meg-til-i-teamet
```

GitHub viser en lenke for å lage en pull request. Den andre ser over og trykker **Merge**. Ferdig! Etter et minutt eller to er endringen synlig på nettsiden.

## Steg 6 – Hold deg oppdatert

Før du begynner på noe nytt:

```bash
git switch main
git pull
```

## Den daglige rytmen

```
git switch main → git pull → git switch -c ny-ting → endre → add → commit → push → PR → merge
```

## Når noe går galt

| Problem | Løsning |
|---|---|
| "Your branch is behind" | `git pull` |
| Konflikt ved pull/merge | Åpne fila, finn `<<<<<<<` og `>>>>>>>`, behold det riktige, slett markørene, `git add` + `git commit` |
| Committet på feil branch | Spør makkeren din – ikke panikk, ingenting er borte i Git |
| Vil se historikken | `git log --oneline --graph` |

## Øvelser i dette repoet

1. ⭐ Legg deg selv til i [team.md](team.md) (via branch + PR)
2. ⭐⭐ Legg til en ny handling i `data/handlinger.json` og se den i fanen *Tid & økonomi*
3. ⭐⭐ Legg til et nytt bygg i `data/bygninger.json` og plasser det i *Byplanleggeren*
4. ⭐⭐⭐ Begge endrer samme linje i `05-veikart.md` samtidig – og løser konflikten sammen
