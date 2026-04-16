// ═══════════════════════════════════════════════════════════
// TypeScript Type Definitions
// ═══════════════════════════════════════════════════════════
// All shared types used across the application.
// Maps directly to the PostgreSQL tables in Supabase.
// ═══════════════════════════════════════════════════════════

/**
 * User profile — maps to the `profiles` table in Supabase.
 * Created automatically when a new user signs up.
 */
export type Profile = {
  id: string;                    // UUID from Supabase Auth
  name: string | null;
  email: string;
  experience: string | null;     // e.g. "3+ years"
  current_role: string | null;   // e.g. "Frontend Developer"
  industry: string | null;       // e.g. "Software / IT"
  skills: string | null;         // Comma-separated skills
  achievement: string | null;    // Key achievement for cover notes
  target_roles: string[];        // PostgreSQL array of target job titles
  target_locations: string[];    // PostgreSQL array of target cities
  min_salary: string | null;
  work_preference: string | null; // "any", "remote", "onsite", "hybrid"
  job_type: string | null;        // "Full-time", "Contract", etc.
  plan: string;                  // "free", "weekly", "monthly"
  plan_expiry: string | null;
  usage_count: number;           // Number of scans used
  created_at: string;
  updated_at: string;
};

/**
 * Application record — maps to the `applications` table.
 * Created when user clicks "Mark Applied" on a job.
 */
export type Application = {
  id: string;                    // Auto-generated UUID
  user_id: string;               // References profiles.id
  job_id: number | null;
  company: string;
  title: string;
  location: string | null;
  score: number | null;          // AI match score (0-100)
  portal: string | null;         // e.g. "LinkedIn", "Indeed"
  salary: string | null;
  status: string;                // "applied", "interview", "offer", "rejected"
  applied_date: string | null;
  job_url: string | null;
  created_at: string;
};

/**
 * Cover note record — maps to the `cover_notes` table.
 * Created when user saves an AI-generated cover note.
 */
export type CoverNote = {
  id: string;
  user_id: string;
  company: string | null;
  role: string | null;
  note: string | null;           // The actual cover note text
  note_date: string | null;
  created_at: string;
};

/**
 * Job result from AI scanning — NOT stored in DB.
 * This is the shape returned by the /api/scan endpoint.
 */
export type JobScanned = {
  id: number;
  company: string;
  title: string;
  loc: string;
  portal: string;
  salary: string;
  exp: string;
  shift: string;
  url: string;
  skills: string[];
  score: number;                 // AI match score (0-100)
  verdict: string;               // e.g. "STRONG MATCH"
  reasons: string;               // AI explanation
  apply: boolean;
};
