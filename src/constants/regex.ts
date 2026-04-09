export const EMAIL_REGEX: RegExp = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export const PASSWORD_REGEX: RegExp = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
export const SPECIAL_CHARS_REGEX: RegExp = /^[a-zA-ZÀ-ÿ'-\s]+$/;

export const TICKER_REPLACE_MULTIPLE_SPACES: RegExp = /\s+/g;
export const TICKER_DELETE_LAST_POINT: RegExp = /\.$/;
export const TICKER_DELETE_POINT: RegExp = /\.(?!com\b)/gi;
export const TICKER_COMMON_SPECIAL_CHARS_REGEX: RegExp = /[^'\.\p{L}\p{N}\s-]/gu;
export const TICKER_COMMON_WORD: RegExp = /\b(the|co|cothe|inc|corp|corporation|ltd|limited|plc|sa|ag|nv|llc|group|holdings?)\b/gi;
