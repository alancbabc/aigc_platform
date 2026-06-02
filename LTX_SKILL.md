---
name: LTX-2-prompt-guide
description: Write and optimize English prompts for LTX-2 text-to-video generation.
trigger: Use when generating or revising prompts for LTX-2 video.
---

# LTX-2 Prompt Guide

> **Rule:** LTX-2 prompts must be written in **English only**.

## Goal

Turn a scene idea into a **single flowing English video prompt** that LTX-2 can execute reliably.

## Instructions

When invoked:
- output **one English prompt only**
- write **one single paragraph**
- write **4–8 sentences**
- use **present tense**
- keep **one clear visual sequence from start to end**
- make the result **ready to paste into LTX-2**
- when polishing an existing prompt, actively rewrite risky phrasing into safer visual descriptions instead of preserving the original wording verbatim

## Prompt Structure

Build the prompt in this order:

1. **Shot** — establish the shot type and style
2. **Scene** — lighting, atmosphere, color, texture, time of day
3. **Character** — age, appearance, clothing, distinguishing details
4. **Action** — one clear action sequence in present tense
5. **Camera** — describe camera movement relative to the subject
6. **Audio** — ambient sound, dialogue, music if needed

## Writing Rules

- Write as **one flowing paragraph**, not a keyword list.
- Use **present tense** verbs.
- Match detail to shot scale.
- Express emotion through **visible behavior**, not labels.
- Use **specific lighting cues** instead of vague mood words.
- Keep the scene readable and physically simple.
- Prefer **one main subject** and **one main action**.
- If the input prompt already contains risky packaging or subtitle-triggering language, replace it with a safer equivalent during polishing.

## Prompt Formula

```text
[STYLE / SHOT]. [SCENE with lighting, atmosphere, texture, time of day]. [CHARACTER details]. [ACTION unfolds from beginning to end in present tense]. [CAMERA movement relative to subject]. [AUDIO details]. [Emotion shown through posture, gesture, or facial expression].
```

## Use

### Shot / Camera
- cinematic wide shot
- wide establishing shot
- medium close-up
- extreme close-up
- over-the-shoulder
- static frame
- handheld tracking
- pushes in
- pulls back
- pans across
- circles around
- crane shot
- overhead view

### Lighting / Atmosphere
- warm golden hour light
- soft studio lighting
- neon glow
- dramatic shadows
- cold blue light
- fog
- rain
- dust
- smoke
- reflections
- worn pavement
- glossy surfaces

### Style
- cinematic
- film noir
- painterly
- surreal
- cyberpunk
- comic-book
- documentary
- stop-motion
- hand-drawn
- pixelated animation

## Avoid

- emotion labels without visual cues
  - bad: `a sad woman`
  - better: `a woman sits hunched forward, eyes wet, hands trembling`
- text, logos, signage, brand names
- prompt patterns that strongly imply packaged subtitle-heavy source material
  - high risk: `two anchors in a modern news studio`, `breaking news`, `anchor says in Chinese`, `left anchor / right anchor`, `broadcast segment`, `guest introduction`
  - safer rewrite: `two presenters in a neutral indoor setting`, `calm professional conversation`, `simple desk`, `clean background`, `restrained delivery`
- prompt patterns that strongly imply dubbed animation clips with baked-in captions
  - high risk: `donghua style dialogue scene`, `anime dialogue scene`, `manga panel feel`, `character introduction card`, long quoted spoken Chinese lines
  - safer rewrite: `stylized character scene`, `character-focused interior`, `subtle conversational movement`, `natural Mandarin delivery`, `clean composition`
- explicit negation inside the main positive prompt when trying to suppress subtitles or overlays
  - avoid relying on phrases like `no subtitles`, `no captions`, `without text` as the main fix
  - the model may still attend to `subtitles`, `captions`, or `text` as active concepts
  - put subtitle / overlay suppression primarily in `negative_prompt`, and keep the positive prompt focused on clean visual state
- strong broadcast-packaging cues unless they are essential to the scene
  - avoid `lower-third style`, `headline feel`, `newsroom energy`, `presenter graphic`, `speaker label`, `intro card`
- strong comic-packaging cues unless they are essential to the scene
  - avoid `speech bubble`, `manga annotation`, `comic caption`, `role card`, `vertical title`, `profile card`
- overloaded scenes with too many characters or actions
- chaotic physics or fast nonlinear motion
- conflicting lighting logic unless intentionally motivated
- stacked camera instructions like:
  - bad: `zoom while panning while rotating while tilting`

## Subtitle-Risk Guidance

