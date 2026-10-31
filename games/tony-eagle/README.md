# Tony Eagle: Amateur Skateboarding

Original game by **GloveGames / Greg-Anims**:
https://gamejolt.com/games/tony-eagle-amateur-skateboarding/24295

Preservation and browser port by Charles Perrault. This port uses recovered
original scenes, assets, audio, and gameplay scripts, migrated from Unity 4.3 to
Unity 2022.3.62f3. The original in-game creator credit is preserved.

Open `index.html` through a web server. The complete uncompressed WebGL build is
included in `Build/`; no browser plugin or separate installation is needed.
Controls: arrows / WASD to move; hold and release Space / B to jump.
Phones show a computer-access message without downloading the game.

To embed the hosted version:

```html
<iframe
  src="https://charles-perrault.github.io/games/tony-eagle/"
  title="Tony Eagle: Amateur Skateboarding"
  style="width:100%;height:680px;border:0"
  allow="fullscreen;autoplay;gamepad"
  allowfullscreen>
</iframe>
```

The website's Windows 95 desktop also opens the game in its own window. Minimize,
switch windows, or press Escape to pause. The gray overlay shows GAME PAUSED;
click the text or press Escape to continue.

Enter Up, Up, Down, Down, Left, Right, Left, Right, B, A in the game to unlock
unlimited upgrade points. Pick speed, jump, and spin upgrades as often as you
like, then choose SKATE AGAIN to apply them. The cheat lasts through retries
until the game is reloaded; cheat upgrades stay in memory and are discarded on refresh.

Open Leaderboard.txt in the desktop's Notepad app for the shared top 20 scores.
After a normal round, enter a name and submit your score. Using the Konami code
disqualifies that session; refresh or use Reset upgrades to return to ranked play.
Normal earned upgrades remain saved. Older saved cheat upgrades are cleared on load. The original music is retained.

Scoring fix: a new combo starts at a minimum multiplier of one, so a single
trick awards its base points. Existing combo multipliers and stale-trick penalties
are preserved. The Unity source patch is in `patches/first-trick-score.patch`.
Copy `tests/*.cs` into the recovered project's `Assets/Editor/` and run
`TonyEagleSingleTrickRegression.ValidateAndBuild` to verify first tricks, existing
combos, repeated tricks, and real flip detection before rebuilding WebGL.
