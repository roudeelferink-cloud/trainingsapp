import { bestandsCache } from './cache'
import { maakClaudeClient, type ModelClient } from './claude'
import { loadEnvFile, readConfig } from './config'
import { maakServer } from './http'
import { log } from './log'

/**
 * Het startpunt: instellingen lezen, de onderdelen aan elkaar knopen, luisteren.
 *
 * Standaard luistert hij op 127.0.0.1. Van buiten komt er dus niets binnen; wat er wél
 * bij mag komt via `tailscale serve` en de nginx ernaast, en die zit op hetzelfde
 * toestel. In de container staat REVIEW_HOST op 0.0.0.0 omdat nginx dan uit een andere
 * container komt — die container publiceert geen poort naar buiten, dus het net waar hij
 * op zit is het compose-netwerk en verder niets.
 */

loadEnvFile(new URL('../.env', import.meta.url).pathname)
const config = readConfig()

if (!config.apiKey) {
  log('let op: geen ANTHROPIC_API_KEY gevonden. /api/review geeft 503 tot hij er staat.')
}

// pas maken als hij nodig is, en daarna hergebruiken
let client: ModelClient | null = null
const geefClient = (): ModelClient => {
  if (!client) client = maakClaudeClient(config)
  return client
}

const server = maakServer({
  client: geefClient,
  cache: bestandsCache(config.cacheFile),
  weken: config.weken,
  nu: () => new Date(),
})

server.listen(config.port, config.host, () => {
  log(`luistert op http://${config.host}:${config.port} — model ${config.model}, effort ${config.effort}`)
})

for (const signaal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signaal, () => {
    log(`${signaal}: afsluiten`)
    server.close(() => process.exit(0))
  })
}
