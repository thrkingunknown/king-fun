# MYSTERY WHO?
## Game Architecture, Gameplay & Feature Analysis Report

**Project:** Mystery Who?  
**Package:** `mystery-whos`  
**Version:** 1.0.1  
**Genre:** Social Deduction / Party Game / Hidden Role  
**Platform:** Web, PWA, Tauri Desktop and Android  
**Players:** 3–20 local / 3–24 online

---

# 1. Executive Summary

Mystery Who? is a multiplayer social-deduction word game built around hidden identities, secret information, deception, discussion and voting.

Its fundamental mechanic is simple:

- Civilians receive a secret word.
- Mystics receive the category and indirect hints, but not the word.
- Mr. White receives the category but absolutely no hint or secret word.
- Everyone discusses the subject without exposing their information.
- Players attempt to identify the Mystics.
- Mr. White can attempt to guess the secret word when the required voting threshold is reached.

The game supports three modes, customizable player counts, several configuration parameters, custom word packs, AI-assisted content generation and online multiplayer.

**Overall assessment:** The project has a reasonably modular game architecture and a substantial feature set. However, the bundled content quality, several implementation inconsistencies and a source-level compilation defect currently prevent me from considering this archive production-ready.

# 2. Game Concept and Core Mechanics

## 2.1 Roles

There are three possible roles.

| Role | Information received | Objective |
|---|---|---|
| Civilian | Category + secret word | Identify the Mystics |
| Mystic | Category + indirect hint(s) | Blend in without knowing the word |
| Mr. White | Category only | Avoid detection and potentially guess the word |

### Civilian

Civilians receive the actual secret word.

They must participate in discussions without revealing the word too directly. Their objective is to identify suspicious players whose descriptions do not convincingly match the secret.

### Mystic

Mystics know the category but not the secret word.

They receive indirect hints when Mystic Hint is enabled.

They must use the discussion to infer the secret word while pretending they already know it.

Multiple Mystics can receive either:

- The same hint.
- Different hints.

### Mr. White

Mr. White is an additional special role.

Mr. White receives:
- The category.
- No secret word.
- No indirect hint.

Mr. White must figure out the secret word by listening to everyone else.

When the voting threshold is reached, Mr. White gets a final opportunity to guess the secret word.

A correct guess produces a special victory result.

# 3. Game Modes

The project implements three modes.

## 3.1 Classic

**Roles:** Civilians and Mystics.

- There is no Mr. White.
- Civilians receive the word.
- Mystics receive hints.
- Players discuss.
- Players vote to identify Mystics.
- Results expose the secret word and hidden roles.

The configured Mystic count determines the number of Mystics.

## 3.2 Mystics

**Roles:** Civilians, Mystics and exactly one Mr. White.

This is the standard game with the additional Mr. White role.

The number of ordinary Mystics is configurable.

Example with six players:

| Player | Assigned role |
|---|---|
| Player 1 | Civilian |
| Player 2 | Mystic |
| Player 3 | Civilian |
| Player 4 | Mr. White |
| Player 5 | Mystic |
| Player 6 | Civilian |

The actual assignment is randomized.

Mr. White receives no word or hint.

If Mr. White receives at least half of all submitted vote selections, rounded up, the final guess phase activates.

## 3.3 Chaos

Chaos introduces randomized role combinations.

At the beginning of each round:

- The Mystic count is randomized.
- One to three Mystics can be generated, subject to player-count restrictions.
- There is a 45% chance of including Mr. White when the lobby has at least four players.
- Role counts are adjusted to preserve at least one Civilian.

Consequently, the same configuration does not guarantee the same role distribution every round.

This is the least predictable mode.

# 4. Gameplay Loop

## 4.1 Local Gameplay

The local gameplay is a pass-and-play experience using one device.

### Phase 1 — Game Configuration

Players configure the round before starting.

Available options include:
- Player names.
- Number of players.
- Selected categories.
- Game mode.
- Mystic count.
- Mystic hint settings.
- Discussion timer.
- Voting settings.
- Voter visibility.

### Phase 2 — Secret Word Generation

The game randomly selects one category from the selected categories.

It then generates a `GeneratedRound` containing:

