# BANDRUPTCY
## Master Design Document

*(Formerly titled Hot Mic. Renamed August 2026: "hot mic" is a common podcast and politics term and was unsearchable.)*

---

## 0. About this document

This is the living design bible for Bandruptcy. It describes the game as a whole, not a prototype and not a single level.

It is a work in progress. It does not contain every level, character, or event the finished game will have. Sections marked **TO BE EXPANDED** are deliberately incomplete and will be filled in as production continues, level by level. That is by design. Nothing here should be read as "this is all the game is."

**This document describes WHAT and WHY, not HOW.**

It states what the game needs to do and the reasoning behind each decision. It deliberately avoids prescribing technical implementation. Where a technical constraint is stated, it is because that constraint is a *design* requirement (for example, the audio must be real processing on real stems, because that is the point of the game), not because it is the only way to build it. Find better implementations wherever they exist. The reasoning in this document is what must be preserved, not the method.

Section 12 states real numbers for difficulty. Those are starting points for playtesting, not fixed values, and the reasoning behind each is given so they can be argued with rather than obeyed.

Section 23 lists ideas that were considered and deliberately rejected, with the reasons. Read it before proposing changes, so the same ground isn't re-litigated.

**If you read only five sections, read 2.4, 6.4, 6.6, 8.1b and 8.7.** The derivability rule, the staging rules, the animation test, the signal path test, and the event grammar are what make every other decision in this document survive contact with a player. The first build of this game failed on exactly those three, and it failed while implementing everything else here correctly.

---

## 0.1 How to edit this document

**This section is for whoever is editing next, human or AI. Read it before writing anything.**

This document is developed in conversation with AI agents. That process has a specific failure mode, it has already damaged this document once, and it will happen again unless whoever is editing knows to watch for it.

### The failure mode: writing case law

A concrete problem comes up in discussion. Someone gives an example. The agent writes a rule that bans that example.

It happened here with pan. The example given was a guitarist stepping to one side to signal a pan move, which is illegible. The document came back with a rule that pan events may never be driven by performer position.

Three things wrong with that, and they are the same three things wrong with every instance of this pattern:

1. **It was already covered.** The guitarist example fails the derivability rule in 2.4, because nothing is actually wrong when someone walks across a stage. The new rule caught something an existing rule had already caught.
2. **It over-blocked.** A performer can legitimately *cause* a pan event: tripping over a cable and yanking the feed out of one PA stack, or shoving a road case in front of one side of the system. Both legible, both banned by a rule aimed at something else.
3. **It defended against nothing.** No implementer was going to invent performer-driven pan unprompted. The rule cost design space and bought no safety.

Multiply that by every design conversation this document has been through and you get a bible that is mostly transcript. **A resolution reached in conversation is not automatically a rule.** Most of them are examples of rules that already exist.

### The test, before writing anything new

> **Does an existing rule already cover this? If yes, what you have is an example, not a rule. Write it as one, or do not write it at all.**

If it genuinely is not covered, ask the next question: **is the new rule as general as the problem?** A rule written from one example usually is not. Find the level of generality that covers the case you were given and the cases you were not.

Rules are expensive. They constrain everything downstream forever and they are read by implementers who cannot tell an important one from a defensive one. Prefer fixing an existing rule over adding a new one, and prefer an example over both.

### Every claim has a type

Claims in this document are one of three things, and they are not interchangeable:

- **[Rule]** Breaking it breaks the game. Do not revisit without a serious argument.
- **[Decision]** Settled and defensible, cheap to change if something better appears.
- **[Guess]** Written to fill a hole. Awaiting a build, a playtest, or a better idea. **Guesses are invitations, not instructions.** If you have a better answer, propose it.

Section 2.8 lists the rules. Anything not in that list is a decision, a guess, or an example, and none of those bind you the way a rule does.

### Examples are disposable

Every specific event, object, character and venue named in this document is an illustration of a principle, not a fixture of the game. The dog on the pedal, the blown speaker stack, the beer spill: these exist to show what the principles look like in practice. Replace them freely with better ones. What must survive is the reasoning, not the instance.

**Examples are not exempt from being correct.** A disposable example still has to survive both the signal path test (8.1b) and the animation test (6.6). Several in earlier drafts did not, and the damage was worse than a wrong rule, because implementers build what the examples show. If an example cannot be made technically coherent, delete it rather than writing it loosely.

---

## 1. The game in one paragraph

You are the live sound engineer for a band. You see the stage on the top of the screen and your mixing board on the bottom. The band plays. Things go wrong. Your job is to notice what went wrong, work out which channel it affects, fix it before the audience notices, and put it back when the moment passes. You start in a garage with one guitarist. If you survive, you end up in stadiums. The band gets bigger, the board gets busier, the problems get stupider, and none of it ever calms down.

---

## 2. Design pillars

Six things this game is. Every decision should be traceable to one of them.

### 2.1 The scoring problem is solved by inversion

Music games that ask you to be creative are fundamentally unscorable, because the thing that makes music good is taste, and taste cannot be evaluated in code. Any game that tries either collapses into a rhythm game (hit the right button at the right time) or into a bad DAW (here are some tools, have fun).

Bandruptcy sidesteps this entirely. **It never asks whether your mix sounds good. It asks whether you caught the problem, and whether you put things back afterwards.**

Every event has a visible or audible cause, a correct response, a time window, a measurable penalty for missing it, and a later moment when the fix must be undone. All of that is objectively checkable. The player exercises real audio skills but the game only ever evaluates problem detection, response speed, and restoration.

This is the load-bearing insight of the whole project. Do not add any mechanic that requires the game to judge the aesthetic quality of the player's mix.

### 2.2 Every event has a setup and a payoff

This is the rule that keeps 2.1 from breaking.

If the game only scored catches, the board would drift. You turn the guitar toward treble to cut through after someone drapes a coat over the mic, and nothing ever makes you turn it back, so by the end of the song every control sits at whatever extreme the last event demanded and the score is still perfect. Worse, a player who has memorised a level could park controls at their eventual positions before the events even fire.

So: **every problem has two beats.** The drummer falls asleep, you pull him down. The drummer wakes up, you push him back. Score drains every second past the grace period in *both* directions, and reacting fast to either beat earns points back.

And underneath that, **every channel has a neutral resting position.** When nothing is wrong on stage, a channel sitting away from neutral drains slowly. That single rule kills pre-parking, gives the fader a defined place to return to, and means a slow leak in the meter is itself a message: something is still off the board and you have not put it back.

Neutral is a range, not a pixel-perfect point. The width of that range is a difficulty dial (see 12).

### 2.3 Attention is the resource *[Guess]*

The player has two places to look and cannot look at both. The stage tells you what is happening. The board is where you act.

Difficulty is not about complexity of individual actions. Every single action in this game is trivial: drag a fader, turn a knob, press a button, wipe a spill. Difficulty comes from **how many trivial actions are demanded at once, and how little time you have to decide which one matters most.**

This is the Spaceteam principle. Simple verbs, impossible schedule.

Both claims in this section are untested. That the player cannot watch both halves of the screen, and that difficulty comes only from simultaneity rather than from any individual action being hard, are assumptions this game is built on and has never checked. Listed as a pillar because it is load-bearing, marked as a guess because it is unproven.

### 2.4 Identifying the problem is never the challenge

Problems announce themselves. Loudly. Visually, audibly, or both.

**Sound problems are never subtle.** When an event announces itself through audio, that audio must instantly name its own channel: snoring in the overheads is the drums, a phone ringing beside the vocal mic is the vocal channel, a crackling jack is whichever instrument just went intermittent. The ear replaces the glance. It never adds a puzzle.

There is no hunting, no process of elimination, no "something is wrong somewhere, go and find it." The demand is always obvious. The difficulty is executing it while three other things are also obvious.

This is what separates the game from a diagnostic sim, and it is why solo is not a search tool (see 5.3).

**The derivability rule.** Announcing itself is not enough. The cue must also name the fix.

> A player who understands sound but has never played this game must be able to derive the correct control *and the correct direction* within one second of seeing the cue, without a legend, a tutorial, or a memorised mapping.

If they cannot, the cue is wrong or the event does not belong in the game.

This distinguishes two kinds of event, and only one of them is allowed:

- **Problems.** A state on stage that is visibly or audibly wrong, where the fix follows from the fiction. The drummer is asleep with his head on the snare, snoring into a mic. Channel: him. Direction: too much sound. Control: loudness is the fader. Nothing was memorised.
- **Instructions.** A signal that means "do X" only because the game says so. A character steps to one side, so pan. A fan holds up a sign, so press solo. These require a lookup table the player was never given.

Spaceteam can use arbitrary mappings because its instructions are written out in words on screen. Bandruptcy has no text layer during a gig, so arbitrary mappings have nowhere to live. **Author problems, never instructions.**

A useful corollary: a cue may state a **goal** and still be legible. It may not state a **control**. The venue owner's TURN IT DOWN sign is fine, because the sign gives the direction and the player picks the control. A crowd sign demanding sound their way is not, because it silently assumes the player knows which knob does that.

### 2.5 A good game that is also funny

The gameplay loop is a known quantity. "Operate a control panel under escalating stress" is a proven genre. The game has to work as a game, and it has to be funny.

Beyond that, **whatever suits the game goes.** An earlier version of this section tried to rule on the relationship between mechanics and comedy: cut mechanics that exist only to set up a bit, keep flavour that serves no mechanic. Both halves were invented rather than needed. Some jokes will earn a mechanic. Some mechanics will exist because they are funny. Neither needs permission from this document.

### 2.6 You are always the professional

The player character is never on screen and never speaks. You are a pair of hands and a set of ears. You are competent. You are trying to do your job.

The comedy comes from the contrast between your professionalism and the chaos surrounding it. Nobody in the game comments on how ridiculous anything is. The bassist proposes to someone in the crowd mid-song and the band stops dead, and your problem is that you now have dead air and a live vocal mic picking up an intimate moment at full gain. That is the joke. Nothing needs to wink at it.

This is the LucasArts register. Play it straight.

### 2.7 It should teach you something real without ever saying so

By the end of the game the player will understand, at an intuitive level, what a fader does, what EQ does, what reverb does, why feedback happens, and what it feels like to keep a live mix alive. None of this is ever taught explicitly. There are no tutorials that explain audio concepts.

They learn it because the controls are real controls doing real things to real audio, and because every problem has a physically sensible cause and fix. When the amp dies and the guitar comes through a borrowed DI sounding thin and buzzy, you turn the tone knob toward bass and it stops sounding thin. That is the entire lesson and it never needs stating.

### 2.8 The rules, in full

Everything in this document that is a **rule** rather than a decision, a guess or an example. This is the whole list. If a constraint is not here, it does not bind you (0.1).

**On events**

1. **An event must make sense contextually, visually and technically.** This is the general form of most of what follows, and it is the one to reason from when a case is not covered. Contextually: something is genuinely wrong in the fiction. Visually: the player can see it happen, at the thing that caused it, animated within the constraints of the pipeline. Technically: the cause really changes the signal, and the fix is a real operation that really addresses it. The two tests are 6.6 and 8.1b.
2. Problems always announce themselves. No hunting, no elimination, no searching. (2.4)
3. The correct control and direction must be derivable within one second, with no legend and no memorised mapping. (2.4)
4. Every problem has a physically sensible cause and fix. (2.7)
5. Only one problem at a time per instrument. (8.1)

**On scoring**

