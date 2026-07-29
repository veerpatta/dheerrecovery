'use client'

import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import type { Band } from '@/lib/bp'
import type { DoseRecord } from '@/db/schema'
import type { MedicineWithSlots } from '@/lib/queries'
import { useChrome } from './chrome'
import { DoseTimeSheet } from './dose-time-sheet'

/**
 * The bottom sheets, loaded only when one is actually opened.
 *
 * All four used to be mounted on every route. They render `null` until opened,
 * so they cost nothing to look at — but the JavaScript still shipped, parsed
 * and hydrated on the safety page, the chart, everywhere. That was the bulk of
 * the shell layout chunk, against a page chunk half its size.
 *
 * Note that `dynamic()` alone would not have fixed it: a sheet that is always
 * rendered still pulls its chunk down, even when it returns `null`. The saving
 * comes from not rendering it at all until `sheet` names it.
 *
 * DoseTimeSheet is the exception and is imported eagerly. It opens on every
 * "Taken" tap — the one interaction that has to feel instant — so it is the
 * one sheet that must never wait on a network fetch. It is also the smallest.
 */
const SosSheet = dynamic(() => import('./sos-drawer').then((m) => m.SosSheet))
const BpSheet = dynamic(() => import('./bp-sheet').then((m) => m.BpSheet))
const AddMedicineSheet = dynamic(() =>
  import('./add-medicine-sheet').then((m) => m.AddMedicineSheet),
)

export function SheetHost({
  sos,
  sosRecords,
  band,
  lastReadingAt,
}: {
  sos: MedicineWithSlots[]
  sosRecords: DoseRecord[]
  band: Band
  lastReadingAt: Date | string | null
}) {
  const { sheet } = useChrome()

  /*
   * Fetch the three lazy chunks once the browser is otherwise idle. Gating on
   * open keeps them off the critical path; warming them here means the tap
   * that opens one is still instant, because the chunk is already in cache.
   * Same module specifiers as the `dynamic()` calls above, so this is the
   * same chunk rather than a second copy.
   */
  useEffect(() => {
    const warm = () => {
      void import('./sos-drawer')
      void import('./bp-sheet')
      void import('./add-medicine-sheet')
    }
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(warm, { timeout: 3000 })
      return () => window.cancelIdleCallback(id)
    }
    const id = setTimeout(warm, 1500)
    return () => clearTimeout(id)
  }, [])

  return (
    <>
      {sheet === 'sos' ? <SosSheet medicines={sos} records={sosRecords} /> : null}
      {sheet === 'bp' ? <BpSheet band={band} lastReadingAt={lastReadingAt} /> : null}
      {sheet === 'add' ? <AddMedicineSheet /> : null}
      <DoseTimeSheet />
    </>
  )
}