- `word`: Secret word.
- `hints`: Available hints.
- `hint`: Primary hint.
- `category`: Selected category name.

Word generation can use:
1. Bundled local word banks.
2. Manually created custom packs.
3. AI-generated content.

### Phase 3 — Role Assignment

The game engine performs randomized role assignment.

It uses Fisher–Yates shuffling.

Every player receives exactly one role.

Mystic hints are distributed according to the selected hint configuration.

### Phase 4 — Private Role Reveal

Players take turns viewing their information.

The reveal system uses a press-and-hold interaction.

The player must hold the reveal button for approximately 650 milliseconds.

The screen displays:
- Player name.
- Assigned role.
- Secret word or hint.
- Category.

Releasing the button hides the information again.

The next player cannot proceed until the current player has successfully viewed their information.

This helps prevent accidental exposure when passing the device around.

### Phase 5 — Discussion

After every player has viewed their role, the discussion phase begins.

Players discuss the secret subject.

They must identify who is bluffing.

If the timer is enabled, a countdown begins.

When it reaches zero:
- Voting begins automatically if voting is enabled.
- Results are revealed automatically if voting is disabled.

The timer only applies to the discussion phase, not the entire round.

### Phase 6 — Voting

Every player votes sequentially.

Each player receives a voting interface where they can select suspected Mystics.

The required selections are based on the number of ordinary Mystics.

For example:

- 1 Mystic = select 1 player.
- 2 Mystics = select 2 players.
- 3 Mystics = select 3 players.

Mr. White is excluded from this required selection count.

Additional mechanics:
- Players can vote for themselves.
- Players can skip voting.
- Duplicate targets are rejected.
- Invalid targets are rejected.

### Phase 7 — Mr. White's Final Guess

When Mr. White reaches the required voting threshold, a final guessing interface appears.

Mr. White enters the secret word.

The answer is normalized by:
- Removing surrounding whitespace.
- Converting to lowercase.
- Collapsing repeated whitespace.

The comparison is otherwise an exact word comparison.

### Phase 8 — Results

The results screen reveals:

- Secret word.
- Category.
- Mystics.
- Mr. White's identity, implicitly through the role reveal.
- Voting results.
- Mystic hints.
- Mr. White's guessing outcome.

Players can return to the configuration screen and begin a new game.

---

# 5. Online Multiplayer

Online functionality is implemented separately from local gameplay.

It uses a Bun-native WebSocket relay.

## 5.1 Room Creation

A player can:
- Create a new room.
- Join an existing room using a six-character code.

Online limits:

| Parameter | Value |
|---|---:|
| Minimum players | 3 |
| Maximum players | 24 |
| Room code | 6 characters |
| Player name | 24 characters maximum |
| Reconnection grace period | 20 seconds |
| Room idle expiration | 2 hours |
| Server default room capacity | 10,000 rooms |

The room creator becomes the host.

The host can:
- Configure game settings.
- Start rounds.
- Change phases.
- Remove players.
- Start subsequent rounds.

## 5.2 Online Gameplay Phases

The relay manages five phases:

1. Lobby
2. Reveal
3. Discussion
4. Voting
5. Results

Unlike local gameplay, players independently access the game through their devices.

### Reveal

Each player receives a private role assignment through the WebSocket connection.

Only that player's connection receives their private information.

Players use the same press-and-hold reveal mechanic.

Once every connected player confirms that they have memorized their information, the relay advances to discussion.

### Discussion

The host controls the transition to voting or results.

The discussion timer is synchronized through the host's client-side countdown and host-triggered phase transition.

### Voting

Each connected player submits one ballot.

The relay validates:
- Voting phase.
- Number of selections.
- Duplicate selections.
- Valid player targets.
- One submission per player.

Once all connected players have submitted their votes, results are generated automatically.

### Results

The relay sends the secret word and voting results to participants.

If Mr. White meets the voting threshold, only Mr. White's client displays the final guessing input.

The host can subsequently initiate another round.

## 5.3 Online Communication

The project deliberately does not implement:

- Text chat.
- Voice communication.
- Video communication.
- WebRTC.

Players are expected to communicate using external applications such as Discord or WhatsApp.

This is an intentional architectural decision, not an unfinished chat interface.

