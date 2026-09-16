/*
 * Every word this app pushes to a phone, in both languages.
 *
 * The voice is the app's own: warm, plain, never alarmist, honest about what
 * it does not know. Two rules govern the humour, and they are not style
 * preferences — they are the difference between a notification that helps and
 * one that lands badly on a hard day:
 *
 *   1. Nothing playful ever attaches to the chemotherapy capsule, the
 *      anti-seizure pair, the therapy question or the bloods review. Those are
 *      `tone: 'chemo'` and `tone: 'seizure'` in the catalogue, plus the two
 *      alerts that carry clinical instructions. They get warmth, not jokes.
 *   2. The lighter voice lives where the stakes are ordinary — the weekly
 *      weigh-in, course milestones, and the morning greeting.
 *
 * The morning greeting sits directly above the therapy question during the
 * course, so even that bank is gentle rather than funny. A caregiver reading
 * "Capsule o'clock!" at 7am on week three would not feel looked after.
 */
import { RT_COURSE_START } from '../catalog'
import { daysBetween } from '../time'
import type { Lang } from './types'

export interface Line {
  en: string
  hi: string
}

export const pick = (line: Line, lang: Lang): string => line[lang]

// ----------------------------------------------------------- morning ----

/**
 * Sixteen greetings, chosen by date rather than at random.
 *
 * Deterministic so every phone in the house shows the same line, and so a
 * retry after a failed send repeats the line it was going to show rather than
 * reshuffling. Sixteen against a 42-day course means a line comes round about
 * every two weeks — far enough apart to read as a greeting rather than a loop.
 */
export const MORNING_LINES: Line[] = [
  { en: 'Good morning. A quiet start is still a good start.', hi: 'सुप्रभात। शांत शुरुआत भी अच्छी शुरुआत है।' },
  { en: 'Morning. The chart is ready when you are.', hi: 'सुप्रभात। चार्ट तैयार है, जब आप तैयार हों।' },
  { en: 'Good morning. One day at a time, and this is the one.', hi: 'सुप्रभात। एक दिन में एक कदम — आज वही दिन है।' },
  { en: 'Morning. Tea first is allowed.', hi: 'सुप्रभात। पहले चाय — बिलकुल चलेगी।' },
  { en: 'Good morning. Nothing here needs rushing.', hi: 'सुप्रभात। यहाँ किसी चीज़ की जल्दी नहीं है।' },
  { en: 'Morning. Small steady days add up.', hi: 'सुप्रभात। छोटे-छोटे स्थिर दिन जुड़ते जाते हैं।' },
  { en: 'Morning. You have done this before.', hi: 'सुप्रभात। यह आपने पहले भी किया है।' },
  { en: 'Good morning. Today only asks for today.', hi: 'सुप्रभात। आज सिर्फ़ आज माँगता है।' },
  { en: 'Morning. The kettle counts as step one.', hi: 'सुप्रभात। पहला कदम — एक कप चाय।' },
  { en: 'Good morning. Steady is the whole plan.', hi: 'सुप्रभात। स्थिर रहना ही पूरी योजना है।' },
  { en: 'Morning. Gently, and in order.', hi: 'सुप्रभात। आराम से, और क्रम से।' },
  { en: 'Good morning. Rest counts too.', hi: 'सुप्रभात। आराम भी गिनती में आता है।' },
  { en: 'Morning. A slow start still counts as started.', hi: 'सुप्रभात। धीमी शुरुआत भी शुरुआत है।' },
  { en: 'Good morning. Nothing is behind. It is just morning.', hi: 'सुप्रभात। कुछ भी पीछे नहीं छूटा — बस सुबह हुई है।' },
  { en: 'Morning. Same chart, same care, new day.', hi: 'सुप्रभात। वही चार्ट, वही देखभाल, नया दिन।' },
  { en: 'Good morning. The list is short and it keeps.', hi: 'सुप्रभात। सूची छोटी है और इंतज़ार कर लेगी।' },
]

