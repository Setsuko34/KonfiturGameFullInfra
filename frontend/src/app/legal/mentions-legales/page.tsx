import type { Metadata } from 'next'
import { LegalTitle, Section, P, List, A, Todo } from '../_components'

export const metadata: Metadata = {
  title: 'Mentions légales',
  description: 'Mentions légales du site KonfiturGame conformément à la loi LCEN.',
  alternates: { canonical: '/legal/mentions-legales' },
}

export default function MentionsLegalesPage() {
  return (
    <>
      <LegalTitle updated="4 juin 2026">Mentions légales</LegalTitle>

      <Section id="editeur" title="1. Éditeur du site">
        <P>
          Le site <strong>KonfiturGame</strong> (ci-après « le Site »), accessible à l&apos;adresse{' '}
          <A href="https://konfiturgame.fr">konfiturgame.fr</A>, est édité par :
        </P>
        <List>
          <li>Dénomination / éditeur : <Todo>nom ou raison sociale de l&apos;éditeur</Todo></li>
          <li>Statut juridique : <Todo>forme juridique (association, SAS, auto-entrepreneur…)</Todo></li>
          <li>Adresse : <Todo>adresse postale du siège</Todo></li>
          <li>Email : <A href="mailto:contact@konfiturgame.fr">contact@konfiturgame.fr</A></li>
          <li>Numéro d&apos;immatriculation (RCS / SIREN), le cas échéant : <Todo>SIREN / RCS</Todo></li>
          <li>Numéro de TVA intracommunautaire, le cas échéant : <Todo>TVA intracommunautaire</Todo></li>
        </List>
      </Section>

      <Section id="publication" title="2. Directeur de la publication">
        <P>
          Directeur / Directrice de la publication : <Todo>nom du directeur de la publication</Todo>.
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