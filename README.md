# Setlist: TFT Set 19 study deck

A study tool for **Teamfight Tactics Set 19: Prismatic Tour**. It has three tabs:

- **Unlocks**: how each of the 31 unlockable champions is unlocked
- **Traits**: what each trait does, its breakpoints, and which champions carry it
- **Abilities**: every champion's ability

Each tab has three ways to practice:

- **Study**: a searchable, filterable list. Turn on *Cover answers* to blur the answers and tap to check yourself.
- **Flashcards**: rounds of 15 cards that work in both directions (for example, champion → unlock or unlock → champion). "Again" brings a card back later in the round.
- **Quiz**: four-choice questions with names hidden from the clues. Questions pick the items you know least first.

Your progress is saved in your browser. Keyboard: `Space` flips a card, `1`/`2` marks it, `1`–`4` answers a quiz question, and `Enter` moves to the next one.

## Data

The data comes from the Set 19 preview on [MetaTFT](https://www.metatft.com/new-set#Units) (PBE). That preview leaves out most numbers, so a boxed **X** stands in for a value that hasn't been published yet. To refresh the data after MetaTFT updates:

```sh
python3 tools/update_data.py
```

This rewrites `data/set19.js`. Champion art and trait icons are © Riot Games and load from MetaTFT's CDN.

This is a fan-made tool. It isn't affiliated with Riot Games or MetaTFT.