## 5.4 Reconnection

Online sessions are stored in browser local storage.

The implementation supports:
- Automatic reconnection.
- Heartbeat messages.
- Reconnection backoff.
- Reconnecting to an existing game.
- Restoring private assignments.
- Host promotion when the host is removed after the reconnection grace period.

The online server keeps room state in memory. Server restarts therefore terminate active rooms.

---

# 6. Configuration Parameters

The following are the important game parameters.

| Parameter | Default | Function |
|---|---|---|
| Players | 3 | Number of local players |
| Categories | Daily Life, Animals, Food | Available word categories |
| Game Mode | Classic | Role distribution rules |
| Mystic Count | 1 | Number of ordinary Mystics |
| Time Limit Enabled | Off | Enables discussion countdown |
| Time Limit | 180 seconds | Local discussion duration |
| Mystic Hint | On | Enables Mystic hints |
| Same Mystic Hint | Off | Whether Mystics share a hint |
| Voting Enabled | On | Enables the voting phase |
| Hidden Voter | On | Hides voter names in local results |
| Theme | System | Appearance preference |
| AI Provider | Gemini | AI generation provider |
| Gemini API Key | Empty | Optional Gemini authentication |
| Groq API Key | Empty | Optional Groq authentication |
| Recent Words | Empty | Repeat-protection history |

## 6.1 Player Count

Local mode supports 3–20 players.

Online supports 3–24 players.

Local names must be unique, ignoring case, and cannot exceed 24 characters in online mode.

## 6.2 Mystic Count

Local Mystic count is limited by player count:

| Players | Maximum ordinary Mystics |
|---:|---:|
| 3–5 | 1 |
| 6–10 | 2 |
| 11–15 | 3 |
| 16–20 | 4 |

The engine also enforces a minimum of one Civilian.

Online has a separate higher Mystic selection limit.

## 6.3 Mystic Hint Configuration

Two options are available when multiple Mystics exist:

**Same Hint**

Every ordinary Mystic receives the same hint.

**Different Hints**

Each Mystic receives a different hint when enough unique hints are available.

If Mystic Hint is disabled, ordinary Mystics receive no hint.

Mr. White never receives a hint.

## 6.4 Discussion Timer

Local timer range:

- Minimum: 15 seconds.
- Maximum: 600 seconds.
- Increment: 15 seconds.

The timer is disabled by default.

Although the interface describes it as a per-round time limit, its actual implementation limits discussion only.

The online relay has different validation bounds and defaults, which should be standardized.

## 6.5 Voting Configuration

Voting can be completely disabled.

When enabled, players can select multiple suspected Mystics or skip.

The result screen supports:
- Hidden voter names.
- Visible voter names.

The hidden-voter setting currently works in local mode but is not properly enforced in online mode.

---

# 7. Category and Word Bank System

This is one of the larger content systems in the project.

There are 30 built-in categories.

| # | Category | # | Category |
|---:|---|---:|---|
| 1 | Animals | 16 | School |
| 2 | Fruit | 17 | Sports |
| 3 | Food & Drinks | 18 | Football |
| 4 | Objects | 19 | Fantasy |
| 5 | Celebrities | 20 | Fashion & Clothes |
| 6 | Cities | 21 | Technology |
| 7 | Countries | 22 | Traveling |
| 8 | Body & Health | 23 | World & Places |
| 9 | Brands | 24 | Summer |
| 10 | Hollywood | 25 | Music |
| 11 | Games | 26 | Jobs & Crafts |
| 12 | Locations | 27 | Daily Life |
| 13 | Film & TV | 28 | Adults Only |
| 14 | Anime | 29 | Superheroes |
| 15 | Professions | 30 | Weather & Nature |

### Content Statistics

Static audit results:

| Metric | Result |
|---|---:|
| Built-in categories | 30 |
| Total word entries | 1,800 |
| Words per category | 60 |
| Hints per entry | 20 |
| Total hint entries | 36,000 |
| Unique hint strings | 531 |
| Duplicate secret words within individual categories | 0 |

There is an important content-quality issue, however.

The word banks contain approximately 20 generic category-related terms before the more specific answers.

