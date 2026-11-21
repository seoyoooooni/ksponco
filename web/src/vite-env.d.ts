/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_VERSION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
