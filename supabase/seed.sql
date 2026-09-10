-- Musalleen virtues seed data — the "why" content shown alongside the counter.
-- Sourcing discipline (matches Mustaghfirin's own content-integrity boundary,
-- see its app/i18n.js header comment):
--   'quran'      — verbatim/near-verbatim from the Quran, cited by surah:ayah.
--   'hadith'     — a real, well-known, widely-authenticated report, cited by
--                  collection. Distinct clauses of one rich hadith are split
--                  into separate cards (same pattern Mustaghfirin used for
--                  Surah Nuh 71:10-12's five promises) rather than treated
--                  as 100 independent hadith that don't exist.
--   'scholar'    — a real, general point of scholarly consensus/commentary,
--                  attributed loosely ("scholars note...") rather than to a
--                  specific named individual/book I can't verify.
--   'reflection' — general reflective framing, explicitly NOT presented as
--                  scripture or a specific person's words.
--   'friday'     — is_friday_special = true, shown with extra emphasis on
--                  Fridays per the reminder engine.
-- Anything here should be scholar-reviewed before wide release, same caution
-- Mustaghfirin's own i18n file flags for its Urdu translations.

-- salawat_formats: seeded with the one universally-known, uncontroversial
-- form (recited in every prayer's tashahhud, taught by the Prophet ﷺ
-- himself in response to the companions' question of how to send blessings
-- upon him). Additional formats (short forms, other collections) are
-- explicitly Phase 4 work — this seed only proves the schema shape.
insert into salawat_formats (slug, title, arabic_text, transliteration, translation, source_note, category, sort_order, is_active) values
('ibrahimiyyah', 'Salawat Ibrahimiyyah', 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ كَمَا صَلَّيْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ إِنَّكَ حَمِيدٌ مَجِيدٌ',
 'Allahumma salli ala Muhammadin wa ala aali Muhammad, kama sallayta ala Ibrahima wa ala aali Ibrahim, innaka Hamidun Majid',
 'O Allah, send blessings upon Muhammad and the family of Muhammad, as You sent blessings upon Ibrahim and the family of Ibrahim. Indeed You are Praiseworthy, Glorious.',
 'The salutation taught by the Prophet ﷺ himself when the companions asked how to send blessings upon him, recited in every prayer''s tashahhud.',
 'tashahhud', 1, true),
('ibrahimiyyah-barakah', 'Salawat Ibrahimiyyah (with Barakah)',
 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ كَمَا صَلَّيْتَ عَلَى آلِ إِبْرَاهِيمَ، وَبَارِكْ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ كَمَا بَارَكْتَ عَلَى آلِ إِبْرَاهِيمَ إِنَّكَ حَمِيدٌ مَجِيدٌ',
 'Allahumma salli ala Muhammadin wa ala aali Muhammad, kama sallayta ala aali Ibrahim, wa barik ala Muhammadin wa ala aali Muhammad, kama barakta ala aali Ibrahim, innaka Hamidun Majid',
 'O Allah, send blessings upon Muhammad and the family of Muhammad, as You sent blessings upon the family of Ibrahim, and bless Muhammad and the family of Muhammad, as You blessed the family of Ibrahim. Indeed You are Praiseworthy, Glorious.',
 'A second authentic wording taught by the Prophet ﷺ, narrated by Ka''b ibn ''Ujrah (Sahih al-Bukhari) — adds "wa barik" (and bless) alongside "salli".',
 'tashahhud', 2, true),
('short-salawat', 'Short Salawat',
 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى سَيِّدِنَا مُحَمَّدٍ',
 'Allahumma salli wa sallim ala Sayyidina Muhammad',
 'O Allah, send blessings and peace upon our master Muhammad.',
 'A short, widely-used devotional form for repeated counting — not itself a direct hadith quotation like the tashahhud forms, but a simple, uncontroversial salutation used across the Muslim world.',
 'short', 3, true),
('tashahhud-greeting', 'The Tashahhud Greeting',
 'السَّلَامُ عَلَيْكَ أَيُّهَا النَّبِيُّ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ',
 'As-salamu alayka ayyuha an-nabiyyu wa rahmatullahi wa barakatuh',
 'Peace be upon you, O Prophet, and the mercy of Allah and His blessings.',
 'The direct greeting to the Prophet ﷺ said in every prayer''s tashahhud, immediately before the salawat itself — addressed to him directly, in the second person.',
 'tashahhud', 4, true),
('minimal-salawat', 'Minimal Salawat',
 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ',
 'Allahumma salli ala Muhammad',
 'O Allah, send blessings upon Muhammad.',
 'The shortest core form — just the essential request, without the additional phrases found in the longer tashahhud wordings.',
 'short', 5, true)
-- Deliberately not adding tariqa/collection-specific salawat (Dala'il
-- al-Khayrat excerpts, Salawat al-Fatih, Nariyah, etc.) here -- those
-- carry group-specific association and authenticity questions I'm not
-- positioned to adjudicate. If wanted, they should come from the user's
-- own sourced text, same content-authoring boundary held throughout.
on conflict (slug) do nothing;

insert into virtues (title, body, source, category, is_friday_special, sort_order) values

-- QURAN — there is essentially one direct verse commanding this; kept small
-- and honest rather than padded.
('The Command Itself', '"Indeed, Allah confers blessing upon the Prophet, and His angels [ask Him to do so]. O you who believe, ask [Allah to confer] blessing upon him and ask [Allah to grant him] peace."', 'Quran — Al-Ahzab 33:56', 'quran', false, 1),
('Allah Already Does It', 'The verse opens with Allah Himself sending blessings on the Prophet ﷺ, before the command to believers even arrives — we are invited to join something already happening, not asked to start it from nothing.', 'Quran — Al-Ahzab 33:56', 'quran', false, 2),
('The Angels Join Too', 'Not believers alone — the angels themselves are described sending blessings on the Prophet ﷺ. A gathering far larger than any human circle of dhikr.', 'Quran — Al-Ahzab 33:56', 'quran', false, 3),
('A Complete Salutation', 'The verse asks not just for blessings but for a "worthy salutation" (taslima) — completeness of the greeting, not a hurried or partial one.', 'Quran — Al-Ahzab 33:56', 'quran', false, 4),

-- HADITH — distinct, well-known, widely cited authenticated reports. Multi-
-- clause hadith are split into their separate promises as separate cards.
('Tenfold in Return', '"Whoever sends blessings upon me once, Allah will send blessings upon him tenfold."', 'Hadith — Sahih Muslim', 'hadith', false, 10),
('Ten Sins Erased', 'The fuller narration adds: ten of his sins are removed for every salawat sent.', 'Hadith — An-Nasa''i', 'hadith', false, 11),
('Ten Degrees Raised', 'The same narration continues: he is raised ten degrees in rank for every salawat sent.', 'Hadith — An-Nasa''i', 'hadith', false, 12),
('Closest on the Day of Judgment', '"The people closest to me on the Day of Resurrection will be those who sent the most blessings upon me."', 'Hadith — Tirmidhi', 'hadith', false, 13),
('The One Truly Miserly', '"The miser is the one in whose presence I am mentioned and he does not send blessings upon me."', 'Hadith — Tirmidhi', 'hadith', false, 14),
('It Reaches Him Wherever You Are', '"Send blessings upon me, for your blessings reach me wherever you may be."', 'Hadith — Abu Dawud', 'hadith', false, 15),
('Angels Carry It to Him', 'The Prophet ﷺ said Allah has angels who travel the earth conveying to him the greetings of his Ummah.', 'Hadith — An-Nasa''i', 'hadith', false, 16),
('A Gathering That Regrets Itself', 'The Prophet ﷺ warned that people who sit in a gathering without remembering Allah or sending blessings upon him will find it a source of regret on the Day of Judgment.', 'Hadith — Tirmidhi', 'hadith', false, 17),
('Precede Your Dua With It', 'The Prophet ﷺ heard a man make dua without first praising Allah or sending blessings upon him, and said he had been hasty — teaching that salawat belongs before the asking, not after.', 'Hadith — Tirmidhi', 'hadith', false, 18),
('A Dua Suspended Until Sent', 'A dua made without salawat is described as remaining suspended between heaven and earth until blessings are sent upon the Prophet ﷺ.', 'Hadith — Tirmidhi', 'hadith', false, 19),
('Sufficiency Against Worry', 'When a companion asked how much of his dua-time to devote to salawat, the Prophet ﷺ told him to increase it, saying it would be sufficient for whatever worried him and his sins would be forgiven.', 'Hadith — Tirmidhi', 'hadith', false, 20),
('A Reply to Every Greeting', 'The Prophet ﷺ said his spirit is returned to him so he can reply to whoever sends him greetings — the salutation is not sent into silence.', 'Hadith — Abu Dawud', 'hadith', false, 21),

-- FRIDAY — the specific hadith on Friday's emphasis, expanded into distinct
-- facets, matching the reminder engine's Friday-special content.
('Increase It on Friday', '"Increase your sending of blessings upon me on Friday, for the blessings of my Ummah are presented to me on that day."', 'Hadith — Abu Dawud', 'friday', true, 30),
('Presented, Not Just Sent', 'On Friday specifically, salawat is described as being presented directly to the Prophet ﷺ — the day itself carries the delivery.', 'Hadith — Abu Dawud', 'friday', true, 31),
('The Most Virtuous Day', 'Friday is described in hadith as the best day the sun rises upon — the day Adam was created, entered Paradise, and left it.', 'Hadith — Sahih Muslim', 'friday', true, 32),
('A Day of Witnessing', 'Scholars note Friday is described as a "witnessed" day — a fitting day for a salutation that is itself carried and presented.', 'Scholars & Reflection', 'friday', true, 33),
('Don''t Let the Day Pass Quietly', 'If Friday is the day salawat is specially presented, letting it pass without any extra effort is easy to regret later.', 'Reflection', 'friday', true, 34),

-- SCHOLARS — general, safely-attributed points of classical practice and
-- commentary, not pinned to a specific unverifiable quote.
('A Practice Kept for Centuries', 'Scholars across centuries kept personal daily commitments (awrad) of salawat, alongside istighfar and other dhikr, as part of an ordinary daily discipline — not reserved for scholars alone.', 'Scholars', 'scholar', false, 40),
('Dala''il al-Khayrat', 'Imam al-Jazuli''s famous salawat collection, organized by day of the week, has been recited communally across the Muslim world for centuries — evidence of how central this practice became to devotional life.', 'Scholars — historical practice', 'scholar', false, 41),
('An Act With No Downside', 'Scholars often note that unlike many acts of worship, sending salawat carries no possible harm or excess — there is no version of "too much."', 'Scholars & Reflection', 'scholar', false, 42),
('Joining a Motion Already in Progress', 'Commentators on 33:56 point out the grammar itself: Allah "confers" blessing (present, ongoing), while believers are told to "ask" for it — we step into something moving, not something we start.', 'Scholars — on Quran 33:56', 'scholar', false, 43),
('Why the Miser Language', 'Scholars explain the "miser" hadith uses financial language deliberately — sending salawat costs nothing, so withholding it when the Prophet ﷺ is mentioned is framed as a stinginess with something free.', 'Scholars — on the miser hadith', 'scholar', false, 44),
('A Sign of Love, Not Just Obligation', 'Scholars frame frequent salawat as a natural expression of love rather than a checklist item — the heart that loves mentions who it loves.', 'Scholars & Reflection', 'scholar', false, 45),

-- REFLECTION — general reflective framing, explicitly not scripture.
('A Two-Way Gift', 'Every salawat sent is returned tenfold — rare is the act of worship that is also, in the same breath, a gift back to the one who does it.', 'Reflection', 'reflection', false, 50),
('Said Without Cost', 'No wudu required, no set time, no fixed place — salawat can be said walking, waiting, working, in any state.', 'Reflection', 'reflection', false, 51),
('A Habit That Fits Anywhere', 'Between tasks, in traffic, before sleep — salawat asks for a moment, not a setting.', 'Reflection', 'reflection', false, 52),
('The Shortest Distance to Nearness', 'If nearness to the Prophet ﷺ on the Day of Judgment is tied to how much salawat is sent, it may be the simplest deed with the clearest reward attached.', 'Reflection', 'reflection', false, 53),
('Every Language Says It', 'Muslims across every land and language pause to send blessings on one man — a shared devotion that crosses every other line.', 'Reflection', 'reflection', false, 54),
('It Doesn''t Require Understanding Arabic', 'The words can be learned by anyone; sincerity of intention has never depended on fluency.', 'Reflection', 'reflection', false, 55),
('A Quiet Defense Against a Hard Day', 'Hearts unsettled by a difficult morning often find that sending salawat a few times steadies them before anything else does.', 'Reflection', 'reflection', false, 56),
('Not Competing With Dhikr — Completing It', 'Salawat is not separate from remembrance of Allah; it is woven into the same fabric, since it is Allah who commanded it.', 'Reflection', 'reflection', false, 57),
('The One Constant Companion', 'Long after companions, teachers, and routines change, salawat remains something that can be said the same way, every single day.', 'Reflection', 'reflection', false, 58),
('A Small Habit With No Ceiling', 'There is no hadith fixing a maximum — as much as the heart wants to give, it can.', 'Reflection', 'reflection', false, 59),
('Said for Someone You''ve Never Met', 'It is a strange and beautiful kind of love — devotion for someone none of us have seen, learned only through what was passed down.', 'Reflection', 'reflection', false, 60),
('A Habit the Youngest Can Start', 'Unlike many acts of worship that take years to learn, a child can be taught salawat in a single sitting.', 'Reflection', 'reflection', false, 61),
('Reaches Further Than a Phone Call', 'No signal, no distance, no waiting — the hadith describing it as always reaching him ﷺ makes it a message with no possible delivery failure.', 'Reflection', 'reflection', false, 62),
('It Doesn''t Need an Occasion', 'Some acts of worship wait for a set time or place; salawat has none of those conditions.', 'Reflection', 'reflection', false, 63),
('A Reminder Before It''s a Ritual', 'Saying his name and sending blessings keeps the Prophet ﷺ present in daily thought, not just in specific acts of worship.', 'Reflection', 'reflection', false, 64),
('The Opposite of Forgetting', 'To send salawat regularly is, in a small way, to actively resist letting the Prophet ﷺ fade into the background of a busy life.', 'Reflection', 'reflection', false, 65),
('One Line, Endless Repetition, Never Empty', 'Unlike a story told too many times, salawat doesn''t wear thin with repetition — it''s the rare phrase that stays meaningful the thousandth time.', 'Reflection', 'reflection', false, 66),
('A Practice That Travels With You', 'Move countries, change jobs, lose routines — salawat is one habit that survives every disruption, needing nothing external to continue.', 'Reflection', 'reflection', false, 67),
('Said in Grief, Said in Joy', 'Believers reach for salawat both in celebration and in hardship — it fits whatever the moment holds.', 'Reflection', 'reflection', false, 68),
('It Doesn''t Ask to Be Understood, Only Said', 'Unlike complex acts of worship that need study first, salawat asks only for the words and the intention.', 'Reflection', 'reflection', false, 69),
('A Habit That Builds Without Announcing Itself', 'No one has to know how much salawat someone sends in a day — it can be entirely between a person and Allah.', 'Reflection', 'reflection', false, 70),
('Said Standing in Line, Waiting for a Bus', 'The gaps in an ordinary day — waiting rooms, red lights, queues — are exactly where a habit like this quietly adds up.', 'Reflection', 'reflection', false, 71),
('Few Words, A Large Meaning', 'A handful of words in Arabic carry a request that touches mercy, peace, and elevation all at once.', 'Reflection', 'reflection', false, 72),
('It Costs Nothing and Loses Nothing', 'Wealth can be spent and gone; salawat is never depleted by being given.', 'Reflection', 'reflection', false, 73),
('The Habit Behind the Habit', 'Many who build a strong daily dhikr practice say salawat was the first habit that made the rest easier to hold onto.', 'Reflection', 'reflection', false, 74),
('Not Reserved for the Scholarly', 'This is not a practice that requires years of study — it has always belonged equally to everyone.', 'Reflection', 'reflection', false, 75),
('A Companion for the Commute', 'Long, unoccupied stretches of travel are, for many, where salawat is said most freely.', 'Reflection', 'reflection', false, 76),
('It Doesn''t Compete for Time', 'A single salawat takes seconds — it asks to be fit in, not scheduled around.', 'Reflection', 'reflection', false, 77),
('Said for Him, Returned to You', 'The one praying benefits more than the one prayed for could ever need — Allah and His angels already send blessings on the Prophet ﷺ without any need for ours.', 'Reflection', 'reflection', false, 78),
('A Thread Through the Whole Ummah', 'Every believer who has ever lived has said some version of the same words — an unbroken thread across fourteen centuries.', 'Reflection', 'reflection', false, 79),
('The Practice That Needs No Translation to Feel Right', 'Even before understanding every word, many say the Arabic feels weighty from the first time they learn it.', 'Reflection', 'reflection', false, 80),
('A Habit Worth Repeating on Purpose', 'Consistency here isn''t about a number — it''s about not letting a single day pass without it entirely.', 'Reflection', 'reflection', false, 81),
('One of the Few Deeds With No Wrong Time', 'Fajr or midnight, fasting or not, traveling or home — there is no state in which salawat is out of place.', 'Reflection', 'reflection', false, 82),
('A Small Deed That Outlives the Moment', 'A single salawat said quietly today may be one of the deeds a person is most grateful for on the Day it matters most.', 'Reflection', 'reflection', false, 83),
('The Practice That Asks for Nothing Back', 'Unlike most requests, this one is made entirely on someone else''s behalf — and still returns tenfold to the one who made it.', 'Reflection', 'reflection', false, 84),
('Said Between Sujood and the Next Task', 'The seconds after finishing prayer, before standing up, are a favorite quiet moment for many to add a few more.', 'Reflection', 'reflection', false, 85),
('Not Diminished by Distraction', 'Even said with a wandering mind, salawat is still salawat — sincerity grows with practice, not before it.', 'Reflection', 'reflection', false, 86),
('A Habit Anyone Can Teach', 'Parents often find salawat is one of the easiest parts of faith to hand down to a child, word for word.', 'Reflection', 'reflection', false, 87),
('The Practice That Makes a Room Feel Different', 'Many describe a gathering that opens or closes with salawat feeling noticeably different from one that doesn''t.', 'Reflection', 'reflection', false, 88),
('Said for a Man Who Already Has Everything He Needs', 'The Prophet ﷺ needs nothing from us — and yet this is the deed he is reported to have asked his Ummah to keep doing regardless.', 'Reflection', 'reflection', false, 89),
('A Line That Has Never Gone Out of Use', 'Trends change, languages shift, but this specific set of words has been said, unaltered, for over a thousand years.', 'Reflection', 'reflection', false, 90),
('It Grows Quieter, Not Louder, With Sincerity', 'The most consistent practitioners often describe their salawat becoming more private over time, not more public.', 'Reflection', 'reflection', false, 91),
('A Practice for the In-Between Moments', 'Not everything worth doing needs a dedicated block of time — some of the best habits live entirely in the gaps.', 'Reflection', 'reflection', false, 92),
('One Sentence, Repeated a Lifetime', 'Few sentences a person learns as a child are still being said, meaningfully, decades later — this one usually is.', 'Reflection', 'reflection', false, 93),
('A Small Act That Needs No Explanation', 'Unlike some practices that require context to make sense to an outsider, salawat''s meaning is immediate: blessings, on someone worth blessing.', 'Reflection', 'reflection', false, 94),

-- more SCHOLARS
('A Practice Agreed Upon Across Schools of Thought', 'Scholars across the different schools of Islamic law differ on many details of practice, but the virtue of frequent salawat is a rare point where all agree.', 'Scholars', 'scholar', false, 46),
('Recommended, Not Restricted', 'Classical scholarship treats salawat as a recommended act open to every believer, with no special conditions of knowledge or status required to begin.', 'Scholars', 'scholar', false, 47),

-- more REFLECTION
('A Habit That Needs Neither Privacy Nor an Audience', 'It works said silently in a crowd, or aloud when entirely alone — no setting makes it awkward.', 'Reflection', 'reflection', false, 95),
('Said Before Falling Asleep', 'Many end their day with a few quiet salawat, letting it be among the last words of the day.', 'Reflection', 'reflection', false, 96),
('A Deed That Doesn''t Fade With Age', 'Even when other acts of worship grow physically harder with age, salawat remains just as easy to say as ever.', 'Reflection', 'reflection', false, 97),
('Easy to Restart After a Gap', 'Unlike habits that need to be relearned, missing a week of salawat changes nothing about how easily it can be picked back up.', 'Reflection', 'reflection', false, 98),
('Said for Someone Whose Face Was Never Seen', 'The devotion carried in these words is as real as for anyone known personally — perhaps more so.', 'Reflection', 'reflection', false, 99),
('It Doesn''t Wait for Motivation', 'Salawat can be said on a low, uninspired day exactly as it can on an eager one — it doesn''t ask how you feel first.', 'Reflection', 'reflection', false, 100),
('A Habit That Deepens With Repetition, Not Wears Out', 'Unlike most phrases that lose meaning when repeated too often, this one tends to grow richer instead.', 'Reflection', 'reflection', false, 101),
('A Practice That Fits a Life of Any Size', 'As relevant in the busiest season of life as in the quietest one — it asks the same small amount either way.', 'Reflection', 'reflection', false, 102),
('A Natural Swap for a Spare Minute', 'The minute otherwise spent scrolling absentmindedly is exactly the kind of gap this habit is built for.', 'Reflection', 'reflection', false, 103),
('Available Even When Weak or Unwell', 'It asks for no physical strength, no standing, no particular posture — sayable from a sickbed as easily as anywhere else.', 'Reflection', 'reflection', false, 104),
('The Transliteration Is Enough to Begin', 'Fluency in Arabic isn''t a prerequisite — the practice can start today, in whatever script makes it accessible.', 'Reflection', 'reflection', false, 105),
('A Wish Made Entirely for Someone Else', 'Most personal worship is a request for oneself; this one is explicitly on someone else''s behalf, and still returns tenfold.', 'Reflection', 'reflection', false, 106),
('A Practice With Built-In Humility', 'Asking Allah to bless someone already perfected in character has a way of keeping the one asking humble about their own place.', 'Reflection', 'reflection', false, 107),
('Said in the Same Words the Earliest Muslims Used', 'A direct, unbroken link in wording connects a believer saying it today to the very first generation who said it.', 'Reflection', 'reflection', false, 108),
('Every Single One Counts, Not Just a Round Number', 'The tenth salawat of the day carries the same virtue as the hundredth — none of them are just filler on the way to a milestone.', 'Reflection', 'reflection', false, 109),
('A Habit That Doesn''t Interrupt Conversation', 'It can be said silently mid-task, mid-walk, or mid-wait without anyone else ever noticing.', 'Reflection', 'reflection', false, 110),
('Said on Behalf of the Man Who Changed Everything', 'The difference his life made to the world is part of why this specific salutation exists at all.', 'Reflection', 'reflection', false, 111),
('Practiced the Same Way in Every Country', 'The words don''t change with geography — the exact same salutation is said from one end of the earth to the other.', 'Reflection', 'reflection', false, 112),
('A Small Deed That Adds Up Without Needing to Be Tracked', 'Even an approximate daily habit, kept loosely, compounds meaningfully over the course of a lifetime.', 'Reflection', 'reflection', false, 113),
('Not Contingent on Mood or Circumstance', 'Grief, joy, routine, or crisis — it fits all of them without needing to be adjusted for the moment.', 'Reflection', 'reflection', false, 114),
('A Rushed One Still Counts', 'It doesn''t ask to be said perfectly — even a hurried, imperfect salawat is still counted as one.', 'Reflection', 'reflection', false, 115),
('Said Quietly in a Crowded Room', 'It needs no volume, no audience, and no acknowledgment from anyone else present.', 'Reflection', 'reflection', false, 116),
('Welcomes a Beginner and a Lifelong Practitioner Equally', 'There is no advanced version required before starting — day one looks the same as year twenty.', 'Reflection', 'reflection', false, 117),
('The One Constant Across a Changing Ummah', 'Communities, cultures, and eras have shifted in countless ways, and this one practice has stayed exactly the same across all of them.', 'Reflection', 'reflection', false, 118),
('No Special Occasion Required to Feel Meaningful', 'An ordinary weekday carries the same weight for this practice as any significant date on the calendar.', 'Reflection', 'reflection', false, 119),
('A Reminder That Devotion Isn''t Only Ritual', 'This is worship expressed as care for someone else, not only as personal obligation.', 'Reflection', 'reflection', false, 120),
('Small Enough to Never Run Out of Time For', 'Even the busiest day still has room for one more.', 'Reflection', 'reflection', false, 121)

on conflict do nothing;
