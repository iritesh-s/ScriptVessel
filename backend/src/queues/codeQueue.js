import {Queue} from 'bullmq';

const connection = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    // password: process.env.REDIS_PASSWORD || '', // Good to have for production

};

const executionQueue = new Queue('executions', {connection});

const addToQueue = async (language , code) => {
    const job = executionQueue.add(
        "code-execution",
        {
            language , code
        },
        {
            attempts: 3,
            backoff: {
                type: "exponential",
                delay: 1000
            }
        }
    )
    return job;
}
export{
    executionQueue,
    connection,
    addToQueue
}