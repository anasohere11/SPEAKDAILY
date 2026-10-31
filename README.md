# Speak Daily

Static site (`public/`) + two Netlify Functions (`netlify/functions/`). No build step, no dependencies.

## Environment variables (Netlify → Site configuration → Environment variables)
| Purpose | Variable | Notes |
|---|---|---|
| Speech-to-text (Whisper) | `GROQ_API_KEY` (free tier) or `OPENAI_API_KEY` | one is enough |
| Feedback LLM | `ANTHROPIC_API_KEY` (model `claude-sonnet-5-5`) or `GEMINI_API_KEY` (free tier) | Claude is used if set |

## Deploy
Push this folder to GitHub → Netlify → Add new site → Import from Git (no build command, publish dir `public`).
Or: `npm i -g netlify-cli && netlify login && netlify deploy --prod` (answer: create new site).
Then set the variables above and redeploy.

## Local test
`netlify dev` (needs the variables in a `.env` file, see `.env.example`).
