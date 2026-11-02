/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** Gemini API key for the optional AI insight feature. */
    readonly VITE_GEMINI_API_KEY: string
    /** Deployed AniLust Express backend base URL (empty = direct mode). */
    readonly VITE_BACKEND_URL: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
