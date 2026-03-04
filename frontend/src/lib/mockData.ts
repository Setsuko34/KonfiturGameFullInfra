import type { GameJam, Team, Project, ChatMessage, Announcement, PastWinner, SiteStats } from '@/types'

// ═══ Game Jams ═══

export const mockJams: GameJam[] = [
  {
    id: 'jam-001',
    slug: 'spring-jam-2025',
    title: 'Spring Jam 2025',
    theme: 'La renaissance',
    description: 'Créez un jeu autour du thème de la renaissance — nouvelle vie, nouveau départ, transformation. Toutes les formes de renaissance sont acceptées : naturelle, technologique, personnelle...',
    status: 'ongoing',
    type: 'both',
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
    duration: '72h',
    participants: 142,
    maxParticipants: 200,
    rules: [
      'Le jeu doit être créé pendant la durée de la jam',
      'Toute technologie est acceptée',
      'Les assets pré-créés sont autorisés si déclarés',
      'Le jeu doit être jouable dans un navigateur ou téléchargeable',
    ],
    prizes: ['500€', '250€', '100€'],
    organizer: 'KonfiturGame',
    organizerId: 'user-organizer-001',
    tags: ['2D', 'Toutes technologies', 'Débutants bienvenus'],
  },
  {
    id: 'jam-002',
    slug: 'pixel-jam-2025',
    title: 'Pixel Jam 2025',
    theme: 'Glitch',
    description: 'Un jam 100% pixel art où les bugs deviennent des features. Exploitez les glitches, les erreurs, les anomalies comme mécaniques de jeu.',
    status: 'upcoming',
    type: 'team',
    startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    duration: '72h',
    participants: 0,
    maxParticipants: 100,
    rules: [
      'Pixel art obligatoire (résolution max 64×64 par sprite)',
      'Équipes de 2 à 4 personnes uniquement',
      'Moteur libre',
    ],
    prizes: ['300€', '150€', '50€'],
    organizer: 'PixelCrew',
    organizerId: 'user-organizer-002',
    tags: ['Pixel Art', 'Équipe', '72h'],
  },
  {
    id: 'jam-003',
    slug: 'solo-jam-2025',
    title: 'Solo Challenge',
    theme: 'Seul contre tous',
    description: 'Relevez le défi ultime : créer un jeu complet en solo en seulement 48 heures.',
    status: 'upcoming',
    type: 'solo',
    startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000),
    duration: '48h',
    participants: 0,
    rules: [
      'Solo uniquement — pas de collaboration',
      'Assets générés par IA autorisés',
      'Toute technologie acceptée',
    ],
    organizer: 'KonfiturGame',
    organizerId: 'user-organizer-001',
    tags: ['Solo', '48h', 'Défi'],
  },
  {
    id: 'jam-004',
    slug: 'winter-jam-2024',
    title: 'Winter Jam 2024',
    theme: 'Chaleur',
    description: 'Créez un jeu qui réchauffe les cœurs pendant l\'hiver.',
    status: 'ended',
    type: 'both',
    startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() - 87 * 24 * 60 * 60 * 1000),
    duration: '72h',
    participants: 189,
    rules: [],
    prizes: ['500€', '250€', '100€'],
    organizer: 'KonfiturGame',
    organizerId: 'user-organizer-001',
    tags: ['Hiver', 'Terminé'],
  },
]

// ═══ Past Winners ═══

export const mockWinners: PastWinner[] = [
  {
    id: 'winner-001',
    jamId: 'jam-004',
    jamTitle: 'Winter Jam 2024',
    jamYear: 2024,
    placement: 1,
    projectTitle: 'Cozy Hearth',
    teamName: 'Les Pixels Chauds',
  },
  {
    id: 'winner-002',
    jamId: 'jam-004',
    jamTitle: 'Winter Jam 2024',
    jamYear: 2024,
    placement: 2,
    projectTitle: 'Firefly Dreams',
    teamName: 'NightCode',
  },
  {
    id: 'winner-003',
    jamId: 'jam-004',
    jamTitle: 'Winter Jam 2024',
    jamYear: 2024,
    placement: 3,
    projectTitle: 'Snowflake',
    teamName: 'Solo Dev',
  },
]

// ═══ Stats globales ═══

export const mockStats: SiteStats = {
  jamsOrganized: 24,
  participants: 1847,
  projectsSubmitted: 412,
  countriesRepresented: 18,
}

// ═══ Chat Messages ═══

export const mockChatMessages: ChatMessage[] = [
  {
    id: 'msg-001',
    jamId: 'jam-001',
    channel: 'general',
    authorId: 'user-001',
    authorName: 'KonfiturGame',
    content: 'Bienvenue dans Spring Jam 2025 ! Le thème est "La renaissance". Bonne chance à tous !',
    role: 'organizer',
    pinned: true,
    createdAt: new Date(Date.now() - 60 * 60 * 1000),
  },
  {
    id: 'msg-002',
    jamId: 'jam-001',
    channel: 'general',
    authorId: 'user-002',
    authorName: 'DevPixel',
    content: 'Super thème ! Je pars sur un jeu de plateforme avec une plante qui renaît après chaque mort.',
    role: 'user',
    pinned: false,
    createdAt: new Date(Date.now() - 55 * 60 * 1000),
  },
  {
    id: 'msg-003',
    jamId: 'jam-001',
    channel: 'team-search',
    authorId: 'user-003',
    authorName: 'ArtistMH',
    content: 'Cherche une équipe ! Je suis pixel artist, disponible tout le weekend. DM bienvenu.',
    role: 'user',
    pinned: false,
    createdAt: new Date(Date.now() - 30 * 60 * 1000),
  },
]

// ═══ Announcements ═══

export const mockAnnouncements: Announcement[] = [
  {
    id: 'ann-001',
    jamId: 'jam-001',
    title: 'Le thème est révélé !',
    content: 'Le thème de Spring Jam 2025 est **"La renaissance"**. Toutes les interprétations sont valides. Bonne chance !',
    important: true,
    authorId: 'user-organizer-001',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
  {
    id: 'ann-002',
    jamId: 'jam-001',
    title: 'Discord officiel',
    content: 'Rejoignez notre serveur Discord pour des discussions en temps réel, de l\'entraide et le stream de la cérémonie de clôture.',
    important: false,
    authorId: 'user-organizer-001',
    createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
  },
]
