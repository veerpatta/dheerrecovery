export type Lang = 'en' | 'hi'

/**
 * UI chrome is bilingual. Clinical text (dose, caution, doctor's wording) is
 * deliberately NOT translated — it is shown exactly as prescribed, with the
 * Hindi prescription summary carried separately as `prescriptionHi`.
 */
export const STRINGS = {
  today: { en: 'Today', hi: 'आज' },
  todaysMedicines: { en: 'Today’s medicines', hi: 'आज की दवाइयाँ' },
  fullChart: { en: 'Full chart', hi: 'पूरा चार्ट' },
  historyExport: { en: 'History & export', hi: 'इतिहास और निर्यात' },
  safety: { en: 'Safety', hi: 'सुरक्षा' },
  recoveryLogs: { en: 'Recovery logs', hi: 'रिकवरी रिकॉर्ड' },
  timesAlerts: { en: 'Times & alerts', hi: 'समय और अलर्ट' },
  taken: { en: 'Taken', hi: 'ले ली' },
  skip: { en: 'Skip', hi: 'छोड़ें' },
  undo: { en: 'Undo', hi: 'वापस लें' },
  logBp: { en: 'Log BP', hi: 'BP दर्ज करें' },
  addMedicine: { en: 'Add medicine', hi: 'दवा जोड़ें' },
  scheduledTime: { en: 'Scheduled time', hi: 'निर्धारित समय' },
  needsReview: { en: 'Needs review', hi: 'जाँच बाकी' },
  upcoming: { en: 'Upcoming', hi: 'आने वाली' },
  notRecorded: { en: 'Not recorded', hi: 'दर्ज नहीं' },
  skipped: { en: 'Skipped', hi: 'छोड़ी गई' },
  sos: { en: 'SOS', hi: 'SOS' },
  emergency: { en: 'Call emergency help', hi: 'आपातकालीन सहायता' },
  save: { en: 'Save', hi: 'सहेजें' },
  cancel: { en: 'Cancel', hi: 'रद्द करें' },
  systolic: { en: 'Systolic', hi: 'सिस्टोलिक' },
  diastolic: { en: 'Diastolic', hi: 'डायस्टोलिक' },
  pulse: { en: 'Pulse', hi: 'नाड़ी' },
  noReadingYet: { en: 'No reading yet', hi: 'अभी कोई रीडिंग नहीं' },
  sevenDayAvg: { en: '7-day avg', hi: '7-दिन औसत' },
  seizureWatch: { en: 'Seizure watch', hi: 'दौरे की निगरानी' },
  caregiverNotes: { en: 'Caregiver notes', hi: 'देखभाल टिप्पणियाँ' },
  familySync: { en: 'Family sync', hi: 'परिवार सिंक' },
  syncCode: { en: 'Family sync code', hi: 'परिवार सिंक कोड' },
} as const

export type StringKey = keyof typeof STRINGS

export function t(key: StringKey, lang: Lang): string {
  return STRINGS[key][lang]
}
