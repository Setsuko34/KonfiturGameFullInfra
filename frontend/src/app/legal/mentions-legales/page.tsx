import type { Metadata } from 'next'
import { LegalTitle, Section, P, List, A } from '../_components'

export const metadata: Metadata = {
  title: 'Mentions légales',
  description: 'Mentions légales du site KonfiturGame conformément à la loi LCEN.',
  alternates: { canonical: '/legal/mentions-legales' },
}

export default function MentionsLegalesPage() {
  return (
    <>
      <LegalTitle updated="15 juillet 2026">Mentions légales</LegalTitle>

      <Section id="editeur" title="1. Éditeur du site">
        <P>
          Le site <strong>KonfiturGame</strong> (ci-après « le Site »), accessible à l&apos;adresse{' '}
          <A href="https://konfiturgame.fr">konfiturgame.fr</A>, est édité à titre non professionnel
          par un particulier (personne physique).
        </P>
        <P>
          Conformément à l&apos;article 6-III-2 de la loi n° 2004-575 du 21 juin 2004 pour la confiance
          dans l&apos;économie numérique (LCEN), l&apos;éditeur, personne physique éditant le Site à
          titre non professionnel, a choisi de ne pas rendre ses coordonnées publiques. Son identité
          et ses coordonnées ont été communiquées à l&apos;hébergeur (voir section 3), qui les tient à
          la disposition des autorités judiciaires.
        </P>
        <List>
          <li>Contact : <A href="mailto:contact@konfiturgame.fr">contact@konfiturgame.fr</A></li>
        </List>
      </Section>

      <Section id="publication" title="2. Directeur de la publication">
        <P>
          Le directeur de la publication est l&apos;éditeur du Site, personne physique mentionnée à la
          section 1, dont l&apos;identité est détenue par l&apos;hébergeur.
        </P>
      </Section>

      <Section id="hebergeur" title="3. Hébergement">
        <P>Le Site est hébergé par :</P>
        <List>
          <li>OVH SAS</li>
          <li>2 rue Kellermann, 59100 Roubaix, France</li>
          <li>Téléphone : +33 9 72 10 10 07</li>
          <li>
            Site web : <A href="https://www.ovhcloud.com">www.ovhcloud.com</A>
          </li>
        </List>
      </Section>

      <Section id="contact-dsa" title="4. Point de contact (DSA)">
        <P>
          Conformément aux articles 11 et 12 du Règlement (UE) 2022/2065 (Digital Services Act),
          un point de contact unique est mis à disposition des autorités et des utilisateurs pour
          toute communication relative au Site :
        </P>
        <List>
          <li>
            Contact (autorités et utilisateurs) :{' '}
            <A href="mailto:contact@konfiturgame.fr">contact@konfiturgame.fr</A>
          </li>
          <li>Langue de communication : français</li>
        </List>
      </Section>

      <Section id="propriete" title="5. Propriété intellectuelle">
        <P>
          La structure générale du Site, ainsi que les textes, logos et éléments graphiques le
          composant, sont la propriété de l&apos;éditeur, sauf mention contraire. Les projets,
          contenus et créations publiés par les utilisateurs restent la propriété de leurs auteurs
          respectifs. Toute reproduction non autorisée constitue une contrefaçon.
        </P>
      </Section>

      <Section id="donnees" title="6. Données personnelles">
        <P>
          Le traitement de vos données personnelles est décrit dans notre{' '}
          <A href="/legal/privacy">politique de confidentialité</A>. Les conditions d&apos;utilisation
          du Site sont détaillées dans les <A href="/legal/terms">conditions générales d&apos;utilisation</A>.
        </P>
      </Section>
    </>
  )
}