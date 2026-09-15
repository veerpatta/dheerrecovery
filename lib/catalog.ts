/**
 * Medicine catalogue transcribed from Dr Ajit Singh's Paras Hospitals
 * prescription dated 28 July 2026, plus the earlier 20 July 2026 hospital
 * discharge guide for the SOS entries, plus Dr Ankit Agarwal's Geetanjali
 * Cancer Centre chemoradiation sheet dated 15 September 2026.
 *
 * Clinical wording is copied verbatim from the source prescription sheet and
 * must not be paraphrased. Reminder clock times are a caregiver organiser —
 * only Betacap's 8:00 AM is explicitly printed on either prescription.
 *
 * The header constants below still name the 28 July sheet. They describe the
 * care record as a whole and are printed as one line in the report header, so
 * the newer sheet's provenance is carried per-medicine in `prescribedAt`
 * instead — which is what that field is for.
 */

export const PRESCRIPTION_VERSION = 'paras-ajit-singh-2026-07-28'
export const PRESCRIPTION_DATE = '2026-07-28'
export const PRESCRIBER = 'Dr Ajit Singh'
export const PATIENT_NAME = 'Dheer'

/**
 * The chemoradiation course from the 15 September 2026 Geetanjali sheet:
 * "42 days with RT". Forty-two days counted inclusively from the sheet's own
 * date, so 15 September through 26 October 2026.
 */
export const RT_COURSE_START = '2026-09-15'
export const RT_COURSE_END = '2026-10-26'
export const RT_PRESCRIBED_AT = 'Geetanjali Cancer Centre · 15 Sep 2026'

export type Tone = 'recovery' | 'seizure' | 'bp' | 'comfort' | 'chemo'
export type Kind = 'routine' | 'sos'
export type SosStatus = 'current' | 'previous' | 'supportive'

export interface CatalogSlot {
  key: string
  time: string
  label: string
}

export interface CatalogMedicine {
  id: string
  brand: string
  generic: string
  dose: string
  form: string
  purpose: string
  prescription: string
  prescriptionHi: string
  courseDays: number | null
  slots: CatalogSlot[]
  /**
   * Hours the prescription expects between consecutive doses. Set only where
   * the spacing is clinically load-bearing — the two anti-seizure medicines.
   * The prescription prints "morning and evening" without clock times, so an
   * even 12-hour split is the caregiver reading of that.
   */
  dosingIntervalHours?: number
  /**
   * Which days this medicine is due on. Absent means every day, forever, which
   * is what the whole 28 July prescription is. See `db/schema.ts` for the
   * column comments and `lib/schedule.ts` for how the three compose.
   */
  courseStartDate?: string
  courseEndDate?: string
  /** ISO-8601 weekdays, comma-joined: Monday = 1 … Sunday = 7. */
  weekdays?: string
  /** Due only on a day the caregiver has answered "yes, therapy today". */
  therapyOnly?: boolean
  tone: Tone
  kind: Kind
  sosStatus?: SosStatus
  symptom?: string
  repeatableLog?: boolean
  food: string
  prescribedAt: string
  doctorNote: string
  instruction: string
  caution: string
  verify: string
}