export function morningLineFor(isoDate: string): Line {
  const day = daysBetween(RT_COURSE_START, isoDate)
  const n = MORNING_LINES.length
  return MORNING_LINES[((day % n) + n) % n]
}

/** Asked only while a therapy-gated medicine is in its course window. */
export const MORNING_THERAPY: Line = {
  en: 'Is there radiation therapy today? The Temozolomide capsule is given only on a therapy day, so it is not on the timeline until this is answered.',
  hi: 'क्या आज रेडियोथेरेपी है? टेमोज़ोलोमाइड कैप्सूल केवल थेरेपी वाले दिन दिया जाता है, इसलिए उत्तर देने तक वह सूची में नहीं आएगा।',
}

/*
 * `time` arrives from `prettyTime` as "7:00 am", which already carries the
 * sense of "बजे" — the two together read as "at 7 o'clock o'clock".
 */
export const MORNING_PLAIN = (brand: string, time: string, n: number): Line => ({
  en: `First today: ${brand} at ${time}. ${n} ${n === 1 ? 'dose' : 'doses'} on the chart.`,
  hi: `आज सबसे पहले: ${brand}, ${time}। चार्ट पर ${n} खुराक${n === 1 ? '' : 'ें'}।`,
})

export const THERAPY_ACTIONS: { yes: Line; no: Line } = {
  yes: { en: 'Yes, therapy today', hi: 'हाँ, आज थेरेपी' },
  no: { en: 'No therapy', hi: 'थेरेपी नहीं' },
}

export const THERAPY_CONFIRMED: { yes: Line; no: Line } = {
  yes: {
    en: 'Radiation therapy today ✓ — the capsule is on the timeline.',
    hi: 'आज रेडियोथेरेपी ✓ — कैप्सूल सूची में है।',
  },
  no: {
    en: 'No radiation therapy today ✓ — the capsule is not scheduled.',
    hi: 'आज रेडियोथेरेपी नहीं ✓ — कैप्सूल निर्धारित नहीं है।',
  },
}

// ------------------------------------------------------ evening wrap ----

/*
 * Never playful: this alert names Temozolomide, Lacoset and Valprol. It is
 * also silent on a clean day — no row is claimed and nothing is sent, so a
 * caregiver who has recorded everything is not interrupted to be told so.
 */

export const EVENING_ONE = (brand: string, label: string, time: string) => ({
  title: {
    en: 'One dose still to write down',
    hi: 'एक खुराक अभी दर्ज नहीं हुई',
  } as Line,
  body: {
    en: `${brand} · ${label}, due ${time}. Log the time it was actually given — it is often not the moment you tap.`,
    hi: `${brand} · ${label}, देय ${time}। जो समय वास्तव में दी गई, वही दर्ज करें — अक्सर वह समय नहीं होता जब आप दर्ज करते हैं।`,
  } as Line,
})

/** Appended when the outstanding dose is chemotherapy or anti-seizure. */
export const EVENING_SERIOUS: Line = {
  en: 'If it was not given, record that instead. Never double the next dose.',
  hi: 'अगर नहीं दी गई, तो वही दर्ज करें। अगली खुराक कभी दोगुनी न करें।',
}

export const EVENING_MANY = (n: number, a: string, b: string) => ({
  title: {
    en: `${n} doses still to write down`,
    hi: `${n} खुराकें अभी दर्ज नहीं हुईं`,
  } as Line,
  body: {
    en:
      `${a}, ${b}${n > 2 ? ` and ${n - 2} more` : ''}. ` +
      'A missing entry does not prove a missed dose — record each one with the time it was actually given.',
    hi:
      `${a}, ${b}${n > 2 ? ` और ${n - 2} और` : ''}। ` +
      'दर्ज न होना यह साबित नहीं करता कि खुराक छूटी — हर एक को उसी समय के साथ दर्ज करें जब वह दी गई थी।',
  } as Line,
})