6. The game never asks whether the mix sounds good, because taste cannot be evaluated in code. (2.1)
7. Score drains past the grace period in both directions, on the setup beat and the payoff beat alike. (2.2)
8. Every channel has a neutral resting position, and sitting off it with no active event drains slowly. (2.2)
9. Neutral is a range, not a point, and the width of that range is a difficulty dial. (2.2)

**On the board**

10. Every control must have a perceptible consequence when moved. If it does not, it does not belong. (5.1)
11. Four controls per channel: volume, tone, pan, FX. (5.2)
12. Effect and tone ranges are exaggerated well past real-world practice. Legibility beats realism, always. (5.2)
13. Controls are real controls doing real processing to real audio. (2.7, 18.1)
14. Talkback is a new problem class, never an alternative fix for something the board can already handle. (5.5)
15. House music exists to solve dead air. (5.3)
16. One person, one channel. Global controls (master, house music, talkback, solo, record) are the exception and are not channels. (5.6)
17. Every channel strip is visible on every platform. No banking. (5.6)

**On tone and world**

18. LucasArts SCUMM era is the primary reference: deadpan absurdity, a high rate of small jokes, and affection for people who are not succeeding. (3.1)
19. Nobody in the game ever comments on how ridiculous anything is. (2.6)
20. Spaceteam is a reference for pacing and pressure only, never for aesthetic or content. (3.1)
21. The hub is one screen, visited between gigs. (4)

---

## 3. Tone and humor

### 3.1 Reference points

The primary reference is **LucasArts adventure games of the SCUMM era**: The Secret of Monkey Island, Monkey Island 2, Day of the Tentacle, Sam and Max Hit the Road, and Grim Fandango for mood.

What is being borrowed from them:

- **Deadpan absurdity.** Impossible things happen and are treated as ordinary inconveniences.
- **Density of jokes.** Background details, item descriptions, and throwaway lines all carry humor. The joke rate is high and most of them are small.
- **Affection for losers.** The band is not good. The manager is not honest. The venues are not nice. Nobody in this world is succeeding, and the game likes all of them anyway.
- **Wordplay in flavor text.** *[Guess]* Object and item descriptions are a primary comedy vehicle. "Snare drum. Technically a snare drum." "Mic stand (load-bearing)."

The secondary reference for *chaos structure* is **Spaceteam**: escalating simultaneous demands on a panel of simple controls. This is a reference for **pacing and pressure**, not for aesthetic or content. Bandruptcy is not sci-fi and should not accumulate absurdly-named technical controls. The chaos comes from how much is happening, not from how many buttons exist.

The reference for **cosmetic joke items** is Shadows Over Loathing: purchasable novelty that changes how things look without changing how things play.

### 3.2 Escalation *[Guess]*

Absurdity is present from the very first gig. This is not a game that starts realistic and gets silly. The garage is already ridiculous.

What escalates is **scale**, not weirdness. A dog standing on a boost pedal in a garage becomes a pyrotechnic malfunction setting a guitarist's hair on fire in an arena. Same comedic register, more consequence.

### 3.3 Where the writing lives

- Event flavor and stage business (visual, mostly wordless)
- The manager's gig pitches
- Answering machine messages
- Store and inventory item descriptions
- Post-gig band and venue reactions
- Failure messages
- Venue names, band names, poster art in backgrounds

**TO BE EXPANDED.** The band needs a name. The manager needs a name. The band members need names and personalities.

---

## 4. Core gameplay loop

**Moment to moment, during a gig:**

1. The band plays. Every channel sits at neutral.
2. Something goes wrong on stage. It announces itself.
3. You identify which channel is affected and which control fixes it.
4. You act. Fast enough and the crowd never notices, and you may even claw points back. Slow and crowd energy drains. Not at all and you are heading for a failed gig.
5. The problem passes. You put the channel back to neutral. Same clock, same penalties.
6. Repeat, with overlaps, until the song ends.

*[Guess]* This describes the loop as currently designed, not as it has to stay. **Directly clickable things on the stage are an open direction**, in the spirit of the beer spill (9) but on the other half of the screen: objects the player reaches up and deals with rather than compensating for on the board. This would change the shape of step 3, and it is wanted rather than merely tolerated.

**Between gigs:**

1. You land in the manager's office.
2. He pitches whatever gig he is currently trying to offload onto you. If that venue has a gear requirement, he tells you what it is, in his own dishonest and unhelpful way.
3. The map then displays that venue, and makes it unmistakable that you cannot play it until you own the gear it needs.
4. You can check the answering machine for optional side jobs, browse the map for other available gigs, buy gear and consumables, and dress your band in stupid clothes.
5. You pick a gig and play it.

**Across the game:**

1. Score well, get paid.
2. Money buys the gear that makes bigger gigs possible.
3. Bigger gigs mean a bigger band, more channels, and eventually entirely new systems to operate.
4. The venues get bigger and the disasters scale accordingly.

---

## 5. The mixing board

### 5.1 Design principles

*[Decision]* **Every control must be learnable from a single encounter.** The player should never need to be told what a control does. They should meet a problem, try the obvious thing, and have it work.

**Every control must have audible or visible consequence.** If moving something does not produce a perceptible change, it does not belong on the board.

*[Guess]* **The board must not become cluttered.** New controls are added rarely and only when they enable a genuinely new *kind* of problem. Adding a control that duplicates something an existing control already handles is not allowed.

**Every channel has a neutral position.** See 2.2. This is a property of the board, not just of scoring.

**The board is hand-drawn like everything else.** It is not a clean vector UI. It uses ruled straight lines where it needs to read as a functional object, and freehand everywhere else, including hand-lettered channel labels. The whole screen must feel like one coherent drawn world.

### 5.2 Per-channel controls

Each channel strip has four controls. Layout is a tall vertical fader at the bottom with the other controls stacked above it and a hand-lettered label at the top.

| Control | What it does | Why it's here |
|---|---|---|
| **Volume fader** | Channel level | The primary verb of the game. Most problems resolve here. Vertical drag, generous travel. |
| **Tone knob** | Single knob, bassy at one end, bright at the other, flat in the middle | EQ reduced to one intuitive axis. Player never needs to know what a frequency is. They hear "too thin" and turn it toward fat. |
| **Pan knob** | Position in the stereo field | Real stereo processing, but driven by *visual* cues. See 5.4. |
| **FX toggle** | The board's reverb/delay on or off for that channel | Binary, instant, obvious. Note that this is the console's effects rack, not the band's pedals, which the player cannot touch (8.1b). |

Effects should be exaggerated relative to real-world practice. The player needs to hear the difference clearly on laptop speakers or a phone. The same applies to the tone knob's range. Realism loses to legibility every time.

**Controls arrive one at a time, and not all at once with the strip.** *[Guess]*

The original plan grew the board by adding a channel per venue in tier 1, which meant the player was handed four controls per channel in venue 1 while only fader events ever fired. When the first tone or FX event finally landed there was no reason to expect it and no way to guess where it went.

So the tutorial tier interleaves two ramps, member growth and control growth:

| Venue | Band | Controls available |
|---|---|---|
| **T1 V1** | Guitarist | Fader, master |
| **T1 V2** | + Drummer | + Tone |
| **T1 V3** | + Bassist | + FX toggle |
| **T2, at the blown speaker stack** | + Vocalist | + Pan |

*[Decision]* Controls that have not arrived yet are not greyed out, they are **physically not there**: the strip is short, or the knobs are missing, or there is a hole where one used to be with a scrawled note taped over it. The manager keeps handing you worse gear and then slightly better gear, which covers the whole thing in fiction and gives the store something to sell.

Each control's debut venue opens with an event that can only be solved by the new control, at low pressure, with nothing else active. That is the entire tutorial.

*[Decision]* **Every control draws its own axis.** The tone knob is a fat blob at one end and a sharp spike at the other, not the words bass and treble. The fader track is thick at the top and thin at the bottom. The player should be able to guess which way to move something before they have ever moved it.

### 5.3 Global controls

| Control | What it does | Why it's here |
|---|---|---|
| **Master volume** *[Guess]* | Overall level | Creates a tug-of-war: the neighbour or venue owner wants it quieter, the crowd wants it louder. Under 2.2 this is a clean setup and payoff pair rather than a coin flip. One knob, one recurring gag, no further role. |
| **Talkback** | Speak to the band | Unlocked at tier 3. Introduces an entire class of problems the board cannot fix. See 5.5. |
| **House music** | Play or stop background music through the PA | Solves the dead-air problem. Several events stop the band entirely. Without this, those events are passive and you just watch your score drain. With it, you have a job: cover the gap, keep the room alive, drop it when they restart. |
| **Solo** | Isolate one channel to the house | Primarily a side-job tool. Not a diagnostic instrument. See below. |
| **Record** | Records the set | Used **only** for optional side jobs. Never a routine per-gig action. See 16. |

**Solo is not a hunting tool.** The original design had solo as the way to find problems with no visual cue: something is wrong, the stage looks fine, search for it by ear. That is a linear search under time pressure, which is tedium rather than tension, and it contradicts 2.4. Problems announce themselves, so there is nothing to hunt.

*[Decision]* **Solo has no in-gig events at all.** The previous design kept one: a fan holds up a sign asking for the guitar to be soloed. That fails the derivability rule in 2.4 for the same reason the old pan cues did. A sign asking for a specific control is a lookup, not a problem, and no amount of drawing fixes it.

Solo therefore exists for exactly one reason: **side jobs that require isolating a channel**, like the DJ who wants a clean drum break. In that context the answering machine has already told the player in words what to do and why, so the mapping is taught rather than assumed, and the sticky note on the board carries the reminder (16.4).

This is not a loss. It removes a control from moment-to-moment attention load and gives side jobs a verb that nothing else in the game uses, which makes them feel like a different activity rather than a modifier on the same one.

**Solo goes to the house, not to headphones.** On a real console solo is PFL to the engineer's cans and the audience hears nothing, which would make it free. Here everyone hears it, so holding it has a real cost. Legibility beats realism.

### 5.4 Pan

Pan cannot be relied upon as an audio cue. Phone speakers are effectively mono, iOS mixes to mono on the built-in speaker, and many players will be on laptop speakers or a single earbud. **Every pan event must therefore be legible from the stage**, and rule 1 in 2.8 governs what that means: something is genuinely wrong in the fiction, the player can see it where it happened, and moving the sound sideways is a real fix for it.

The failure to avoid is a cue that *signals a control* rather than showing a problem. A guitarist stepping to one side and expecting a pan move is not a pan event, because nothing is wrong when a guitarist walks. That fails rule 3 and it would fail identically for any other control.

Examples that pass, illustrative only:

- A speaker stack blows on one side, sparks and smoke. Everything moves to the working side.
- One side of the crowd goes flat, cups their ears, drifts toward the middle.
- Someone parks a van or a stack of crates in front of one stack and kills that side of the room.
- The guitarist trips over a cable and yanks the feed out of one PA stack, killing that side of the room.

Note that the last one is caused by a performer and works fine, because something actually went wrong. What matters is whether there is a problem, not who or what caused it. A performer walking about is not a problem. A performer breaking something is.

**Real stereo processing is retained.** Desktop players in headphones will hear it. That is for feel, not for information.

**Hard-panning also drops the channel level slightly**, a few dB at the extreme. This gives mobile and mono players a perceptible consequence. The drop is deliberately small: if pan could cut enough level to solve a "too loud" problem it would become a second fader, which is what monitor sends were rejected for. *[Decision]*

**Pan arrives last of the four channel controls**, in tier 2 (5.2). It is the least intuitive control on the board. *[Guess]*

### 5.5 Talkback is a new problem class, not a second solution

Talkback is a single button but it is the most significant addition in the game, because it changes the *category* of solvable problems.

