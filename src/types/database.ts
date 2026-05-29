export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          headline: string | null
          location: string | null
          resume_json: Json
          created_at: string
          updated_at: string | null
          linkedin_connected: boolean
          linkedin_id: string | null
          linkedin_first_name: string | null
          linkedin_last_name: string | null
          linkedin_headline: string | null
          linkedin_summary: string | null
          linkedin_profile_url: string | null
          linkedin_profile_image_url: string | null
          linkedin_raw_profile: Json
          linkedin_token: string | null
          linkedin_connected_at: string | null
        }
        Insert: {
          id?: string
          email?: string | null
          full_name?: string | null
          headline?: string | null
          location?: string | null
          resume_json?: Json
          created_at?: string
          updated_at?: string | null
          linkedin_connected?: boolean
          linkedin_id?: string | null
          linkedin_first_name?: string | null
          linkedin_last_name?: string | null
          linkedin_headline?: string | null
          linkedin_summary?: string | null
          linkedin_profile_url?: string | null
          linkedin_profile_image_url?: string | null
          linkedin_raw_profile?: Json
          linkedin_token?: string | null
          linkedin_connected_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      jobs: {
        Row: {
          id: string
          user_id: string
          title: string
          company_name: string
          location: string | null
          salary_min: number | null
          salary_max: number | null
          url: string | null
          description: string | null
          source: string
          match_score: number | null
          status: string
          applied_date: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          company_name?: string
          location?: string | null
          salary_min?: number | null
          salary_max?: number | null
          url?: string | null
          description?: string | null
          source?: string
          match_score?: number | null
          status?: string
          applied_date?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['jobs']['Insert']>
      }
      applications: {
        Row: {
          id: string
          user_id: string
          job_id: string | null
          title: string
          company: string
          job_url: string | null
          status: string
          resume_version: string | null
          cover_letter: string | null
          applied_date: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          job_id?: string | null
          title?: string
          company?: string
          job_url?: string | null
          status?: string
          resume_version?: string | null
          cover_letter?: string | null
          applied_date?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['applications']['Insert']>
      }
      resumes: {
        Row: {
          id: string
          user_id: string
          name: string
          is_default: boolean
          content: Json
          file_path: string | null
          ats_score: number | null
          target_job_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          is_default?: boolean
          content?: Json
          file_path?: string | null
          ats_score?: number | null
          target_job_id?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['resumes']['Insert']>
      }
      contacts: {
        Row: {
          id: string
          user_id: string
          name: string
          company: string | null
          title: string | null
          email: string | null
          linkedin_url: string | null
          status: string
          notes: string | null
          last_contacted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          company?: string | null
          title?: string | null
          email?: string | null
          linkedin_url?: string | null
          status?: string
          notes?: string | null
          last_contacted_at?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['contacts']['Insert']>
      }
      outreach_messages: {
        Row: {
          id: string
          user_id: string
          contact_id: string | null
          channel: string | null
          direction: string | null
          subject: string | null
          content: string
          sent_at: string
          reply_received: boolean
        }
        Insert: {
          id?: string
          user_id: string
          contact_id?: string | null
          channel?: string | null
          direction?: string | null
          subject?: string | null
          content: string
          sent_at?: string
          reply_received?: boolean
        }
        Update: Partial<Database['public']['Tables']['outreach_messages']['Insert']>
      }
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Job = Database['public']['Tables']['jobs']['Row']
export type Application = Database['public']['Tables']['applications']['Row']
export type Resume = Database['public']['Tables']['resumes']['Row']
export type Contact = Database['public']['Tables']['contacts']['Row']
export type OutreachMessage = Database['public']['Tables']['outreach_messages']['Row']