export const EVENING_ACTION: { one: Line; many: Line } = {
  one: { en: 'Log it', hi: 'दर्ज करें' },
  many: { en: 'Review', hi: 'देखें' },
}

// ------------------------------------------------------------ weight ----

export const WEIGHT_DUE = (days: number | null) => ({
  title: { en: 'The scale would like a word', hi: 'तराज़ू आपको याद कर रहा है' } as Line,
  body: {
    en:
      (days === null
        ? 'No weight has been recorded yet. One reading now gives every later one something to be measured against. '
        : `${days} ${days === 1 ? 'day' : 'days'} since the last weight. `) +
      'Before breakfast, same scale, same clothes — that is the whole method.',
    hi:
      (days === null
        ? 'अभी तक कोई वज़न दर्ज नहीं हुआ। अभी एक रीडिंग लेने से आगे की हर रीडिंग को एक आधार मिल जाएगा। '
        : `पिछले वज़न को ${days} दिन हो गए। `) +
      'नाश्ते से पहले, वही तराज़ू, वही कपड़े — बस इतना ही तरीका है।',
  } as Line,
})

/** The 5%-below-baseline flag is up, so the humour goes away entirely. */
export const WEIGHT_FLAGGED = (kg: string, percent: string) => ({
  title: { en: 'Weekly weight', hi: 'साप्ताहिक वज़न' } as Line,
  body: {
    en: `The last reading was ${kg} kg, ${percent} from baseline. A fresh number helps the treating team see the trend. This is an observation, not advice.`,
    hi: `पिछली रीडिंग ${kg} kg थी, बेसलाइन से ${percent}। एक ताज़ा रीडिंग से टीम को रुझान दिखता है। यह एक अवलोकन है, सलाह नहीं।`,
  } as Line,
})

export const WEIGHT_ACTION: Line = { en: 'Log weight', hi: 'वज़न दर्ज करें' }

// ------------------------------------------------------------ bloods ----

export const BLOODS = {
  tomorrow: {
    title: { en: 'Blood tests tomorrow', hi: 'कल खून की जाँच' } as Line,
    body: {
      en: 'The 15 September sheet says: review after 7 days with CBC, S. creatinine and SGPT. Carry the prescription. Confirm the exact date and any fasting with the treating team.',
      hi: '15 सितम्बर की पर्ची पर लिखा है: 7 दिन बाद CBC, S. creatinine और SGPT के साथ समीक्षा। पर्ची साथ ले जाएँ। सही तारीख़ और खाली पेट की ज़रूरत टीम से पुष्टि करें।',
    } as Line,
  },
  today: {
    title: { en: 'Blood tests today', hi: 'आज खून की जाँच' } as Line,
    body: {
      en: 'CBC, S. creatinine and SGPT, as written on the 15 September sheet. The counts are the reason these tests were asked for.',
      hi: 'CBC, S. creatinine और SGPT — जैसा 15 सितम्बर की पर्ची पर लिखा है। कीमोथेरेपी के दौरान गिनती देखने के लिए ही ये जाँचें माँगी गई हैं।',
    } as Line,
  },
}

export const BLOODS_ACTION: Line = { en: 'Open the chart', hi: 'चार्ट खोलें' }

// -------------------------------------------------------- milestones ----

