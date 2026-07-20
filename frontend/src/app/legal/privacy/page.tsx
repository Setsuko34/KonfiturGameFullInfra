import type { Metadata } from 'next'
import { LegalTitle, Section, P, List, A } from '../_components'

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description:
    'Comment KonfiturGame collecte, utilise et protège vos données personnelles, conformément au RGPD.',
  alternates: { canonical: '/legal/privacy' },
}

export default function PrivacyPage() {
  return (
    <>
      <LegalTitle updated="15 juillet 2026">Politique de confidentialité</LegalTitle>

      <Section id="intro" title="1. Préambule">
        <P>
          La présente politique décrit la manière dont KonfiturGame (« nous ») traite les données
          personnelles des utilisateurs (« vous ») de la plateforme{' '}
          <A href="https://konfiturgame.fr">konfiturgame.fr</A>, conformément au Règlement (UE)
          2016/679 (RGPD) et à la loi française « Informatique et Libertés ».
        </P>
      </Section>

      <Section id="responsable" title="2. Responsable du traitement">
        <P>
          Le responsable du traitement est l&apos;éditeur du Site, identifié dans les{' '}
          <A href="/legal/mentions-legales">mentions légales</A>.
        </P>
        <List>
          <li>
            Contact pour toute question relative à vos données :{' '}
            <A href="mailto:privacy@konfiturgame.fr">privacy@konfiturgame.fr</A>
          </li>
        </List>
      </Section>

      <Section id="donnees" title="3. Données collectées, finalités et bases légales">
        <P>Nous traitons les catégories de données suivantes :</P>
        <List>
          <li>
            <strong>Compte</strong> : adresse e-mail, mot de passe (stocké haché), pseudo et bio.
            Finalité : création et gestion de votre compte. Base légale : exécution du contrat.
          </li>
          <li>
            <strong>Connexion via Google ou Discord (OAuth)</strong> : identifiant et informations de
            profil transmises par le fournisseur que vous choisissez. Finalité : authentification.
            Base légale : exécution du contrat / votre consentement auprès du fournisseur.
          </li>
          <li>
            <strong>Contenus publiés</strong> : projets, commentaires, messages de chat, likes,
            participations et équipes, associés à votre pseudo. Finalité : fonctionnement de la
            plateforme de game jams. Base légale : exécution du contrat.
          </li>
          <li>
            <strong>Avatar</strong> : image de profil que vous téléversez. Finalité : personnalisation.
            Base légale : exécution du contrat.
          </li>
          <li>
            <strong>Données techniques de sécurité</strong> : adresse IP, agent utilisateur (navigateur),
            page consultée et horodatage, journalisés à des fins de sécurité et de prévention des abus
            (détection de robots, blocage d&apos;adresses IP malveillantes). Base légale : intérêt
            légitime à assurer la sécurité du service.
          </li>
        </List>
        <P>
          Nous n&apos;utilisons aucune publicité ni profilage à des fins commerciales, et ne procédons
          à aucune décision entièrement automatisée produisant des effets juridiques à votre égard.
        </P>
      </Section>

      <Section id="destinataires" title="4. Destinataires et sous-traitants">
        <P>
          Vos données sont traitées par nos soins et ne sont jamais vendues. Elles peuvent être
          traitées par les sous-traitants et services suivants :
        </P>
        <List>
          <li>
            <strong>OVH SAS</strong> (France, UE) : hébergement de l&apos;infrastructure et de la base
            de données.
          </li>
          <li>
            <strong>Google / Discord</strong> : uniquement si vous utilisez la connexion via ces
            fournisseurs, pour l&apos;authentification.
          </li>
        </List>
      </Section>

      <Section id="transferts" title="5. Transferts hors Union européenne">
        <P>
          Les données sont hébergées dans l&apos;Union européenne. Si vous utilisez la connexion via
          Google ou Discord, des données peuvent être traitées par ces fournisseurs selon leurs propres
          politiques, susceptibles d&apos;impliquer des transferts hors UE encadrés par des garanties
          appropriées (clauses contractuelles types).
        </P>
      </Section>

      <Section id="conservation" title="6. Durées de conservation">
        <List>
          <li>
            <strong>Compte et contenus</strong> : conservés tant que votre compte est actif. En cas de
            suppression du compte, vos données sont effacées ou anonymisées.
          </li>
          <li>
            <strong>Journaux de sécurité (logs)</strong> : conservés au maximum 30 jours, puis supprimés
            automatiquement.
          </li>
          <li>
            <strong>Adresses IP bloquées</strong> : conservées le temps nécessaire à la protection du
            service.
          </li>
        </List>
      </Section>

      <Section id="droits" title="7. Vos droits">
        <P>
          Conformément au RGPD, vous disposez des droits suivants sur vos données :
        </P>
        <List>
          <li>Droit d&apos;accès et de copie de vos données ;</li>
          <li>Droit de rectification ;</li>
          <li>Droit à l&apos;effacement (« droit à l&apos;oubli ») ;</li>
          <li>Droit à la portabilité de vos données ;</li>
          <li>Droit d&apos;opposition et de limitation du traitement.</li>
        </List>
        <P>
          Vous pouvez exercer la plupart de ces droits directement depuis votre{' '}
          <A href="/dashboard/profile">espace profil</A> : modification de vos informations,
          téléchargement d&apos;une copie de vos données au format JSON (droits d&apos;accès et de
          portabilité) et suppression de votre compte. Pour toute autre demande, contactez-nous par
          e-mail. Nous y
          répondons dans un délai d&apos;un mois. Vous disposez également du droit d&apos;introduire une
          réclamation auprès de la <A href="https://www.cnil.fr">CNIL</A>.
        </P>
      </Section>

      <Section id="cookies" title="8. Cookies">
        <P>
          Le Site utilise uniquement un cookie strictement nécessaire à votre authentification (cookie
          de session). Ce cookie est indispensable au fonctionnement du Site et ne requiert pas votre
          consentement. Nous n&apos;utilisons aucun cookie de mesure d&apos;audience, de publicité ou de
          réseau social tiers.
        </P>
      </Section>

      <Section id="mineurs" title="9. Mineurs">
        <P>
          La création d&apos;un compte est réservée aux personnes âgées d&apos;au moins 15 ans. En
          dessous de cet âge, l&apos;inscription nécessite le consentement d&apos;un titulaire de
          l&apos;autorité parentale.
        </P>
      </Section>

      <Section id="securite" title="10. Sécurité">
        <P>
          Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger
          vos données : chiffrement des communications (HTTPS), hachage des mots de passe, contrôle
          d&apos;accès aux données d&apos;administration et journalisation de sécurité.
        </P>
      </Section>

      <Section id="evolution" title="11. Évolution de la politique">
        <P>
          Cette politique peut être mise à jour. Toute modification substantielle vous sera signalée,
          et la date de dernière mise à jour figure en tête de page.
        </P>
      </Section>
    </>
  )
}