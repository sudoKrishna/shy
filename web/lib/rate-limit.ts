const WINDOW_MS = 60000;
const MAX_REQUEST = 5;

interface Bucket {
    count : number;
    resetAt : number;
}

const buckets = new Map<string , Bucket>();

export function checkRateLimit(key : string) {
    const now = Date.now();
    const bucket = buckets.get(key);

    if(!bucket || now >= bucket.resetAt) {
       buckets.set(key, {
        count : 1,
        resetAt : now +  WINDOW_MS,
       })

       return {
        allowed : true,
        retryAfterSeconds : 0,
       }
    }

    if(bucket.count >= MAX_REQUEST) {
        const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000) 

        return {
            allowed : false,
            retryAfterSeconds,
        }
    }

    bucket.count++;

    return {
        allowed : true, 
        retryAfterSeconds : 0,
    }

    
}