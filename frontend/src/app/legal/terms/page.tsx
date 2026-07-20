import type { Metadata } from 'next'
import { LegalTitle, Section, P, List, A } from '../_components'

export const metadata: Metadata = {
  title: "Conditions d'utilisation",
  description:
    "Conditions générales d'utilisation de la plateforme de game jams KonfiturGame.",
  alternates: { canonical: '/legal/terms' },
}

export default function TermsPage() {
  return (
    <>
      <LegalTitle updated="4 juin 2026">Conditions générales d&apos;utilisation</LegalTitle>

      <Section id="objet" title="1. Objet">
        <P>
          Les présentes conditions générales d&apos;utilisation (« CGU ») régissent l&apos;accès et
          l&apos;utilisation de la plateforme KonfiturGame (« le Service »), un site dédié à
          l&apos;organisation et à la participation à des game jams. En utilisant le Service, vous
          acceptez sans réserve les présentes CGU.
        </P>
      </Section>

      <Section id="acces" title="2. Accès au Service et compte">
        <List>
          <li>
            La consultation des jams et projets publics est libre. La participation (création de
            projets, commentaires, chat, likes) nécessite la création d&apos;un compte.
          </li>
          <li>
            La création d&apos;un compte est réservée aux personnes âgées d&apos;au moins 15 ans, ou
            disposant du consentement d&apos;un titulaire de l&apos;autorité parentale.
          </li>
          <li>
            Vous êtes responsable de la confidentialité de vos identifiants et de toute activité
            réalisée depuis votre compte.
          </li>
          <li>
            Les informations relatives au traitement de vos données figurent dans notre{' '}
            <A href="/legal/privacy">politique de confidentialité</A>.
          </li>
        </List>
      </Section>

      <Section id="regles" title="3. Règles de contenu et de comportement">
        <P>
          En publiant du contenu (projets, commentaires, messages, noms d&apos;équipe), vous vous
          engagez à respecter la loi et à ne pas diffuser de contenu :
        </P>
        <List>
          <li>illicite, diffamatoire, haineux, discriminatoire ou incitant à la violence ;</li>
          <li>à caractère pornographique, ou portant atteinte à la dignité des personnes ;</li>
          <li>portant atteinte aux droits de tiers (droit d&apos;auteur, marques, vie privée) ;</li>
          <li>constituant du harcèlement, du spam ou une usurpation d&apos;identité ;</li>
          <li>contenant des logiciels malveillants ou des liens dangereux.</li>
        </List>
      </Section>

      <Section id="propriete" title="4. Propriété intellectuelle des contenus">
        <P>
          Vous conservez l&apos;entière propriété des projets et contenus que vous publiez. En les
          publiant, vous accordez à KonfiturGame une licence non exclusive et gratuite permettant leur
          affichage et leur diffusion dans le cadre du fonctionnement du Service. Vous garantissez
          détenir les droits nécessaires sur les contenus que vous publiez.
        </P>
      </Section>

      <Section id="moderation" title="5. Signalement et modération des contenus">
        <P>
          Conformément au Règlement (UE) 2022/2065 (Digital Services Act), nous mettons en place les
          mesures suivantes pour la modération des contenus :
        </P>
        <List>
          <li>
            <strong>Signalement</strong> : tout utilisateur peut signaler un contenu qu&apos;il estime
            illicite ou contraire aux présentes CGU, via les boutons de signalement présents sur les
            projets et les messages, ou en nous contactant à{' '}
            <A href="mailto:contact@konfiturgame.fr">contact@konfiturgame.fr</A>.
          </li>
          <li>
            <strong>Traitement</strong> : les signalements sont examinés de manière diligente et non
            arbitraire. Nous pouvons retirer un contenu, le rendre inaccessible, ou suspendre un compte.
          </li>
          <li>
            <strong>Information</strong> : en cas de restriction d&apos;un de vos contenus, vous êtes
            informé(e) des motifs de la décision et des voies de recours disponibles.
          </li>
          <li>
            <strong>Mesures</strong> : en fonction de la gravité, les mesures vont de l&apos;avertissement
            au retrait du contenu, jusqu&apos;à la suspension ou la résiliation du compte et le blocage
            de l&apos;adresse IP. Les soupçons d&apos;infractions pénales graves peuvent être signalés
            aux autorités compétentes.
          </li>
        </List>
      </Section>

      <Section id="responsabilite" title="6. Responsabilité">
        <P>
          Le Service est fourni « en l&apos;état ». Nous nous efforçons d&apos;assurer sa disponibilité
          et sa sécurité mais ne pouvons garantir une absence totale d&apos;interruption ou
          d&apos;erreur. KonfiturGame n&apos;est pas responsable des contenus publiés par les
          utilisateurs, sous réserve de ses obligations légales en matière de retrait des contenus
          illicites qui lui sont signalés.
        </P>
      </Section>

      <Section id="resiliation" title="7. Résiliation">
        <P>
          Vous pouvez supprimer votre compte à tout moment depuis votre{' '}
          <A href="/dashboard/profile">espace profil</A>. Nous nous réservons le droit de suspendre ou
          de résilier un compte en cas de manquement aux présentes CGU.
        </P>
      </Section>

      <Section id="droit" title="8. Droit applicable et juridiction">
        <P>
          Les présentes CGU sont soumises au droit français. En cas de litige, et à défaut de
          résolution amiable, les tribunaux français seront compétents. Les présentes CGU peuvent être
          modifiées ; la date de dernière mise à jour figure en tête de page.
        </P>
      </Section>
    </>
  )
}