When the target scene involves spoken Chinese dialogue, studio presentation, animation dubbing, or character introductions, LTX-2 may drift toward subtitle-like artifacts, lower-thirds, or character-card overlays.

To reduce that risk:

- prefer neutral scene language over packaging language
  - better: `two people seated at a simple desk in a clean indoor setting`
  - riskier: `two anchors in a modern news studio`
- prefer conversational wording over program wording
  - better: `the woman speaks first, then the man responds`
  - riskier: `the left female anchor says..., then the right male anchor says...`
- prefer short dialogue intent descriptions over long quoted lines when subtitle artifacts are persistent
  - better: `he speaks briefly in Mandarin with natural mouth movement`
  - riskier: long quoted Chinese lines embedded directly in the prompt
- emphasize clean visual state in affirmative language
  - useful phrases: `clean composition`, `neutral background`, `character-focused frame`, `restrained upper-body motion`, `visually uncluttered frame`, `unobstructed lower frame area`
- keep subtitle suppression out of the main positive prompt when possible
  - use `negative_prompt` for `subtitles`, `captions`, `lower-third`, `ticker`, `character intro card`, `vertical text`, and related overlay terms
  - use the positive prompt to describe what the frame should look like, not what should be banned

### Required Rewrite Behavior For Existing Prompts

When revising or polishing a user-provided prompt, do not keep risky phrasing just because the user wrote it. If the prompt contains subtitle-triggering packaging language, rewrite it into a safer visual description while preserving the scene intent.

Apply these replacements proactively:

- replace broadcast-packaging phrasing with neutral scene phrasing
  - `two anchors in a modern news studio` -> `two presenters seated in a clean neutral indoor setting`
  - `left anchor / right anchor` -> `the woman / the man` or `one speaker / the other speaker`
  - `breaking news`, `broadcast segment`, `guest introduction` -> `professional conversation`, `calm discussion`, `formal exchange`
- replace comic / donghua packaging phrasing with character-scene phrasing
  - `donghua dialogue scene` -> `stylized character scene`
  - `anime dialogue scene` -> `character-focused dramatic scene`
  - `manga panel feel` -> `clean stylized composition`
  - `character introduction card`, `role card`, `profile card` -> remove from the positive prompt and express the scene as a clean character-focused frame
- replace long quoted spoken Chinese lines with short intent-driven speech descriptions when subtitle artifacts are persistent
  - `he says: "..."` -> `he speaks briefly in Mandarin with natural mouth movement`
  - `she interrupts and says: "..."` -> `she responds urgently in Mandarin with synchronized mouth movement`
- replace negation-based suppression in the positive prompt with affirmative clean-frame language
  - `no subtitles`, `no captions`, `without text` -> `clean composition`, `visually uncluttered frame`, `unobstructed lower frame area`, `neutral background`

Preserve the user's intended subject, emotion, staging, and shot logic, but remove or rewrite the specific phrasing that increases the chance of subtitle-like overlays.

### Recommended Negative Prompt Template

Current local case template from `ltx23_text_case.py.py`:

```text
text, subtitles, lower-third, chyron, nameplate, news broadcast, TV graphics, interview, breaking news banner, character introduction overlay, manga annotation, comic annotation, text bubble, lettering artifacts, on-screen text, kana, furigana, character card, profile card, vertical text, vertical subtitles, vertical title card
```

Use this template when the scene is at risk of generating subtitle-like overlays, news-style lower-thirds, interview nameplates, manga/comic annotations, or character-introduction cards.

## Validation

Before returning the prompt, verify:

- Is the prompt fully in English?
- Is it one paragraph?
- Is it 4–8 sentences?
- Does it clearly establish shot, scene, character, action, camera, and audio?
- Are emotions shown visually instead of named?
- Is the camera movement readable?
- Is the lighting concrete?
- Is the action simple enough to render clearly?

## Output Pattern

Return only the final prompt unless the caller explicitly asks for analysis, options, or revision notes.

## Example

```text
Cinematic medium close-up of a woman in her 30s standing alone on a wet city street at night. Cold blue neon reflections shimmer across the pavement while dim storefront light catches the edge of her dark coat and loose hair. She stands slightly hunched, jaw tight, eyes glossy, then slowly begins walking forward while glancing down at the ground. The camera tracks backward with her, keeping her face centered as blurred headlights drift behind her. Distant traffic hum, light rain, and soft footsteps echo through the street. She exhales shakily and whispers, "I thought you would come back."
```

## Reference

Official guide:
https://ltx.io/model/model-blog/prompting-guide-for-ltx-2#key-aspects-to-include