export const CATALOG: CatalogMedicine[] = [
  {
    id: 'pantocid',
    brand: 'Pantocid‑DSR 40/30',
    generic: 'Pantoprazole 40 mg + domperidone 30 mg',
    dose: '1 capsule · 40 mg + 30 mg',
    form: 'Capsule',
    purpose: 'Reduces stomach acid and helps nausea / stomach emptying',
    prescription: 'Once daily · morning · 1 month',
    prescriptionHi: 'रोज़ 1 बार · सुबह · 1 महीना',
    courseDays: 30,
    slots: [{ key: 'am', time: '07:00', label: 'Morning · reminder time' }],
    tone: 'recovery',
    kind: 'routine',
    food: 'Prescription says “as directed.” These ingredients are commonly taken before food; confirm the exact gap on the strip or with the pharmacist.',
    prescribedAt: 'Paras Hospitals · 28 Jul 2026',
    doctorNote: 'Morning; food timing not printed.',
    instruction:
      'Swallow whole. Use the pharmacy label if it gives a specific before-food interval.',
    caution:
      'Domperidone can affect heart rhythm. Seek advice for palpitations, fainting or unusual dizziness.',
    verify: 'Confirm whether the pack is a capsule and the exact before-breakfast timing.',
  },
  {
    id: 'lacoset',
    brand: 'Lacoset 100',
    generic: 'Lacosamide 100 mg',
    dose: '1 tablet · 100 mg',
    form: 'Tablet',
    purpose: 'Anti-seizure medicine; helps prevent seizures',
    prescription: 'Twice daily · morning and evening · 1 month',
    prescriptionHi:
      'दिन में 2 बार · सुबह और शाम · 1 महीना',
    courseDays: 30,
    slots: [
      { key: 'am', time: '08:00', label: 'Morning' },
      { key: 'pm', time: '20:00', label: 'Evening' },
    ],
    dosingIntervalHours: 12,
    tone: 'seizure',
    kind: 'routine',
    food: 'May be taken with or without food; keep the routine consistent.',
    prescribedAt: 'Paras Hospitals · 28 Jul 2026',
    doctorNote: 'Morning and evening; exact clock times not printed.',
    instruction: 'Swallow whole and take at the same times each day.',
    caution:
      'May cause dizziness or double vision. Do not stop suddenly or change the dose without the prescriber.',
    verify: 'Match Lacoset 100 mg on the strip before every dose.',
  },
  {
    id: 'valprol',
    brand: 'Valprol CR 500',
    generic: 'Sodium valproate controlled-release 500 mg',
    dose: '1 CR tablet · 500 mg',
    form: 'Controlled-release tablet',
    purpose: 'Anti-seizure medicine; helps prevent seizures',
    prescription: 'Twice daily · morning and evening · 1 month',
    prescriptionHi:
      'दिन में 2 बार · सुबह और शाम · 1 महीना',
    courseDays: 30,
    slots: [
      { key: 'am', time: '08:00', label: 'Morning' },
      { key: 'pm', time: '20:00', label: 'Evening' },
    ],
    dosingIntervalHours: 12,
    tone: 'seizure',
    kind: 'routine',
    food: 'May be taken with or without food; take it the same way each day.',
    prescribedAt: 'Paras Hospitals · 28 Jul 2026',
    doctorNote: 'Morning and evening; exact clock times not printed.',
    instruction: 'Swallow the CR tablet whole; do not crush or chew.',
    caution:
      'Do not stop suddenly. Seek prompt advice for severe vomiting, unusual drowsiness, jaundice or worsening seizures.',
    verify:
      'Match Valprol CR 500 mg on the strip; do not substitute a different valproate form.',
  },
  {
    id: 'betacap',
    brand: 'Betacap TR 40',
    generic: 'Propranolol 40 mg modified-release',
    dose: '1 TR tablet · 40 mg',
    form: 'Modified-release tablet',
    purpose:
      'Often used for headache prevention, tremor or heart-rate control; the exact reason is not printed',
    prescription: 'Once daily · 8:00 AM · 1 month',
    prescriptionHi:
      'रोज़ 1 बार · सुबह 8 बजे · 1 महीना',
    courseDays: 30,
    slots: [{ key: 'am', time: '08:00', label: '8:00 AM · printed time' }],
    tone: 'bp',
    kind: 'routine',
    food: 'Food timing is not printed. Take it consistently in relation to meals and follow the strip/pharmacist instructions.',
    prescribedAt: 'Paras Hospitals · 28 Jul 2026',
    doctorNote: 'Remarks: 8 AM.',
    instruction: 'Take at 8:00 AM. Swallow the modified-release tablet whole.',
    caution:
      'Can lower pulse and blood pressure. Do not stop suddenly; seek advice for fainting, wheezing or a very slow pulse with symptoms.',
    verify: 'Confirm the TR / modified-release form on the strip.',
  },
  {
    id: 'tryptomer',
    brand: 'Tryptomer 10',
    generic: 'Amitriptyline 10 mg',
    dose: '1 tablet · 10 mg',
    form: 'Tablet',
    purpose:
      'Often used for nerve pain or headache prevention; may also improve sleep',
    prescription: 'Once daily · night · 1 month',
    prescriptionHi: 'रोज़ 1 बार · रात · 1 महीना',
    courseDays: 30,
    slots: [{ key: 'pm', time: '21:30', label: 'Night' }],
    tone: 'comfort',
    kind: 'routine',
    food: 'May be taken with or without food; the prescription only specifies night.',
    prescribedAt: 'Paras Hospitals · 28 Jul 2026',
    doctorNote: 'Night; exact clock time not printed.',
    instruction:
      'Take at night because it can cause sleepiness. Use the reminder time that best matches the doctor’s advice.',
    caution:
      'May cause drowsiness, dry mouth, constipation or dizziness. Avoid driving if sleepy and do not stop suddenly.',
    verify: 'Confirm Tryptomer 10 mg on the strip.',
  },

  // ------------------------------- chemoradiation · 15 Sep 2026 sheet ----

  {
    id: 'temozolomide',
    brand: 'Temozolomide 140 mg',
    generic: 'Temozolomide · dispensed as 100 mg + 40 mg',
    dose: '140 mg · 100 mg capsule + 40 mg capsule',
    form: 'Capsule',
    purpose: 'Chemotherapy given alongside the radiotherapy course',
    prescription: 'Once daily on a radiotherapy day · 42 days · with RT',
    prescriptionHi:
      'रेडियोथेरेपी वाले दिन रोज़ 1 बार · 42 दिन · RT के साथ',
    courseDays: 42,
    courseStartDate: RT_COURSE_START,
    courseEndDate: RT_COURSE_END,
    therapyOnly: true,
    slots: [
      {
        key: 'am',
        time: '07:55',
        label: 'Therapy day · about 1 hour before radiotherapy',
      },
    ],
    tone: 'chemo',
    kind: 'routine',
    // Deliberately says only that the rule is missing. An earlier draft named
    // the empty-stomach gap here while asking about it, and `foodRuleOf`
    // condensed that into an "Empty stomach" chip — a directive the sheet
    // never gave. The question belongs in `verify`, which already asks it.
    food: 'Food timing is not printed on the 15 September sheet.',
    prescribedAt: RT_PRESCRIBED_AT,
    doctorNote:
      'Rx: Cap. Temozolomide 140 mg OD 42 days with RT (100+40). Review after 7 days with CBC, S. creatinine, SGPT.',
    instruction:
      'Two capsules make up the 140 mg dose — 100 mg and 40 mg together. Give only on a day radiotherapy is actually going ahead, and log it after it was swallowed.',
    caution:
      'This is chemotherapy and it lowers blood counts. Urgent advice for fever, chills, a sore throat, mouth ulcers, unusual bruising or bleeding, or persistent vomiting that stops the dose staying down. Do not double up for a missed day.',
    verify:
      'Confirm the 100 mg + 40 mg capsule pairing, whether the capsule is swallowed whole or may be opened, the empty-stomach gap before radiotherapy, and what to do on a day radiotherapy is cancelled.',
  },
  {
    id: 'perinorm',
    brand: 'Perinorm 10',
    generic: 'Metoclopramide 10 mg',
    dose: '1 tablet · 10 mg',
    form: 'Tablet',
    purpose: 'Prevents and settles nausea and vomiting during the course',
    prescription: 'Twice daily · morning and night · 42 days',
    prescriptionHi: 'दिन में 2 बार · सुबह और रात · 42 दिन',
    courseDays: 42,
    courseStartDate: RT_COURSE_START,
    courseEndDate: RT_COURSE_END,
    slots: [
      {
        key: 'am',
        time: '07:30',
        label: 'Morning · about 30 minutes before the capsule',
      },
      { key: 'pm', time: '21:00', label: 'Night' },
    ],
    tone: 'comfort',
    kind: 'routine',
    food: 'Commonly taken before food so it is working by the time the capsule is given; the 15 September sheet does not print a food rule. Confirm the gap with the treating team.',
    prescribedAt: RT_PRESCRIBED_AT,
    doctorNote: 'Rx: T. Perinorm (10) 1–0–1.',
    instruction:
      'Given every day of the 42, whether or not there is radiotherapy that day.',
    caution:
      'Can cause restlessness, muscle stiffness or unusual movements of the face, neck or eyes. Stop and seek advice the same day if any of those appear. Also causes drowsiness.',
    verify:
      'Confirm how many days in a row Perinorm should be continued, and whether it should be taken before food and how long before the capsule.',
  },
  {
    id: 'septran-ds',
    brand: 'Septran DS',
    generic: 'Sulfamethoxazole 800 mg + trimethoprim 160 mg',
    dose: '1 tablet · 800 mg + 160 mg',
    form: 'Double-strength tablet',
    purpose:
      'Prevents a chest infection while the blood counts are low during chemoradiation',
    prescription: 'Twice daily · Mondays and Thursdays only · 42 days',
    prescriptionHi:
      'दिन में 2 बार · केवल सोमवार और गुरुवार · 42 दिन',
    courseDays: 42,
    courseStartDate: RT_COURSE_START,
    courseEndDate: RT_COURSE_END,
    weekdays: '1,4',
    slots: [
      { key: 'am', time: '08:00', label: 'Monday & Thursday · morning' },
      { key: 'pm', time: '20:00', label: 'Monday & Thursday · evening' },
    ],
    tone: 'recovery',
    kind: 'routine',
    food: 'Take with food and a full glass of water. The 15 September sheet does not print a food rule; this is the usual advice for the tablet and should be confirmed.',
    prescribedAt: RT_PRESCRIBED_AT,
    doctorNote: 'Rx: T. Septran-DS 1–0–1 (Mon / Thursday).',
    instruction:
      'Only on Mondays and Thursdays — not the other five days. Both tablets are given on each of those two days.',
    caution:
      'This is a sulfa medicine. Stop and seek advice the same day for any rash, mouth ulcers, or peeling skin. Keep fluids up.',
    verify:
      'The sheet prints "Septran-DS" without a strength. Confirm the tablet is the 800 mg + 160 mg double-strength one, and confirm the Monday and Thursday pattern.',
  },

  // ---------------------------------------------------------------- SOS ----
  {
    id: 'napra-d',
    brand: 'Napra‑D 500/10',
    generic: 'Naproxen 500 mg + domperidone 10 mg',
    dose: '1 tablet · 500 mg + 10 mg',
    form: 'Tablet',
    purpose:
      'SOS relief commonly used for pain / headache with nausea; the exact trigger is not printed',
    prescription: 'SOS only · one tablet when the doctor’s condition applies',
    prescriptionHi:
      'केवल SOS · डॉक्टर की बताई स्थिति में 1 गोली',
    courseDays: 30,
    slots: [],
    tone: 'comfort',
    kind: 'sos',
    sosStatus: 'current',
    symptom: 'Headache / pain with nausea',
    food: 'The prescription says only “SOS.” The one-page guide says to give it with or after food.',
    prescribedAt: 'Paras Hospitals · 28 Jul 2026',
    doctorNote:
      'Remarks: SOS. No trigger, minimum interval or daily maximum is printed.',
    instruction:
      'Keep outside the routine pill schedule. Log it only after it is actually taken.',
    caution:
      'Do not repeat the same day without doctor or pharmacist advice. Do not combine with ibuprofen, diclofenac, aspirin for pain, or another naproxen.',
    verify:
      'Ask the treating team what symptom triggers SOS use, the minimum gap, and the maximum tablets in 24 hours.',
  },
  {
    id: 'centnil-t',
    brand: 'Centnil T',
    generic: 'Blood-pressure tablet · composition not captured',
    dose: '1 tablet · strength not printed',
    form: 'Tablet',
    purpose: 'SOS use for a high blood-pressure reading',
    prescription: 'SOS only · confirm the triggering reading before giving',
    prescriptionHi: 'केवल SOS · देने से पहले रीडिंग की पुष्टि करें',
    courseDays: null,
    slots: [],
    tone: 'bp',
    kind: 'sos',
    sosStatus: 'current',
    symptom: 'High blood pressure',
    food: 'Food timing was not captured. Ask the treating team whether it should be given with or after food.',
    prescribedAt: 'Added by caregiver · not transcribed from the 28 July sheet',
    doctorNote:
      'The strength, the reading that triggers a dose, the minimum gap and the daily maximum were not recorded when this was added.',
    instruction:
      'Take a blood-pressure reading first and log it, so the reading that prompted the dose sits beside it in the record. Log the dose only after it was actually given.',
    caution:
      'Do not repeat without the treating team’s advice, and do not combine with another blood-pressure tablet unless they have said to. Urgent review for chest pain, breathlessness, one-sided weakness, slurred speech, a severe headache or fainting.',
    verify:
      'Confirm the strength, the blood-pressure reading that triggers a dose, the minimum gap and the maximum tablets in 24 hours with the treating team.',
  },
  {
    id: 'zytee-gel-la',
    brand: 'Zytee Gel LA',
    generic: 'Previous mouth-gel instruction · ingredients not printed on this sheet',
    dose: 'Thin local layer · amount not printed',
    form: 'Oral gel',
    purpose: 'Previous instruction for mouth soreness or a tongue bite',
    prescription: 'Previous discharge instruction · twice daily · confirm before using',
    prescriptionHi:
      'पुराना निर्देश · उपयोग से पहले डॉक्टर से पुष्टि करें',
    courseDays: null,
    slots: [],
    tone: 'comfort',
    kind: 'sos',
    sosStatus: 'previous',
    symptom: 'Mouth soreness / tongue bite',
    repeatableLog: true,
    food: 'Not food-related. Apply only to the affected mouth area if the treating team confirms it is still active.',
    prescribedAt: 'Hospital discharge guide · 20 Jul 2026',
    doctorNote: 'Amount and duration were not printed. Do not deliberately swallow.',
    instruction:
      'This is an old instruction, not part of the 28 July prescription. Log only after it was actually used.',
    caution:
      'Not for sudden mouth, lip or tongue swelling, hives, throat tightness, trouble swallowing or breathing — those need emergency help.',
    verify: 'Confirm current permission, the amount, duration and exact product before using.',
  },
  {
    id: 'dolo-old',
    brand: 'Dolo',
    generic: 'Paracetamol brand · exact strength not printed',
    dose: '1 tablet · strength unknown',
    form: 'Tablet',
    purpose: 'Previous discharge SOS instruction for fever',
    prescription: 'Previous discharge instruction · after food · confirm before using',
    prescriptionHi:
      'पुराना निर्देश · उपयोग से पहले डॉक्टर से पुष्टि करें',
    courseDays: null,
    slots: [],
    tone: 'comfort',
    kind: 'sos',
    sosStatus: 'previous',
    symptom: 'Fever',
    food: 'The previous instruction said after food.',
    prescribedAt: 'Hospital discharge guide · 20 Jul 2026',
    doctorNote:
      'The strength was missing and Dolo is not on the 28 July prescription.',
    instruction:
      'Log only after the exact strength and current permission were confirmed and the tablet was actually taken.',
    caution: 'Do not combine with another paracetamol product.',
    verify:
      'Confirm whether the tablet is 500 mg, 650 mg or another strength and that it is still permitted.',
  },
  {
    id: 'looz-old',
    brand: 'Looz syrup',
    generic: 'Previous constipation-syrup instruction',
    dose: '20 mL · measured dose',
    form: 'Syrup',
    purpose: 'Previous discharge instruction for constipation',
    prescription: 'Previous discharge instruction · bedtime · confirm before using',
    prescriptionHi:
      'पुराना निर्देश · उपयोग से पहले डॉक्टर से पुष्टि करें',
    courseDays: null,
    slots: [],
    tone: 'comfort',
    kind: 'sos',
    sosStatus: 'previous',
    symptom: 'Constipation',
    food: 'Food timing was not printed.',
    prescribedAt: 'Hospital discharge guide · 20 Jul 2026',
    doctorNote: '20 mL at bedtime was written previously; duration was not printed.',
    instruction:
      'Measure with the supplied cup or oral syringe. Log only after it was actually given.',
    caution: 'Do not give during loose motions.',
    verify:
      'Confirm that the previous instruction is still active and ask how many days to continue.',
  },
  {
    id: 'ors-support',
    brand: 'ORS / safe fluids',
    generic: 'Supportive loose-motions guide · no anti-diarrhoea medicine was listed',
    dose: 'Small frequent sips · packet directions',
    form: 'Supportive care',
    purpose:
      'Hydration support for loose motions while contacting the treating team',
    prescription: 'Supportive guide · not a scheduled medicine',
    prescriptionHi:
      'सहायक देखभाल · रोज़ की दवा नहीं',
    courseDays: null,
    slots: [],
    tone: 'recovery',
    kind: 'sos',
    sosStatus: 'supportive',
    symptom: 'Loose motions',
    repeatableLog: true,
    food: 'Prepare ORS exactly according to the packet and give in small frequent sips.',
    prescribedAt: 'One-page medicine guide · 28 Jul 2026',
    doctorNote:
      'No separate anti-diarrhoea medicine was found in the previous prescriptions.',
    instruction:
      'Continue safe fluids and contact the treating team the same day if stools repeat or medicines or fluids cannot be kept down.',
    caution:
      'Urgent review for blood or black stool, severe abdominal pain, repeated vomiting, fever, dizziness, very little urine, marked sleepiness or dehydration.',
    verify:
      'This logs supportive care only; it does not replace same-day medical advice when symptoms continue.',
  },
]