**Talkback is never an alternative way to fix something the board can already fix.** The original framing had it as a tradeoff: turn the drummer down, which is fast but costs you the drums, or yell at him, which is slower but gets the drums back. That tradeoff is fake, because talkback costs nothing but time, so the correct play would always be talkback.

Instead, specific problems **require** talkback and can only be solved that way. These are things wrong with the humans, which no fader can touch: the drummer drifting off tempo, the guitarist standing in front of the wedge so it howls no matter what you do, the singer wandering off mic, the bassist still playing the previous song.

Spam stops being a concern automatically, because pressing talkback at a board problem does nothing.

### 5.6 Channel count

Channel count grows with the band. This is the primary difficulty scaler across the whole game. Tier 1 adds a member every venue; after that, additions are much rarer. See 11.

**One person, one channel, always.** No multi-channel sources: the drummer is one strip, not kick plus snare plus overheads. No non-person channels either. Per-drum channels would clutter the board and would break the position mapping in 6.2.

**Every strip is always visible, on every platform.** The band is capped at whatever fits the smallest supported screen. There is no banking. See 22.

### 5.7 Where the split sits

*[Guess]* The vertical split between stage and board is flexible and should be tuned per venue. A one-channel garage gig can afford a taller stage. A stadium with a full band and a lighting rig needs more board. Letting the proportions shift is a free way to communicate escalation.

---

## 6. The stage

### 6.1 What the stage is for

The stage is the player's primary information channel. It is where problems announce themselves. Everything about how it is drawn and animated is in service of **readability under pressure**.

It is also where all the comedy lives. These two jobs are compatible, because a problem that is funny is a problem that is memorable, and a memorable problem is one the player learns to recognize faster next time.

### 6.2 Readability rules

These are non-negotiable and matter more than art quality.

1. **Every event's visual appears at the location of its cause.** The snoring is at the drummer. The spark is at the guitarist's feet. The player learns to map stage position to channel strip, and that mapping must never be violated. One person per channel (5.6) is what makes this possible.

2. **Event visuals must be distinguishable at a glance.** Different shape, different motion, different color. The player must never have to read text to know what is happening.

3. **Ambient motion is looping and predictable, never erratic.** The venue must feel alive. The crowd dances, the band plays, things move in the background, and a dead audience in front of a static band would be worse than any readability gain.

   What matters is not how much moves but *how* it moves. Ambient animation should be rhythmic and repeating, so the player's brain locks onto the pattern within a few seconds and stops attending to it. A crowd swaying in time is readable background. A crowd twitching at random is noise, and it competes with event signaling and loses.

   The practical test: if a new animation appeared in the middle of the background right now, would the player notice it immediately? If the background is looping, yes. If the background is random, no.

4. **When an event moves from "you have time" to "you are losing points," the visual escalates.** A pulse, a shake, a color shift. This transition is the single most important piece of feedback in the game. The player must feel the moment grace runs out. The same applies to the payoff beat: when a problem ends and the channel needs restoring, that also has to announce itself.

5. **The crowd is a readable meter, not decoration.** How the crowd looks and behaves communicates crowd energy without the player having to check a number.

### 6.3 The crowd

The crowd is drawn in the same style as everything else but simpler and smaller. A small set of distinct crowd shapes, repeated and recolored, is enough.

The crowd's state should be visible: engaged and moving when energy is high, folding their arms and looking around when it drops, actively hostile at the bottom of the scale. Failure states are communicated through the crowd (demanding refunds, throwing things) rather than through a UI message.

The crowd is also **spatial**. It has a left, a middle and a right, and those sections can behave differently. That is what makes the pan events in 5.4 legible, and it costs nothing, since the crowd is already drawn as repeated shapes.

### 6.4 Staging events so they read

A well-designed event still fails if it is staged like reality. This section exists because it was the actual failure of the first build: the events were correct on paper and illegible on screen.

The worked example throughout is the dog on the guitar pedal. Drawn realistically, the player sees a dog, does not see the pedal, and has to infer a three-link chain: dog, to boost pedal, to a guitar channel that just jumped in level. Every link is a place to lose them.

These six are the visual half of rule 1 in 2.8: they are what "the player can see it, at the thing that caused it" actually requires in production. The specific objects named are examples (0.1).

**1. Draw at gameplay scale, not at real scale.** A real pedal seen from behind a console is the size of a paperback. Any object that can cause an event is drawn two to four times its true size. The pedal is a suitcase. The cable is a rope. The amp knob is a dinner plate.

Nobody reads this as an error. LucasArts oversized every interactive object and it reads as style. The corollary is strict: **anything that can never cause an event stays small, or is not drawn at all.**

**2. Establish before you disturb.** An object introduced at the moment it breaks is unreadable, because the player is parsing "what is that" and "what changed" at the same time.

Every event object is on stage from the level's opening beat, in ambient loop, with a visible resting state. The pedal sits there with its light off for thirty seconds and becomes furniture. Then the dog stands on it, the light comes on, and the change is instant.

**No event object may first appear later than the opening beat of the level it fires in.** Objects that arrive by fiction (a thrown bottle, weather) are the agent, not the object, and the thing they hit must already be established.

**3. The message goes on the object, not on the agent.** The dog is the cause and the joke. The dog is not the information. The pedal's light was off, now it is on and the guitar's sound is visibly twice the size (6.5). The player reads the pedal and the stack, not the dog.

Every event has this split. Agent carries the comedy, object carries the cue. Design them separately and check that the cue survives if the player misses the agent entirely, because under load they will.

**4. Three beats, and the third one holds.** Approach, contact, result. Contact-only animation is over before it is parsed. The **result state persists and keeps animating for as long as the problem is live**, and escalates visibly when grace runs out (6.2.4). A player who looks up two seconds late must still see everything they need.

**5. Channel colour binds the whole chain.** Each band member owns a colour, used on the person, their gear, their cables, their pedal, their speaker stack, their channel strip on the board, and any effect the board applies to them. Then "which strip" stops being a reasoning step and becomes matching.

The colour is also what makes 6.5 work. Sound made visible is only useful if the player can tell whose sound it is at a glance, and colour is what carries that.

**6. Keep the moving foreground almost bare.** Readability is relative. Five things that can move means any change to any of them is obvious. Twenty means none of them are.

Venue backgrounds can be as dense and detailed as the comedy wants, because they are flat and still. The foreground holds the band, their gear, and nothing else that animates. Background detail is a joke delivery system (17.6); it is not allowed to move.

### 6.5 The stage shows the board's state

Everything above makes the *problem* legible. This section makes the *board* legible, and it is what turns "which control" from a reasoning step into a perception.

**Every channel's current setting is drawn as visible sound coming out of that channel's speaker stack.** Not a meter, not a HUD element, not a number. A drawn, animated, cartoon representation of sound leaving a cabinet, in that channel's colour (6.4.5).

Four controls, four visual properties:

| Control | Visual property | At neutral | Off neutral |
|---|---|---|---|
| **Volume** | Size and reach of the sound leaving the stack | Steady pulses, roughly a third of the way into the room | Thin puffs that die at the cabinet, or huge waves crashing over the front row |
| **Pan** | Which stack the sound comes out of, and how far it leans | Both stacks equally | Pulled toward one side, with the other stack going quiet |
| **Tone** | Shape of the wave form | A balanced shape | Round, heavy, sagging blobs at the bass end. Sharp, spiky, jittering shards at the treble end |
| **FX** | A visible tail | Nothing | Echoes: ghosted repeats of the same shape trailing behind and fading, or a smeared halo for reverb |

This is one visual system doing five jobs.

**It answers "which control" without reasoning.** The vocalist eats the mic, the sound coming off his stack turns into round sagging blobs, and the player reaches for his tone knob. They never had to think "muddy means low frequencies means EQ means the tone control." The symptom and the control are the same picture.

**It makes the neutral rule visible.** 2.2's off-neutral drain is currently invisible: a channel sitting wrong just slowly costs points with nothing on screen explaining it. Now the guitar is visibly still throwing spiky shards into the room long after the jacket came off the cabinet, and the player can see the leak rather than being told about it after the gig.

**It makes the payoff beat obvious.** The problem ends, the stage returns to normal, and the one channel that is still wrong is the only one still looking wrong. That is the entire second half of every event, solved by drawing.

**It teaches audio for free.** 2.7 wants the player to leave understanding what a fader, EQ and reverb actually do. A player who has spent four hours watching bass look heavy and treble look sharp has that intuition whether they wanted it or not.

**It gives mobile and mono players the pan information they cannot hear.** This is a better answer to 5.4's problem than the small level drop at hard pan, which stays but stops being the only consequence.

#### The rules that keep it from becoming noise

Rule 6 above says keep the moving foreground bare, and this adds a moving element per channel. Four constraints reconcile them.

1. **It is anchored to established objects.** The sound comes out of the speaker stacks, which are already on stage, already oversized (6.4.1), already established from the opening beat. Nothing new enters the frame.

2. **At neutral, it is ambient.** Every channel sitting correctly means a rhythmic, repeating, identical pulse from every stack, locked to the song. That is exactly the predictable ambient motion 6.2.3 asks for, and the brain files it as background within seconds. **Deviation is the only thing that reads as new.** A stage where every channel is right should look calm and even.

3. **It renders state, never events.** Events are drawn at the person who caused them (6.2.1). The stacks show only what the board is currently doing. Cause and consequence stay in different places on screen, so they cannot be confused for each other, and an event that has been fixed still visibly changed something.

4. **It is subordinate in the visual hierarchy.** Lower contrast and slower motion than event visuals. If a spark at the guitarist's feet and a wave off his stack compete, the spark wins. This is the one place where the system is allowed to be quiet, because a player who ignores it entirely can still play the game from the event visuals alone. It is a second, redundant channel of information, not a replacement for the first.

#### Introduction

The system arrives one property at a time, alongside the controls in 5.2. Venue 1 has one stack, one channel, and only size varies, which teaches the whole visual language with a single variable and no possibility of confusion. Shape arrives with the tone knob, tails with the FX toggle, and lateral lean with pan in tier 2.

**TO BE EXPANDED.** The exact visual vocabulary needs drawing and testing before it is fixed here. What matters is the mapping, not the specific shapes.

#### The known risk

This is the most expensive addition in this document: a per-channel animated system that has to remain readable at the pixel resolution in 17.4 and at maximum band size. It shares its failure mode with the existing measurement in 19.1, and should be tested in the same pass rather than as a separate exercise. If it does not survive that test, the fallback is colour binding alone (6.4.5), which delivers a meaningful part of the benefit at none of the cost.

### 6.6 The animation test

**Run this on every event alongside the signal path test in 8.1b. An event that is technically correct and cannot be animated legibly is just as unshippable as one that is nonsense.**

The constraints are hard and they are set by the pipeline (17.2) and the resolution (17.4). Animation is transforms on named parts of an existing drawing. The stage renders at roughly 320x180. A tier 1 character is perhaps fifty pixels tall; a late-game one is half that. A guitar pedal at real scale is one pixel.

So: **can a player see this happen, in that frame, without being told?**

**1. Rotation and translation of long objects read best.** A mic stand tipping, a cymbal swinging, an arm lifting, a door opening, a person walking. These are exactly what the pipeline produces and they survive any resolution, because the eye reads a changing angle across a long span from anywhere on screen. Prefer causes that are things swinging and things sliding.

**2. Covering reads better than modifying.** A large shape laid over a thing is the most readable event in low-resolution pixel art, because it changes a big block of the frame at once. This is a large part of why tone events are authored as covering (8.8): the blanket over the drum kit is both physically correct and the clearest thing on the stage.

