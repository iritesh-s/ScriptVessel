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