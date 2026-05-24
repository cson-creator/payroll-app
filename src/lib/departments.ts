// All known department names, grouped.
// Numbers are ignored — matching is by cc2_name string only.

export const ALL_DEPARTMENTS: { cc1_group: string; cc2_name: string }[] = [
  // Nursing
  { cc1_group: 'Nursing', cc2_name: 'DON' },
  { cc1_group: 'Nursing', cc2_name: 'ADON' },
  { cc1_group: 'Nursing', cc2_name: 'MDS' },
  { cc1_group: 'Nursing', cc2_name: 'Wound Nurse' },
  { cc1_group: 'Nursing', cc2_name: 'Corporate Nurse' },
  { cc1_group: 'Nursing', cc2_name: 'Staffing Coordinator CNA' },
  { cc1_group: 'Nursing', cc2_name: 'RN' },
  { cc1_group: 'Nursing', cc2_name: 'LVN' },
  { cc1_group: 'Nursing', cc2_name: 'CMT' },
  { cc1_group: 'Nursing', cc2_name: 'CNA' },
  // Rehab
  { cc1_group: 'Rehab', cc2_name: 'Rehab Director' },
  { cc1_group: 'Rehab', cc2_name: 'Physical Therapist' },
  { cc1_group: 'Rehab', cc2_name: 'PTA' },
  { cc1_group: 'Rehab', cc2_name: 'Occupational Therapist' },
  { cc1_group: 'Rehab', cc2_name: 'COTA' },
  { cc1_group: 'Rehab', cc2_name: 'Speech Therapist' },
  // Dietary
  { cc1_group: 'Dietary', cc2_name: 'Food Service Director' },
  { cc1_group: 'Dietary', cc2_name: 'Cook' },
  { cc1_group: 'Dietary', cc2_name: 'Dietary Aide' },
  { cc1_group: 'Dietary', cc2_name: 'Dietary' },
  // Housekeeping/Laundry
  { cc1_group: 'Housekeeping/Laundry', cc2_name: 'Housekeeping/Laundry Director' },
  { cc1_group: 'Housekeeping/Laundry', cc2_name: 'Housekeeping' },
  { cc1_group: 'Housekeeping/Laundry', cc2_name: 'Laundry' },
  // Maintenance
  { cc1_group: 'Maintenance', cc2_name: 'Maintenance Director' },
  { cc1_group: 'Maintenance', cc2_name: 'Maintenance' },
  // Administration
  { cc1_group: 'Administration', cc2_name: 'Administrator' },
  { cc1_group: 'Administration', cc2_name: 'Assistant Administrator' },
  { cc1_group: 'Administration', cc2_name: 'Admissions' },
  { cc1_group: 'Administration', cc2_name: 'Marketing' },
  { cc1_group: 'Administration', cc2_name: 'Business Office Manager' },
  { cc1_group: 'Administration', cc2_name: 'Business Office' },
  { cc1_group: 'Administration', cc2_name: 'Purchasing' },
  { cc1_group: 'Administration', cc2_name: 'Human Resources' },
  // Activities
  { cc1_group: 'Activities', cc2_name: 'Activity Director' },
  { cc1_group: 'Activities', cc2_name: 'Activities' },
  // Social Service
  { cc1_group: 'Social Service', cc2_name: 'Social Services' },
]

// Which Cc2 names are considered "nursing" for PPD calculation
export const NURSING_LICENSED = ['RN', 'LVN']
export const NURSING_MEDAIDES = ['CMT']
export const NURSING_AIDES = ['CNA']
export const NURSING_ADMIN = ['DON', 'ADON', 'MDS', 'Wound Nurse', 'Corporate Nurse', 'Staffing Coordinator CNA']
export const NURSING_ALL = [...NURSING_LICENSED, ...NURSING_MEDAIDES, ...NURSING_AIDES, ...NURSING_ADMIN]

// ShiftKey specialty → cc2_name mapping
export const SHIFTKEY_SPECIALTY_MAP: Record<string, string> = {
  'RN': 'RN',
  'LVN': 'LVN',
  'LVN/LPN': 'LVN',
  'LPN': 'LVN',
  'CNA': 'CNA',
  'CMT': 'CMT',
}