export const ROUTINE = CATALOG.filter((m) => m.kind === 'routine')
export const SOS = CATALOG.filter((m) => m.kind === 'sos')

/*
 * There is deliberately no DAILY_DOSE_COUNT constant. Once the chemoradiation
 * medicines joined the chart there is no single "doses in a day": inside the
 * 42-day course it is nine, ten, eleven or twelve depending on the weekday and
 * on whether radiotherapy happened, and seven outside it. Ask
 * `buildDaySchedule` for a date rather than reaching for a number.
 */

/** The 28 July prescription is written for one month. */
export const SUPPLY_DAYS = 30

/**
 * Active ingredient per single dose, keyed by `catalogId`. Used only to total
 * up what was actually recorded as taken, so a doctor can see intake at a
 * glance. Caregiver-added medicines have no entry — their intake card shows
 * the dose count without a salt breakdown rather than disappearing.
 */
export const SALTS: Record<string, { name: string; mg: number }[]> = {
  pantocid: [
    { name: 'Pantoprazole', mg: 40 },
    { name: 'Domperidone', mg: 30 },
  ],
  lacoset: [{ name: 'Lacosamide', mg: 100 }],
  valprol: [{ name: 'Sodium valproate', mg: 500 }],
  betacap: [{ name: 'Propranolol', mg: 40 }],
  tryptomer: [{ name: 'Amitriptyline', mg: 10 }],
  temozolomide: [{ name: 'Temozolomide', mg: 140 }],
  perinorm: [{ name: 'Metoclopramide', mg: 10 }],
  'septran-ds': [
    { name: 'Sulfamethoxazole', mg: 800 },
    { name: 'Trimethoprim', mg: 160 },
  ],
}

