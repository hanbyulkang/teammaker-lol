# teammaker.lol

Balanced in-house team generator for League of Legends.
Role-aware, rank-aware, constraint-supported — for Discord servers, friend groups, and community scrims.

## Features

- **Smart balancing**: Not just rank totals. Role comfort, autofill penalties, and champion pool depth all factor in.
- **Hard constraints**: Force players together or onto opposite teams. Impossible constraints are caught early.
- **Bilingual**: Full English and Korean support via next-intl.
- **Fast**: C(10,5) × 5! optimizer runs in milliseconds in a Vercel serverless function.
- **Shareable lobbies**: Results are stored and accessible via URL.
- **Launch-ready**: Privacy Policy, Terms of Service, Contact, and Legal Notice pages included.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui primitives |
| i18n | next-intl |
| Database | Prisma + PostgreSQL (Neon recommended) |
| Validation | Zod |
| Deployment | Vercel |

---

## Quick Start (Local Development)

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in:

```env
RIOT_API_KEY=RGAPI-your-key-here
DATABASE_URL=postgresql://...
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_CONTACT_EMAIL=hello@teammaker.lol
```

**Getting a Riot API key:**
- Development key (rate limited): https://developer.riotgames.com/
- For production use, apply for a Personal or Production key via the Riot developer portal.

**Getting a Neon database:**
- Sign up at https://neon.tech
- Create a new project → copy the connection string

### 3. Initialize the database

```bash
npm run db:push
# or for migrations:
npm run db:migrate
```

### 4. Run the dev server

```bash
npm run dev
```

Open http://localhost:3000

---

## Deploying to Vercel

### Option A: Vercel Dashboard (recommended for first deploy)

1. Push this repo to GitHub
2. Go to https://vercel.com/new and import the repo
3. Add environment variables (see below)
4. Click Deploy

### Option B: Vercel CLI

```bash
npm i -g vercel
vercel login
vercel --prod
```

### Required Environment Variables

Set these in the Vercel dashboard under **Project → Settings → Environment Variables**:

| Variable | Description | Required |
|---|---|---|
| `RIOT_API_KEY` | Riot Games API key | Yes |
| `DATABASE_URL` | PostgreSQL connection string (Neon recommended) | Yes |
| `NEXT_PUBLIC_APP_URL` | Your production URL, e.g. `https://teammaker.lol` | Yes |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Contact email shown in footer | No |

### Database Setup on Vercel

After deploying, run the database migration once using Vercel's build command or manually:

Option 1 — Add to build command in Vercel dashboard:
```
prisma generate && prisma db push && next build
```

Option 2 — Run manually after first deploy:
```bash
DATABASE_URL="your-neon-url" npx prisma db push
```

### Neon + Prisma Configuration

For Neon Postgres, your `DATABASE_URL` should use the **pooled** connection string:
```
postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

---

## Architecture

```
app/
├── api/
│   ├── riot/resolve/          # POST: resolve Riot IDs → player profiles
│   └── lobby/
│       ├── route.ts           # POST: create lobby
│       └── [id]/
│           ├── route.ts       # GET: fetch lobby
│           └── generate/      # POST: run optimizer → save result
├── [locale]/
│   ├── page.tsx               # Homepage (input → review → result)
│   ├── lobby/[id]/page.tsx    # Shareable result page
│   ├── privacy/               # Privacy Policy
│   ├── terms/                 # Terms of Service
│   ├── contact/               # Contact page
│   └── legal/                 # Legal Notice
lib/
├── riot/                      # Riot API client
├── analysis/                  # Rank mapping, role inference, profile builder
└── optimizer/                 # Constraint validation, scoring, team optimizer
```

### Balancing Algorithm

1. **Profile building**: For each player, fetch rank + last 20 matches → compute `baseSkill` score and role comfort for all 5 roles.
2. **Constraint validation**: Union-Find groups TOGETHER players, validates OPPOSITE constraints don't conflict.
3. **Enumeration**: Generate all C(10,5) = 252 candidate team splits.
4. **Pruning**: Skip splits that violate hard constraints.
5. **Role assignment**: For each valid split, find the optimal role assignment by brute-forcing 5! = 120 permutations per team.
6. **Selection**: Rank splits by (a) strength gap, (b) off-role count, (c) total role quality. Return the best.
7. **Explanation**: Generate human-readable bullets explaining why this split was chosen.

Total: up to ~3.6M evaluations, runs in <50ms.

### Rate Limit Handling

- Player profiles (rank + match data) are cached in Postgres for 30 minutes.
- Match details are cached for 7 days (matches don't change).
- With a development API key: support for small groups with some waiting between sessions.
- With a Personal/Production key: full concurrent support.

---

## Customization

### Changing the balance weights

`lib/optimizer/teamOptimizer.ts` → `betterThan()` function controls the trade-off between strength gap and role quality.

### Adjusting role comfort bonuses

`lib/analysis/roleInference.ts` → `ROLE_COMFORT_BONUSES` constants.

### Adding more platforms

`lib/riot/constants.ts` → `PLATFORMS` array.

---

## Legal

teammaker.lol is not endorsed by Riot Games. See `/legal` page for full disclaimer.

League of Legends and Riot Games are trademarks of Riot Games, Inc.