For example, the Animals bank begins with terms such as:

- Behavior
- Ecosystem
- Silhouette
- Habitat
- Diet
- Tracks
- Fur
- Feathers

The Fruit category similarly includes terms like Botanical, Sweetness, Orchard and Harvest.

These are often not suitable secret answers for a category guessing game.

The hint system also heavily reuses broad terms. For example, Lion receives hints including Feathers and Scales.

This means the numerical content audit passes, but the semantic quality of the actual gameplay content is considerably weaker than the raw 1,800-word count suggests.

The word banks need content-level validation and revision.

---

# 8. Custom Content

The project supports two custom category systems.

## 8.1 Manual Custom Packs

Players can create their own word packs.

Each pack supports:
- Name.
- Emoji.
- Multiple secret words.
- 1–20 hints per word.
- JSON import.
- TXT import.
- JSON export.
- TXT export.

The TXT format uses:

`Secret Word | Hint 1 | Hint 2 | Hint 3`

This is useful for themed party games and user-created datasets.

Multiple custom packs can be stored simultaneously.

## 8.2 AI Categories

Players can create AI-powered categories.

A custom AI category stores:
- Category name.
- Emoji.
- Generation instructions.
- Source type.

For every new round, the AI generates a fresh secret word and hints.

Examples:
- Anime characters.
- Video games.
- Fictional universes.
- Famous personalities.
- Movies.
- Custom themed topics.

These categories require an API key and an internet connection.

---

# 9. AI Integration

The project supports two providers:

- Google Gemini.
- Groq.

The provider selection is stored in settings.

## 9.1 Gemini

The current code uses:

`gemini-3.5-flash-lite`

The model is used for:
- Secret word generation.
- Hint generation.
- Custom AI categories.

## 9.2 Groq

The code configures:

1. `llama-3.3-70b-versatile`
2. `openai/gpt-oss-20b`

The second model is a fallback, although the implementation only switches models when the first endpoint responds with HTTP 404.

The first model has since been deprecated by Groq, so this configuration should be updated.

## 9.3 Generation Parameters

The current implementation includes:

| Parameter | Value |
|---|---:|
| API timeout | 8 seconds |
| Maximum attempts | 2 |
| Round generation temperature | 1.25 |
| Hint generation temperature | 1.2 |
| Maximum hints | 20 |

The game requests structured JSON responses.

Generated secret words are checked against recent-word history.

However, AI-generated Mystic hints are not fully fail-safe: if the hint-generation API fails, round creation can fail even when usable local hints already exist.

---

# 10. Repeat Protection

Recent secret words are stored in settings.

The game retains the latest ten normalized words.

Normalization:
- Lowercase.
- Trim whitespace.
- Collapse repeated spaces.

The system attempts to avoid selecting any of those words again.

This applies across categories rather than maintaining a separate history for each category.

One edge case exists: a small custom pack can become exhausted because all its words are still in recent history. Instead of automatically relaxing the restriction when alternatives are exhausted, the game can refuse to start another round.

---

# 11. Technical Architecture

The codebase is reasonably separated into independent responsibilities.

| Component | Responsibility |
|---|---|
| `App.tsx` | Main application and local game state |
| `GameReveal.tsx` | Reveal, discussion, voting and results UI |
| `AppMain.tsx` | Main configuration screen |
| `ModeSelector.tsx` | Mode selection |
| `MysticModal.tsx` | Mystic configuration |
| `PlayersModal.tsx` | Player management |
| `CategoriesModal.tsx` | Category management |
| `CustomPackEditor.tsx` | Manual pack creation |
| `GeminiCategoryEditor.tsx` | AI pack creation |
| `SettingsModal.tsx` | Provider keys and preferences |
| `OnlineLobby.tsx` | Multiplayer interface |
| `game-engine.ts` | Deterministic game rules |
| `gemini.ts` | AI generation and local word selection |
| `storage.ts` | Persistent game configuration |
| `online.ts` | WebSocket client and reconnect logic |
| `server/index.mjs` | Online room relay and authoritative voting |

### Technology Stack

- React 19
- TypeScript
- Vite 8
- Bun 1.4.2
- Motion
- Lucide React
- WebSocket
- PWA Service Worker
- Tauri 2