**3. On and off beat gradual.** A light going from dark to lit is two frames and unmissable. A knob rotating twenty degrees is invisible unless the knob is the size of a dinner plate with a pointer painted on it, which is exactly what 6.4.1 requires.

**4. Whole-body movement beats limb detail.** Somebody walking off the stage is unmissable. Somebody changing their grip is not. If an event's visual lives in the hands, it needs an object to carry it instead.

**5. Breaking the ambient loop is a free cue.** Everything on stage moves in rhythmic, repeating, predictable motion (6.2.3). That means a character falling out of sync with everyone else is instantly readable with no new asset at all. The drummer speeding up needs no drawing: his existing loop just runs faster than the rest of the band's, and the eye catches it immediately. Use this wherever the problem is about timing.

**6. If it cannot be animated, give it an object.** This is the workhorse rule. Many real audio problems are physically invisible: an instrument going out of tune, a tempo drifting, a singer going flat, wind hitting a capsule. Each one gets an oversized object that carries the state visibly:

| Invisible problem | The object that carries it |
|---|---|
| Guitar going out of tune | A clip-on tuner on the headstock, drawn huge, flashing red |
| In-ear monitor pack dying | The belt pack's light, drawn huge, going out |
| Wind on a mic | Banners, hair and cables all streaming sideways |
| An amp being turned down or crept up | One dinner-plate knob with a painted pointer, rotating |

The object is the cue, the person is the joke. This is 6.4.3 again, arriving from the other direction.

**7. No event may require a new full-body drawing.** The whole pipeline rests on one drawing per character plus a face sheet (17.3). An event that needs a character in a genuinely new pose costs an asset that does not otherwise exist. A small number of one-off climax moments can be worth it, and they should be deliberate rather than accidental.

---

## 7. Crowd energy and scoring

### 7.1 One meter, no score readout

There is exactly one live feedback system during a gig: the crowd energy meter. There is no numeric score on screen while playing. Two systems that move together and mean the same thing is one system too many, and a HUD counter fights the period aesthetic.

The meter is a bar from 0 to 100. Numbers do not need to be shown, but the fill level must be unambiguous at a glance.

**The crowd expresses the same value diegetically, in addition to the bar and not instead of it.** The dancing gets more pronounced as energy climbs, until a room at 100 is genuinely going off. As energy falls the movement subsides, and by the time the player is approaching 0 the crowd is standing completely still, then shouting, then throwing things. The bar is the precise readout; the crowd is what the player actually feels. Both are always present.

**The player starts every gig at 100.** The meter drains from there. Ending at 100 means a flawless gig and maximum money, and that is achievable, because nothing forces the meter down except the player's own mistakes.

**There is no passive regeneration.** The meter does not refill on its own during calm stretches. It does not need to, because the player starts full.

### 7.2 What moves the meter

**Down:**
- A problem unresolved past its grace period, at its own rate
- A channel sitting off neutral with no active event to justify it, much more gently
- Deliberate sabotage during a side job
- Missed or badly executed lighting cues, tier 4 and up

**Up:**
- Fixing a problem inside its grace window (the speed bonus)
- Hitting lighting cues cleanly, tier 4 and up

The speed bonus is capped by the ceiling of 100, which gives it a clean role: it does nothing on a perfect run and functions purely as recovery once the meter has dropped. No score inflation, and a bad opening is always recoverable.

### 7.3 Passing and failing

**The threshold is 50, in every venue, for the whole game.** It is marked visibly on the bar so it reads as a place rather than a number. Stay above half and you pass. Finish at 100 and you have played a perfect gig.

The threshold never moves. Difficulty comes from drain rate, grace length, and event density (see 12), never from shifting the goalposts, because a threshold that changes per venue is invisible to the player and feels arbitrary when they fail at 60.

If the meter reaches 0 the gig ends early. That is the hard fail.

**When a player fails, they must understand why.** This is communicated diegetically rather than as a stats screen. The audience demands refunds. Someone throws a tomato. The venue owner cuts the power. The specific failure feedback should point at what went wrong, so the player learns rather than just losing.

The numeric score appears at the end of the gig and determines the payout.

### 7.4 Failure, retry, and replay

Gigs can be failed and replayed immediately, with no run-loss or progress penalty.

If a player is short of money, replaying earlier gigs is always available from the map. This is not a soft lock risk: money always has a route, so the worst case is slow rather than stuck. Side jobs may explicitly ask the player to return to earlier venues, which turns what would otherwise be farming into a reason to go back and gives old venues a second life once the board has grown.

Replay for score is encouraged. Gigs are authored, so a better score is genuinely a better performance rather than a luckier one (see 8.3).

---

## 8. Events

### 8.1 What an event is

An event is a problem that:
- **Announces itself** clearly, visually or audibly or both (see 2.4)
- Has **one correct fix** (or a defined sequence of them, later in the game)
- Has a **grace period** before it starts costing you
- **Drains crowd energy** at its own rate until resolved
- Has a **payoff beat**: a later moment when the fix must be undone and the channel returned to neutral, on the same clock and with the same penalties

Resolution is evaluated against game state, not against a specific input gesture. If the player reaches the right end state by an unusual route, that counts.

**Only one problem at a time per instrument.** A second problem never stacks on a channel that already has an active one. This keeps the board from becoming unreadable and it means event audio can never hide behind a fader the player pulled down for something else, so no bypass rule is needed.

### 8.1b The signal path test

**Run this on every event before it is written down. It is the most important check in this document.**

The player is a sound engineer operating a front of house console. The console affects exactly one thing: **what goes into the PA.** Sources reach it through microphones and DI boxes. Nothing else on stage is under the player's control.

That gives three questions, in order:

1. **Does the cause actually change the signal?** Not the room, not the stage, the signal arriving at the console. Something happening acoustically on stage that does not change what a mic or DI picks up is not an event, however visible it is.
2. **Does the named control actually address it?** Volume for level, tone for timbre, pan for placement in the room, FX for the board's own effects.
3. **Is the direction physically correct?** Covering a mic loses treble first, so you brighten it. Wind noise is low-frequency rumble, so you cut bass. Get this backwards and the player learns the wrong thing and stops trusting the board.

Two consequences of this fall out immediately, and between them they catch most bad events:

**You cannot undo a musician's own gear from the console.** If a guitarist's own delay pedal switches on, no fader, knob or toggle on the board removes it. That problem is talkback (5.5) or it is not a problem. The board's FX toggle controls the board's effects, not theirs.

**Acoustic events must reach a microphone.** Blocking a speaker cabinet does not change a close mic pointed at its cone. Opening a door does not thin out a close-mic'd amp. Where a performer stands does not change where his channel sits in the stereo field. Every one of those was in an earlier version of this document, and every one would have confused a player who understood sound better than the person who wrote it.

**Where a performer stands changes his sound only if he is being picked up by a mic he is moving relative to.** A vocalist backing off his mic gets quieter and thinner, which is real. A bassist walking around does nothing, because he is on a DI and his position is irrelevant.

### 8.2 Authored, not random

Events are authored per level. The same gig always contains the same set of problems. This is a deliberate choice in favour of comedy over variety: challenges are written for specific levels, and a level should have its own character.

### 8.3 The scheduler

Levels should feel fresh on replay without becoming unfair. The model is a scheduler, not a fixed script.

Each challenge carries:
- an **intensity rating**
- an **earliest allowed position** in the song
- a **duration**
- a **frequency flag**: once-only, or recurring

Each level then has an **intensity curve**. It starts chill with easy challenges and gets progressively more stressful. The hardest, the slowest, and the most dramatic or story-heavy challenges are reserved for the end.

The climax is usually **final beats, plural**: a pile-up of the biggest problems rather than one closing gag. But that is a tendency, not a rule. Some levels will land better on a single punchline, and a level built around one enormous closing disaster is a perfectly legitimate shape.

Within those constraints the order is shuffled between attempts, so the same cast of gags arrives in a different sequence each run.

**The curve controls density, not just intensity.** Each song section has a fixed budget for how much can be active at once, and the shuffle can only rearrange which challenges fill that budget. The shape of the pressure is identical every run; the contents are not. Without this, two medium events landing three seconds apart instead of thirty makes a run unwinnable through luck alone, and score chasing becomes unfair.

This also gives the escalation principle real teeth. The doc has always said events escalate within a set. The intensity rating is what enforces it.

### 8.4 Events hang on song structure

A gig is one song. Its structure (intro, verse, chorus, solo, outro) provides the anchor points for the density budget and event placement.

This matters because the same problem has different weight depending on when it lands. A dead vocal channel during the chorus is a disaster. During the intro it is an inconvenience. Use this.

### 8.5 Not every fix is "turn it down"

A meaningful fraction of events must require turning something **up**, or turning something **on**. If every problem resolves by pulling a fader down, the player stops thinking and just yanks whatever is glowing.

The payoff structure in 2.2 helps here automatically, since every "turn it down" is answered by a "turn it back up," but the setup beats themselves should vary too.

### 8.6 Multi-step fixes

Early gigs are single-action fixes. Later gigs introduce sequences, where the correct response requires more than one control in the right order. Example: an effect gets stuck on, and you cannot toggle it without an audible artifact, so you have to pull the channel down, toggle, and bring it back up.

Multi-step fixes should be introduced gradually and should always be logically derivable, never arbitrary.

### 8.7 How events are generated

The library below is small and always will be relative to what the game needs. Fifteen venues at eight to twelve challenge instances each, with recurring events firing more than once and venues within a tier sharing a library, comes to roughly 60 to 90 distinct event types across the whole game. This section is the method for getting there; 8.8 is the current inventory.

**The grammar.** Every event is three slots.

| Slot | What it is | Examples |
|---|---|---|
| **Agent** | What acts | Animals, weather, objects falling, crowd members, venue staff, band members, gear failing, the building itself |
| **Contact** | How it reaches the sound path | Covers, knocks, unplugs, soaks, blocks, drops onto, leans on, sits on, chews, opens, closes, wraps |
| **Symptom** | What the player perceives, which names the control | Too loud, too quiet, too dark, too thin, dead on one side, switched on, switched off, obstructed, human |

Crossing those three gives a space far larger than the game needs. The work is not inventing 90 events. It is **filtering thousands of combinations down to the ones that are both funny and instantly readable**, which is a much easier job.

**The constraint is on the cue, not on the joke.** Nothing in 2.4 or 6.4 restricts what can be absurd. A goat wanders in, eats the setlist, then eats the guitar cable: completely ridiculous, completely legible, visible agent, visible contact, visible result. What the rules cost is the lazy shortcut of a character signalling intent, which is a small and mostly unfunny corner of the space.

**The legible categories all share a shape:** a visible physical cause acting on a visible established object. The illegible ones all share the opposite shape: a person indicating what they want. Author toward objects and physics, away from signalling. That happens to be the LucasArts register anyway.

**Freshness comes from context, not from novelty.** Spaceteam ships with a small instruction vocabulary and Overcooked has about six verbs. Neither feels repetitive, because the same element lands differently depending on what surrounds it. The multipliers here are band size (the same spill is a different event with one channel and with six), song section (8.4), stacking, new systems recontextualising the whole existing library, and escalation of the same gag across tiers. The dog on the pedal in a garage becomes the dog loose in a stadium.

### 8.8 The library

**TO BE EXPANDED.** A starting inventory, not a final set, and **every entry is an example rather than a fixture** (0.1). Replace any of them with something better. What must survive is the shape: a real problem, visible where it happened, with a derivable fix.