export const EMERGENCY_CONTACTS = [
  { label: 'Emergency reception', phone: '+91 91161 44111' },
  { label: 'Ambulance', phone: '+91 91161 44001' },
  { label: 'Hospital reception', phone: '+91 294 666 9999' },
]

export const EMERGENCY_TRIGGER =
  'Seizure lasting 5 minutes, repeated seizures without recovery, trouble breathing, chest pain, fainting, or new weakness / speech / vision difficulty.'

export const SAFETY_RULES = [
  {
    n: '01',
    title: 'Never double a missed dose',
    body: 'If it is close to the next dose, do not take two together. For missed Lacoset or Valprol, contact the treating team or pharmacist because anti-seizure medicines need medicine-specific advice.',
  },
  {
    n: '02',
    title: 'Do not abruptly stop daily medicines',
    body: 'Lacoset, Valprol, Tryptomer and Betacap can all need a supervised stopping plan. The prescription is for one month; arrange review before the supply runs out.',
  },
  {
    n: '03',
    title: 'Red SOS tab shows permission status',
    body: 'Napra‑D is the current SOS. Zytee Gel LA, Dolo and Looz are older discharge instructions and stay marked “confirm first.” Logging an item does not restart it.',
  },
  {
    n: '04',
    title: 'Watch for combined drowsiness',
    body: 'Lacoset, Valprol and Tryptomer may cause dizziness or sleepiness. Use extra care with walking, stairs and driving until the treating team says it is safe.',
  },
]

