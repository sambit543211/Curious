# Morning Edition writing guide

Read this before writing any card. It sets how every story sounds. The checks in `lib/edition-v2.js`
still apply (sources, 12-word headlines, 80–170 words of prose per card, numbers that match a dated source).

## The voice in one paragraph

Write like a smart friend explaining the news over chai. Plain words, short sentences, one idea per
sentence. Start from the ground and connect the dots, so a reader who knows nothing about the topic
still follows. Every story answers four questions in order: **What happened? Why did it happen? Why
should I care? What happens next?** The reader should finish a card and be able to explain it to
someone else.

## Eleven rules

1. **Open with the plain fact, not the jargon.** "A cyclone is heading for Odisha." Not "IMD's
   02:35 IST bulletin forecasts…". Put the source and time in the sources list, not the first line.
2. **Start from the ground.** Before the news, give the one piece of background that makes it make
   sense. What is this thing? Where does it come from? Who is involved?
3. **Explain every hard word the moment it appears**, in brackets or the next sentence:
   "ROCE (how much the business earns on every hundred rupees put into it)". If a simpler word exists, use it:
   "rules" not "regulatory framework", "fell" not "witnessed a decline".
4. **Turn numbers into something you can picture.** "Nearly double Australia's." "It earns about
   twenty-eight rupees a year on every hundred it invests." Use lakh and crore. Round freely ("about 27%",
   "₹1.1 lakh crore"): the check accepts any figure within 5% of a dated, cited number. Write
   framing amounts in words ("on every hundred rupees", "for each rupee of profit").
5. **Use a small story or everyday example** when a concept is abstract: a scene, an office meeting,
   a shop, a household budget. Keep it real and Indian where it fits.
6. **Ask the reader's question, then answer it.** "So why does this matter?" "Is it expensive?"
   One rhetorical question per card at most.
7. **Short sentences.** Aim for under 20 words. Vary the length so it doesn't sound robotic.
8. **Be honest about uncertainty, in plain words.** "This is a forecast. It can still change."
   Not "attribution remains provisional".
9. **Say what it means for the reader**, concretely: their money, their commute, their job, their
   health, their decisions.
10. **No report-speak.** Don't write "prepared five-year history", "verified close", "respectively",
    "attribution", "statistical", "commence", "is not automatic" or "does not eliminate". Say it the way you'd
    say it out loud: "Over five years, sales grew about 22% a year." The publishing check rejects these words.
11. **No filler.** Avoid "amid", "in a significant move", "it remains to be seen", "watch whether",
    "could disrupt", "landscape", "robust", "leverage" (as a verb), "going forward".

## What each field is for

The reader shows `summary` as the opening, then `soWhat` in a highlighted box, then `watch`. `why`
and `take` sit under "Background and my take".

| Field | Job | Length |
|---|---|---|
| `headline` | The news in everyday words. A full thought, not a label. Max 12 words. | ≤ 12 words |
| `summary` | **What happened**, starting from the ground. Plain fact first, then the one detail that makes it real. | 50–75 words |
| `why` | **The backstory.** The cause, or the background a newcomer needs. Must add something the summary didn't. | 30–50 words |
| `soWhat` | **Why you should care.** Concrete effect on the reader. | 15–25 words |
| `take` | **Our view** in one arguable sentence. | 8–15 words |
| `watch` | **What happens next**: the specific event, date or number to look out for. | 8–15 words |
| `terms` | Hard words used in the card, each explained in under 10 words. | 0–3 |

## Key numbers, charts and tap-to-explain words

These make a story visual. Use them only when they help; most cards need none of the first two.

- **`keyNumber`** `{value, label}`, optional. Only when one figure *is* the story: "7.6%" / "expected GDP growth",
  "₹5,500 crore" / "maximum fundraise approved". Value under 18 characters, label up to 6 words. The figure must
  appear in the card's own text. It shows large at the top of the story and beside the headline on Today. Skip it
  for stories where no single number matters (most politics, psychology, marketing).
- **`chart`** `{title, unit, items: [{label, value}]}`, optional. A simple bar comparison when two to eight numbers
  are easier to see than read: GDP this quarter vs last, input vs output price, before vs after. `unit` is `%`, `₹`,
  `$` or `×`. Every value must also appear in the card's text. The app already draws the markets day-move chart and
  the stock "price tag: today vs its usual" chart, so don't repeat those.
- **`terms`** `[{term, meaning}]`, 0–4 per card. Every hard word you use (GDP, IPO, moat, free float, conformity):
  the term exactly as it appears in the text, and a meaning under 10 words. The app underlines its first use and
  shows the meaning when tapped, so explain lightly in the text and let the tap do the rest.

## Section recipes

**India and World.** Lead with what changed today. In `why`, give the background: who, why now,
what led here. Name places with their state or country ("Puri in Odisha"). Spell out every acronym the
first time ("the weather office (IMD)").

**Indian Markets.** Say what moved and by how much in plain words ("Gold fell over 2%"), then the
reason. Explain market terms in brackets ("FIIs, foreign investors"). Tie it to the reader's money:
loans, SIPs, gold jewellery, fuel prices.

