/**
 * Public legal document content (CS-02).
 *
 * These documents describe the platform's real, code-verified behaviour: the
 * cookies issued by `getAuthCookieNames`, the retention windows recorded in
 * `docs/operations-runbook.md`, and the subprocessors actually integrated in
 * the API server.
 *
 * `counselReviewed` is intentionally false. The content is accurate to the
 * implementation, but it has not been reviewed by a qualified lawyer. The
 * public pages surface a review notice while this flag is false, and
 * `scripts/check-public-routes.mjs` keeps the flag visible in the release gate.
 * Set it to true only when counsel has signed off, and record who and when.
 */

import { LEGAL_SLUGS, type LegalSlug } from './slugs';

export const COUNSEL_REVIEWED = false;

export type LegalSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalDocument = {
  slug: LegalSlug;
  title: string;
  summary: string;
  updated: string;
  sections: LegalSection[];
};

const UPDATED = "2026-08-08";

const OPERATOR = "ENS Platform";
const CONTACT = "support@ens.io";

export const LEGAL_DOCUMENTS: LegalDocument[] = [
  {
    slug: "privacy",
    title: "Privacy Policy",
    summary:
      "What personal data the platform collects, why it is processed, how long it is kept, and the rights available to you.",
    updated: UPDATED,
    sections: [
      {
        heading: "Who processes your data",
        paragraphs: [
          `${OPERATOR} operates this exhibition booth design platform. For account holders of a customer organization, that organization is the data controller and ${OPERATOR} acts as processor on its instructions. For visitors to this public website, ${OPERATOR} is the controller.`,
          `Questions about this policy, or any request described below, can be sent to ${CONTACT}.`,
        ],
      },
      {
        heading: "Data we collect",
        paragraphs: [
          "The platform collects only what the workflow requires. We do not buy personal data from third parties and we do not build advertising profiles.",
        ],
        bullets: [
          "Account data — name, work email address, password (stored only as a salted hash), assigned role, and organization membership.",
          "Organization and project data — company name, contact email, exhibition details, booth dimensions, quotes, and deadlines.",
          "Workspace data — 3D booth designs, furniture placements, revisions, and version history you create.",
          "Documents and attachments — files uploaded to a project or conversation, together with filename, size, content type, and checksum.",
          "Messages — conversation contents between permitted participants, stored encrypted at rest.",
          "Billing data — subscription state and Stripe customer and price identifiers. Full payment card details are handled by Stripe and never reach our servers.",
          "Operational and security logs — request identifiers, timestamps, IP address, user agent, and audit records of security-sensitive actions.",
        ],
      },
      {
        heading: "Why we process it",
        bullets: [
          "To provide the service — authenticating you, rendering your designs, routing approvals, and delivering messages.",
          "To meet a contract — managing subscriptions, quotes, and invoices.",
          "For security and integrity — detecting suspicious logins, enforcing organization isolation, and maintaining audit trails.",
          "To meet legal obligations — retaining financial and audit records where law requires it.",
        ],
      },
      {
        heading: "How long we keep it",
        paragraphs: [
          "Retention follows the schedule published in our operations runbook:",
        ],
        bullets: [
          "Security, authentication, and audit logs — at least 180 days.",
          "Operational API logs — 30 days searchable, 90 days archived.",
          "Database backups — 30 daily and 12 monthly snapshots.",
          "Customer uploads — retained per the customer contract and deletion policy, and never retained indefinitely by accident.",
          "Account data — for the life of the account, then deleted or anonymized on request subject to legal retention duties.",
        ],
      },
      {
        heading: "Who we share it with",
        paragraphs: [
          "We share personal data only with subprocessors that are necessary to run the service, and only to the extent each one needs:",
        ],
        bullets: [
          "Stripe — subscription billing and payment processing.",
          "Resend — transactional email such as invitations, verification, and password reset.",
          "Our hosting and database provider — infrastructure on which the application and PostgreSQL database run.",
        ],
      },
      {
        heading: "Your rights",
        paragraphs: [
          `Depending on where you live, you may have the right to access, correct, delete, restrict, or object to processing of your personal data, and to receive it in a portable format. To exercise any of these, contact ${CONTACT}. If your account belongs to a customer organization, we will refer your request to that organization as the controller and assist them in responding.`,
          "You also have the right to lodge a complaint with your local data protection authority.",
        ],
      },
      {
        heading: "Security",
        paragraphs: [
          "Access is deny-by-default and scoped to your organization on every request. Message contents are encrypted at rest, uploads are validated and access-controlled, and security-sensitive actions are written to an audit log. See the Security page for further detail.",
        ],
      },
    ],
  },
  {
    slug: "terms",
    title: "Terms of Service",
    summary:
      "The agreement governing use of the platform, including subscriptions, acceptable use, intellectual property, and liability.",
    updated: UPDATED,
    sections: [
      {
        heading: "Agreement",
        paragraphs: [
          `These terms govern access to and use of the ${OPERATOR} platform. By creating an account or using the service you agree to them. If you accept on behalf of an organization, you confirm you are authorized to bind that organization.`,
        ],
      },
      {
        heading: "Accounts and roles",
        paragraphs: [
          "The platform issues role-scoped accounts: Chief Manager, Project Manager, and Client. Staff accounts are created by invitation from an authorized Chief Manager. You are responsible for keeping credentials confidential and for activity under your account.",
        ],
      },
      {
        heading: "Subscriptions and payment",
        paragraphs: [
          "Paid features are billed through Stripe according to the plan selected at purchase. Fees are charged in advance for the billing period and are non-refundable except where required by law or expressly stated in writing. We will give reasonable notice before changing prices for a renewal term.",
        ],
      },
      {
        heading: "Your content",
        paragraphs: [
          "You retain all rights to designs, documents, and other content you upload or create. You grant us a limited licence to host, process, transmit, and display that content solely to operate the service for you. We do not use your content to train models or for any purpose beyond providing the service.",
        ],
      },
      {
        heading: "Acceptable use",
        bullets: [
          "Do not attempt to access data belonging to another organization.",
          "Do not probe, scan, or test the vulnerability of the service without written authorization.",
          "Do not upload malware, or content you lack the rights to distribute.",
          "Do not resell or provide the service to third parties except as permitted by your plan.",
          "Do not interfere with or place unreasonable load on the platform's infrastructure.",
        ],
      },
      {
        heading: "Availability",
        paragraphs: [
          "We aim to meet the targets published in our service level objectives, but except where a written agreement states otherwise the service is provided on an as-available basis. Planned maintenance will be announced in advance where practical.",
        ],
      },
      {
        heading: "Termination",
        paragraphs: [
          "You may stop using the service at any time. We may suspend or terminate access for material breach of these terms, non-payment, or where required by law. On termination you may export your data for a reasonable period before deletion under the retention schedule in the Privacy Policy.",
        ],
      },
      {
        heading: "Liability",
        paragraphs: [
          "To the maximum extent permitted by law, neither party is liable for indirect, incidental, or consequential damages, or for lost profits or lost data. Nothing in these terms limits liability that cannot lawfully be limited.",
        ],
      },
      {
        heading: "Changes",
        paragraphs: [
          `We may update these terms. Material changes will be notified in advance by email or in-product notice. Continued use after the effective date constitutes acceptance. Questions: ${CONTACT}.`,
        ],
      },
    ],
  },
  {
    slug: "security",
    title: "Security",
    summary:
      "How the platform protects accounts, isolates organizations, secures uploads and messages, and handles vulnerability reports.",
    updated: UPDATED,
    sections: [
      {
        heading: "Authorization model",
        paragraphs: [
          "Authorization is deny-by-default. Every protected route declares the roles permitted, the organization relationship required, and the expected denial status. That contract is documented in the platform authorization matrix and enforced by automated tests that run on every release.",
          "Organization scoping is applied in the data layer, not only in the interface. A request that carries a valid session for one organization cannot read or write another organization's records.",
        ],
      },
      {
        heading: "Authentication and sessions",
        bullets: [
          "Passwords are stored only as salted hashes.",
          "Sessions use HTTP-only cookies, marked Secure behind HTTPS, with separate cookie names isolating staff and client portals.",
          "Access tokens are short-lived and refreshed against a server-side session.",
          "Security-sensitive events, including suspicious logins and cross-organization access attempts, are written to an audit log.",
        ],
      },
      {
        heading: "Uploads",
        bullets: [
          "Content type and file extension are validated for consistency.",
          "Maximum size is enforced before storage.",
          "Filenames are sanitized and path traversal is rejected; the original name is preserved only as display metadata.",
          "Downloads are authorized per request and served through access-controlled URLs.",
          "Stored assets are checksummed, and integrity is verified across application restarts.",
        ],
      },
      {
        heading: "Messages",
        paragraphs: [
          "Message contents are encrypted at rest. Key rotation is supported, and messages encrypted under a previous active key remain decryptable. Plaintext message contents are not written to operational logs.",
        ],
      },
      {
        heading: "Supply chain",
        paragraphs: [
          "Dependency installation enforces a minimum release age, which blocks newly published package versions until they have been public long enough for malicious releases to be identified and withdrawn. Every release runs a production dependency vulnerability audit and a repository secret scan; either failing blocks the release.",
        ],
      },
      {
        heading: "Reporting a vulnerability",
        paragraphs: [
          `Report suspected vulnerabilities to ${CONTACT}. Please include reproduction steps and avoid accessing or modifying data that is not yours. We will acknowledge your report and keep you informed while we investigate. We will not pursue action against good-faith research that follows this guidance.`,
        ],
      },
    ],
  },
  {
    slug: "cookies",
    title: "Cookie Policy",
    summary:
      "Every cookie the platform sets, what it is for, and how long it lasts. The platform sets no advertising or tracking cookies.",
    updated: UPDATED,
    sections: [
      {
        heading: "Summary",
        paragraphs: [
          "The platform sets only cookies that are strictly necessary to sign you in and remember your language. There are no advertising cookies, no third-party tracking pixels, and no cross-site profiling.",
        ],
      },
      {
        heading: "Strictly necessary cookies",
        bullets: [
          "ens_access — short-lived staff portal access token. Session duration.",
          "ens_client_access — short-lived client portal access token, kept separate so staff and client sessions cannot collide. Session duration.",
          "ens_refresh — refresh token used to renew an access token without re-entering credentials. Expires with the session policy.",
        ],
      },
      {
        heading: "Preference cookies",
        bullets: [
          "ens-lang — remembers your selected interface language across visits. Expires after one year.",
        ],
      },
      {
        heading: "Analytics",
        paragraphs: [
          "No analytics or measurement cookies are currently set. If that changes, this page will be updated and, where consent is required, a consent choice will be presented before any non-essential cookie is written.",
        ],
      },
      {
        heading: "Managing cookies",
        paragraphs: [
          "You can clear or block cookies in your browser settings. Blocking strictly necessary cookies will prevent you from signing in, because the session cannot be maintained without them.",
        ],
      },
    ],
  },
  {
    slug: "gdpr",
    title: "GDPR",
    summary:
      "How the platform meets its obligations under the General Data Protection Regulation, including roles, transfers, and data subject requests.",
    updated: UPDATED,
    sections: [
      {
        heading: "Controller and processor roles",
        paragraphs: [
          `Where an organization uses the platform to manage its own clients and projects, that organization is the controller and ${OPERATOR} is the processor acting on its documented instructions. For this public website, ${OPERATOR} is the controller.`,
        ],
      },
      {
        heading: "Lawful bases",
        bullets: [
          "Performance of a contract — providing the platform to account holders and billing for it.",
          "Legitimate interests — securing the service, preventing abuse, and maintaining audit trails, balanced against your rights.",
          "Legal obligation — retaining financial and audit records where required.",
          "Consent — only where specifically requested, and withdrawable at any time.",
        ],
      },
      {
        heading: "Data subject requests",
        paragraphs: [
          `Requests for access, rectification, erasure, restriction, objection, or portability can be sent to ${CONTACT}. We respond within one month and may extend by two further months for complex requests, telling you why. Where the request concerns data held on behalf of a customer organization, we forward it to that organization and assist them in responding.`,
        ],
      },
      {
        heading: "International transfers",
        paragraphs: [
          "Where personal data is transferred outside the European Economic Area, the transfer is covered by an adequacy decision or by Standard Contractual Clauses with the receiving subprocessor, together with supplementary measures where required.",
        ],
      },
      {
        heading: "Subprocessors",
        paragraphs: [
          "The current subprocessors are listed in the Privacy Policy. We will give notice before adding a new subprocessor that processes customer personal data, allowing a reasonable period to object.",
        ],
      },
      {
        heading: "Breach notification",
        paragraphs: [
          "In the event of a personal data breach we notify the relevant supervisory authority within 72 hours of becoming aware where the breach is likely to result in a risk to individuals, and notify affected controllers without undue delay under our incident response process.",
        ],
      },
    ],
  },
];

/**
 * Fails to compile if a routed slug has no document, keeping `slugs.ts` and
 * this file from drifting apart.
 */
const DOCUMENT_BY_SLUG: Record<LegalSlug, LegalDocument> = Object.fromEntries(
  LEGAL_DOCUMENTS.map((doc) => [doc.slug, doc]),
) as Record<LegalSlug, LegalDocument>;

for (const slug of LEGAL_SLUGS) {
  if (!DOCUMENT_BY_SLUG[slug]) {
    throw new Error(`Legal route "${slug}" has no document in content.ts`);
  }
}

export function getLegalDocument(slug: string): LegalDocument | undefined {
  return LEGAL_DOCUMENTS.find((doc) => doc.slug === slug);
}
