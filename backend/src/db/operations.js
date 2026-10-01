import { pgPool } from "./index.js";
export const saveSubmission = async ({
    userId,
    problemId,
    code,
    language,
    verdict,
    runtimeMs = 0,
    memoryMb = 0
}) => {
    const query = `
        INSERT INTO submissions (user_id, problem_id, code, language, verdict, runtime_ms, memory_mb)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, created_at;
    `;
    const values = [userId, problemId, code, language, verdict, runtimeMs, memoryMb];
    const { rows } = await pgPool.query(query, values);
    return rows[0];
};

export const getSubmissions = async ({ userId, problemId, limit = 20, offset = 0 }) => {
    const query = `
        SELECT 
            id,
            user_id,
            problem_id,
            language,
            verdict,
            runtime_ms,
            memory_mb,
            created_at
        FROM submissions 
        WHERE user_id = $1 
          AND problem_id = $2 
          AND verdict != 'System Error'
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4;
    `;

    const values = [userId, problemId, limit, offset];
    const { rows } = await pgPool.query(query, values);
    return rows;
};

export const getSubmissionById = async (submissionId, userId) => {
    const query = `
        SELECT 
            id,
            user_id,
            problem_id,
            code,
            language,
            verdict,
            runtime_ms,
            memory_mb,
            created_at
        FROM submissions 
        WHERE id = $1 AND user_id = $2;
    `;

    const { rows } = await pgPool.query(query, [submissionId, userId]);
    return rows[0] || null;
};
export const calculateSubmissionMetrics = async ({
    problemId,   
    language,    
    runtimeMs,
    memoryMb
}) => {
    try {
        const metricsQuery = `
            SELECT 
                -- Calculate % of Accepted submissions IN THIS LANGUAGE that were SLOWER
                COALESCE(ROUND((COUNT(*) FILTER (WHERE runtime_ms > $1)::NUMERIC / NULLIF(COUNT(*) - 1, 0)) * 100, 2), 100.00) AS beats_runtime,
                
                -- Calculate % of Accepted submissions IN THIS LANGUAGE that used MORE MEMORY
                COALESCE(ROUND((COUNT(*) FILTER (WHERE memory_mb > $2)::NUMERIC / NULLIF(COUNT(*) - 1, 0)) * 100, 2), 100.00) AS beats_memory,
                
                COUNT(*)::INTEGER AS total_accepted
            FROM submissions
            WHERE problem_id = $3
              AND language = $4
              AND verdict = 'Accepted';
        `;

        const { rows } = await pgPool.query(metricsQuery, [
            runtimeMs,
            memoryMb,
            problemId,
            language
        ]);

        const row = rows[0];
        
        return {
            beatsRuntime: parseFloat(row.beats_runtime),
            beatsMemory: parseFloat(row.beats_memory),
            totalAccepted: row.total_accepted
        };

    } catch (error) {
        console.error('Error calculating submission percentiles:', error);
        // Fallback gracefully so the UI doesn't crash if the metrics calculation fails
        return {
            beatsRuntime: 0,
            beatsMemory: 0,
            totalAccepted: 0
        };
    }
};

export const getProblemDistributions = async (problemId, language) => {
    // 1. Define bucket parameters (can be adjusted based on problem difficulty)
    const RUNTIME_BIN_MS = 7;
    const MAX_RUNTIME_CAP = 200; 

    const MEMORY_BIN_MB = 4;
    const MAX_MEMORY_CAP = 100;

    const runtimeQuery = `
        SELECT LEAST(FLOOR(runtime_ms / $1) * $1, $2)::INTEGER AS bucket, COUNT(*)::INTEGER AS count
        FROM submissions
        WHERE problem_id = $3 AND language = $4 AND verdict = 'Accepted'
        GROUP BY bucket ORDER BY bucket ASC;
    `;

    const memoryQuery = `
        SELECT LEAST(FLOOR(memory_mb / $1) * $1, $2)::INTEGER AS bucket, COUNT(*)::INTEGER AS count
        FROM submissions
        WHERE problem_id = $3 AND language = $4 AND verdict = 'Accepted'
        GROUP BY bucket ORDER BY bucket ASC;
    `;

    // 2. Execute both queries in parallel
    const [runtimeRes, memoryRes] = await Promise.all([
        pgPool.query(runtimeQuery, [RUNTIME_BIN_MS, MAX_RUNTIME_CAP, problemId, language]),
        pgPool.query(memoryQuery, [MEMORY_BIN_MB, MAX_MEMORY_CAP, problemId, language])
    ]);

    // 3. Format the output for the frontend charting library (e.g., Recharts or Chart.js)
    return {
        runtimeDistribution: runtimeRes.rows.map(row => ({
            bin: `${row.bucket}ms`, 
            count: row.count
        })),
        memoryDistribution: memoryRes.rows.map(row => ({
            bin: `${row.bucket}MB`, 
            count: row.count
        }))
    };
};