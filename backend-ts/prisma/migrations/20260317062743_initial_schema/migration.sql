-- CreateTable
CREATE TABLE "deals" (
    "deal_id" TEXT NOT NULL,
    "opportunity_name" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "account_id" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'prospecting',
    "progress_percentage" INTEGER NOT NULL DEFAULT 0,
    "estimated_value" DOUBLE PRECISION,
    "close_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "priority" TEXT,
    "owner" TEXT,
    "team_members" TEXT,
    "win_themes" TEXT,
    "story" TEXT,
    "notes" TEXT,
    "servicenow_id" TEXT,
    "jira_key" TEXT,
    "salesforce_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION,
    "campaign_id" TEXT,
    "contact_id" TEXT,
    "description" TEXT,
    "fiscal_quarter" INTEGER,
    "fiscal_year" INTEGER,
    "forecast_category" TEXT,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "is_won" BOOLEAN NOT NULL DEFAULT false,
    "lead_source" TEXT,
    "next_step" TEXT,
    "probability" DOUBLE PRECISION,
    "stage_name" TEXT,
    "type" TEXT,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("deal_id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "account_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "owner" TEXT,
    "industry" TEXT,
    "location" TEXT,
    "summary" TEXT,
    "summary_updated" TIMESTAMP(3),
    "logo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "annual_revenue" DOUBLE PRECISION,
    "billing_city" TEXT,
    "billing_country" TEXT,
    "billing_postal_code" TEXT,
    "billing_state" TEXT,
    "billing_street" TEXT,
    "description" TEXT,
    "number_of_employees" INTEGER,
    "parent_account_id" TEXT,
    "phone" TEXT,
    "type" TEXT,
    "website" TEXT,
    "salesforce_id" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "meeting_id" TEXT NOT NULL,
    "deal_id" TEXT,
    "account_id" TEXT,
    "online_meeting_id" TEXT,
    "ical_uid" TEXT,
    "title" TEXT NOT NULL,
    "meeting_date" TIMESTAMP(3),
    "duration_minutes" INTEGER,
    "internal_attendees" TEXT,
    "external_attendees" TEXT,
    "transcript" TEXT,
    "recording_url" TEXT,
    "notes" TEXT,
    "analysis_id" TEXT,
    "key_points" TEXT,
    "action_items" TEXT,
    "calendar_event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_proactive_call" BOOLEAN NOT NULL DEFAULT false,
    "outreach_email_draft" TEXT,
    "outreach_email_sent_at" TIMESTAMP(3),
    "outreach_email_subject" TEXT,
    "proactive_call_type" TEXT,
    "followup_email_draft" TEXT,
    "followup_email_sent_at" TIMESTAMP(3),
    "followup_email_subject" TEXT,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("meeting_id")
);

-- CreateTable
CREATE TABLE "meeting_attendee_research" (
    "id" SERIAL NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "attendee_id" INTEGER,
    "attendee_type" TEXT NOT NULL DEFAULT 'external',
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "company" TEXT,
    "research" JSONB,
    "sources" JSONB,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "error_message" TEXT,
    "last_researched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_attendee_research_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analyses" (
    "session_id" TEXT NOT NULL,
    "deal_id" TEXT,
    "meeting_id" TEXT,
    "company_name" TEXT NOT NULL,
    "purpose_of_meeting" TEXT,
    "meeting_title" TEXT,
    "meeting_date" TEXT,
    "meeting_time" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "current_step" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "result" TEXT,
    "attendees" TEXT,
    "progress" TEXT,
    "error" TEXT,
    "requested_by" TEXT,
    "edited_result" TEXT,
    "last_edited_at" TIMESTAMP(3),

    CONSTRAINT "analyses_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" SERIAL NOT NULL,
    "company_name" TEXT NOT NULL,
    "financial_data" TEXT,
    "market_position" TEXT,
    "leadership_info" TEXT,
    "strategic_initiatives" TEXT,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "research_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendees" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT,
    "company" TEXT,
    "linkedin_url" TEXT,
    "profile_data" TEXT,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" SERIAL NOT NULL,
    "session_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "file_path" TEXT,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_cache" (
    "id" SERIAL NOT NULL,
    "cache_key" TEXT NOT NULL,
    "cache_type" TEXT NOT NULL,
    "response_data" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "hit_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "api_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcript_analyses" (
    "analysis_id" TEXT NOT NULL,
    "deal_id" TEXT,
    "meeting_id" TEXT,
    "account_id" TEXT,
    "company_name" TEXT,
    "meeting_title" TEXT,
    "transcript_text" TEXT NOT NULL,
    "transcript_excerpt" TEXT,
    "analysis_result" TEXT NOT NULL,
    "opportunity_score" INTEGER,
    "sentiment_overall" TEXT,
    "sentiment" TEXT,
    "success_probability" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "analyzed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auto_proposal_requested" BOOLEAN NOT NULL DEFAULT false,
    "auto_ppt_requested" BOOLEAN NOT NULL DEFAULT false,
    "proposal_job_id" TEXT,
    "ppt_job_id" TEXT,
    "requested_by" TEXT,
    "edited_analysis_result" TEXT,
    "last_edited_at" TIMESTAMP(3),
    "is_saved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "transcript_analyses_pkey" PRIMARY KEY ("analysis_id")
);

-- CreateTable
CREATE TABLE "proposal_jobs" (
    "job_id" TEXT NOT NULL,
    "analysis_type" TEXT NOT NULL DEFAULT 'enhanced',
    "status" TEXT NOT NULL DEFAULT 'processing',
    "current_step" TEXT,
    "requested_by" TEXT,
    "deal_id" TEXT,
    "meeting_id" TEXT,
    "transcript_analysis_id" TEXT,
    "file_name" TEXT,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "rfp_text" TEXT,
    "rfp_summary" TEXT,
    "metadata" TEXT,
    "proposal_data" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "edited_proposal_data" TEXT,
    "last_edited_at" TIMESTAMP(3),

    CONSTRAINT "proposal_jobs_pkey" PRIMARY KEY ("job_id")
);

-- CreateTable
CREATE TABLE "meeting_analysis_jobs" (
    "job_id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "run_transcript" BOOLEAN NOT NULL DEFAULT false,
    "run_proposal" BOOLEAN NOT NULL DEFAULT false,
    "run_ppt" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "transcript_status" TEXT NOT NULL DEFAULT 'pending',
    "proposal_status" TEXT NOT NULL DEFAULT 'pending',
    "ppt_status" TEXT NOT NULL DEFAULT 'pending',
    "ppt_job_id" TEXT,
    "transcript_text" TEXT,
    "transcript_analysis_id" TEXT,
    "proposal_job_id" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "requested_by" TEXT,
    "requested_by_email" TEXT,
    "send_email_notification" BOOLEAN NOT NULL DEFAULT false,
    "bulk_job_id" TEXT,

    CONSTRAINT "meeting_analysis_jobs_pkey" PRIMARY KEY ("job_id")
);

-- CreateTable
CREATE TABLE "bulk_analysis_jobs" (
    "bulk_job_id" TEXT NOT NULL,
    "deal_id" TEXT,
    "account_id" TEXT,
    "requested_meeting_ids" TEXT,
    "resolved_meeting_ids" TEXT,
    "total_meetings" INTEGER NOT NULL DEFAULT 0,
    "completed_meetings" INTEGER NOT NULL DEFAULT 0,
    "failed_meetings" INTEGER NOT NULL DEFAULT 0,
    "skipped_meetings" INTEGER NOT NULL DEFAULT 0,
    "run_transcript" BOOLEAN NOT NULL DEFAULT false,
    "run_proposal" BOOLEAN NOT NULL DEFAULT false,
    "run_ppt" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "error_message" TEXT,
    "requested_by" TEXT,
    "requested_by_email" TEXT,
    "send_email_notification" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "bulk_analysis_jobs_pkey" PRIMARY KEY ("bulk_job_id")
);

-- CreateTable
CREATE TABLE "pptx_jobs" (
    "job_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "requested_by" TEXT,
    "analysis_type" TEXT NOT NULL DEFAULT 'rfp',
    "current_step" TEXT,
    "meeting_id" TEXT,
    "deal_id" TEXT,
    "proposal_job_id" TEXT,
    "transcript_analysis_id" TEXT,
    "template_name" TEXT,
    "template_version" TEXT,
    "rfp_summary" TEXT,
    "rfp_files" TEXT,
    "solution_file" TEXT,
    "output_file" TEXT,
    "output_file_size" INTEGER,
    "slide_count" INTEGER,
    "stats" TEXT,
    "presentation_data" TEXT,
    "error_message" TEXT,
    "metadata" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "edited_presentation_data" TEXT,
    "last_edited_at" TIMESTAMP(3),

    CONSTRAINT "pptx_jobs_pkey" PRIMARY KEY ("job_id")
);

-- CreateTable
CREATE TABLE "pursuit_brief_snapshots" (
    "snapshot_id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "meeting_id" TEXT,
    "transcript_analysis_id" TEXT,
    "question_answers" JSONB NOT NULL DEFAULT '{}',
    "source" TEXT NOT NULL DEFAULT 'transcript',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pursuit_brief_snapshots_pkey" PRIMARY KEY ("snapshot_id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "opportunity_id" TEXT NOT NULL,
    "deal_id" TEXT,
    "meeting_id" TEXT,
    "transcript_analysis_id" TEXT,
    "title" TEXT,
    "description" TEXT,
    "confidence_score" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'open',
    "source" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("opportunity_id")
);

-- CreateTable
CREATE TABLE "vector_indices" (
    "id" SERIAL NOT NULL,
    "index_name" TEXT NOT NULL,
    "index_type" TEXT NOT NULL,
    "dimension" INTEGER NOT NULL,
    "total_vectors" INTEGER NOT NULL DEFAULT 0,
    "index_path" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vector_indices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "embedding_documents" (
    "id" SERIAL NOT NULL,
    "doc_id" TEXT NOT NULL,
    "index_name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "document_type" TEXT,
    "source_file" TEXT,
    "chunk_index" INTEGER,
    "vector_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "embedding_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_case_studies" (
    "id" SERIAL NOT NULL,
    "deal_id" TEXT NOT NULL,
    "case_study_id" TEXT NOT NULL,
    "case_study_source" TEXT NOT NULL,
    "relevance_score" DOUBLE PRECISION,
    "relevance_reason" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_case_studies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_services" (
    "id" SERIAL NOT NULL,
    "deal_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "recommended_by" TEXT,
    "recommendation_reason" TEXT,
    "priority" TEXT,
    "status" TEXT NOT NULL DEFAULT 'recommended',
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_action_plans" (
    "id" SERIAL NOT NULL,
    "deal_id" TEXT NOT NULL,
    "analysis_session_id" TEXT,
    "title" TEXT NOT NULL,
    "action_plan_text" TEXT NOT NULL,
    "action_items" TEXT,
    "created_by" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deal_action_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_questionnaires" (
    "id" SERIAL NOT NULL,
    "deal_id" TEXT NOT NULL,
    "analysis_session_id" TEXT,
    "title" TEXT NOT NULL,
    "questions" TEXT NOT NULL,
    "questionnaire_type" TEXT,
    "created_by" TEXT,
    "completion_status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deal_questionnaires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_team_members" (
    "member_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT,
    "title" TEXT,
    "department" TEXT,
    "expertise_areas" TEXT,
    "phone" TEXT,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "availability" TEXT,
    "bio" TEXT,
    "profile_image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_team_members_pkey" PRIMARY KEY ("member_id")
);

-- CreateTable
CREATE TABLE "service_offerings" (
    "service_id" TEXT NOT NULL,
    "service_name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "short_description" TEXT,
    "pricing_model" TEXT,
    "estimated_duration" TEXT,
    "typical_team_size" TEXT,
    "tags" TEXT,
    "related_case_studies" TEXT,
    "deliverables" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_offerings_pkey" PRIMARY KEY ("service_id")
);

-- CreateTable
CREATE TABLE "users" (
    "user_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "full_name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_calendar_meetings" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "online_meeting_id" TEXT,
    "ical_uid" TEXT,
    "subject" TEXT NOT NULL,
    "body_preview" TEXT,
    "start_utc" TIMESTAMP(3) NOT NULL,
    "end_utc" TIMESTAMP(3),
    "original_time_zone" TEXT,
    "location" TEXT,
    "join_url" TEXT,
    "is_cancelled" BOOLEAN NOT NULL DEFAULT false,
    "transcript_available" BOOLEAN NOT NULL DEFAULT false,
    "internal_attendees" JSONB,
    "external_attendees" JSONB,
    "raw_event" JSONB,
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_calendar_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_api_keys" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "openai_api_key_encrypted" BYTEA,
    "azure_client_id_encrypted" BYTEA,
    "azure_client_secret_encrypted" BYTEA,
    "azure_tenant_id_encrypted" BYTEA,
    "has_openai_key" BOOLEAN NOT NULL DEFAULT false,
    "has_azure_credentials" BOOLEAN NOT NULL DEFAULT false,
    "sf_access_token_encrypted" BYTEA,
    "sf_refresh_token_encrypted" BYTEA,
    "sf_instance_url_encrypted" BYTEA,
    "has_salesforce_credentials" BOOLEAN NOT NULL DEFAULT false,
    "sf_token_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_graphs" (
    "id" SERIAL NOT NULL,
    "graph_id" TEXT NOT NULL,
    "graph_type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "nodes_data" TEXT NOT NULL,
    "links_data" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_graphs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "notification_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "deal_id" TEXT,
    "meeting_id" TEXT,
    "metadata" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "email_sent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_stages" (
    "stage_id" TEXT NOT NULL,
    "stage_name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "probability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "forecast_category" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "is_won" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunity_stages_pkey" PRIMARY KEY ("stage_id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "contact_id" TEXT NOT NULL,
    "account_id" TEXT,
    "first_name" TEXT,
    "last_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "mobile_phone" TEXT,
    "title" TEXT,
    "department" TEXT,
    "mailing_street" TEXT,
    "mailing_city" TEXT,
    "mailing_state" TEXT,
    "mailing_postal_code" TEXT,
    "mailing_country" TEXT,
    "lead_source" TEXT,
    "description" TEXT,
    "owner_id" TEXT,
    "reports_to_id" TEXT,
    "linkedin_url" TEXT,
    "salesforce_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "do_not_call" BOOLEAN NOT NULL DEFAULT false,
    "has_opted_out_of_email" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("contact_id")
);

-- CreateTable
CREATE TABLE "enterprise_opportunity_mappings" (
    "id" SERIAL NOT NULL,
    "analysis_session_id" TEXT,
    "transcript_analysis_id" TEXT,
    "deal_id" TEXT,
    "service_lines" JSONB NOT NULL,
    "opportunity_category" TEXT NOT NULL,
    "strategic_fit_score" DOUBLE PRECISION,
    "strategic_fit_analysis" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enterprise_opportunity_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atlassian_assessments" (
    "id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "meeting_id" TEXT,
    "questionnaire_responses" JSONB,
    "environment_data" JSONB,
    "analysis_result" JSONB,
    "migration_score" INTEGER,
    "urgency_level" TEXT,
    "gaps" JSONB,
    "recommendations" JSONB,
    "cloud_capabilities" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "is_saved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "atlassian_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atlassian_credentials" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "instance_url" TEXT NOT NULL,
    "username" TEXT,
    "api_token_enc" BYTEA NOT NULL,
    "product_type" TEXT NOT NULL,
    "is_valid" BOOLEAN NOT NULL DEFAULT true,
    "last_tested_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "atlassian_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pursuit_briefs" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "meeting_id" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "completeness" INTEGER NOT NULL DEFAULT 0,
    "linked_research_sessions" TEXT,
    "linked_transcripts" TEXT,
    "linked_case_studies" TEXT,
    "content" TEXT NOT NULL DEFAULT '',
    "question_answers" TEXT NOT NULL DEFAULT '{}',
    "transcript_answers" TEXT NOT NULL DEFAULT '{}',

    CONSTRAINT "pursuit_briefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_evaluations" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT,
    "rfp_file_name" TEXT NOT NULL,
    "proposal_file_name" TEXT NOT NULL,
    "pursuit_brief_file_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "compliance_score" INTEGER NOT NULL,
    "total_requirements" INTEGER NOT NULL,
    "addressed_count" INTEGER NOT NULL,
    "partial_count" INTEGER NOT NULL,
    "not_addressed_count" INTEGER NOT NULL,
    "mandatory_total" INTEGER NOT NULL,
    "mandatory_met" INTEGER NOT NULL,
    "analysis_data" TEXT NOT NULL,
    "executive_summary" TEXT NOT NULL,
    "win_loss_insights" TEXT NOT NULL,
    "critical_gaps" TEXT NOT NULL,
    "by_section" TEXT NOT NULL,
    "pursuit_brief_analysis" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "is_saved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "proposal_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_events" (
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "label" TEXT,
    "value" DOUBLE PRECISION,
    "duration" DOUBLE PRECISION,
    "user_id" TEXT,
    "session_id" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "metadata" TEXT,
    "context" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "rfp_research" (
    "research_id" TEXT NOT NULL,
    "file_name" TEXT,
    "file_type" TEXT,
    "company_name" TEXT,
    "rfp_summary" TEXT,
    "total_questions" INTEGER NOT NULL DEFAULT 0,
    "answered_questions" INTEGER NOT NULL DEFAULT 0,
    "average_confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "processing_time_ms" INTEGER NOT NULL DEFAULT 0,
    "questions_data" TEXT,
    "answers_data" TEXT,
    "custom_prompt" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "error_message" TEXT,
    "requested_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_saved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "rfp_research_pkey" PRIMARY KEY ("research_id")
);

-- CreateTable
CREATE TABLE "salesforce_syncs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "object_type" TEXT NOT NULL,
    "sf_object_id" TEXT NOT NULL,
    "local_object_id" TEXT,
    "last_synced_at" TIMESTAMP(3) NOT NULL,
    "sync_status" TEXT NOT NULL,
    "sync_direction" TEXT NOT NULL DEFAULT 'inbound',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salesforce_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "workspace_type" TEXT NOT NULL DEFAULT 'workshop_analysis',
    "source_documents" TEXT,
    "transcript_text" TEXT,
    "transcript_excerpt" TEXT,
    "workshop_date" TIMESTAMP(3),
    "workshop_duration" INTEGER,
    "client_name" TEXT,
    "analysis_status" TEXT NOT NULL DEFAULT 'pending',
    "analysis_result" TEXT,
    "miro_status" TEXT NOT NULL DEFAULT 'pending',
    "miro_board_id" TEXT,
    "miro_board_url" TEXT,
    "miro_snapshot" TEXT,
    "pptx_status" TEXT NOT NULL DEFAULT 'pending',
    "pptx_job_id" TEXT,
    "engagement_stage" TEXT,
    "workshop_focus" TEXT NOT NULL DEFAULT 'ITSM',
    "client_intelligence" TEXT,
    "preworkshop_survey" TEXT,
    "survey_doc_url" TEXT,
    "survey_responses" TEXT,
    "workshop_prep_miro_id" TEXT,
    "workshop_prep_miro_url" TEXT,
    "workshop_prep_miro_snapshot" TEXT,
    "workshop_prep_miro_status" TEXT DEFAULT 'pending',
    "workshop_prep_deck_url" TEXT,
    "workshop_prep_pptx_status" TEXT DEFAULT 'pending',
    "workshop_prep_pptx_job_id" TEXT,
    "workshop_prep_pptx_step" TEXT,
    "workshop_notes" TEXT,
    "miro_context_items" TEXT,
    "agent_mappings" TEXT,
    "agent_mapping_status" TEXT DEFAULT 'pending',
    "workshop_personas" TEXT,
    "workshop_pain_points" TEXT,
    "persona_mappings" TEXT,
    "persona_mapping_status" TEXT DEFAULT 'pending',
    "error_message" TEXT,
    "pipeline_log" TEXT,
    "requested_by" TEXT,
    "requested_by_email" TEXT,
    "account_id" TEXT,
    "deal_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "is_saved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("workspace_id")
);

-- CreateTable
CREATE TABLE "discovery_sessions" (
    "session_id" TEXT NOT NULL,
    "title" TEXT,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "requested_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_saved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "discovery_sessions_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "output_feedback" (
    "feedback_id" TEXT NOT NULL,
    "event_id" TEXT,
    "rating" TEXT NOT NULL,
    "comment" TEXT,
    "user_id" TEXT,
    "category" TEXT,
    "reference_id" TEXT,
    "metadata" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "output_feedback_pkey" PRIMARY KEY ("feedback_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deals_salesforce_id_key" ON "deals"("salesforce_id");

-- CreateIndex
CREATE INDEX "deals_opportunity_name_idx" ON "deals"("opportunity_name");

-- CreateIndex
CREATE INDEX "deals_company_name_idx" ON "deals"("company_name");

-- CreateIndex
CREATE INDEX "deals_account_id_idx" ON "deals"("account_id");

-- CreateIndex
CREATE INDEX "deals_servicenow_id_idx" ON "deals"("servicenow_id");

-- CreateIndex
CREATE INDEX "deals_jira_key_idx" ON "deals"("jira_key");

-- CreateIndex
CREATE INDEX "deals_created_at_idx" ON "deals"("created_at");

-- CreateIndex
CREATE INDEX "deals_type_idx" ON "deals"("type");

-- CreateIndex
CREATE INDEX "deals_lead_source_idx" ON "deals"("lead_source");

-- CreateIndex
CREATE INDEX "deals_forecast_category_idx" ON "deals"("forecast_category");

-- CreateIndex
CREATE INDEX "deals_is_closed_idx" ON "deals"("is_closed");

-- CreateIndex
CREATE INDEX "deals_contact_id_idx" ON "deals"("contact_id");

-- CreateIndex
CREATE INDEX "deals_salesforce_id_idx" ON "deals"("salesforce_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_salesforce_id_key" ON "accounts"("salesforce_id");

-- CreateIndex
CREATE INDEX "accounts_name_idx" ON "accounts"("name");

-- CreateIndex
CREATE INDEX "accounts_owner_idx" ON "accounts"("owner");

-- CreateIndex
CREATE INDEX "accounts_industry_idx" ON "accounts"("industry");

-- CreateIndex
CREATE INDEX "accounts_type_idx" ON "accounts"("type");

-- CreateIndex
CREATE INDEX "accounts_parent_account_id_idx" ON "accounts"("parent_account_id");

-- CreateIndex
CREATE INDEX "accounts_salesforce_id_idx" ON "accounts"("salesforce_id");

-- CreateIndex
CREATE INDEX "meetings_deal_id_idx" ON "meetings"("deal_id");

-- CreateIndex
CREATE INDEX "meetings_account_id_idx" ON "meetings"("account_id");

-- CreateIndex
CREATE INDEX "meetings_analysis_id_idx" ON "meetings"("analysis_id");

-- CreateIndex
CREATE INDEX "meetings_calendar_event_id_idx" ON "meetings"("calendar_event_id");

-- CreateIndex
CREATE INDEX "meetings_online_meeting_id_idx" ON "meetings"("online_meeting_id");

-- CreateIndex
CREATE INDEX "meetings_ical_uid_idx" ON "meetings"("ical_uid");

-- CreateIndex
CREATE INDEX "meetings_meeting_date_idx" ON "meetings"("meeting_date");

-- CreateIndex
CREATE INDEX "meetings_created_at_idx" ON "meetings"("created_at");

-- CreateIndex
CREATE INDEX "meeting_attendee_research_meeting_id_idx" ON "meeting_attendee_research"("meeting_id");

-- CreateIndex
CREATE INDEX "meeting_attendee_research_attendee_id_idx" ON "meeting_attendee_research"("attendee_id");

-- CreateIndex
CREATE INDEX "meeting_attendee_research_email_idx" ON "meeting_attendee_research"("email");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_attendee_research_meeting_id_key_attendee_type_key" ON "meeting_attendee_research"("meeting_id", "key", "attendee_type");

-- CreateIndex
CREATE INDEX "analyses_company_name_idx" ON "analyses"("company_name");

-- CreateIndex
CREATE INDEX "analyses_deal_id_idx" ON "analyses"("deal_id");

-- CreateIndex
CREATE INDEX "analyses_meeting_id_idx" ON "analyses"("meeting_id");

-- CreateIndex
CREATE INDEX "analyses_requested_by_idx" ON "analyses"("requested_by");

-- CreateIndex
CREATE INDEX "analyses_status_idx" ON "analyses"("status");

-- CreateIndex
CREATE INDEX "analyses_started_at_idx" ON "analyses"("started_at");

-- CreateIndex
CREATE INDEX "analyses_completed_at_idx" ON "analyses"("completed_at");

-- CreateIndex
CREATE UNIQUE INDEX "companies_company_name_key" ON "companies"("company_name");

-- CreateIndex
CREATE INDEX "companies_company_name_idx" ON "companies"("company_name");

-- CreateIndex
CREATE INDEX "companies_last_updated_idx" ON "companies"("last_updated");

-- CreateIndex
CREATE INDEX "attendees_name_idx" ON "attendees"("name");

-- CreateIndex
CREATE INDEX "attendees_email_idx" ON "attendees"("email");

-- CreateIndex
CREATE INDEX "attendees_company_idx" ON "attendees"("company");

-- CreateIndex
CREATE INDEX "documents_session_id_idx" ON "documents"("session_id");

-- CreateIndex
CREATE INDEX "documents_created_at_idx" ON "documents"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "api_cache_cache_key_key" ON "api_cache"("cache_key");

-- CreateIndex
CREATE INDEX "api_cache_cache_key_idx" ON "api_cache"("cache_key");

-- CreateIndex
CREATE INDEX "api_cache_cache_type_idx" ON "api_cache"("cache_type");

-- CreateIndex
CREATE INDEX "api_cache_expires_at_idx" ON "api_cache"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "transcript_analyses_proposal_job_id_key" ON "transcript_analyses"("proposal_job_id");

-- CreateIndex
CREATE UNIQUE INDEX "transcript_analyses_ppt_job_id_key" ON "transcript_analyses"("ppt_job_id");

-- CreateIndex
CREATE INDEX "transcript_analyses_deal_id_idx" ON "transcript_analyses"("deal_id");

-- CreateIndex
CREATE INDEX "transcript_analyses_account_id_idx" ON "transcript_analyses"("account_id");

-- CreateIndex
CREATE INDEX "transcript_analyses_meeting_id_idx" ON "transcript_analyses"("meeting_id");

-- CreateIndex
CREATE INDEX "transcript_analyses_company_name_idx" ON "transcript_analyses"("company_name");

-- CreateIndex
CREATE INDEX "transcript_analyses_created_at_idx" ON "transcript_analyses"("created_at");

-- CreateIndex
CREATE INDEX "transcript_analyses_is_saved_created_at_idx" ON "transcript_analyses"("is_saved", "created_at");

-- CreateIndex
CREATE INDEX "proposal_jobs_status_idx" ON "proposal_jobs"("status");

-- CreateIndex
CREATE INDEX "proposal_jobs_analysis_type_idx" ON "proposal_jobs"("analysis_type");

-- CreateIndex
CREATE INDEX "proposal_jobs_meeting_id_idx" ON "proposal_jobs"("meeting_id");

-- CreateIndex
CREATE INDEX "proposal_jobs_deal_id_idx" ON "proposal_jobs"("deal_id");

-- CreateIndex
CREATE INDEX "proposal_jobs_transcript_analysis_id_idx" ON "proposal_jobs"("transcript_analysis_id");

-- CreateIndex
CREATE INDEX "proposal_jobs_created_at_idx" ON "proposal_jobs"("created_at");

-- CreateIndex
CREATE INDEX "meeting_analysis_jobs_meeting_id_idx" ON "meeting_analysis_jobs"("meeting_id");

-- CreateIndex
CREATE INDEX "meeting_analysis_jobs_bulk_job_id_idx" ON "meeting_analysis_jobs"("bulk_job_id");

-- CreateIndex
CREATE INDEX "bulk_analysis_jobs_deal_id_idx" ON "bulk_analysis_jobs"("deal_id");

-- CreateIndex
CREATE INDEX "bulk_analysis_jobs_account_id_idx" ON "bulk_analysis_jobs"("account_id");

-- CreateIndex
CREATE INDEX "bulk_analysis_jobs_status_idx" ON "bulk_analysis_jobs"("status");

-- CreateIndex
CREATE INDEX "pptx_jobs_status_idx" ON "pptx_jobs"("status");

-- CreateIndex
CREATE INDEX "pptx_jobs_created_at_idx" ON "pptx_jobs"("created_at");

-- CreateIndex
CREATE INDEX "pptx_jobs_deal_id_idx" ON "pptx_jobs"("deal_id");

-- CreateIndex
CREATE INDEX "pptx_jobs_meeting_id_idx" ON "pptx_jobs"("meeting_id");

-- CreateIndex
CREATE INDEX "pptx_jobs_proposal_job_id_idx" ON "pptx_jobs"("proposal_job_id");

-- CreateIndex
CREATE INDEX "pptx_jobs_transcript_analysis_id_idx" ON "pptx_jobs"("transcript_analysis_id");

-- CreateIndex
CREATE INDEX "pursuit_brief_snapshots_deal_id_idx" ON "pursuit_brief_snapshots"("deal_id");

-- CreateIndex
CREATE INDEX "pursuit_brief_snapshots_meeting_id_idx" ON "pursuit_brief_snapshots"("meeting_id");

-- CreateIndex
CREATE INDEX "pursuit_brief_snapshots_transcript_analysis_id_idx" ON "pursuit_brief_snapshots"("transcript_analysis_id");

-- CreateIndex
CREATE INDEX "opportunities_deal_id_idx" ON "opportunities"("deal_id");

-- CreateIndex
CREATE INDEX "opportunities_meeting_id_idx" ON "opportunities"("meeting_id");

-- CreateIndex
CREATE INDEX "opportunities_transcript_analysis_id_idx" ON "opportunities"("transcript_analysis_id");

-- CreateIndex
CREATE UNIQUE INDEX "vector_indices_index_name_key" ON "vector_indices"("index_name");

-- CreateIndex
CREATE INDEX "vector_indices_index_name_idx" ON "vector_indices"("index_name");

-- CreateIndex
CREATE INDEX "vector_indices_last_updated_idx" ON "vector_indices"("last_updated");

-- CreateIndex
CREATE UNIQUE INDEX "embedding_documents_doc_id_key" ON "embedding_documents"("doc_id");

-- CreateIndex
CREATE INDEX "embedding_documents_doc_id_idx" ON "embedding_documents"("doc_id");

-- CreateIndex
CREATE INDEX "embedding_documents_index_name_idx" ON "embedding_documents"("index_name");

-- CreateIndex
CREATE INDEX "embedding_documents_content_hash_idx" ON "embedding_documents"("content_hash");

-- CreateIndex
CREATE INDEX "embedding_documents_vector_id_idx" ON "embedding_documents"("vector_id");

-- CreateIndex
CREATE INDEX "embedding_documents_created_at_idx" ON "embedding_documents"("created_at");

-- CreateIndex
CREATE INDEX "deal_case_studies_deal_id_idx" ON "deal_case_studies"("deal_id");

-- CreateIndex
CREATE INDEX "deal_case_studies_case_study_id_idx" ON "deal_case_studies"("case_study_id");

-- CreateIndex
CREATE INDEX "deal_case_studies_linked_at_idx" ON "deal_case_studies"("linked_at");

-- CreateIndex
CREATE INDEX "deal_services_deal_id_idx" ON "deal_services"("deal_id");

-- CreateIndex
CREATE INDEX "deal_services_service_id_idx" ON "deal_services"("service_id");

-- CreateIndex
CREATE INDEX "deal_services_linked_at_idx" ON "deal_services"("linked_at");

-- CreateIndex
CREATE INDEX "deal_action_plans_deal_id_idx" ON "deal_action_plans"("deal_id");

-- CreateIndex
CREATE INDEX "deal_action_plans_analysis_session_id_idx" ON "deal_action_plans"("analysis_session_id");

-- CreateIndex
CREATE INDEX "deal_action_plans_created_at_idx" ON "deal_action_plans"("created_at");

-- CreateIndex
CREATE INDEX "deal_questionnaires_deal_id_idx" ON "deal_questionnaires"("deal_id");

-- CreateIndex
CREATE INDEX "deal_questionnaires_analysis_session_id_idx" ON "deal_questionnaires"("analysis_session_id");

-- CreateIndex
CREATE INDEX "deal_questionnaires_created_at_idx" ON "deal_questionnaires"("created_at");

-- CreateIndex
CREATE INDEX "sales_team_members_name_idx" ON "sales_team_members"("name");

-- CreateIndex
CREATE INDEX "sales_team_members_email_idx" ON "sales_team_members"("email");

-- CreateIndex
CREATE INDEX "service_offerings_service_name_idx" ON "service_offerings"("service_name");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "user_calendar_meetings_user_id_start_utc_idx" ON "user_calendar_meetings"("user_id", "start_utc");

-- CreateIndex
CREATE INDEX "user_calendar_meetings_online_meeting_id_idx" ON "user_calendar_meetings"("online_meeting_id");

-- CreateIndex
CREATE INDEX "user_calendar_meetings_ical_uid_idx" ON "user_calendar_meetings"("ical_uid");

-- CreateIndex
CREATE UNIQUE INDEX "user_calendar_meetings_user_id_event_id_key" ON "user_calendar_meetings"("user_id", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_api_keys_user_id_key" ON "user_api_keys"("user_id");

-- CreateIndex
CREATE INDEX "user_api_keys_user_id_idx" ON "user_api_keys"("user_id");

-- CreateIndex
CREATE INDEX "user_api_keys_created_at_idx" ON "user_api_keys"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_graphs_graph_id_key" ON "knowledge_graphs"("graph_id");

-- CreateIndex
CREATE INDEX "knowledge_graphs_graph_type_idx" ON "knowledge_graphs"("graph_type");

-- CreateIndex
CREATE INDEX "knowledge_graphs_created_at_idx" ON "knowledge_graphs"("created_at");

-- CreateIndex
CREATE INDEX "knowledge_graphs_updated_at_idx" ON "knowledge_graphs"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_notification_id_key" ON "notifications"("notification_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_idx" ON "notifications"("user_id", "read");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_stages_stage_name_key" ON "opportunity_stages"("stage_name");

-- CreateIndex
CREATE INDEX "opportunity_stages_stage_name_idx" ON "opportunity_stages"("stage_name");

-- CreateIndex
CREATE INDEX "opportunity_stages_sort_order_idx" ON "opportunity_stages"("sort_order");

-- CreateIndex
CREATE INDEX "opportunity_stages_is_active_idx" ON "opportunity_stages"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_salesforce_id_key" ON "contacts"("salesforce_id");

-- CreateIndex
CREATE INDEX "contacts_account_id_idx" ON "contacts"("account_id");

-- CreateIndex
CREATE INDEX "contacts_email_idx" ON "contacts"("email");

-- CreateIndex
CREATE INDEX "contacts_last_name_idx" ON "contacts"("last_name");

-- CreateIndex
CREATE INDEX "contacts_owner_id_idx" ON "contacts"("owner_id");

-- CreateIndex
CREATE INDEX "contacts_reports_to_id_idx" ON "contacts"("reports_to_id");

-- CreateIndex
CREATE INDEX "contacts_salesforce_id_idx" ON "contacts"("salesforce_id");

-- CreateIndex
CREATE UNIQUE INDEX "enterprise_opportunity_mappings_analysis_session_id_key" ON "enterprise_opportunity_mappings"("analysis_session_id");

-- CreateIndex
CREATE INDEX "enterprise_opportunity_mappings_analysis_session_id_idx" ON "enterprise_opportunity_mappings"("analysis_session_id");

-- CreateIndex
CREATE INDEX "enterprise_opportunity_mappings_transcript_analysis_id_idx" ON "enterprise_opportunity_mappings"("transcript_analysis_id");

-- CreateIndex
CREATE INDEX "enterprise_opportunity_mappings_deal_id_idx" ON "enterprise_opportunity_mappings"("deal_id");

-- CreateIndex
CREATE INDEX "enterprise_opportunity_mappings_opportunity_category_idx" ON "enterprise_opportunity_mappings"("opportunity_category");

-- CreateIndex
CREATE INDEX "atlassian_assessments_company_name_idx" ON "atlassian_assessments"("company_name");

-- CreateIndex
CREATE INDEX "atlassian_assessments_meeting_id_idx" ON "atlassian_assessments"("meeting_id");

-- CreateIndex
CREATE INDEX "atlassian_assessments_status_idx" ON "atlassian_assessments"("status");

-- CreateIndex
CREATE INDEX "atlassian_assessments_created_at_idx" ON "atlassian_assessments"("created_at");

-- CreateIndex
CREATE INDEX "atlassian_assessments_is_saved_created_at_idx" ON "atlassian_assessments"("is_saved", "created_at");

-- CreateIndex
CREATE INDEX "atlassian_credentials_assessment_id_idx" ON "atlassian_credentials"("assessment_id");

-- CreateIndex
CREATE INDEX "atlassian_credentials_company_name_idx" ON "atlassian_credentials"("company_name");

-- CreateIndex
CREATE INDEX "proposal_evaluations_deal_id_idx" ON "proposal_evaluations"("deal_id");

-- CreateIndex
CREATE INDEX "proposal_evaluations_created_at_idx" ON "proposal_evaluations"("created_at");

-- CreateIndex
CREATE INDEX "proposal_evaluations_status_idx" ON "proposal_evaluations"("status");

-- CreateIndex
CREATE INDEX "proposal_evaluations_is_saved_created_at_idx" ON "proposal_evaluations"("is_saved", "created_at");

-- CreateIndex
CREATE INDEX "usage_events_event_type_idx" ON "usage_events"("event_type");

-- CreateIndex
CREATE INDEX "usage_events_category_idx" ON "usage_events"("category");

-- CreateIndex
CREATE INDEX "usage_events_user_id_idx" ON "usage_events"("user_id");

-- CreateIndex
CREATE INDEX "usage_events_session_id_idx" ON "usage_events"("session_id");

-- CreateIndex
CREATE INDEX "usage_events_created_at_idx" ON "usage_events"("created_at");

-- CreateIndex
CREATE INDEX "rfp_research_requested_by_idx" ON "rfp_research"("requested_by");

-- CreateIndex
CREATE INDEX "rfp_research_company_name_idx" ON "rfp_research"("company_name");

-- CreateIndex
CREATE INDEX "rfp_research_created_at_idx" ON "rfp_research"("created_at");

-- CreateIndex
CREATE INDEX "rfp_research_status_idx" ON "rfp_research"("status");

-- CreateIndex
CREATE INDEX "rfp_research_is_saved_created_at_idx" ON "rfp_research"("is_saved", "created_at");

-- CreateIndex
CREATE INDEX "salesforce_syncs_user_id_idx" ON "salesforce_syncs"("user_id");

-- CreateIndex
CREATE INDEX "salesforce_syncs_object_type_idx" ON "salesforce_syncs"("object_type");

-- CreateIndex
CREATE INDEX "salesforce_syncs_sync_status_idx" ON "salesforce_syncs"("sync_status");

-- CreateIndex
CREATE INDEX "salesforce_syncs_last_synced_at_idx" ON "salesforce_syncs"("last_synced_at");

-- CreateIndex
CREATE UNIQUE INDEX "salesforce_syncs_user_id_object_type_sf_object_id_key" ON "salesforce_syncs"("user_id", "object_type", "sf_object_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_pptx_job_id_key" ON "workspaces"("pptx_job_id");

-- CreateIndex
CREATE INDEX "workspaces_status_idx" ON "workspaces"("status");

-- CreateIndex
CREATE INDEX "workspaces_requested_by_idx" ON "workspaces"("requested_by");

-- CreateIndex
CREATE INDEX "workspaces_client_name_idx" ON "workspaces"("client_name");

-- CreateIndex
CREATE INDEX "workspaces_account_id_idx" ON "workspaces"("account_id");

-- CreateIndex
CREATE INDEX "workspaces_deal_id_idx" ON "workspaces"("deal_id");

-- CreateIndex
CREATE INDEX "workspaces_created_at_idx" ON "workspaces"("created_at");

-- CreateIndex
CREATE INDEX "workspaces_is_saved_created_at_idx" ON "workspaces"("is_saved", "created_at");

-- CreateIndex
CREATE INDEX "workspaces_workspace_type_idx" ON "workspaces"("workspace_type");

-- CreateIndex
CREATE INDEX "discovery_sessions_requested_by_created_at_idx" ON "discovery_sessions"("requested_by", "created_at");

-- CreateIndex
CREATE INDEX "discovery_sessions_is_saved_created_at_idx" ON "discovery_sessions"("is_saved", "created_at");

-- CreateIndex
CREATE INDEX "output_feedback_user_id_idx" ON "output_feedback"("user_id");

-- CreateIndex
CREATE INDEX "output_feedback_rating_idx" ON "output_feedback"("rating");

-- CreateIndex
CREATE INDEX "output_feedback_category_idx" ON "output_feedback"("category");

-- CreateIndex
CREATE INDEX "output_feedback_created_at_idx" ON "output_feedback"("created_at");

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("account_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("contact_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_parent_account_id_fkey" FOREIGN KEY ("parent_account_id") REFERENCES "accounts"("account_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("account_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("deal_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_attendee_research" ADD CONSTRAINT "meeting_attendee_research_attendee_id_fkey" FOREIGN KEY ("attendee_id") REFERENCES "attendees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_attendee_research" ADD CONSTRAINT "meeting_attendee_research_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("meeting_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("deal_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_analyses" ADD CONSTRAINT "transcript_analyses_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("account_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_analyses" ADD CONSTRAINT "transcript_analyses_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("deal_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_analyses" ADD CONSTRAINT "transcript_analyses_ppt_job_id_fkey" FOREIGN KEY ("ppt_job_id") REFERENCES "pptx_jobs"("job_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_analyses" ADD CONSTRAINT "transcript_analyses_proposal_job_id_fkey" FOREIGN KEY ("proposal_job_id") REFERENCES "proposal_jobs"("job_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_jobs" ADD CONSTRAINT "proposal_jobs_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("deal_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_jobs" ADD CONSTRAINT "proposal_jobs_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("meeting_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_jobs" ADD CONSTRAINT "proposal_jobs_transcript_analysis_id_fkey" FOREIGN KEY ("transcript_analysis_id") REFERENCES "transcript_analyses"("analysis_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_analysis_jobs" ADD CONSTRAINT "meeting_analysis_jobs_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("meeting_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_analysis_jobs" ADD CONSTRAINT "meeting_analysis_jobs_ppt_job_id_fkey" FOREIGN KEY ("ppt_job_id") REFERENCES "pptx_jobs"("job_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pptx_jobs" ADD CONSTRAINT "pptx_jobs_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("deal_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pptx_jobs" ADD CONSTRAINT "pptx_jobs_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("meeting_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pptx_jobs" ADD CONSTRAINT "pptx_jobs_proposal_job_id_fkey" FOREIGN KEY ("proposal_job_id") REFERENCES "proposal_jobs"("job_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pptx_jobs" ADD CONSTRAINT "pptx_jobs_transcript_analysis_id_fkey" FOREIGN KEY ("transcript_analysis_id") REFERENCES "transcript_analyses"("analysis_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pursuit_brief_snapshots" ADD CONSTRAINT "pursuit_brief_snapshots_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("deal_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pursuit_brief_snapshots" ADD CONSTRAINT "pursuit_brief_snapshots_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("meeting_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pursuit_brief_snapshots" ADD CONSTRAINT "pursuit_brief_snapshots_transcript_analysis_id_fkey" FOREIGN KEY ("transcript_analysis_id") REFERENCES "transcript_analyses"("analysis_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("deal_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("meeting_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_transcript_analysis_id_fkey" FOREIGN KEY ("transcript_analysis_id") REFERENCES "transcript_analyses"("analysis_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_case_studies" ADD CONSTRAINT "deal_case_studies_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("deal_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_services" ADD CONSTRAINT "deal_services_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("deal_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_services" ADD CONSTRAINT "deal_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "service_offerings"("service_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_action_plans" ADD CONSTRAINT "deal_action_plans_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("deal_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_questionnaires" ADD CONSTRAINT "deal_questionnaires_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("deal_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_calendar_meetings" ADD CONSTRAINT "user_calendar_meetings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_api_keys" ADD CONSTRAINT "user_api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("account_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_reports_to_id_fkey" FOREIGN KEY ("reports_to_id") REFERENCES "contacts"("contact_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enterprise_opportunity_mappings" ADD CONSTRAINT "enterprise_opportunity_mappings_analysis_session_id_fkey" FOREIGN KEY ("analysis_session_id") REFERENCES "analyses"("session_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlassian_assessments" ADD CONSTRAINT "atlassian_assessments_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("meeting_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlassian_credentials" ADD CONSTRAINT "atlassian_credentials_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "atlassian_assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pursuit_briefs" ADD CONSTRAINT "pursuit_briefs_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("deal_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pursuit_briefs" ADD CONSTRAINT "pursuit_briefs_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("meeting_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_pptx_job_id_fkey" FOREIGN KEY ("pptx_job_id") REFERENCES "pptx_jobs"("job_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("account_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("deal_id") ON DELETE SET NULL ON UPDATE CASCADE;