**Note on tier 1:** the band starts as a guitarist alone, gains a drummer at venue 2 and a bassist at venue 3. Vocals arrive in tier 2. Every event below that needs vocals or drums is unavailable in the earliest gigs, and the tier 1 library has to be funny with instruments only. See 11.

Every entry below has been checked against the three questions in 2.4: which channel, which control, which direction. Entries that failed have been rewritten or cut. The cuts are not recorded as rejections, because they were bad instances rather than bad ideas, and a cut example that gets rewritten well is welcome back.

Every entry below has been run through both the signal path test (8.1b) and the animation test (6.6). Entries that failed either are gone or rewritten. The cuts are not recorded as rejections, because they were bad instances of good rules, and a cut example that gets rewritten well is welcome back.

Where an entry names an object, that object is the cue and it is drawn oversized (6.4.1). Where it names a movement, that movement is a rotation or a translation of an existing part.

#### Resolved with volume

- The drummer falls asleep, head on the snare, snoring into the overheads
- Someone climbs on stage and grabs the vocal mic
- The guitarist tunes mid-song without muting. Tuning looks exactly like playing at this resolution, so the cue is an oversized clip-on tuner on the headstock flashing hard red (6.6.6).
- A phone left **against a mic stand** starts ringing, its owner walks on and answers it standing over that mic. The phone is drawn large with radiating rings; the walk-on is a translation.
- The guitarist reaches down and turns his own amp down mid-song. **Turn him up.** The mic at his cabinet hears exactly what he did, so this is as real as events get, and the payoff beat is him turning it back. The cue is the amp's one dinner-plate knob with a painted pointer, rotating visibly; his arm is a rotation, not a crouch, because a crouch is a new drawing (6.6.7).
- The vocalist walks away from the mic toward the front of the stage and goes quiet. **Turn him up.** Written as a walk rather than a lean, because a translation across the stage reads and a few pixels of head movement does not.
- Someone knocks a mic stand and it swings away from the cabinet it was pointed at. Level drops. **Turn it up**, until someone re-aims it. A long stand rotating about its base is the single most readable animation available (6.6.1).
- A dog wanders on stage and stands on the guitarist's boost pedal. Level jumps. **Pull him down**, and back up when the dog gets bored. *(Moved out of the FX category, where the fix was not real: see below.)*
- **Feedback.** The cause must be visible and must be a mic and a speaker getting into each other: a vocalist swinging the mic out over the wedge, a knocked stand leaving a mic pointing straight at a monitor, someone carrying a live mic in front of the PA. A howl does not name its own channel and cannot be hunted by ear (2.4), so the offending mic must visibly ring: the stand shakes, the capsule glows, the person nearest it flinches. Feedback with no drawn cause is not shippable.

*Rewritten twice:* the vocalist's rambling monologue. First for ambiguity, because "duck the band" and "push the vocal" reach the same end state and the player stalls choosing, so it is now a **single action**: the band drops to a vamp and the vocal alone needs pushing up over it. Then for legibility, because a band playing quieter is not visible. The band's ambient loops drop to half speed while the vocalist walks to the front of the stage, which reads as a break in the rhythm everyone else is locked to (6.6.5).

*Cut:* the bassist's strap breaking so he plays sitting down "off mic." He is on a DI. Sitting on the floor changes nothing about his signal. *Cut:* the road case shoved in front of an amp. A close mic on the cone does not care what is in front of the cabinet.

#### Resolved with tone

The physics has to carry the direction, and it does, because two real effects are intuitive to everyone:

- **Covering and muffling loses treble first.** Anything draped over, stuffed into, or wrapped around a source or its mic goes dark. **Brighten it.**
- **Proximity effect.** Close to a mic means more bass. Off the mic means thin. So a vocalist eating the mic goes boomy and needs treble; a vocalist backing off goes thin and needs warmth.

Events:

- The vocalist cups his whole hand around the mic capsule and goes boomy. Toward treble. A hand wrapped over the mic is a distinct silhouette; a head moving two pixels closer is not.
- The guitarist throws his jacket over the cabinet, mic and all. Toward treble. A large shape landing over a large object is the clearest event type in the game (6.6.2).
- A plastic cup, a hat, or a fallen banner lands over a mic. Toward treble.
- Someone drapes a blanket over the kit and takes the overheads with it. Toward treble.
- Someone gaffer-tapes a plastic bag over a mic to keep the rain off. Toward treble. Drawn as a large flapping shape, not a real-scale bag.
- The vocalist takes the mic off the stand and holds it out at arm's length to point it at the crowd. Off the mic means thin. **Toward bass.** An extended arm is a clean rotation and the change in silhouette is unmistakable.
- The guitarist's amp dies in a puff of smoke and he plugs straight into a borrowed DI box. Thin, buzzy, no cabinet. **Toward bass**, and it is a genuine engineering move rather than a game convention. The smoke and the dead amp light carry it.

*Cut on the animation test:* the towel stuffed into the kick, because the inside of a kick drum is not visible at this resolution and stuffing is a small hand motion. *Cut:* the mic slipping from the centre of the cone to the edge, which is physically real and a difference of about two pixels. *Cut:* the bassist's dead battery and instrument swap, because swapping instruments needs a second drawing and reads as nothing at fifty pixels.

*Cut:* the garage door being rolled open to thin out the guitar. A close-mic'd cabinet does not change because a door opened. *Cut:* the bassist wandering behind the PA stack. He is on a DI; his position is irrelevant. *Cut, retained from the previous pass:* the kicked cable, the debris on the kit, and the power hum, all of which were real causes that did not tell the player which way to turn the knob.

#### Resolved with FX

**The board's FX toggle controls the board's effects, not the band's pedals.** This is the correction that removed most of this category. A guitarist's own delay switching on is not fixable from the console at all, which makes it a talkback problem or nothing.

So FX events originate at the board or at the player's own rack:

- The reverb unit runs away into a rising howl after someone knocks the rack. Toggle it off, then back on when it settles. The cue is carried by 6.5: the tail off that channel's stack grows until it swamps the stage.
- The delay is still set to the last song's tempo and audibly fights the new one. Also carried by 6.5, and unusually readable, because a tail pulsing out of time against a stage where everything else is locked to the beat is exactly the pattern break in 6.6.5.
- Spilled beer gets into the FX switch and it engages itself. *(Crosses with section 9.)*
- An effect gets stuck on and needs a multi-step fix (8.6): pull the channel down, toggle, bring it back up, because toggling live makes an audible artifact.
- The vocalist's ending is a bare a cappella line in a dead room and it needs reverb put on it, then taken off. **Turn something on**, which this category otherwise never asks for. The whole band stopping at once is a total change in stage motion and needs no dedicated cue at all.

*Cut:* the dog engaging the delay pedal, which is now a volume event. *Cut:* the bottle rolling onto the pedal board, and the guitarist stamping his own pedal early, for the same reason. Both can return as level or tone events if the pedal in question is a boost or a fuzz. *Cut, retained from the previous pass:* the vocalist gesturing for reverb, which was a mapping rather than a problem.

#### Resolved with pan

See 5.4. Pan moves a channel between the left and right sides of the PA, so a pan event is always **one side of the room not being served**, whatever caused it.

- A speaker stack blows on one side, sparks and smoke. Sum everything to the working side.
- One stack goes dead and dark, and that half of the crowd stops moving and starts drifting toward the middle. Half the crowd freezing while the other half keeps dancing is a large-area change and needs no small detail to read.
- The guitarist walks into a cable and drags the feed out of one stack. Written as a walk and a cable whipping loose, not a fall, because a fall is a new drawing (6.6.7).
- A van or a stack of crates gets parked in front of one stack and swallows that side.

*Cut, retained from the previous pass:* the guitarist walking to one side, and the crowd holding up signs demanding sound their way.

#### Resolved with master volume

- The neighbour or venue owner holds up a TURN IT DOWN sign
- The crowd chants for it louder

These are legible because the cue states a **goal**, not a control. They should sometimes fire close together, so the player is caught between them.

#### Resolved with solo

None. Solo is a side-job tool only (5.3).

#### Resolved at the board itself

One instance at the end of tier 1 venue 3, then common from tier 2. See section 9. This category survives the signal path test better than anything else in the game, because the obstruction is between the player's hand and the control, which needs no audio reasoning at all. **It is the category to expand.**

#### Resolved with talkback (tier 3+)

Problems that are people or their own gear, neither of which the console can touch:

- The guitarist creeps his amp louder continuously, so chasing him on the fader never holds, because his stage volume is now louder than the PA. **Make this the tier 3 debut event.** The player tries the obvious thing, watches it visibly fail, and reaches for the new button unprompted. Same oversized amp knob as the volume event above, rotating a notch at a time.
- The guitarist stands in front of his wedge and it howls no matter what you do
- A band member's own effect switches on and stays on. Nothing on the board removes it.
- The drummer speeds up and the band drifts apart. Needs no new art at all: his existing loop simply runs faster than everyone else's, and a broken rhythm on a stage where all motion is locked to the beat is instantly visible (6.6.5).
- The vocalist forgets the lyrics and stalls. He stops moving while the band's loops continue, which is the ambient break again.
- The vocalist's in-ear pack dies and he starts singing flat. Flatness is audible and invisible, so the cue is the oversized belt pack light going out and him tugging at his ear.
- A band member wanders off stage mid-song. A whole character translating out of frame is the most readable event available (6.6.4).

*Rewritten:* two band members arguing. As written the faders also solved it, by simply pulling their mics down, which breaks the rule that talkback is never an alternative fix (5.5). It is now that the argument **stops the song**, which is dead air and therefore house music, with talkback needed to get them playing again.

#### Resolved with lighting (tier 4+)

- A spotlight is aimed at empty stage while the vocalist keeps walking into the dark
- A strobe is still running through the ballad
- The rig goes dark on a hit the singer is clearly expecting
- The haze machine fills the room until you cannot see the band. **This one attacks your information channel rather than your mix.** You still have audio, but you lose the visual cues you have relied on all game.
- The lighting desk and the board are on the same overloaded ring main, so pushing one browns out the other

#### Resolved with pyro (tier 5)

- A charge fires early and the guitarist's hair catches fire
- The confetti cannon jams, then discharges into the drum kit
- A pyro cue is scheduled during a quiet passage and needs overriding

#### Environmental and structural

- Rain at an outdoor gig, with channels failing one by one
- A gust hits the stage. Wind noise is low-frequency rumble, so this is **toward treble**, not toward bass. *(An earlier version had this backwards, which would have taught the player the opposite of how a high-pass filter works.)* Wind is invisible, so the cue is everything loose on stage streaming sideways at once: banners, cables, hair, the setlist going.
- A brownout sags the amps and everything drops. Push everything up, then back down when it recovers.
- The bassist proposes to someone in the crowd mid-song and the band stops dead. Dead air, so house music. This is one of the few events worth spending a dedicated drawing on (6.6.7), and it earns it by being a level's closing beat.

*Reclassified as flavour, not events:* the support band playing across the room, and the stage monitor sliding toward the edge. Neither has a console control that addresses it, so neither is scorable. They stay as background business, or they get a control attached, but they are not events until they do.

## 9. Board interference

### 9.1 What it is

A category of problems that obstruct **the board and the space around you**, rather than breaking the audio.

The origin case: someone spills a drink over your desk and you have to wipe it away. The original design had the spill as a channel problem that crackled until it settled, which made it the only event in the game whose correct response was to wait. Moving it onto the board turns a passive event into a physical one.

