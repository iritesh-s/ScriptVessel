CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(24) NOT NULL,            -- Stores MongoDB user._id as a string
    problem_id VARCHAR(64) NOT NULL,
    language VARCHAR(32) NOT NULL,
    verdict VARCHAR(64) NOT NULL,
    runtime_ms NUMERIC(10, 2) DEFAULT 0,
    memory_mb NUMERIC(10, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_submissions_percentile 
ON submissions (problem_id, language, verdict, runtime_ms, memory_mb);