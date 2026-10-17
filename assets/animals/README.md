# Imported animals

Animated `.glb` files here replace that species' code-built body (see `src/03c_animals.js`). Supported names are
`horse.glb`, `deer.glb`, `wolf.glb` and `rabbit.glb`. `build.py` embeds every file it finds.

| File | Source | License |
| --- | --- | --- |
| horse.glb | "Farm Animals Animated" by Quaternius (Horse.fbx), converted with `tools/fbx2glb.py` | CC0 1.0 |
| wolf.glb | "Animal Pack Vol.2" by Quaternius (Wolf.fbx), converted with `tools/fbx2glb.py` | CC0 1.0 |

To add one, run `python3 tools/fbx2glb.py path/to/Animal.fbx assets/animals/<species>.glb`, then `python3 build.py`.
The loader picks clips by name: Idle, Walk, Trot, Gallop or Run, Eating, Death, Attack, Jump. A model with only a walk
lopes on it at speed, and one with no death clip rolls onto its side.