The category is not limited to wiping. Different objects want different gestures: wipe a spill, drag and fling a bra that has landed over the whole board, hold something down, shove a drunk's arm off the faders, pull a setlist off the desk. The point is a physical vocabulary that has nothing to do with faders, which is what keeps the board from having to grow to stay interesting.

It also extends past the desk surface to interactable things happening around the player. **TO BE EXPANDED.**

This is the one category that is exempt from the signal path test in 8.1b, because nothing about it is a signal problem. The obstruction sits between the player's hand and the control, which is why it needs no audio reasoning and why it reads so cleanly.

### 9.2 The first one lands at the end of tier 1

A single beer spill, once, near the close of venue 3. Not repeated anywhere else in tier 1.

Three reasons. It puts the mechanic in front of a player who has just got comfortable with the board, which is exactly when a surprise lands. It gives the first tier an ending rather than a fade out. And it means the whole interference system gets built and tested during tier 1 production instead of waiting for tier 2, which is worth a lot for a mechanic this new.

### 9.3 Why it earns tier 2

Tier 2 previously had no identity. It was dive bars with more channels and nothing new, justified as an honest test of whether the core loop scales. That test still matters, but it is not a design.

Board interference is exactly the right size for tier 2. It is not a new control, it needs no explanation, and it changes the kind of pressure without adding board complexity. It also has a natural home in the fiction: this is the tier where the audience is close enough to reach you.

The single tier 1 appearance does not undercut this. One beer spill at the very end of a tier is a punchline. Tier 2 is where interference becomes common, varied, and a pressure the player has to plan around, which is what makes it the tier's defining addition.

The full progression reads: tier 1 teaches the board, tier 2 attacks the board, tier 3 gives you problems the board cannot fix, tier 4 gives you something to win back, tier 5 is spectacle.

### 9.4 The rules that keep it honest

Interference is the one thing in the game that legitimately stacks with everything else. One problem per instrument still holds, because interference is not on an instrument. A spill can land while the guitarist's cable is sparking, and that is the point.

That makes it dangerous, so three hard rules:

1. **One active interference at a time. Ever. At every tier.** This is the cautionary lesson from Cook, Serve, Delicious, whose "chores" system is widely regarded as fake difficulty precisely because chores stack, decay faster than orders, and turn a cooking game into a chore game. Bandruptcy must never become a wiping game with a mixer attached.

2. **Obstruction must never hide information the player needs to know exists.** A beer covering a fader is fine, because the guitarist is still visibly flailing and you know which strip you need. A beer covering the crowd meter or the side job note is not.

3. **Clearing it must have an obvious affordance.** Wipe across it, drag it off, whatever the gesture is, the player should never wonder how. Discovery is not the challenge (2.4).

---

## 10. Progression and tiers

### 10.1 Structure

Five tiers, roughly three venues each. Target of 12 to 15 venues total, giving somewhere around a four to six hour game. **This is a target, not a commitment**, and more venues can be added per tier later.

Venues within a tier share a vibe and a control set. What differs is the room, the band size, and the events. Three house parties means three different houses: a living room with the sofa shoved against the wall, a basement, a back garden.

### 10.2 The tiers

| Tier | Venues | New capability | What it teaches |
|---|---|---|---|
| **1** | Garage, house parties | Volume, then tone, then FX (one per venue) | The board itself, one control at a time |
| **2** | Dive bars, small clubs | **Board interference**, plus pan and vocals | That the interface itself can be attacked |
| **3** | Proper clubs | **Talkback** | That some problems are people, not signals |
| **4** | Festivals, theatres | **Lighting** | A second, anticipatory kind of task, and the only way to win points back |
| **5** | Arenas, stadiums | **Pyro** | Consequence, and pressure on everything already learned |

### 10.3 Why one new thing per tier

Each addition should change the *kind* of thinking required, not just add more of the same.

**Tier 4 is the biggest character shift in the game.** Everything on the mixing board is corrective: something broke, undo it. Lighting is anticipatory: hit the cue at the right moment.

Crucially, lighting is **two-way**. It can fail like anything else and cost you points: the wrong person spotlit during the solo, a strobe still running through the ballad, the rig dark on a hit. And hitting cues cleanly is the only thing in the game that pushes crowd energy back up rather than merely stopping the drain.

That two-way property is why it arrives at tier 4 rather than earlier. Up to that point a bad gig only gets worse. From tier 4 on, a player who is drowning has something to reach for. A purely reward-based lighting system would have been ignored entirely, because under load players optimise against punishment and drop anything that only withholds upside.

**Tier 5's pyro is lighting with consequences.** A mistimed light is a missed opportunity. A mistimed pyro charge is a disaster. Tier 5 adds nothing else; if it feels thin in production, it can be expanded then.

---

## 11. The band

The same band for the entire game. You rise together.

**They grow, but not at a constant rate.**

Tier 1 adds a member every venue. That is partly because it is the tutorial tier and the ramp needs to be gentle, and partly because every gig in the opening tier has to feel new.

From tier 2 onward, a new member arrives once per tier, twice at most. A stage cannot hold fifteen people and a board cannot show fifteen strips, so one per venue is not feasible past the opening and was never going to be.

Additions should still land mid-tier rather than on a tier boundary, so band growth never coincides with a new capability arriving. Each new member gets their own introduction beat instead of turning up in a crowd.

**Tier 1 is the tutorial, and there is no other tutorial.** It runs two ramps at once: one new band member per venue, and one new control per venue (5.2).

Venue 1 is a guitarist alone with a single fader and nothing else on the strip: one instrument, one verb, the neutral rule obvious, setup and payoff demonstrable with a single gag. Venue 2 adds drums and the tone knob. Venue 3 adds bass and the FX toggle, and closes with the game's first board interference (9.2). Vocals and pan both arrive in tier 2.

Each control's debut venue opens with a low-pressure event that only the new control can solve, with nothing else active. Controls and pressure are introduced by the fiction, never by instruction.

The cost of that ordering is worth knowing: the vocal mic is the most comedically loaded channel in the game (feedback, mic eating, forgotten lyrics, phones, drunks grabbing it) and all of it is tier 2 material. Tier 1 has to be funny with instruments only.

**They improve visually.** Better gear, better clothes, better posture. The kit held together with duct tape in the garage becomes a real kit by the arena. This is a free progression signal that costs only art.

**They have personalities that generate problems.** Band members are not neutral channels. Each one has recurring behaviors the player learns to anticipate: the one who falls asleep, the one who creeps his amp louder, the one who wanders. Recurring, character-driven problems are funnier and more learnable than random events.

**TO BE EXPANDED.** Band name, member names, member personalities, and which member joins at which venue.

---

## 12. Difficulty

### 12.1 The three dials

Difficulty is tuned through exactly three things:

1. **Concurrency**: how many problems can be active at once
2. **Grace period**: how long before an unresolved problem starts draining
3. **Drain rate**: how fast it drains

Plus one structural dial: the **width of the neutral range** on each control.

The failure threshold is never a dial. It is fixed at 50 (see 7.3).

### 12.2 Starting numbers

These are starting points for playtesting, not final values. They are stated as numbers rather than as vague ranges for two reasons: an unspecified number will be invented by whoever builds it, and a wrong number you can feel is more useful than a vague one you cannot test.

| Tier | Sustained concurrency | Peak in final beats | Grace period |
|---|---|---|---|
| **1** | 1 | 1 (2 in venue 3) | ~4s |
| **2** | 2 | 3 | ~3.5s |
| **3** | 2 | 3 | ~3s |
| **4** | 3 | 4 | ~2s |
| **5** | 3 | 4 | ~1.5s |

**Never 5 concurrent. At any point, in any tier.**

Board interference occupies one concurrency slot and is separately capped at one active at a time (9.4).

**Drain rate**: roughly 1.5 to 2 points per second per unresolved problem past grace. Ignoring something for ten seconds therefore costs 15 to 20 points, so three badly handled events put a player at the threshold. Off-neutral drift should be much gentler, around 0.25 per second, because it is a nag rather than a failure.

**Speed bonus**: awarded for resolving inside the grace window. Since the window shrinks across the game, the bonus naturally gets harder to earn without changing its value, which is a cleaner curve than scaling the reward.

### 12.3 Why these numbers

**Concurrency is lower than instinct suggests, and that is deliberate.** Spaceteam originally displayed four instructions at once, three of them greyed out so players could see the team's whole workload. Playtesters found it overwhelming and confusing, and Henry Smith cut it to one instruction at a time per player. Four visible demands broke people even when only one was actually theirs. Human working memory tops out around four items and drops under motor load and time pressure.

Bandruptcy's advantage over Spaceteam is that the board is spatial and persistent, so the player can see all demands rather than holding them in memory. That buys roughly one extra slot, not three.

**Rate scales, concurrency barely does.** Spaceteam's difficulty comes from firing instructions and special events at an increasing rate, and from stacking orthogonal events (asteroids, wormholes) on top of the instruction stream, not from raising the number of live instructions. Its control panel also grows, from a 3x3 board to 4x4, but that is a capacity increase rather than a concurrency increase. Tier 5 here should feel relentless because things arrive constantly, not because four things are live at once.

**A global clock forces resolution.** Spaceteam added the supernova late, after playtests showed games dragging on with players getting a few things right and a few wrong. The crowd energy meter does that job here.

**Volume is not difficulty.** Cook, Serve, Delicious 3 shipped with roughly four times the order volume of earlier games in the series, and reviewers found the failure chance high from the outset with a curve that no longer tracked player skill.

**Two rush hours, not one long climb.** CSD1 did not use a monotonic ramp. It used two discrete rush periods against an otherwise manageable baseline. Bandruptcy's model is a rising curve with final beats, which is close, but a single mid-level spike with recovery afterwards is worth testing, because the relief after a spike is where players feel competent.

**The default curve has to be right, because there is no safety net.** David Galindo found that CSD players who stalled on Standard almost never dropped to Chill mode. They quit instead. That is a strong argument that difficulty options do not rescue a bad curve, and it is why there are none here (see 22).

### 12.4 No adaptive difficulty

The game never adjusts itself mid-run based on how the player is doing.

Research on skill and challenge balance does find that real-time adaptive adjustment produces higher flow than static difficulty in parallel-task games of this kind. It is rejected anyway, because it would destroy score comparability, which the fixed density budget (8.3) exists to protect. A 90 scored on a run the game quietly softened is not the same as a 90 earned clean, and money is tied to score.

The curve is fixed and hand-tuned through playtesting.

---

## 13. The hub

### 13.1 The manager's office

Between every gig, the player lands in the office of their manager. He is sleazy. He books gigs he should not book, describes them dishonestly, and takes a cut.

He is the comedic engine of the game's structure. He is the reason the player ends up in escalating disasters without feeling railroaded, because every catastrophe traces back to something he said was going to be fine. "Small acoustic thing, very chill" turns out to be a death metal band with a pyro budget.

He is on screen every time the player returns to the hub, so he earns a lot of value from being drawn once.

### 13.2 What's in the hub

| Element | What it does | Why |
|---|---|---|
| **The manager** | Pitches the newest available gig on entry | Story delivery and comedy, without needing new art per beat |
| **The map** | Browse and select from available gigs, including ones already completed | Shows progression, shows what is locked and why, and is the route back to earlier venues for money |
| **The store** | The manager's computer. Buy gear, consumables, and wearables | The economy. Also a joke delivery system via item descriptions. See 13.3. |
| **The answering machine** | Optional side jobs, with a sticky note carrying the current one | See 16 |

Buying and equipping live in the same place. A separate inventory screen would be menu bloat.

### 13.3 The store is the manager's computer