export const MILESTONES: Record<number, { title: Line; body: (taken: number, perfect: number) => Line }> = {
  1: {
    title: { en: 'Day 1 of 42', hi: '42 में से दिन 1' },
    body: () => ({
      en: 'The course starts today. One day at a time — the chart keeps the count for you.',
      hi: 'कोर्स आज शुरू होता है। एक दिन में एक कदम — गिनती चार्ट रख लेगा।',
    }),
  },
  7: {
    title: { en: 'A week in — day 7 of 42', hi: 'एक हफ़्ता पूरा — 42 में से दिन 7' },
    body: (_t, perfect) => ({
      en: `Six weeks is a long road and one of them is behind you. ${perfect} of the last 7 days had every dose written down.`,
      hi: `छह हफ़्तों का रास्ता है, एक हफ़्ता पीछे छूट गया। पिछले 7 दिनों में से ${perfect} दिन हर खुराक दर्ज थी।`,
    }),
  },
  14: {
    title: { en: 'Day 14 of 42 — a third of the way', hi: '42 में से दिन 14 — एक तिहाई रास्ता' },
    body: (taken) => ({
      en: `Fourteen down. ${taken} doses written down since 15 September.`,
      hi: `चौदह पूरे। 15 सितम्बर से अब तक ${taken} खुराकें दर्ज हैं।`,
    }),
  },
  21: {
    title: { en: 'Day 21 of 42. Halfway.', hi: '42 में से दिन 21। आधा रास्ता।' },
    body: () => ({
      en: 'Twenty-one down, twenty-one to go. The hard half is the one already behind you.',
      hi: 'इक्कीस पूरे, इक्कीस बाकी। मुश्किल आधा हिस्सा पीछे छूट चुका है।',
    }),
  },
  28: {
    title: { en: 'Day 28 of 42 — two thirds', hi: '42 में से दिन 28 — दो तिहाई' },
    body: () => ({
      en: 'Four weeks of this, logged. Keep going exactly as you have been.',
      hi: 'चार हफ़्ते, पूरे दर्ज। बस ऐसे ही चलते रहें।',
    }),
  },
  35: {
    title: { en: 'Day 35 of 42. One week left.', hi: '42 में से दिन 35। एक हफ़्ता बाकी।' },
    body: () => ({
      en: 'Seven more days on the chart. The end of the course is a review date, not a finish line — ask what comes next.',
      hi: 'चार्ट पर सात दिन और। कोर्स का अंत एक समीक्षा की तारीख़ है, अंत नहीं — पूछें कि आगे क्या है।',
    }),
  },
  42: {
    title: { en: 'Day 42 of 42 — the last scheduled day', hi: '42 में से दिन 42 — आख़िरी निर्धारित दिन' },
    body: () => ({
      en: 'The last of the forty-two. Ask the treating team what continues, what stops, and when the next review is. Nothing should be stopped without them.',
      hi: 'बयालीस में से आख़िरी। टीम से पूछें कि क्या जारी रहेगा, क्या बंद होगा, और अगली समीक्षा कब है। उनके बिना कुछ भी बंद न करें।',
    }),
  },
}

/** Appended to a milestone when the whole of the last week was recorded. */
export const STREAK: Line = {
  en: 'Seven days in a row with every dose written down. That is quietly excellent.',
  hi: 'लगातार सात दिन, हर खुराक दर्ज। यह चुपचाप कमाल है।',
}

export const OPEN_TODAY: Line = { en: 'Open today', hi: 'आज खोलें' }

// -------------------------------------------------------------- test ----

export const TEST = {
  title: { en: 'Test notification', hi: 'परीक्षण सूचना' } as Line,
  body: {
    en: 'This is how an alert looks on this phone. Nothing was recorded.',
    hi: 'इस फ़ोन पर सूचना ऐसी दिखेगी। कुछ भी दर्ज नहीं हुआ।',
  } as Line,
}

// --------------------------------------------------- action responses ----

export const ALREADY_ANSWERED: Line = {
  en: 'Already answered on another phone. Nothing was changed.',
  hi: 'दूसरे फ़ोन पर पहले ही उत्तर दिया जा चुका है। कुछ नहीं बदला।',
}

export const STALE: Line = {
  en: 'That alert was for an earlier day. Opening the app instead.',
  hi: 'वह सूचना पिछले दिन की थी। इसके बजाय ऐप खोला जा रहा है।',
}
