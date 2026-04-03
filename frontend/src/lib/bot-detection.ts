// ═══════════════════════════════════════════════════════════
// Détection de bots nuisibles — fonctions pures, Edge-compatible
//
// IMPORTANT : les crawlers de preview sociale légitimes sont
// en liste blanche. Les bloquer casserait les previews OG.
// ═══════════════════════════════════════════════════════════

// Crawlers légitimes à NE PAS bloquer (partage social, SEO benign)
const LEGITIMATE_CRAWLERS = [
  /twitterbot/i,
  /facebookexternalhit/i,
  /linkedinbot/i,
  /slackbot/i,
  /whatsapp/i,
  /telegrambot/i,
  /discordbot/i,
  /googlebot/i,
  /bingbot/i,
  /yandexbot/i,
  /applebot/i,
]

// Scrapers / outils d'automatisation abusifs à bloquer
const MALICIOUS_BOT_PATTERNS = [
  /scrapy/i,
  /python-requests/i,
  /python-urllib/i,
  /node-fetch/i,
  /go-http-client/i,
  /java\/\d/i,
  /curl\//i,
  /wget\//i,
  /libwww/i,
  /semrushbot/i,
  /ahrefsbot/i,
  /majesticbot/i,
  /mj12bot/i,
  /dotbot/i,
  /petalbot/i,
  /serpstatbot/i,
  /postman/i,
  /insomnia/i,
  /zgrab/i,
  /masscan/i,
  /nikto/i,
  /sqlmap/i,
]

export function isBot(userAgent: string): boolean {
  if (!userAgent || userAgent.trim().length === 0) return true
  // Laisser passer les crawlers légitimes en priorité
  if (LEGITIMATE_CRAWLERS.some(p => p.test(userAgent))) return false
  return MALICIOUS_BOT_PATTERNS.some(pattern => pattern.test(userAgent))
}

export function extractIP(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    // X-Forwarded-For peut contenir plusieurs IPs : "client, proxy1, proxy2"
    return forwarded.split(',')[0].trim()
  }
  return headers.get('x-real-ip') ?? 'unknown'
}
