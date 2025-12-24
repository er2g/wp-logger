-- OCR jobs and document tracking

CREATE TABLE IF NOT EXISTS ocr_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    mode VARCHAR(20) NOT NULL DEFAULT 'missing',
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
    total_items INTEGER NOT NULL DEFAULT 0,
    processed_items INTEGER NOT NULL DEFAULT 0,
    succeeded_items INTEGER NOT NULL DEFAULT 0,
    failed_items INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    last_error TEXT
);

ALTER TABLE ocr_jobs
    ADD CONSTRAINT valid_ocr_job_status CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled'));

ALTER TABLE ocr_jobs
    ADD CONSTRAINT valid_ocr_job_mode CHECK (mode IN ('all', 'missing', 'failed'));

CREATE INDEX IF NOT EXISTS idx_ocr_jobs_status ON ocr_jobs(status);

CREATE TABLE IF NOT EXISTS ocr_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES ocr_jobs(id) ON DELETE CASCADE,
    media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ,
    provider VARCHAR(50),
    language VARCHAR(50),
    text TEXT,
    result_json JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ
);

ALTER TABLE ocr_documents
    ADD CONSTRAINT valid_ocr_document_status CHECK (status IN ('queued', 'processing', 'succeeded', 'failed', 'skipped'));

CREATE UNIQUE INDEX IF NOT EXISTS ux_ocr_documents_media_id ON ocr_documents(media_id);
CREATE INDEX IF NOT EXISTS idx_ocr_documents_status ON ocr_documents(status);
CREATE INDEX IF NOT EXISTS idx_ocr_documents_job_id ON ocr_documents(job_id);
