# makefun-gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/RieryBuild/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/RieryBuild/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**SOLMAR BAY** — an original sun-soaked open-world crime story, built for make.fun's "Make GTA 6" bounty. Dana Vega drives courier runs out of Rosa's garage on Marlin Street, and the Dockside Kings want the garage: fifty thousand dollars of "protection" or they burn it down. Dana has one week, one rusty van, and no intention of paying.

Drive and fight across a living coastal city: a textured 8×8-block grid with a beach strip, three piers and a working docks, traffic that follows the roads, pedestrians who flee gunfire, and SBPD cruisers and officers who chase, ram and arrest on a 1–5 star wanted system. Five story missions with staged objectives, minimap waypoints, dialogue and cash rewards take Dana from a first delivery to a harbor showdown with Kane himself — plus ten hidden Sunset Postcards to collect, a rifle with muzzle flash and tracers, synthesized WebAudio sound (engine, sirens, gunfire), a start screen, pause menu and localStorage saves. Every asset is procedural or synthesized in code; the game makes zero network requests. Built with Three.js (vendored), split into one-job modules under `game/src/`. An original game: its city, characters, gangs and story are invented, nothing is taken from any commercial game.

## Run it

```sh
node serve.ts
# then open http://localhost:8080 in desktop Chrome
```

Controls: WASD move / drive, mouse look, click shoot, R reload, E enter car / start mission, Shift run, Space handbrake, P pause, M mute, right mouse aim. Missions start at Rosa's garage. Deterministic: `?seed=` fixes the city layout, and `?shot=chase|city|mission|combat` stages the four screenshots.

---

<sub>Entered on [make.fun](https://make.fun/?ref=wa8s3t3t&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
