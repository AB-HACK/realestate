import { EvidenceStatus, MeasurementMethod } from '../types';

export const MEASUREMENT_DISCLAIMER =
  "Approximate. Not a survey. A licensed surveyor's plan is the legal document.";

export const ESRI_ATTRIBUTION_TEXT =
  'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';

export const GPS_SPOOFING_NOTICE =
  'Security Notice: Client GPS coordinates can be spoofed on mobile devices. In-app geotagged photos and GPS walks are physical consistency signals, not standalone legal proof.';

export const NIGERIA_STATES_LGAS: Record<string, string[]> = {
  Lagos: [
    'Eti-Osa (Lekki / Ikoyi / VI)',
    'Ibeju-Lekki',
    'Ikeja',
    'Epe',
    'Surulere',
    'Alimosho',
    'Ikorodu',
    'Badagry',
  ],
  'FCT (Abuja)': [
    'Abuja Municipal (AMAC — Maitama / Wuse / Guzape)',
    'Bwari',
    'Gwagwalada',
    'Kuje',
  ],
  Oyo: [
    'Ibadan North (Bodija / Agodi GRA)',
    'Ibadan South-West (Ring Road / Oluyole)',
    'Ido',
    'Akinyele (Moniya)',
    'Egbeda',
    'Oluyole',
  ],
  Rivers: ['Port Harcourt', 'Obio/Akpor', 'Eleme', 'Ikwerre'],
  Ogun: ['Obafemi Owode (Mowe / Ofada)', 'Ado-Odo/Ota', 'Abeokuta South', 'Ifo', 'Sagamu'],
  Enugu: ['Enugu North (Independence Layout)', 'Enugu South', 'Enugu East', 'Nsukka'],
  Kano: ['Kano Municipal', 'Nassarawa', 'Tarauni', 'Gwale'],
  Delta: ['Oshimili South (Asaba)', 'Uvwie', 'Warri South'],
  Edo: ['Oredo (Benin City)', 'Ikpoba-Okha', 'Egor'],
  Anambra: ['Awka South', 'Onitsha North', 'Nnewi North'],
};

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  survey_plan: 'Registered Survey Plan',
  title_document: 'Title Document (C of O / Registered Deed)',
  governors_consent: "Governor's Consent",
  deed_of_assignment: 'Deed of Assignment / Purchase Receipt',
  other: 'Supporting Clearance / Tax Receipt',
};

export const EVIDENCE_STATUS_CONFIG: Record<
  EvidenceStatus,
  { label: string; badgeClass: string; description: string }
> = {
  not_provided: {
    label: 'Not Provided',
    badgeClass: 'bg-slate-100 text-slate-600 border border-slate-200',
    description: 'No document uploaded to private vault yet.',
  },
  uploaded: {
    label: 'Uploaded (Unreviewed)',
    badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200',
    description: 'Uploaded by owner/agent; awaiting human admin inspection.',
  },
  under_review: {
    label: 'Under Admin Review',
    badgeClass: 'bg-sky-50 text-sky-800 border border-sky-200',
    description: 'Currently queued for human review by platform admin.',
  },
  reviewed_by_admin: {
    label: 'Reviewed by Admin',
    badgeClass: 'bg-indigo-50 text-indigo-800 border border-indigo-200',
    description: 'Admin inspected file format and metadata; not an official registry search.',
  },
  externally_verified: {
    label: 'Externally Verified (Report Attached)',
    badgeClass: 'bg-emerald-50 text-emerald-900 border border-emerald-300',
    description:
      'External registry search or licensed surveyor/solicitor report attached and confirmed by Admin.',
  },
};

export const MEASUREMENT_METHOD_CONFIG: Record<
  MeasurementMethod,
  {
    label: string;
    confidenceNote: string;
    badgeColor: string;
    description: string;
  }
> = {
  gps_walk: {
    label: 'GPS Boundary Walk',
    confidenceNote: 'On-Site GNSS Multi-Sample',
    badgeColor: 'bg-emerald-50 text-emerald-900 border-emerald-300',
    description:
      'Captured on-site by walking each corner (~10s watchPosition window, discarding samples >15m accuracy).',
  },
  satellite_trace: {
    label: 'Satellite Trace',
    confidenceNote: 'Lower Confidence (Imagery Trace)',
    badgeColor: 'bg-amber-50 text-amber-900 border-amber-300',
    description:
      'Digitized over Esri World Imagery satellite tiles. Subject to imagery orthorectification & roof overhang offsets.',
  },
  surveyor_plan: {
    label: 'Surveyor Plan Coordinates',
    confidenceNote: 'Cross-Checked vs Stated Area',
    badgeColor: 'bg-sky-50 text-sky-900 border-sky-300',
    description:
      'Plotted from uploaded Survey Plan bearings/coordinates and compared against stated surveyor area (15% tolerance).',
  },
};

export const BUILT_PROPERTY_TYPE_LABELS: Record<string, string> = {
  house: 'Detached House / Bungalow',
  duplex: 'Semi-Detached / Fully Detached Duplex',
  block_of_flats: 'Block of Flats (Multi-Unit)',
  single_unit: 'Single Apartment / Self-Contained Unit',
};

export const NIGERIA_DISCOS = [
  'IBEDC (Ibadan Electricity Distribution Company)',
  'EKEDC (Eko Electricity Distribution Company)',
  'IKEDC (Ikeja Electric)',
  'AEDC (Abuja Electricity Distribution Company)',
  'PHED (Port Harcourt Electricity Distribution)',
  'EEDC (Enugu Electricity Distribution Company)',
  'KEDCO (Kano Electricity Distribution Company)',
  'BEDC (Benin Electricity Distribution Company)',
];

export const NIGERIA_WATER_SOURCES = [
  'Motorized Borehole + Reverse Osmosis Treatment Plant',
  'Motorized Borehole (Untreated)',
  'State Water Corporation Mains',
  'Deep Well + Overhead Tank',
  'Water Tanker Supply Only',
];

export const MANDATORY_CONDITION_CATEGORIES: Array<{
  id:
    | 'roof'
    | 'ceiling'
    | 'walls_cracks'
    | 'floors'
    | 'doors_windows'
    | 'electrical'
    | 'plumbing'
    | 'water_supply'
    | 'drainage_flooding'
    | 'fence_gate'
    | 'access_road';
  label: string;
}> = [
  { id: 'roof', label: 'Roof & Trusses' },
  { id: 'ceiling', label: 'Ceiling / POP' },
  { id: 'walls_cracks', label: 'Walls & Structural Cracks' },
  { id: 'floors', label: 'Floors & Tiles' },
  { id: 'doors_windows', label: 'Doors, Windows & Burglary Proof' },
  { id: 'electrical', label: 'Electrical Wiring & Distribution Board' },
  { id: 'plumbing', label: 'Plumbing, Pipes & Soakaway' },
  { id: 'water_supply', label: 'Water Supply & Pumping System' },
  { id: 'drainage_flooding', label: 'Drainage Channel & Flood Risk' },
  { id: 'fence_gate', label: 'Perimeter Fence & Security Gate' },
  { id: 'access_road', label: 'Access Road Condition' },
];