The store is not an abstract menu. It is the beige plastic tower and bulky milky-grey CRT sitting on the manager's desk, facing him, because of course it faces him.

Click it and the whole monitor swivels 180 degrees to face you, and what is on screen is a 90s shopping website: table layouts, visited-link purple, a spinning GIF or two, categories down the left. Items are clearly sorted into the three purchase categories.

This does several jobs at once. It keeps the store inside the fiction instead of bolting a UI onto the hub. It is period-correct, which the rest of the game already is. It gives every item description a natural home. And it costs one drawn object rather than a new screen.

**Stock is introduced progressively.** Not everything is available on day one. The catalogue expands as the game does, roughly in step with the tier the player has reached, so the store always shows a few things that are just out of reach rather than a wall of gear that means nothing yet.

**TO BE EXPANDED.** The three categories need in-game names, and so do the items themselves. "Gear", "consumables" and "wearables" are the design words, not the words on the website.

### 13.4 Why a single screen and not walkable scenes

Full point-and-click scenes you can walk around in would roughly double the art workload and pull the project toward being two games at once. A single hub screen gives the same comedic real estate at a fraction of the cost.

---

## 14. Economy

### 14.1 Three categories

| Category | What it does |
|---|---|
| **Gear** | A gate. It does not make gigs easier, it makes them possible. |
| **Consumables** | Single-use helpers for a gig. |
| **Wearables** | Cosmetic only. No gameplay effect whatsoever. |

All three cost money.

### 14.2 Gear as a gate

**Gear does not make gigs easier. Gear makes gigs possible.**

If money bought advantages, the optimal strategy would be grinding easy levels to trivialize hard ones, which is tedious and undermines the skill test at the centre of the game.

Instead, venues have **requirements**. You cannot mix an eight-piece band on a four-channel board. You cannot do an outdoor gig without windscreens. Attempting to select a locked gig tells you exactly what you are missing, which turns the map into a set of visible goals.

Not every venue gates. Tier 1 venue 1 obviously does not, and **venue 2 does not either**. The first gear gate in the game is **venue 3**, which means the player has already played two gigs, earned money twice, and seen the store before the economy asks anything of them.

**TO BE EXPANDED.** What venue 3 actually requires.

### 14.3 Consumables are where the decision lives

Gear as a pure gate means gear itself contains no decision: you buy what the next gig demands, in the order the gigs demand it. The real money decision sits one level down. Spend on something that helps you tonight, or bank it toward the gear that unlocks the better paying gig.

**Consumables are never required.** No venue is ever unbeatable without one. Gear is the only thing that gates, ever. What consumables do is give the player an edge inside a gig they could, in principle, already beat.

That matters because of how a stuck player uses them. Someone struggling with a venue can go back and replay earlier gigs, or take a side job, to afford a consumable that gets them over the line. That is a route the player chooses, not a toll the game charges.

**What they do.** Each consumable is a single-use in-gig effect. A few shapes:

- Nudge the crowd energy meter up
- Instantly clear one active problem
- Buy a short window, around fifteen seconds, where no new problems fire

**Naming and effect have to be designed together.** The object should explain the effect without a tooltip. An airhorn lifts the crowd. Gaffer tape kills one problem outright. The joke and the mechanic arrive in the same word, which is the whole reason the store is funny.

**TO BE EXPANDED.** The full consumable library, with names.

### 14.4 Wearables

Purchasable clothing for band members. **Pure novelty.** They change how a character looks and how they animate.

This is deliberate. It means players can dress the band however they find funniest without worrying that they are making a suboptimal choice. A KISS makeup outfit that makes the guitarist play more theatrically is worth buying because it is funny, and that is the entire reason.

### 14.5 Income and scaling

- **Gig payouts**, scaled by score. Finish at 100 and you get the maximum.
- **Side jobs**, paying well and demanding a lot.

Venues progressively pay more and items get progressively more expensive, scaled together. Players may need to replay levels or complete side missions to afford the next piece of gear.

Winning a venue is required to progress to the next.

**There is no soft lock.** The map always allows replaying an earlier venue, so money always has a route. The worst case is slow, not stuck.

### 14.6 What this game will never have

No in-app purchases. No microtransactions. No ads. Not now, not if it goes commercial.

---

## 15. Save and persistence

Progress, money, gear, wearables, consumable stock, side job state, and per-venue best scores must all survive closing the tab. A browser game that loses a player's run is a browser game they do not come back to.

---

## 16. Side jobs

### 16.1 What they are

Optional missions delivered through the answering machine in the manager's office. The player accepts one before a gig and attempts it during the gig. They pay well. They are deliberately difficult.

### 16.2 Why they work

**They give the player a second objective that is not "keep the mix clean."**

Often that means inverting the core loop. For the entire rest of the game you are fixing problems to protect the mix, and a side job asks you to deliberately break it, or to defend one part of it at the expense of the rest, without tanking your score so badly that you fail the gig outright. That is a real risk decision. Cranking every fader during the chorus drains crowd energy, and if you were already at 65 you may drop below the pass threshold. Do you take the job on a gig you are confident about, or on the one you are struggling with because you need the cash?

But inversion is only one of the things a side job can be. A side job can also be a straight performance challenge, like scoring 100 at a venue you have already passed, or a reason to go back somewhere. Anything that gives the player a defined goal, a reason to play a specific gig, and a payout is fair game. Be generous with the shapes.

### 16.3 Shapes a side job can take

This is a starting set, not a closed list.

- **Do a thing at a moment.** A thief pays you to max all volumes during the chorus so nobody hears the robbery next door. Cut the vocal for exactly five seconds. Slam the tone to full treble when the solo hits.
- **Wreck something on purpose.** The bassist's rival wants him to sound terrible, so you actively ruin his channel at a specific moment.
- **Protect something.** A label scout is in the audience and only cares about the vocalist. Keep the vocal channel flawless and you get paid, even if the rest of the mix falls apart around it.
- **Capture something.** A DJ friend wants a clean drum break to sample. Solo the drums and record at exactly the right moment.
- **Hit a mark.** Score 100 at a venue you have already passed. No sabotage, no second agenda, just someone who wants proof you can actually do the job.
- **Go back somewhere.** A job that names an earlier venue and sends the player back to it, which gives replay a reason inside the fiction rather than making it feel like farming.

**One constraint: during a gig, a side job must be something you do.** An earlier version had a shape where someone pays you to leave a specific problem unfixed, so the player has to actively resist fixing a channel. That is three minutes of sitting on your hands fighting a reflex the game spent hours training, while the meter drains. Abstinence is not gameplay.

This constrains what happens *inside* a gig. It says nothing about what the objective can be. "Score 100" is a perfectly good side job, because the player is playing the whole time.

**TO BE EXPANDED.** More shapes. Be creative here rather than treating the list above as the boundary.

### 16.4 The reminder

A player who accepts "crank everything during the second chorus" and then spends the whole set firefighting will forget.

**In-gig:** a yellow sticky note sits on the board carrying the mission, and it flashes or otherwise notifies itself when the moment arrives. It only appears when playing the venue the mission targets.

The note lives on the board rather than on stage deliberately. The stage has a strict visual language where movement means a problem (6.2), so a conspicuous client in the crowd would read as a threat and compete with real events for the same attention. The board is where the player is already looking, and it is a channel the stage cannot provide.

**In the hub:** a clearly visible sticky note on the answering machine, clickable to re-read the current mission, which disappears when the mission is done.

Note what this changes. The difficulty of a side job is no longer *remembering*, it is the conflict: the sabotage you were paid for actively fights the gig you are being scored on. That is the better version, and it matches 2.4. Knowing what to do is never the challenge.

**TO BE EXPANDED.** The full side job library.

---

## 17. Art direction

### 17.1 The look

Hand-drawn, then pixelated. Everything on screen, including the mixing board.

The reference is **Day of the Tentacle and Monkey Island 1-2**. What that means specifically:

- **Absurd proportions.** Heads far too large. Limbs either noodle-thin or impossibly thick. If a silhouette could pass for a realistic person, it is wrong.
- **Angular, asymmetric shapes.** Trapezoid jaws. Wedge shoulders. Triangular noses that jut. Hard corners everywhere.
- **Off-balance poses.** Nobody stands up straight. Every character looks slightly like they are about to tip over.
- **Ugly on purpose.** These characters are not cute or conventionally appealing. They are funny-looking. The humor is in how strange they look.
- **Bold, clashing, saturated color.** Purple next to orange next to green. High contrast against dark stages. Not muted, not cozy.
- **Visible grime.** These are broke musicians. Stains, duct tape, chips, cracks. Details look hand-drawn and rough.

### 17.2 The pipeline

**Drawings are made by hand on paper.** This is a deliberate decision made after AI-generated vector art repeatedly failed to hit the style. Generated art averages toward clean, balanced, and appealing, and this style is deliberately none of those things. Fighting that tendency costs more effort than drawing.

The pipeline:

1. Draw characters and environments by hand, on paper, in pen or marker for high contrast.
2. Photograph them.
3. Convert to structured SVG, preserving line quality and proportions rather than cleaning them up.
4. Structure each character with **named, independently transformable parts** (head, torso, each arm, each leg, instrument), with each part's origin at its natural joint pivot.
5. Animate through transforms on those parts.

### 17.3 What needs drawing per character

Not one drawing per state. One full-body drawing in a default pose, plus a small sheet of **alternate faces** (eyes open, eyes closed, mouth shapes, key expressions) that swap in.

Everything else is achievable through rotation and translation of existing parts. The drummer falling asleep is his head rotating down, his arms dropping, and his sticks falling. It does not require a new drawing.

**Each character owns a colour**, used on them, their gear, their cables, their pedal, their stack, and their channel strip. See 6.4.5. Pick the palette before drawing anyone, because it constrains every subsequent asset.

### 17.3b What needs drawing per event object

This is where the events actually live, and the original document did not budget for it. **Objects are a larger art deliverable than characters.**

Per object that can cause an event:

1. **Resting state**, oversized per 6.4.1, with an ambient loop. It has to be visibly present and visibly fine before anything happens to it.
2. **Disturbed state**, persistent and animating, readable from across the stage, in the owning character's colour.
3. **Escalated state**, for when the grace period expires (6.2.4).
4. **The contact animation**, which is where the joke is.

Objects that carry an otherwise invisible state (6.6.6) are the highest-value drawings in the game and should be designed before the events that use them.

**The visible sound system (6.5) is its own art deliverable.** Per channel: the neutral pulse, the size range, the two tone shapes at their extremes, the FX tail, and the pan lean. Drawn once as a set and recoloured per channel, so it is one asset family rather than one per band member.

Agents (dogs, drunks, weather, falling objects) are drawn separately and reused. One dog can sit on four different things across five venues. The agent library and the object library multiply rather than add, which is what makes 60 to 90 events achievable for a solo artist.

### 17.4 The pixelation layer

The entire stage is rendered at low resolution and scaled up with hard pixel edges, in the range of the original SCUMM games.

This is doing three jobs:

1. **It is the period-correct aesthetic.** DOTT ran at 320x200. The pixel density is a substantial part of why it looks the way it looks. No amount of smooth vector art will read as that era.
2. **It unifies the art.** Individual drawings will vary in line weight and detail. The pixel grid forgives that and makes everything look like it belongs together. This is a significant practical benefit for a solo artist.
3. **It sets a detail budget.** Anything too fine to survive the pixel grid should not be drawn. This pushes toward big simple shapes and high contrast, which is already what the style wants.