**Stock Investing (five stocks).** Each card should read like a short company profile for someone who
has never heard of the company:

- `summary`: **what the company does** in everyday terms ("makes the wires inside the walls of your
  home"), then its **growth in plain numbers** (sales and profit growth a year, return on capital as
  "about ₹28 on every hundred rupees invested", debt in words).
- `thesis` (3): **good signs**, one plain sentence each.
- `breakers` (2): **red flags**: what could go wrong, one plain sentence each.
- `soWhat`: **cheap or expensive?** Compare today's price with the company's own normal ("you pay
  ₹35 for each rupee of profit; buyers usually paid ₹45"). The verdict and buy-below price are shown
  above it automatically; don't repeat them.
- `take`: **why it could be a good investment**, in one line.
- `why`: the business backstory: what drives its sales, its moat in plain words, or (for a
  52-week-low stock) why the price fell.
- `watch`: the one thing to check next (results date, a number in the next filing).

Every number in the prose must come from the card's data or a dated, cited source. Never say "buy" as
advice: the verdict is the screen's, and the footer says it isn't SEBI-registered advice.

**AI & Tech.** Explain what the product or change actually does for a normal person before the
business angle. Say clearly whether something is announced, available now, or planned.

**Psychology: a short lesson, from first principles.** The goal is that the reader learns one idea about the
mind so well they could explain it to a friend. Never start with the citation. Build it up like a good teacher:

1. *The everyday puzzle* (`summary`): a scene the reader has lived. "You tell your boss the report will be ready by
   Friday…"
2. *What we usually assume* (`belief`): the common-sense view.
3. *What the researchers did* (`experiment`): a short scene: who, how many, what they were asked to do.
4. *The surprise* (`finding`): the result, with the paper's real numbers made easy ("34 days expected, 55 taken").
5. *Why our minds do this* (`why`): the first-principles reason: what the brain is doing and why it evolved or
   learned to do it.
6. *Where you'll see it* (`examples`): two or three quick, everyday Indian examples.
7. *What it means for you* (`soWhat`) and *one thing to try* (`useThisWeek`).
8. *How sure are we?* (`limits`): who was studied and what's still unknown, in plain words.
9. *Remember* (`take`): one line.

No academic words: "people went along with the group", not "participants exhibited conformity". Explain every
term in `terms`. See the 24 November edition for five complete examples.

**Marketing.** Tell it as a mini case study: the brand's problem, the idea, where it ran, and what's
clever about it. Only quote results that were actually published.

## Before and after (19 November edition)

### India

**Before.** "Odisha ordered schools and Anganwadi centres closed in six districts for 19–21 November.
IMD's 02:35 IST bulletin forecasts Akvan crossing between Narsapur and Puri around noon on 20
November, with sustained winds of 90–100 km/h. These are forecasts, not observed landfall conditions."

**After.**
- *Headline:* Cyclone Akvan nears the coast, so Odisha shuts schools in six districts
- *Summary:* A cyclone called Akvan is heading for India's east coast. The weather office (IMD)
  expects it to cross land between Narsapur in Andhra Pradesh and Puri in Odisha around noon on
  Friday, with winds of 90–100 km/h. That's strong enough to bring down trees and power lines. So
  Odisha has shut schools and Anganwadi centres in six districts.
- *Why:* Cyclones feed on warm sea water, and the Bay of Bengal often breeds them at this time of
  year. But this is a forecast. A cyclone can still change course or weaken.
- *So what:* Live near the coast, or travelling there this week? Check your district's instructions
  before you set out.
- *Take:* An uncertain forecast is not a safe one.
- *Watch:* The next IMD update and any evacuation orders.

### Psychology

See the five psychology lessons in `public/editions/2026-11-24.json` (the IKEA effect, the planning fallacy, the
illusion of transparency, self-compassion and reading subgroup results). Each follows the nine steps above.

### Stock

**Before.** "Polycab remains eligible in today's rules-based review using the previous verified NSE
close and consolidated histories. The screen uses an annual-period average for return on capital, not
the current headline ratio."

**After.**
- *Headline:* Polycab wires India's buildings, and it's cheaper than usual
- *Summary:* Polycab makes the wires and cables hidden inside the walls of homes, offices and
  factories. Over five years, sales grew about 27% a year and profit
  about 25% a year. It earns about ₹28 a year on every hundred rupees it puts in. Debt is almost zero.
- *Good signs:* More of India is being wired up every year. Its dealers are everywhere, which is hard
  for a rival to copy. Its everyday business brought in cash in each of the last five years.
- *Red flags:* If customers start paying late, cash gets stuck. New factories must earn their keep
  once they're running.
- *Cheap or expensive?* Today you pay about ₹35 for each rupee of
  yearly profit (its P/E). Over five years, buyers usually paid about ₹45. So it's cheaper than its own normal.
- *Why:* Copper is its main raw material. When copper costs rise, Polycab raises prices, which can
  make sales look bigger than the number of cables sold.
- *Take:* A strong, debt-free leader at a below-normal price.
- *Watch:* Whether customers keep paying on time in the next results.
