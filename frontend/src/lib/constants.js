export const ROLES = ["Admin", "Teacher", "Accountant", "Parent", "Student"];

export const ROLE_TONES = {
  Admin: "violet",
  Teacher: "indigo",
  Accountant: "cyan",
  Parent: "amber",
  Student: "green",
};

export const ATTENDANCE_STATUSES = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
  { value: "excused", label: "Excused" },
];

export const EXAM_TERMS = [
  { value: "first_term", label: "First Term" },
  { value: "mid_term", label: "Mid Term" },
  { value: "final_term", label: "Final Term" },
  { value: "annual", label: "Annual" },
  { value: "monthly", label: "Monthly Test" },
];

export const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

export const STUDENT_STATUSES = [
  { value: "active", label: "Active" },
  { value: "graduated", label: "Graduated" },
  { value: "transferred", label: "Transferred" },
  { value: "suspended", label: "Suspended" },
];

export const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time" },
  { value: "contract", label: "Contract" },
];

export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "mobile_money", label: "Mobile money" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

// Fallback metadata used before /finance/payment-gateways/ responds. The API
// remains the source of truth so new gateways can be enabled server-side.
export const PAYMENT_GATEWAYS = [
  {
    code: "bkash",
    label: "bKash",
    category: "mobile_banking",
    category_label: "Mobile banking",
    description: "Pay from your bKash mobile wallet.",
    brand_color: "#e2136e",
    initials: "bK",
  },
  {
    code: "nagad",
    label: "Nagad",
    category: "mobile_banking",
    category_label: "Mobile banking",
    description: "Pay from your Nagad mobile wallet.",
    brand_color: "#f15a22",
    initials: "Na",
  },
  {
    code: "rocket",
    label: "Rocket",
    category: "mobile_banking",
    category_label: "Mobile banking",
    description: "Pay from your Rocket (DBBL) mobile wallet.",
    brand_color: "#8c3494",
    initials: "Ro",
  },
  {
    code: "mobile_banking",
    label: "Other mobile banking",
    category: "mobile_banking",
    category_label: "Mobile banking",
    description: "Use another mobile banking or wallet provider.",
    brand_color: "#0ea5e9",
    initials: "MB",
  },
  {
    code: "card",
    label: "Debit / credit card",
    category: "card",
    category_label: "Cards",
    description: "Visa, Mastercard, American Express and other cards.",
    brand_color: "#1e3a8a",
    initials: "CC",
  },
  {
    code: "bank",
    label: "Bank transfer",
    category: "bank",
    category_label: "Bank",
    description: "Pay through internet banking or a bank transfer.",
    brand_color: "#0f766e",
    initials: "BK",
  },
];

export const PAYMENT_GATEWAY_GROUPS = [
  { category: "mobile_banking", label: "Mobile banking", hint: "bKash, Nagad, Rocket and other wallets" },
  { category: "card", label: "Cards", hint: "Debit and credit cards" },
  { category: "bank", label: "Bank", hint: "Internet banking or bank transfer" },
];

export const AUDIENCES = [
  { value: "all", label: "Everyone" },
  { value: "teachers", label: "Teachers" },
  { value: "students", label: "Students" },
  { value: "parents", label: "Parents" },
  { value: "class", label: "Specific class" },
];

export const DAYS = [
  { value: 0, label: "Monday" },
  { value: 1, label: "Tuesday" },
  { value: 2, label: "Wednesday" },
  { value: 3, label: "Thursday" },
  { value: 4, label: "Friday" },
  { value: 5, label: "Saturday" },
  { value: 6, label: "Sunday" },
];

export const RELATIONS = [
  { value: "father", label: "Father" },
  { value: "mother", label: "Mother" },
  { value: "guardian", label: "Legal guardian" },
  { value: "other", label: "Other" },
];

export const PAGE_SIZE = 20;

export const DEMO_ACCOUNTS = [
  { role: "Admin", email: "admin@school.example", password: "Admin@12345" },
  { role: "Teacher", email: "teacher@school.example", password: "Teacher@12345" },
  { role: "Accountant", email: "accountant@school.example", password: "Account@12345" },
  { role: "Student", email: "student@school.example", password: "Student@12345" },
  { role: "Parent", email: "parent@school.example", password: "Parent@12345" },
];