**The unresolved tension.** DOTT ran two or three characters at that resolution with no time pressure and a player free to stare. This game has a growing cast, simultaneous events, and sub-second reading demands, and section 6.2 requires that every event visual be distinguishable at a glance and located precisely at its cause. On a stage occupying part of a 320x180 canvas, a late-game character is roughly 25 pixels tall and a spark at his feet is three pixels.

This is a real conflict between 17.1 and 6.2, and it is settled by measurement, not argument. See 19.

### 17.5 The mixing board

The board is hand-drawn too, not clean vector UI. A precise modern interface would break the world.

Ruled straight lines for fader tracks and strip borders, so it reads as a functional object. Freehand for knobs, buttons, and labels. Hand-lettered channel names rather than a font.

Touch and click targets can be larger than the visual, so hand-drawn imprecision does not compromise usability.

### 17.6 Environments

Hand-drawn, same pipeline. Environments carry as much tone as the characters do. A cracked concrete floor, a water heater in the corner, a cat asleep on an amp, band posters with peeling corners.

Background detail is a primary comedy vehicle in this genre and should be treated as such, subject to the readability rules in 6.2: nothing decorative should compete with event signaling.

**TO BE EXPANDED.** Per-venue environment briefs.

---

## 18. Audio direction

### 18.1 Real audio is the whole point

The player is mixing real stems with real processing. When they move the tone knob, an actual filter moves. When they toggle FX, actual reverb engages. When they pan, the signal actually moves.

This is what separates Bandruptcy from a game where you press buttons at the right time. The player is doing a real thing, and they will feel that even if they never think about it consciously.

Processing should be **exaggerated** relative to real-world practice, so differences are clearly audible on bad speakers. Legibility beats realism.

### 18.2 Events inject audio

Many events add sound that was not in the original performance, routed through a specific channel so the channel identity is the clue. The drummer's snoring comes out of the drum channel, which is how the player knows which fader to reach for.

**Injected audio must be routed the way it would really arrive.** The snoring is in the overheads because that is the mic that would hear it. A phone ringing beside the vocal mic arrives on the vocal channel. This is not pedantry: it is what makes the fader actually work on the sound, and if the routing is faked the player's correct action produces the wrong result.

Under 2.4, that injected audio must be blatant and must instantly identify its own channel. This is a core requirement of the audio design, not an edge case. Plan for it from the start.

The one-problem-per-instrument rule (8.1) is what guarantees this works: a channel is never pulled down for one event while a second event is trying to be heard through it.

### 18.3 One song per tier

**Five songs total**, one per tier, reused across the venues within that tier. Reusing a song across three venues is defensible on its own terms, since a real band plays the same set every night.

**The arrangement grows with the band.** A tier's song gains a track whenever a member joins, so it exists in more than one version rather than as a single fixed mix. Tier 1's song has three: guitar alone, then plus drums, then plus bass. Later tiers have fewer versions each, since members arrive only once or twice per tier after the opening.

All music is produced in-house. Production quality is handled directly in the DAW and is not a gameplay concern.

### 18.4 Game chrome audio

Menus, UI sounds, stings, and score screens should sound like the era the game looks like. Roland SC-55 style General MIDI is being considered for this, since it is the sound of the reference games.

The distinction: **SC-55 for the game's chrome, real recorded stems for the band.** The contrast reinforces the separation between the game world and the actual mixing task. The band has to sound real enough that processing it is satisfying.

### 18.5 What is not being done

Performance-reactive music, where the band plays worse as crowd energy drops, was considered and set aside as too ambitious for the value it adds. The music already responds to events in the most important way: when the drummer falls asleep, the drums stop. That is enough.

---

## 19. Things to measure, not argue about

Four questions in this document cannot be settled by design discussion. They need a build and a stopwatch, and they should be answered before art production commits.

1. **Pixel readability at maximum density.** Render the largest planned lineup at target resolution with three concurrent events and the tier 5 grace period. If events are not distinguishable at a glance, either the resolution rises or the stage has to frame rather than show everything. Test this before drawing a cast, not after. (17.4)

   **Include the visible sound system from 6.5 in this test.** It adds one animated element per channel and it is the most likely thing to push the stage over its readability budget. The question is whether event visuals still win against a full board's worth of sound rendering, and whether wave shape survives the pixel grid at all. The fallback if it does not is colour binding alone.

2. **Mobile output latency.** Web Audio output latency on a mid-range Android device runs high enough to eat a meaningful fraction of a grace window, and it means the audible confirmation of a fix arrives noticeably after the gesture. Measure on real hardware during tier 1, not at port time. (20)

3. **Touch density.** Six channels times four controls plus five global controls is a lot of targets in the lower half of a phone screen, operated by two thumbs, with knobs, which are the worst touch control there is. Larger hit areas do not create space that is not there. Design the phone layout early, because it sets the band size cap (5.6). (20)

4. **The haze check.** Hide the stage and see how much still reads. This is a useful diagnostic, not a pass/fail gate: it tells you whether the events that are supposed to be audible actually announce themselves clearly enough to act on, which is what 2.4 and 18.2 require.

   The game is **not** required to be fully playable with the stage hidden. Some challenges are visual only, and that is fine and intended. Most are both. The haze machine works as a tier 4 event precisely because it takes away one channel and leaves the player with the other, which is uncomfortable rather than impossible. Build the toggle during tier 1 anyway, because it is the fastest way to hear whether an event's audio cue is doing its job.

---

## 20. Platform and presentation

**Landscape orientation on all platforms.** Mobile forces rotation. This is standard for games and nobody objects.

Landscape rather than portrait for two reasons: it supports many more channel strips, which matters because band growth is the primary difficulty scaler; and the reference games were all wide, so a tall composition would look wrong no matter how well drawn.

**Desktop and mouse first.** Development and playtesting happen on desktop. Mobile is a later port. The layout is identical, but the port is not merely an input change: see 19 for the two measurements that could force layout changes.

The vertical split between stage and board is flexible and tunable per venue.

**Audio is required.** This game cannot be played without sound, and it is not being designed for sound-off play. Visual redundancy exists because it serves the design, not as an accessibility path.

**English only.**

---

## 21. Scope and roadmap

### 21.1 The first real milestone

**Tier 1, complete.** Three gigs, fully polished. The hub working. The economy working. At least one side job working. Final-quality art and animation.

Not a prototype. Not a vertical slice with placeholder assets. A finished slice of the actual game.

The reason this is the milestone: the gameplay loop is already proven by genre precedent, and a rough prototype has already confirmed it is fun. **The unproven question is whether a solo developer working with AI tooling can produce enough visual personality and comedic writing to make this game worth playing.** Only a fully polished tier answers that.

### 21.2 What comes after

Tiers 2 through 5, in order. Each expands the event library, grows the band, and introduces its one new capability. The design document expands alongside them.

Worth planning for: most of what remains is not just content. Tier 2 adds board interference, which is a new interaction model even though the board itself does not change. Tier 3 adds a whole problem class the faders cannot solve, with band member behaviour states behind it. Tier 4 adds a two-way system with its own failure modes and an anticipatory timing model. Tier 5 adds pyro.

Each of those needs its own design and testing pass, not just new assets. Budget accordingly.

---

## 22. Open questions

Unresolved. To be settled as production continues.

- Band name, member names, and personalities
- The manager's name and backstory
- Which member joins at which venue, after the tier 1 order (guitar, drums, bass)
- Whether channel meters should be visible on strips at all, since they would help the player spot problems but might turn the game into meter-watching instead of band-watching
- The exact channel ceiling, which the phone layout determines (19.3)
- The exact width of the neutral range per control type
- Whether a single mid-level intensity spike works better than a pure rising curve (12.3)
- Full venue list and per-venue environment briefs
- The full event library beyond the starting inventory in 8.8, generated via the grammar in 8.7
- The channel colour palette, which has to be picked before any character is drawn (6.4.5)
- The exact visual vocabulary for sound made visible (6.5), and whether it survives the pixel grid (19.1)
- The full set of state-carrying objects (6.6.6), which needs designing before the events that depend on them
- Whether the reclassified flavour events (the support band across the room, the sliding monitor) can earn a control and become real events
- The full board interference library and its gesture vocabulary (9.1)
- The full side job library

---

## 23. Deliberately rejected

Ideas considered and set aside, with reasons. Do not reintroduce these without new argument.

**This table is for ideas, not for instances.** A specific event that turned out to be illegible is not a rejected idea, it is a bad example of a good rule, and it belongs nowhere. Seven such entries were removed from this table for exactly that reason. Do not add more (0.1).

| Idea | Why rejected |
|---|---|
| **Mute buttons** | The volume fader covers it, and the neutral position rule now gives the fader a defined home to return to, which was the only real argument for mute. |
| **Monitor send knobs** | Two different kinds of volume control is confusing for the player. |
| **Technical console buttons (phantom power, phase invert, pad, high-pass filter)** | HPF duplicates the tone knob. Phase is too invisible to ever feel fair. All of them add clutter without adding a new *kind* of problem. |
| **Channel banking** | Cut. With one person per channel the band caps out at a size that fits the smallest supported screen, so all strips stay visible on every platform. Banking would have been either unnecessary on desktop or a mobile-only compromise. |
| **Multi-channel sources (separate kick, snare, overheads)** | Clutters the board and breaks the stage-position-to-strip mapping in 6.2. One person, one channel, always. |
| **Solo as a diagnostic hunting tool** | Linear search under time pressure is tedium, not tension, and it contradicts 2.4. Solo is a side-job tool and an occasional cued challenge. |
| **Talkback as an alternative fix** | Costs nothing but time, so the correct play would always be talkback. It is now a distinct problem class instead. |
| **Reward-only lighting** | A system that only withholds upside gets dropped the moment a fader needs pulling. Lighting punishes as well as rewards. |
| **Do-nothing side jobs** | Asking the player to spend a gig actively resisting a fix is abstinence, not gameplay. Sabotage stays, but as something you press. This constrains behaviour inside a gig only, not what a side job's objective can be. |
| **Live numeric score during a gig** | Redundant with the crowd meter, which already moves with the score, and a HUD counter fights the aesthetic. |
| **Passive crowd energy regeneration** | Unnecessary once the player starts each gig at 100. Recovery comes from speed bonuses and lighting cues instead. |
| **Adaptive / dynamic difficulty** | Would break score comparability, which the fixed density budget exists to protect, and money is tied to score. |
| **Difficulty options** | Players who stall on a default difficulty tend to quit rather than switch down, so options do not rescue a bad curve. The default curve has to be right. |
| **Outfit gameplay bonuses** | Making cosmetics mechanically relevant forces players to optimize instead of choosing what is funniest. |
| **Selling recorded bootlegs for money** | Requires the player to remember a routine action every gig, which is chore rather than gameplay. Record is side-job only. |
| **Walkable point-and-click hub scenes** | Roughly doubles art workload and turns the project into two games. |
| **Clean vector mixing board UI** | Breaks the visual world. The whole screen should feel drawn by the same hand. |
| **Portrait orientation** | Caps channel count too low, and the reference aesthetic is fundamentally wide. |
| **Performance-reactive music layers** | Too much production overhead for the value. Events already make the music respond in the ways that matter. |
| **Designing for sound-off play** | The core mechanic is audio. Partial visual redundancy exists because it serves the design, but full accessibility is not achievable here. |
| **Randomized event content** | Kills authored comedy. The scheduler in 8.3 provides freshness without randomizing what happens. |
| **AI-generated character art** | Repeatedly failed to hit the deliberately ugly, off-balance LucasArts style. Hand-drawing is faster than fighting that. |
| **In-app purchases, microtransactions, ads** | Never. |
