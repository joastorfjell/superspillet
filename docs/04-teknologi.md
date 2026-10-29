# Teknologi

Ingenting er bestemt! Dette er en oversikt over alternativer.

## Spillmotor

| Motor | Fordeler | Ulemper |
|---|---|---|
| **Unity** | Mest brukt for mobil, enorm mengde guider, bra for isometrisk 3D | C#, litt tungt, lisensvilkårene har vært omstridt |
| **Godot 4** | Gratis og åpen kildekode, lett, GDScript er lett å lære | Mindre økosystem, mobil-eksport litt mindre moden |
| **Web (Three.js / Babylon.js)** | Funker på alt, kan testes i nettleser med en gang | Kjennes mindre som en "ekte" app, ytelse på svake telefoner |
| **Unreal** | Fantastisk grafikk | Overkill for dette, tungt på mobil |

## Server / backend

Siden spillet er online og bruker ventetid, **må** serveren være sjefen:

- Serveren bestemmer når en handling er ferdig (telefonens klokke kan man jukse med)
- Serveren regner ut om en ekspedisjon lykkes
- Klienten (appen) viser bare det serveren sier

| Alternativ | Kommentar |
|---|---|
| **Supabase** | Postgres-database + innlogging + sanntid. Enkelt å starte. |
| **Firebase** | Lignende, fra Google. Godt kjent. |
| **Nakama** | Open source spillserver laget for akkurat dette (kontoer, lagring, chat, klaner) |
| **Egen server** (Node.js / Go) | Full kontroll, mest arbeid |

## Forslag til første prototype

Bygg den **enkleste mulige** versjonen for å teste om løkka er gøy:
en knapp for å rote i søpla, en nedtelling, skrap som går opp. Ingen grafikk. Så legger vi på by og multiplayer.
