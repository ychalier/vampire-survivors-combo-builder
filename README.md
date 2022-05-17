# Vampire Survivors Combo Builder

[Vampire Survivors](https://store.steampowered.com/app/1794680/Vampire_Survivors/) is an action roguelike game where the player has to survive against waves of approaching enemies. The player acquires weapons and items while levelling up (this is called creating a *build*). Items can impact a weapon in two ways:

- by increasing a stat the weapon relies on (a [combo](https://vampire-survivors.fandom.com/wiki/Combos)),
- by changing it into a stronger weapon (an [evolution](https://vampire-survivors.fandom.com/wiki/Evolution)).

Weapons and items are limited in number: 6 weapons and 6 items (plus bonus items directly gathered on the map). This enforces the player to make choices: given the current build, which weapon or item to get next?

**This project aims at generating optimal builds, regarding two criteria: combos and evolutions.**

Some mitigations:

- The model maximizes the number of combos and evolutions, but sometimes evolving a weapon can decrease the number of combos satisfied. Hence, there is a trade-off to perform, by setting coefficients on those criteria. Different coefficients will produce different results. I believe most people would want to target evolutions first.
- Other than combos and evolutions, the model ignores everything: DPS, player stats, weapon or item rarity, etc. Produced builds are only called *optimal* regarding the number of satisfied combos and evolutions. 

[Try it yourself!](https://ychalier.github.io/vampire-survivors-combo-builder/)
