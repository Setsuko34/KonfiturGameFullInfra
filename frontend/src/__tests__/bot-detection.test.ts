import { describe, it, expect } from 'vitest'
import { isBot, extractIP } from '@/lib/bot-detection'

describe('isBot — bots malveillants bloqués', () => {
  it('détecte scrapy', () => {
    expect(isBot('Scrapy/2.11.0 (+https://scrapy.org)')).toBe(true)
  })
  it('détecte python-requests', () => {
    expect(isBot('python-requests/2.31.0')).toBe(true)
  })
  it('détecte curl', () => {
    expect(isBot('curl/7.68.0')).toBe(true)
  })
  it('détecte un UA vide', () => {
    expect(isBot('')).toBe(true)
  })
  it('détecte semrushbot', () => {
    expect(isBot('SemrushBot-SA/0.97')).toBe(true)
  })
  it('détecte nikto (scanner vulnérabilités)', () => {
    expect(isBot('Nikto/2.1.6')).toBe(true)
  })
})

describe('isBot — crawlers légitimes autorisés', () => {
  it('autorise Googlebot', () => {
    expect(isBot('Googlebot/2.1 (+http://www.google.com/bot.html)')).toBe(false)
  })
  it('autorise Twitterbot (previews OG)', () => {
    expect(isBot('Twitterbot/1.0')).toBe(false)
  })
  it('autorise facebookexternalhit (previews OG)', () => {
    expect(isBot('facebookexternalhit/1.1')).toBe(false)
  })
  it('autorise LinkedInBot', () => {
    expect(isBot('LinkedInBot/1.0 (+http://www.linkedin.com)')).toBe(false)
  })
  it('accepte un navigateur desktop normal', () => {
    expect(isBot('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')).toBe(false)
  })
  it('accepte un useragent mobile normal', () => {
    expect(isBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(false)
  })
})

describe('extractIP', () => {
  it('extrait depuis X-Forwarded-For', () => {
    const headers = new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' })
    expect(extractIP(headers)).toBe('1.2.3.4')
  })
  it('extrait depuis x-real-ip si pas de forwarded', () => {
    const headers = new Headers({ 'x-real-ip': '5.6.7.8' })
    expect(extractIP(headers)).toBe('5.6.7.8')
  })
  it('retourne unknown si aucun header IP', () => {
    expect(extractIP(new Headers())).toBe('unknown')
  })
})