export const REVIEW_QUESTIONS = [
  'Continue, taper, or change each daily medicine?',
  'What exact symptom, minimum gap and daily maximum apply to Napra‑D?',
  'Are Zytee Gel LA, Dolo or Looz still permitted, and at what exact strength or duration?',
  'Are blood tests needed for Valprol?',
  'Should Temozolomide be given on a day radiotherapy is cancelled, and is the dose ever made up?',
  'How long should Perinorm continue, and what should prompt stopping it?',
  'Confirm Septran-DS is the 800 mg + 160 mg tablet, and that Mondays and Thursdays is right.',
  'What weight loss is worth calling about between reviews?',
]

export const REFERENCES = [
  { label: 'MedlinePlus: lacosamide', href: 'https://medlineplus.gov/druginfo/meds/a609028.html' },
  { label: 'NHS: sodium valproate', href: 'https://www.nhs.uk/medicines/sodium-valproate/' },
  { label: 'NHS: amitriptyline', href: 'https://www.nhs.uk/medicines/amitriptyline-for-depression/' },
  { label: 'NHS: domperidone', href: 'https://www.nhs.uk/medicines/domperidone/' },
  { label: 'MedlinePlus: naproxen', href: 'https://medlineplus.gov/druginfo/meds/a681029.html' },
]
