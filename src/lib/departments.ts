export const ALL_DEPARTMENTS: { cc1_group: string; cc2_name: string }[] = [
  { cc1_group: 'Nursing', cc2_name: 'DON' },
  { cc1_group: 'Nursing', cc2_name: 'ADON' },
  { cc1_group: 'Nursing', cc2_name: 'MDS' },
  { cc1_group: 'Nursing', cc2_name: 'Wound Nurse' },
  { cc1_group: 'Nursing', cc2_name: 'Corporate Nurse' },
  { cc1_group: 'Nursing', cc2_name: 'Staffing Coordinator CNA' },
  { cc1_group: 'Nursing', cc2_name: 'Staffing Coordinator LVN' },
  { cc1_group: 'Nursing', cc2_name: 'Infection Control' },
  { cc1_group: 'Nursing', cc2_name: 'RN' },
  { cc1_group: 'Nursing', cc2_name: 'LVN' },
  { cc1_group: 'Nursing', cc2_name: 'CMT' },
  { cc1_group: 'Nursing', cc2_name: 'CNA' },
  { cc1_group: 'Rehab', cc2_name: 'Rehab Director' },
  { cc1_group: 'Rehab', cc2_name: 'Physical Therapist' },
  { cc1_group: 'Rehab', cc2_name: 'PTA' },
  { cc1_group: 'Rehab', cc2_name: 'Occupational Therapist' },
  { cc1_group: 'Rehab', cc2_name: 'COTA' },
  { cc1_group: 'Rehab', cc2_name: 'Speech Therapist' },
  { cc1_group: 'Dietary', cc2_name: 'Food Service Director' },
  { cc1_group: 'Dietary', cc2_name: 'Cook' },
  { cc1_group: 'Dietary', cc2_name: 'Dietary Aide' },
  { cc1_group: 'Dietary', cc2_name: 'Dietary' },
  { cc1_group: 'Dietary', cc2_name: 'Assistant Dietary Manager' },
  { cc1_group: 'Housekeeping/Laundry', cc2_name: 'Housekeeping/Laundry Director' },
  { cc1_group: 'Housekeeping/Laundry', cc2_name: 'Housekeeping' },
  { cc1_group: 'Housekeeping/Laundry', cc2_name: 'Laundry' },
  { cc1_group: 'Maintenance', cc2_name: 'Maintenance Director' },
  { cc1_group: 'Maintenance', cc2_name: 'Maintenance' },
  { cc1_group: 'Administration', cc2_name: 'Administrator' },
  { cc1_group: 'Administration', cc2_name: 'Assistant Administrator' },
  { cc1_group: 'Administration', cc2_name: 'Admissions' },
  { cc1_group: 'Administration', cc2_name: 'Marketing' },
  { cc1_group: 'Administration', cc2_name: 'Business Office Manager' },
  { cc1_group: 'Administration', cc2_name: 'Business Office' },
  { cc1_group: 'Administration', cc2_name: 'Purchasing' },
  { cc1_group: 'Administration', cc2_name: 'Human Resources' },
  { cc1_group: 'Administration', cc2_name: 'Receptionist' },
  { cc1_group: 'Administration', cc2_name: 'Transportation' },
  { cc1_group: 'Activities', cc2_name: 'Activity Director' },
  { cc1_group: 'Activities', cc2_name: 'Activities' },
  { cc1_group: 'Social Service', cc2_name: 'Social Services' },
]

export const NURSING_LICENSED = ['RN', 'LVN']
export const NURSING_MEDAIDES = ['CMT']
export const NURSING_AIDES = ['CNA']
export const NURSING_ADMIN = [
  'DON', 'ADON', 'MDS', 'Wound Nurse', 'Corporate Nurse',
  'Staffing Coordinator CNA', 'Staffing Coordinator LVN', 'Infection Control',
]
export const NURSING_ALL = [...NURSING_LICENSED, ...NURSING_MEDAIDES, ...NURSING_AIDES, ...NURSING_ADMIN]

export const SHIFTKEY_SPECIALTY_MAP: Record<string, string> = {
  'RN': 'RN', 'LVN': 'LVN', 'LVN/LPN': 'LVN', 'LPN': 'LVN',
  'CNA': 'CNA', 'CMT': 'CMT',
}

// ── Facility-specific report line item definitions ────────────────────────────
// Drives both the nursing detail table and the cycle grid.
// Order here is the display order on the report.