The game engine is separated from visual components, which is a good architectural choice.

The online relay imports the same game-engine rules used by local gameplay.

---

# 12. User Interface and Experience

The UI is implemented with a custom CSS design system.

### Visual direction

- Strong red accent color.
- Dark and light themes.
- Large display typography.
- Rounded panels and interactive controls.
- Card-based configuration.
- Animated state transitions.
- Dedicated reveal and result screens.

### Responsive layout

The CSS implements different layouts based on viewport width:

- Mobile: single-column layout.
- Tablet: two-column layout.
- Desktop: up to three columns.

### Animations

Motion is used for transitions and card presentation.

The most important interaction is the progressive hold-to-reveal animation.

### UX strengths

- Game configuration is accessible from one screen.
- Player and category editing are separated into dedicated modals.
- The next action is visually prominent.
- Reveal information is intentionally hidden until the user holds the button.
- The online experience has dedicated phase-specific screens.

### UX weaknesses

- The modal implementation does not provide a complete keyboard focus trap.
- Some configuration options have inconsistent availability between local and online play.
- The results screen does not provide a sophisticated scoring or round-history system.
- There is no dedicated onboarding/tutorial sequence beyond a brief help message.

---

# 13. Persistence and Offline Support

The project uses browser `localStorage`.

It stores:
- Player names.
- Category selections.
- Custom packs.
- API keys.
- Theme preferences.
- Game mode.
- Timer and voting preferences.
- Recent secret words.
- Online session information.

The project does not use IndexedDB in this archive.

## PWA

A service worker is included.

It implements:
- Application-shell caching.
- Runtime caching of static resources.
- Network-first navigation.
- Offline fallback.
- Cache-version management.

Once the application has been successfully loaded online and its resources cached, the locally available game can work offline.

The following still require internet:

- Gemini generation.
- Groq generation.
- AI-specific categories.
- Online multiplayer.

## Tauri

A Tauri 2 configuration is provided.

The project has Android packaging infrastructure and an automated Android GitHub Actions workflow.

The workflow supports:
- Android project initialization.
- Signing configuration.
- APK building.
- AAB building.
- Artifact uploads.
- Optional GitHub Release publishing.

The supplied CI configuration does not establish that Android builds have actually succeeded.

---

# 14. Testing and Verification

The archive contains:

### Game engine tests

Tests cover:
- Classic role distribution.
- Mystics mode role distribution.
- Assignment cardinality.
- Voting requirements.
- Vote validation.
- Vote tallying.
- Mr. White guess normalization.
- Hint distribution.

### Online tests

Tests cover relay URL normalization.

### Relay integration tests

The smoke test exercises:
- Creating rooms.
- Joining rooms.
- Starting games.
- Receiving private assignments.
- Reconnection.
- Discussion transition.
- Voting.
- Results.
- Starting another round.
- Host reconnection.
- Kicking players.

### Content audit

The included audit script successfully passed when run with Node.

Its results:

- 30 categories.
- 1,800 word entries.
- 60 entries per category.
- No duplicate words within individual categories.
- No undefined CSS variables.
- Required project files and online safeguards present.

**Important:** This is a static audit, not proof that all the actual words and hints are semantically good.

I could not execute the complete Bun-based test/build pipeline because Bun and the project's installed dependencies were not available in the inspection environment.

I did identify a definite TypeScript problem in the supplied source:

`src/components/GameReveal.tsx` references `onHide()` inside `cancelHold()`, but `onHide` is missing from the component's parameter destructuring.

The prop is declared and passed by the parent, but is never brought into the component's local scope.

This produces:

`TS2304: Cannot find name 'onHide'.`

Since the production build runs TypeScript before Vite, this is a build-blocking defect in the supplied source.

The included `dist/` folder is a prebuilt artifact; its existence does not establish that the current source can rebuild successfully.

---

# 15. Defects and Important Implementation Gaps

The following issues deserve attention before further feature development.

