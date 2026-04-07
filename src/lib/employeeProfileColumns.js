/**
 * Columns aligned with `employee_profiles` (dynaclean_crm). The API intersects
 * these with INFORMATION_SCHEMA so only columns that exist in your DB are used.
 */

export const PROFILE_TEXT_FIELDS = [
  "employee_code",
  "username",
  "empId",
  "source_reference",
  "designation",
  "date_of_joining",
  "work_location",
  "name_prefix",
  "full_name",
  "contact_mobile",
  "contact_landline",
  "date_of_birth",
  "marital_status",
  "blood_group",
  "email",
  "father_name",
  "father_phone",
  "mother_name",
  "mother_phone",
  "correspondence_address",
  "permanent_address",
  "emergency_contact_name",
  "emergency_contact_number",
  "documents_submitted",
  "employment_status",
  "leave_policy",
  "is_experienced",
  "probation_period",
  "department",
  "reporting_manager",
  "near_police_station",
  "name_as_per_bank",
  "bank_name",
  "ifsc_code",
  "bank_account_number",
  "pan_number",
  "aadhar_number",
  "aadhaar_number",
  "pf_uan",
  "esic_number",
  "electricity_bill_for",
  "electricity_bill_type",
  "education_json",
];

/** Form / API file input names → DB column (first match in schema wins) */
export const PROFILE_FILE_FIELD_ALIASES = {
  profile_photo: ["profile_photo", "passport_photo_url", "passport_photo"],
  signature: ["signature", "signature_url"],
  joining_form_documents: ["joining_form_documents"],
  pan_card: [
    "pan_card_path",
    "pan_card_url",
    "pan_document_url",
    "pan_card",
  ],
  voter_id: ["voter_id_path", "voter_id_url", "voter_id"],
  aadhaar_card: [
    "aadhaar_card_path",
    "aadhaar_card_url",
    "aadhaar_document_url",
    "aadhaar_card",
  ],
  electricity_bill: [
    "electricity_bill_path",
    "electricity_bill_url",
    "electricity_bill",
  ],
  rent_agreement: [
    "rent_agreement_path",
    "rent_agreement_url",
    "rent_agreement",
  ],
  police_verification: [
    "police_verification_path",
    "police_verification_url",
    "police_verification",
  ],
  cert_10th: [
    "cert_10th_url",
    "cert_10_path",
    "qualification_10_url",
    "cert_10th",
  ],
  cert_12th: [
    "cert_12th_url",
    "cert_12_path",
    "qualification_12_url",
    "cert_12th",
  ],
  diploma_cert: [
    "diploma_cert_url",
    "degree_cert_url",
    "diploma_certificate_path",
    "diploma_cert",
  ],
  tech_cert: [
    "tech_cert_url",
    "technical_cert_url",
    "technical_certification_path",
    "tech_cert",
  ],
  appt_letter_prev: ["appt_letter_prev_url", "appt_letter_prev_path", "doc_appt_letter_prev", "appt_letter_prev"],
  exp_letter: ["exp_letter_url", "exp_letter_path", "doc_exp_letter", "exp_letter"],
  relieving_letter: [
    "relieving_letter_url",
    "relieving_letter_path",
    "doc_relieving_letter",
    "relieving_letter",
  ],
  salary_slips: ["salary_slips_url", "salary_slips_path", "doc_salary_slips", "salary_slips"],
  cancelled_cheque: [
    "cancelled_cheque_url",
    "cancelled_cheque_path",
    "doc_cancelled_cheque",
    "cancelled_cheque",
  ],
  loi_appointment: ["loi_appointment_url", "loi_appointment_path", "doc_loi_appointment", "loi_appointment"],
  joining_form: ["joining_form_url", "joining_form_path", "doc_joining_form", "joining_form"],
  emp_verification: ["emp_verification_url", "emp_verification_path", "doc_emp_verification", "emp_verification"],
  code_conduct: ["code_conduct_url", "code_conduct_path", "doc_code_conduct", "code_conduct"],
  nda: ["nda_url", "nda_path", "doc_nda", "nda"],
  company_policy: ["company_policy_url", "company_policy_path", "doc_company_policy", "company_policy"],
};

/** Not editable via this form (server/system fields) */
export const RESERVED_PROFILE_COLUMNS = new Set([
  "id",
  "created_at",
  "updated_at",
  "created_by",
  "profile_approved_by",
  "profile_approved_at",
  "hr_approved_by",
  "hr_approved_at",
]);

export const PROFILE_TEXT_ALIASES = {
  aadhaar_number: ["aadhar_number", "aadhaar_number"],
  aadhar_number: ["aadhar_number", "aadhaar_number"],
  empId: ["empId", "emp_id"],
  electricity_bill_for: ["electricity_bill_for", "electricity_bill_type"],
  electricity_bill_type: ["electricity_bill_type", "electricity_bill_for"],
  profile_approval_status: ["profile_approval_status", "hr_approval_status", "profile_hr_status"],
  profile_approved_by: ["profile_approved_by", "hr_approved_by"],
  profile_approved_at: ["profile_approved_at", "hr_approved_at"],
};

export function resolveDbColumn(preferred, columnSet) {
  if (columnSet.has(preferred)) return preferred;
  const alts = PROFILE_TEXT_ALIASES[preferred];
  if (alts) {
    for (const a of alts) {
      if (columnSet.has(a)) return a;
    }
  }
  return null;
}

export function resolveFileDbColumn(logicalKey, columnSet) {
  const aliases = PROFILE_FILE_FIELD_ALIASES[logicalKey];
  if (!aliases) return columnSet.has(logicalKey) ? logicalKey : null;
  for (const a of aliases) {
    if (columnSet.has(a)) return a;
  }
  return null;
}