export interface NursingLineItem {
  key: string          // unique key for lookups
  label: string        // display label
  empeonNames: string[] // cc2_names that roll into this line
  isSubtotal?: boolean
  isTotal?: boolean
  isAgency?: boolean
  skNames?: string[]   // ShiftKey specialty names for agency rows
  autoDON?: boolean    // if true, inject 8hrs on weekdays even if no Empeon data
}

export interface AncillaryLineItem {
  key: string
  label: string
  empeonNames: string[]
}

export interface FacilityReportConfig {
  nursingLines: NursingLineItem[]
  ancillaryLines: AncillaryLineItem[]
}

const CHANDLER_NURSING: NursingLineItem[] = [
  { key: 'adon',       label: 'ADON',             empeonNames: ['ADON', 'Staffing Coordinator CNA'] },
  { key: 'don',        label: 'DON',               empeonNames: ['DON'], autoDON: true },
  { key: 'mds',        label: 'MDS',               empeonNames: ['MDS'] },
  { key: 'woundNurse', label: 'Wound Nurse',        empeonNames: ['Wound Nurse'] },
  { key: 'rn',         label: 'RN',                empeonNames: ['RN'] },
  { key: 'lvn',        label: 'LVN',               empeonNames: ['LVN'] },
  { key: 'rnlvnAg',    label: 'RN / LVN agency',   empeonNames: [], isAgency: true, skNames: ['RN', 'LVN'] },
  { key: 'rnlvn',      label: 'RN / LVN combined', empeonNames: [], isSubtotal: true },
  { key: 'cmt',        label: 'CMT',               empeonNames: ['CMT'] },
  { key: 'cmtAg',      label: 'CMT agency',         empeonNames: [], isAgency: true, skNames: ['CMT'] },
  { key: 'rnlvncmt',   label: 'RN / LVN / CMT',    empeonNames: [], isSubtotal: true },
  { key: 'cna',        label: 'CNA',               empeonNames: ['CNA', 'Purchasing'] },
  { key: 'cnaAg',      label: 'CNA agency',         empeonNames: [], isAgency: true, skNames: ['CNA'] },
  { key: 'allNursing', label: 'All nursing',        empeonNames: [], isTotal: true },
]

const BRIARCLIFF_NURSING: NursingLineItem[] = [
  { key: 'adon',       label: 'ADON',                    empeonNames: ['ADON'] },
  { key: 'don',        label: 'DON',                     empeonNames: ['DON'], autoDON: true },
  { key: 'mds',        label: 'MDS',                     empeonNames: ['MDS'] },
  { key: 'woundNurse', label: 'Wound Nurse',              empeonNames: ['Wound Nurse'] },
  { key: 'staffCoord', label: 'Staffing Coordinator LVN', empeonNames: ['Staffing Coordinator LVN'] },
  { key: 'infControl', label: 'Infection Control',        empeonNames: ['Infection Control'] },
  { key: 'rn',         label: 'RN',                      empeonNames: ['RN'] },
  { key: 'lvn',        label: 'LVN',                     empeonNames: ['LVN'] },
  { key: 'rnlvnAg',    label: 'RN / LVN agency',         empeonNames: [], isAgency: true, skNames: ['RN', 'LVN'] },
  { key: 'rnlvn',      label: 'RN / LVN combined',       empeonNames: [], isSubtotal: true },
  { key: 'cmt',        label: 'CMT',                     empeonNames: ['CMT'] },
  { key: 'cmtAg',      label: 'CMT agency',               empeonNames: [], isAgency: true, skNames: ['CMT'] },
  { key: 'rnlvncmt',   label: 'RN / LVN / CMT',          empeonNames: [], isSubtotal: true },
  { key: 'cna',        label: 'CNA',                     empeonNames: ['CNA', 'Purchasing'] },
  { key: 'cnaAg',      label: 'CNA agency',               empeonNames: [], isAgency: true, skNames: ['CNA'] },
  { key: 'allNursing', label: 'All nursing',              empeonNames: [], isTotal: true },
]