| Priority | Issue | Impact |
|---|---|---|
| Critical | Missing `onHide` destructuring | TypeScript build failure |
| High | Generic and semantically weak word banks | Poor gameplay quality |
| High | Manual packs bypassed when AI key is configured online | Custom content does not behave as expected |
| High | Online hidden-voter data is still distributed to all clients | Privacy setting is not enforced |
| High | Deprecated primary Groq model | AI requests may fail |
| High | Tauri CSP omits the configured external relay origin | Online connectivity can be blocked in packaged apps |
| Medium | AI hint generation failure aborts round creation | Unnecessary loss of playable rounds |
| Medium | Small custom packs can exhaust repeat protection | Cannot start another round |
| Medium | New online rooms overwrite local initial settings with relay defaults | Extra configuration and unexpected defaults |
| Medium | Local and online result presentation differ | Feature inconsistency |
| Medium | Online settings are not equivalent to local settings | Inconsistent gameplay configuration |
| Medium | Limited AI-specific regression tests | Weak failure detection |

### Additional observations

**Manual pack selection bug**

In both local and online game creation, the code checks for a configured AI key before selecting the manual custom-pack word.

Consequently, configuring an API key and playing online can cause a manual pack to be treated as an AI-generation topic instead of using its saved word list.

**Online voter privacy**

The relay includes voter names in the result payload regardless of the hidden-voter setting. Although the online interface currently displays counts, the names remain available to every client inspecting the received message.

**Tauri connectivity**

The Tauri Content Security Policy does not include the external WebSocket relay domain configured in `.env.production`. The production relay origin should be explicitly allowed. The relay's allowed-origin configuration must also account for packaged application origins.

**Local versus online role results**

Local result calculation treats Mr. White as a Mystic for the displayed Mystic-name list. Online results distinguish Mr. White separately. The two implementations should agree.

---

# 16. Recommended Development Priorities

I would approach further development in this order.

### P0 — Build and runtime stability

1. Fix the `GameReveal` TypeScript error.
2. Execute the complete Bun verification pipeline.
3. Resolve any additional typecheck and lint errors.
4. Verify actual browser runtime behavior.

### P1 — Gameplay correctness

1. Replace the generic built-in word entries with real category-specific secret answers.
2. Improve hint relevance and uniqueness.
3. Correct manual custom-pack selection.
4. Make AI hint generation fail gracefully.
5. Correct repeat-protection exhaustion.
6. Enforce voter privacy at the relay.

### P1 — Multiplayer reliability

1. Synchronize local and online settings.
2. Fix new-room configuration initialization.
3. Add the relay to Tauri's CSP.
4. Test host disconnection and promotion.
5. Verify voting under player disconnection.
6. Prevent duplicate Mr. White guesses.

### P2 — Gameplay depth

1. Improve post-round results.
2. Introduce meaningful win-state presentation.
3. Add round history and optional score tracking.
4. Expand custom content management.
5. Improve onboarding and accessibility.
6. Introduce more expressive game feedback and animation.

### P2 — AI and content infrastructure

1. Update the Groq model configuration.
2. Add structured-output validation.
3. Validate generated words and hints.
4. Improve duplicate detection beyond exact matching.
5. Add AI generation regression tests.
6. Separate manual-pack, bundled-bank and AI-generation logic.

---

# 17. Final Assessment

Mystery Who? is fundamentally a hidden-role word deduction game with a pass-and-play implementation and a separate online multiplayer architecture.

Its strongest features are:

- Three distinct game modes.
- Flexible role assignment.
- Multiple Mystic hint configurations.
- 30 built-in categories.
- Manual and AI-generated custom categories.
- Repeat protection.
- Configurable voting.
- Mr. White's final guessing mechanic.
- Independent online rooms.
- Server-side voting validation.
- Automatic reconnection.
- Offline PWA support.
- Tauri packaging infrastructure.

Its main weakness is not the game concept or architecture. It is the quality and consistency of the implementation.

The game engine has a useful separation of responsibilities, but the word banks need substantial content work. Some advertised configuration options are not consistently implemented between local and online modes. There are also build, API compatibility and privacy issues that need correction.

**My verdict:** A promising social-deduction game prototype with a reasonably good technical foundation, but not yet a verified production-ready release.

The most important immediate work is to repair the build, correct the word banks, fix manual custom-pack behavior and enforce online privacy. These changes will improve the actual experience more than adding more superficial configuration options.