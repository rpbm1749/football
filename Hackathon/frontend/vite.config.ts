import { defineConfig } from 'vite'
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

function scenariosApiPlugin() {
  return {
    name: 'scenarios-api',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url.startsWith('/api/scenarios')) {
          return next()
        }

        ensureScenariosDir()
        const urlObj = new URL(req.url, 'http://localhost')
        const pathname = urlObj.pathname
        const parts = pathname.replace(/^\/api\/scenarios/, '').split('/').filter(Boolean)

        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

        if (req.method === 'OPTIONS') {
          res.statusCode = 200
          res.end()
          return
        }

        try {
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
export default defineConfig({
  plugins: [react(), scenariosApiPlugin()],
})
