import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { getProjectById } from '@/lib/actions/projects'
import { generateProjectJsonLd, truncateDescription } from '@/lib/seo'
import { getCommentsByProject } from '@/lib/actions/comments'
import ProjectInteractions from './ProjectInteractions'

interface Props {
  params: { projectId: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = await getProjectById(params.projectId)
  if (!project) return { title: 'Projet introuvable', robots: { index: false } }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://konfiturgame.fr'
  const ogUrl = `/og?type=project&title=${encodeURIComponent(project.title)}`

  return {
    title: project.title,
    description: truncateDescription(project.description),
    keywords: project.technologies,
    openGraph: {
      title: project.title,
      description: truncateDescription(project.description),
      type: 'website',
      url: `${siteUrl}/project/${project.id}`,
      images: [{ url: ogUrl, width: 1200, height: 630, alt: project.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: project.title,
      description: truncateDescription(project.description),
      images: [ogUrl],
    },
    alternates: { canonical: `/project/${project.id}` },
  }
}

export default async function ProjectPage({ params }: Props) {
  const [project, initialComments] = await Promise.all([
    getProjectById(params.projectId),
    getCommentsByProject(params.projectId),
  ])

  if (!project) notFound()

  return (
    <>
      <Header />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(generateProjectJsonLd(project, process.env.NEXT_PUBLIC_SITE_URL || 'https://konfiturgame.fr')),
        }}
      />
      <main id="main-content">
        {/* Hero projet */}
        <div
          className="border-b px-4 sm:px-6 lg:px-8 py-10"
          style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
        >
          <div className="max-w-5xl mx-auto">
            <p className="label-tech mb-2" style={{ color: 'var(--primary)' }}>
              PROJET
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold mb-3">{project.title}</h1>
            <p className="text-base mb-6" style={{ color: 'var(--muted-foreground)' }}>
              {project.description}
            </p>
            <ProjectInteractions
              projectId={project.id}
              initialVotesCount={project.votesCount}
              downloadUrl={project.downloadUrl}
              repoUrl={project.repoUrl}
              initialComments={initialComments}
              initialReported={project.reported ?? false}
            />
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {/* Screenshots */}
              {(project.screenshotIds ?? []).length > 0 && (
                <section aria-labelledby="screenshots-heading">
                  <h2 id="screenshots-heading" className="text-xl font-bold mb-4">
                    Screenshots
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    {(project.screenshotIds ?? []).map((id, i) => (
                      <div
                        key={id}
                        className="aspect-video"
                        style={{ background: 'var(--surface-elevated)' }}
                        role="img"
                        aria-label={`Screenshot ${i + 1}`}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Sidebar */}
            <aside aria-label="Informations du projet">
              <div
                className="p-5 border"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <h3 className="label-tech mb-4" style={{ color: 'var(--muted-foreground)' }}>
                  TECHNOLOGIES
                </h3>
                <div className="flex flex-wrap gap-2 mb-6">
                  {project.technologies.map(tech => (
                    <span
                      key={tech}
                      className="label-tech px-2 py-1"
                      style={{
                        background: 'var(--surface-elevated)',
                        border: '1px solid var(--border)',
                        color: 'var(--muted-foreground)',
                      }}
                    >
                      {tech}
                    </span>
                  ))}
                </div>

                {project.submitted && (
                  <div>
                    <h3 className="label-tech mb-2" style={{ color: 'var(--muted-foreground)' }}>
                      SOUMISSION
                    </h3>
                    <p className="label-tech" style={{ color: 'var(--success)' }}>
                      ✓ SOUMIS
                    </p>
                    {project.submissionDate && (
                      <time
                        className="text-xs mt-1 block"
                        style={{ color: 'var(--muted-foreground)' }}
                        dateTime={project.submissionDate.toISOString()}
                      >
                        {project.submissionDate.toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    )}
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