const CHANDLER_ANCILLARY: AncillaryLineItem[] = [
  { key: 'activities',    label: 'Activities',         empeonNames: ['Activities', 'Activity Director'] },
  { key: 'admin',         label: 'Administration',     empeonNames: ['Admissions', 'Marketing', 'Business Office Manager', 'Business Office', 'Human Resources'] },
  { key: 'dietary',       label: 'Dietary',            empeonNames: ['Dietary', 'Food Service Director', 'Cook', 'Dietary Aide'] },
  { key: 'hkLaundry',     label: 'Housekeeping/Laundry', empeonNames: ['Housekeeping', 'Housekeeping/Laundry Director'] },
  { key: 'laundry',       label: 'Laundry',            empeonNames: ['Laundry'] },
  { key: 'maintenance',   label: 'Maintenance',        empeonNames: ['Maintenance', 'Maintenance Director'] },
  { key: 'rehab',         label: 'Rehab',              empeonNames: ['Rehab Director', 'Physical Therapist', 'PTA', 'Occupational Therapist', 'COTA', 'Speech Therapist'] },
]

const BRIARCLIFF_ANCILLARY: AncillaryLineItem[] = [
  { key: 'activities',    label: 'Activities',         empeonNames: ['Activities', 'Activity Director'] },
  { key: 'admin',         label: 'Administration',     empeonNames: ['Admissions', 'Marketing', 'Business Office', 'Human Resources'] },
  { key: 'receptionist',  label: 'Receptionist',       empeonNames: ['Receptionist'] },
  { key: 'transport',     label: 'Transportation',     empeonNames: ['Transportation'] },
  { key: 'dietary',       label: 'Dietary',            empeonNames: ['Dietary', 'Food Service Director', 'Cook', 'Dietary Aide', 'Assistant Dietary Manager'] },
  { key: 'hkLaundry',     label: 'Housekeeping/Laundry', empeonNames: ['Housekeeping', 'Housekeeping/Laundry Director'] },
  { key: 'laundry',       label: 'Laundry',            empeonNames: ['Laundry'] },
  { key: 'maintenance',   label: 'Maintenance',        empeonNames: ['Maintenance', 'Maintenance Director'] },
  { key: 'rehab',         label: 'Rehab',              empeonNames: ['Rehab Director', 'Physical Therapist', 'PTA', 'Occupational Therapist', 'COTA', 'Speech Therapist'] },
]

// Default fallback (Waco — update when Waco config is confirmed)
const WACO_NURSING = CHANDLER_NURSING
const WACO_ANCILLARY = CHANDLER_ANCILLARY

export const FACILITY_CONFIGS: Record<string, FacilityReportConfig> = {
  chandler:   { nursingLines: CHANDLER_NURSING,   ancillaryLines: CHANDLER_ANCILLARY },
  briarcliff: { nursingLines: BRIARCLIFF_NURSING, ancillaryLines: BRIARCLIFF_ANCILLARY },
  waco:       { nursingLines: WACO_NURSING,        ancillaryLines: WACO_ANCILLARY },
}

// Map facility DB name → config key
export function getFacilityConfigKey(facilityName: string): string {
  const n = facilityName.toLowerCase()
  if (n.includes('chandler'))   return 'chandler'
  if (n.includes('briarcliff')) return 'briarcliff'
  if (n.includes('waco'))       return 'waco'
  return 'chandler'
}

// cc2_name → cc1_group for ancillary grouping (used by getGroup in ReportPreview)
export const CC2_GROUP_MAP: Record<string, string> = {
  'DON':'Nursing','ADON':'Nursing','MDS':'Nursing','Wound Nurse':'Nursing',
  'Corporate Nurse':'Nursing','Staffing Coordinator CNA':'Nursing',
  'Staffing Coordinator LVN':'Nursing','Infection Control':'Nursing',
  'RN':'Nursing','LVN':'Nursing','CMT':'Nursing','CNA':'Nursing','Purchasing':'Nursing',
  'Rehab Director':'Rehab','Physical Therapist':'Rehab','PTA':'Rehab',
  'Occupational Therapist':'Rehab','COTA':'Rehab','Speech Therapist':'Rehab',
  'Food Service Director':'Dietary','Cook':'Dietary','Dietary Aide':'Dietary',
  'Dietary':'Dietary','Assistant Dietary Manager':'Dietary',
  'Housekeeping/Laundry Director':'Housekeeping/Laundry',
  'Housekeeping':'Housekeeping/Laundry',
  'Maintenance Director':'Maintenance','Maintenance':'Maintenance',
  'Administrator':'Administration','Assistant Administrator':'Administration',
  'Admissions':'Administration','Marketing':'Administration',
  'Business Office Manager':'Administration','Business Office':'Administration',
  'Human Resources':'Administration','Receptionist':'Administration',
  'Transportation':'Administration',
  'Activity Director':'Activities','Activities':'Activities',
  'Social Services':'Social Service','Laundry':'Laundry',
}
