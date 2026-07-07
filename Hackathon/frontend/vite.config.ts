import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCENARIOS_DIR = path.resolve(__dirname, 'scenarios')

function ensureScenariosDir() {
  if (!fs.existsSync(SCENARIOS_DIR)) {
    fs.mkdirSync(SCENARIOS_DIR, { recursive: true })
  }
}

function scenariosApiPlugin(geminiApiKey?: string) {
  return {
    name: 'scenarios-api',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url.startsWith('/api/scenarios') && !req.url.startsWith('/api/analyze')) {
          return next()
        }

        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

        if (req.method === 'OPTIONS') {
          res.statusCode = 200
          res.end()
          return
        }

        // POST /api/analyze - LLM analysis
        if (req.method === 'POST' && req.url === '/api/analyze') {
          let body = ''
          req.on('data', (chunk: any) => { body += chunk })
          req.on('end', async () => {
            try {
              const payload = JSON.parse(body)
              const apiKey = geminiApiKey || process.env.GEMINI_API_KEY
              if (!apiKey) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: 'GEMINI_API_KEY environment variable is not set.' }))
                return
              }

              const prompt = `You are a Lead Spatial Data Analyst specializing in team structural integrity and positional architecture. Your job is to audit Team A's positional structure based on game telemetry frames.

[CRITICAL DOMAIN KNOWLEDGE & CALIBRATION]
- Attacking Third Context: Teams DO NOT and CANNOT statically dominate the attacking third. Low zone-of-influence numbers here (e.g., 15%–25%) are completely standard and expected. Do not frame a low attacking-third percentage as a failure or structural breakdown; it is simply where the team relies on active passes, shots, and dynamic actions rather than static space ownership.
- Metric Benchmarks: In a dense defensive block, finding even a single running channel (1), a single attacking overload (1), or ~10% exploitability in the opponent's half is highly successful and represents a great attacking platform. Evaluate these positively as viable breakthrough vectors, not negatively as "limited options."
- Location Context: Use the provided location attributes (left, right, center channels) to identify exactly where overloads and runs are clustered.

[DATA FORMAT RULE]
The provided payload contains a \`boardCount\`. 
- If \`boardCount == 1\`: Analyze the single standalone frame provided.
- If \`boardCount > 1\`: Analyze how Team A's structure mutates or holds over the sequence.

Do not give tactical instructions or subjective decision-making advice (e.g., do NOT say "Player 6 should pass to Player 9"). Instead, deliver an objective structural diagnostic report.

[OUTPUT CONSTRAINTS]
- Tone: Hyper-analytical, objective, structural, realistic about football metrics.
- Format: Use Markdown with bold headers. Use bullet points. Keep it highly concise (Max 3 bullets per section).
- Bullet Length: Keep bullet points extremely short, punchy, and scan-friendly (maximum 15 words per bullet point).
- Sentence Style: Use active voice and direct, high-density phrases instead of descriptive, compound sentences.
- NO DATA VOMIT: Do not repeat raw X/Y coordinates, angles, or math values in your prose paragraphs unless summarizing a key percentage.

Please provide the following architectural report:

1. **Spatial Structure Overview**
(Audit the stability, compactness, and compression of Team A's core structure. Acknowledge healthy defensive/midfield control blocks as solid foundations, without penalizing expected low attacking third ownership).

2. **Attacking Shape & Spatial Exploits** (Only evaluate if teamAPhase is "attacking")
(Highlight the positive structural openings created. Frame active overloads and running channels as high-value, successful launching points to break down the opponent block, specifying channel locations).

3. **Defensive Structural Gaps** (Only evaluate if teamAPhase is "defending")
(Identify chronic architectural flaws in Team A's defensive shape, such as persistent spaces left open to opponent runs or defensive overloads in specific channels).

4. **Key Structural Nodes**
(Identify which player jersey number serves as the critical node or terminal for progressing the shape. Do NOT print raw X or Y coordinates here. Simply explain the tactical significance of this player's positioning as a structural escape or progression target).

Here is the spatial telemetry data:
${JSON.stringify(payload, null, 2)}`

              const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash']
              let lastErrorText = ''
              let lastStatus = 500

              for (const modelName of modelsToTry) {
                const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    contents: [
                      {
                        parts: [
                          { text: prompt }
                        ]
                      }
                    ]
                  })
                })

                if (apiResponse.ok) {
                  const data: any = await apiResponse.json()
                  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.'
                  res.statusCode = 200
                  res.end(JSON.stringify({ analysis: text }))
                  return
                }

                lastStatus = apiResponse.status
                lastErrorText = await apiResponse.text()
              }

              res.statusCode = lastStatus
              res.end(JSON.stringify({ error: `Gemini API error: ${lastErrorText}` }))
            } catch (e: any) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: e.message }))
            }
          })
          return
        }

        try {
          ensureScenariosDir()
          const urlObj = new URL(req.url, 'http://localhost')
          const pathname = urlObj.pathname
          const parts = pathname.replace(/^\/api\/scenarios/, '').split('/').filter(Boolean)

          // GET /api/scenarios - List scenarios
          if (req.method === 'GET' && parts.length === 0) {
            const files = fs.readdirSync(SCENARIOS_DIR)
              .filter(file => file.endsWith('.json'))
            res.statusCode = 200
            res.end(JSON.stringify(files))
            return
          }

          // GET /api/scenarios/:name - Load scenario
          if (req.method === 'GET' && parts.length === 1) {
            const filename = parts[0]
            const filePath = path.join(SCENARIOS_DIR, filename)
            if (fs.existsSync(filePath)) {
              const content = fs.readFileSync(filePath, 'utf-8')
              res.statusCode = 200
              res.end(content)
            } else {
              res.statusCode = 404
              res.end(JSON.stringify({ error: 'Scenario not found' }))
            }
            return
          }

          // POST /api/scenarios/:name - Save scenario
          if (req.method === 'POST' && parts.length === 1) {
            const filename = parts[0]
            const filePath = path.join(SCENARIOS_DIR, filename)
            
            let body = ''
            req.on('data', (chunk: any) => { body += chunk })
            req.on('end', () => {
              try {
                JSON.parse(body)
                fs.writeFileSync(filePath, body, 'utf-8')
                res.statusCode = 200
                res.end(JSON.stringify({ success: true }))
              } catch (e: any) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: 'Invalid JSON: ' + e.message }))
              }
            })
            return
          }

          // POST /api/scenarios/:name/duplicate - Duplicate scenario
          if (req.method === 'POST' && parts.length === 2 && parts[1] === 'duplicate') {
            const filename = parts[0]
            const sourcePath = path.join(SCENARIOS_DIR, filename)
            const newName = urlObj.searchParams.get('newName')

            if (!newName) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'newName query parameter is required' }))
              return
            }

            const destPath = path.join(SCENARIOS_DIR, newName)
            if (fs.existsSync(sourcePath)) {
              fs.copyFileSync(sourcePath, destPath)
              res.statusCode = 200
              res.end(JSON.stringify({ success: true }))
            } else {
              res.statusCode = 404
              res.end(JSON.stringify({ error: 'Source scenario not found' }))
            }
            return
          }

          // DELETE /api/scenarios/:name - Delete scenario
          if (req.method === 'DELETE' && parts.length === 1) {
            const filename = parts[0]
            const filePath = path.join(SCENARIOS_DIR, filename)
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath)
              res.statusCode = 200
              res.end(JSON.stringify({ success: true }))
            } else {
              res.statusCode = 404
              res.end(JSON.stringify({ error: 'Scenario not found' }))
            }
            return
          }

          res.statusCode = 404
          res.end(JSON.stringify({ error: 'Endpoint not found' }))

        } catch (error: any) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: error.message }))
        }
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const geminiApiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY

  return {
    plugins: [react(), scenariosApiPlugin(geminiApiKey)],
  }
})
