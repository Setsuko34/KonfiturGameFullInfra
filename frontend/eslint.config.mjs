// Config ESLint flat (ESLint 9) — remplace .eslintrc.json depuis Next 16,
// qui a supprimé `next lint`. Le script `pnpm lint` appelle eslint directement.
import { defineConfig, globalIgnores } from 'eslint/config'
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

export default defineConfig([
  globalIgnores(['.next/**', 'out/**', 'coverage/**', 'next-env.d.ts']),
  nextCoreWebVitals,
  {
    rules: {
      // TODO(react-hooks-v7): dettes préexistantes révélées par les règles
      // React Compiler de eslint-plugin-react-hooks v7 (Next 16) —
      // composants créés dans le render (sidebars), setState dans les effets
      // (JamChat, useRealtimeChat), Date.now() dans le render (JamTeamsSection).
      // À repasser en 'error' après refactor dédié.
      'react-hooks/static-components': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
])
