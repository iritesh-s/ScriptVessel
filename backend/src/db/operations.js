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

/**
 * Fetches a single submission by ID, including the full submitted code.
 */
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
