export interface Facility {
  id: string
  name: string
  cms_id: string
  slug: string
  email_contacts: string[]
  passcode: string
  active: boolean
}

export interface FacilityDepartment {
  id: string
  facility_id: string
  cc1_group: string
  cc2_name: string
  included: boolean
}

export interface DailyEmpeon {
  facility_id: string
  date: string
  cc2_name: string
  reg_hours: number
  ot_hours: number
}

export interface DailyShiftKey {
  facility_id: string
  date: string
  specialty: string
  hours: number
}

export interface DailyCensus {
  facility_id: string
  date: string
  census: number
}

export interface ReportDay {
  date: string
  dayNum: number
  dow: string
  census: number | null
  empeon: Record<string, { reg: number; ot: number }>
  shiftkey: Record<string, number> // specialty -> hours
}

export interface ReportData {
  facility: Facility
  cycleStart: string
  cycleEnd: string
  currentDay: number
  days: ReportDay[]
}