# Vampire Survivors Combo Builder

[Vampire Survivors](https://store.steampowered.com/app/1794680/Vampire_Survivors/) is an action roguelike game where the player has to survive against waves of approaching enemies. The player acquires weapons and items while levelling up (this is called creating a *build*). Items can impact a weapon in two ways:

- by increasing a stat the weapon relies on (a [combo](https://vampire-survivors.fandom.com/wiki/Combos)),
- by changing it into a stronger weapon (an [evolution](https://vampire-survivors.fandom.com/wiki/Evolution)).

Weapons and items are limited in number: 6 weapons and 6 items (plus bonus items directly gathered on the map). This enforces the player to make choices: given the current build, which weapon or item to get next?

**This project aims at generating optimal builds, regarding two criteria: combos and evolutions.**

Some mitigations:

- The model maximizes the number of combos and evolutions, but sometimes evolving a weapon can decrease the number of combos satisfied. Hence, there is a trade-off to perform, using coefficients. Different coefficients will produce different results. I believe most people would want to target evolutions first.
- Other than combos and evolutions, the model ignores everything: DPS, player stats, weapon or item rarity, etc. Produced builds are only called *optimal* regarding the number of satisfied combos and evolutions. 

The generator relies on an [integer linear programming (ILP)](https://en.wikipedia.org/wiki/Integer_programming) problem solved using [GLPK](https://www.gnu.org/software/glpk/). Data comes from [Vampire Survivors Wiki](https://vampire-survivors.fandom.com/wiki/Vampire_Survivors_Wiki). Assets are extracted from original game assets.

[Try it yourself!](https://chalier.fr/vampire-survivors-combo-builder/) 

## Contributing

Contributions are welcome! Don't hesitate to open an issue or a PR.

If you are adding sprites, it looks better if they are taken from original game files. I wrote a little script `extract.py` to do this: pass an asset list as argument, which is a JSON file found in *Steam* > *steamapps* > *common* > *Vampire Survivors* > *resources* > *app* > *.webpack* > *renderer* > *assets* > *img*. For instance:

- `items.json` for items and weapons,
- `randomazzo.json` for arcanas.

Also, beware that adding more items and weapons to the game increases the complexity of the ILP problem, which can become too hard for a web browser to solve. Try to test the generator a bit to make sure it does not hang after your changes!

Thanks!
