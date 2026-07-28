import ExcelJS from 'exceljs'
import { NextResponse } from 'next/server'
import { isValidCareCode } from '@/lib/care-code'
import {
  buildDaySchedule,
  findHousehold,
  getBpReadings,
  getCareNotes,
  getDoseRecords,
  getMedicines,
  getSeizureEvents,
} from '@/lib/queries'
import {
  addDays,
  careDate,
  dateRange,
  driftMinutes,
  prettyTime,
} from '@/lib/time'

export const dynamic = 'force-dynamic'

const HEADER_FILL = 'FF132238'

function styleHeader(sheet: ExcelJS.Worksheet) {
  const row = sheet.getRow(1)
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
  row.alignment = { vertical: 'middle' }
  row.height = 22
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params
  if (!isValidCareCode(code)) {
    return NextResponse.json({ error: 'Invalid care code.' }, { status: 400 })
  }

  const household = await findHousehold(code)
  if (!household) {
    return NextResponse.json({ error: 'Care record not found.' }, { status: 404 })
  }

  const url = new URL(request.url)
  const today = careDate()
  const isDate = (v: string | null) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)
  const to = isDate(url.searchParams.get('to')) ? url.searchParams.get('to')! : today
  const from = isDate(url.searchParams.get('from'))
    ? url.searchParams.get('from')!
    : addDays(to, -29)

  const [meds, records, readings, seizures, notes] = await Promise.all([
    getMedicines(household.id),
    getDoseRecords(household.id, from, to),
    getBpReadings(household.id, 1000),
    getSeizureEvents(household.id),
    getCareNotes(household.id),
  ])

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Dheer Recovery Medicines'
  wb.created = new Date()

  // ---------------------------------------------------------- 1. Chart ----
  const chart = wb.addWorksheet('Medicine chart')
  chart.columns = [
    { header: 'Medicine', key: 'brand', width: 24 },
    { header: 'Generic', key: 'generic', width: 34 },
    { header: 'Dose', key: 'dose', width: 24 },
    { header: 'Kind', key: 'kind', width: 10 },
    { header: 'SOS status', key: 'sos', width: 14 },
    { header: 'Prescribed', key: 'rx', width: 38 },
    { header: 'Reminder times', key: 'times', width: 20 },
    { header: 'Doctor wrote', key: 'note', width: 40 },
    { header: 'Food', key: 'food', width: 46 },
    { header: 'How', key: 'how', width: 46 },
    { header: 'Watch', key: 'watch', width: 52 },
    { header: 'Verify', key: 'verify', width: 52 },
    { header: 'Source', key: 'src', width: 30 },
  ]
  for (const m of meds) {
    chart.addRow({
      brand: m.brand,
      generic: m.generic ?? '',
      dose: m.dose,
      kind: m.kind,
      sos: m.sosStatus ?? '',
      rx: m.prescription ?? '',
      times: m.slots.map((s) => prettyTime(s.time)).join(' · '),
      note: m.doctorNote ?? '',
      food: m.food ?? '',
      how: m.instruction ?? '',
      watch: m.caution ?? '',
      verify: m.verify ?? '',
      src: m.prescribedAt ?? '',
    })
  }
  chart.eachRow((r, i) => {
    if (i > 1) r.alignment = { vertical: 'top', wrapText: true }
  })
  styleHeader(chart)

  // ----------------------------------------------------- 2. Dose ledger ----
  const ledger = wb.addWorksheet('Dose ledger')
  ledger.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Scheduled time', key: 'time', width: 15 },
    { header: 'Medicine', key: 'brand', width: 24 },
    { header: 'Dose', key: 'dose', width: 24 },
    { header: 'Slot label', key: 'label', width: 26 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Recorded at', key: 'taken', width: 20 },
    { header: 'Difference (min)', key: 'drift', width: 16 },
    { header: 'Note', key: 'note', width: 34 },
  ]
  for (const date of dateRange(from, to)) {
    for (const d of buildDaySchedule(meds, records, date)) {
      const drift =
        d.record?.takenAt && d.record.scheduledTime
          ? driftMinutes(date, d.record.scheduledTime, new Date(d.record.takenAt))
          : null
      ledger.addRow({
        date,
        time: prettyTime(d.time),
        brand: d.medicine.brand,
        dose: d.medicine.dose,
        label: d.label,
        status:
          d.status === 'not-recorded'
            ? 'Not recorded'
            : d.status.charAt(0).toUpperCase() + d.status.slice(1),
        taken: d.record?.takenAt
          ? new Date(d.record.takenAt).toLocaleString('en-GB', {
              timeZone: 'Asia/Kolkata',
            })
          : '',
        drift: drift ?? '',
        note: d.record?.note ?? '',
      })
    }
  }
  styleHeader(ledger)

  // ------------------------------------------------------- 3. SOS log ----
  const medById = new Map(meds.map((m) => [m.id, m]))
  const sosSheet = wb.addWorksheet('SOS log')
  sosSheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Recorded at', key: 'taken', width: 22 },
    { header: 'Medicine', key: 'brand', width: 24 },
    { header: 'Dose', key: 'dose', width: 26 },
    { header: 'Permission status', key: 'status', width: 18 },
    { header: 'Note', key: 'note', width: 40 },
  ]
  for (const r of records) {
    const m = medById.get(r.medicineId)
    if (!m || m.kind !== 'sos') continue
    sosSheet.addRow({
      date: r.doseDate,
      taken: r.takenAt
        ? new Date(r.takenAt).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' })
        : '',
      brand: m.brand,
      dose: m.dose,
      status: m.sosStatus ?? '',
      note: r.note ?? '',
    })
  }
  styleHeader(sosSheet)

  // -------------------------------------------------------- 4. BP log ----
  const bpSheet = wb.addWorksheet('BP log')
  bpSheet.columns = [
    { header: 'Measured at', key: 'at', width: 22 },
    { header: 'Systolic', key: 'sys', width: 10 },
    { header: 'Diastolic', key: 'dia', width: 10 },
    { header: 'Pulse', key: 'pulse', width: 10 },
    { header: 'Symptoms', key: 'sym', width: 36 },
    { header: 'Note', key: 'note', width: 36 },
  ]
  for (const r of readings) {
    bpSheet.addRow({
      at: new Date(r.measuredAt).toLocaleString('en-GB', {
        timeZone: 'Asia/Kolkata',
      }),
      sys: r.systolic,
      dia: r.diastolic,
      pulse: r.pulse ?? '',
      sym: r.symptoms ?? '',
      note: r.note ?? '',
    })
  }
  styleHeader(bpSheet)

  // ----------------------------------------- 5. Seizures & care notes ----
  const recovery = wb.addWorksheet('Recovery logs')
  recovery.columns = [
    { header: 'Type', key: 'type', width: 16 },
    { header: 'When', key: 'when', width: 22 },
    { header: 'Duration (min)', key: 'dur', width: 15 },
    { header: 'Recovery (min)', key: 'rec', width: 15 },
    { header: 'Detail', key: 'detail', width: 70 },
  ]
  for (const s of seizures) {
    recovery.addRow({
      type: 'Seizure',
      when: new Date(s.occurredAt).toLocaleString('en-GB', {
        timeZone: 'Asia/Kolkata',
      }),
      dur: s.durationMinutes ?? '',
      rec: s.recoveryMinutes ?? '',
      detail: s.description ?? '',
    })
  }
  for (const n of notes) {
    recovery.addRow({
      type: 'Caregiver note',
      when: new Date(n.createdAt).toLocaleString('en-GB', {
        timeZone: 'Asia/Kolkata',
      }),
      dur: '',
      rec: '',
      detail: n.body,
    })
  }
  recovery.eachRow((r, i) => {
    if (i > 1) r.alignment = { vertical: 'top', wrapText: true }
  })
  styleHeader(recovery)

  const buffer = await wb.xlsx.writeBuffer()
  const filename = `dheer-recovery-${from}-to-${to}.xlsx`

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'content-type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  })
}
