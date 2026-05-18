// Document templates as fixed JS constants. No fetching, no external deps.
// Each template: id, name, category, blurb, fields[], body (with {{key}}).
// Field types: text | textarea | date | select (options[]).
//
// v1 scope: SEVEN templates — Mutual NDA, One-Way NDA, Independent Contractor
// Agreement, Statement of Work, Professional Services Agreement, Partnership
// Agreement, AI Addendum. Chosen because they are two-party, P2P-signable, not
// heavily regulated, and not notarization-dependent. Cloud Service Agreement,
// Photography/Model Release, BAA, DPA, SLA, ToS, Term Sheet, LOI, Order Form,
// Amendment, Design Partner were intentionally dropped.
//
// SOURCING (integrity-critical): Common Paper documents are adapted via the
// Cover-Page-by-reference method — Variables become `fields`, the unmodified
// Standard Terms are incorporated by a verified URL, and the footer carries a
// TRUE CC BY 4.0 attribution (versions/URLs verified 2026-05 at commonpaper.com).
// The Independent Contractor Agreement is hand-written conservative boilerplate
// and keeps the honest `Source: PENDING` footer until genuinely adapted +
// attorney-reviewed. Never label hand-written text as "Adapted from X".

const today = new Date().toISOString().slice(0, 10);

// Footers render as small, de-emphasized fine print (engine: "> " block),
// not a heading. Kept as short as CC BY 4.0 + the disclaimer allow.

// Honest placeholder footer — only for the not-yet-sourced contractor template.
const FOOTER = `> Foolscap is not a law firm and gives no legal advice; this is a general template — have it reviewed by a licensed attorney. Source: PENDING (not yet adapted from a named source or attorney-reviewed).`;

// TRUE Common Paper CC BY 4.0 attribution: name + version + license + link +
// "unmodified/by reference" — compact, but every required element kept.
function cpFooter(attribution) {
  return `> Foolscap is not a law firm and gives no legal advice; this is a general template — have it reviewed by a licensed attorney. ${attribution} Common Paper does not endorse Foolscap or this use.`;
}

const MNDA_FOOTER = cpFooter(
  `Built on the Common Paper Mutual NDA (Standard Terms v1.0, CC BY 4.0, https://commonpaper.com/standards/mutual-nda/1.0/); Standard Terms unmodified, incorporated by reference.`
);

const MNDA_ONEWAY_FOOTER = cpFooter(
  `Built on the Common Paper Mutual NDA (Standard Terms v1.0, CC BY 4.0, https://commonpaper.com/standards/mutual-nda/1.0/); no separate one-way standard exists, so it is applied one-way via a Cover Page modification only; Standard Terms unmodified, incorporated by reference.`
);

const PSA_FOOTER = cpFooter(
  `Built on the Common Paper Professional Services Agreement (Standard Terms v1.1, CC BY 4.0, https://commonpaper.com/standards/professional-services-agreement/); Standard Terms unmodified, incorporated by reference.`
);

const PARTNER_FOOTER = cpFooter(
  `Built on the Common Paper Partnership Agreement (Standard Terms v1.1, CC BY 4.0, https://commonpaper.com/standards/partnership-agreement/); Standard Terms unmodified, incorporated by reference.`
);

const AI_FOOTER = cpFooter(
  `Built on the Common Paper AI Addendum (v1.0, CC BY 4.0, https://commonpaper.com/standards/ai-addendum/); a supplement to the Primary Agreement above; Standard Terms unmodified, incorporated by reference.`
);

const SOW_FOOTER = cpFooter(
  `Based on the Common Paper Statement of Work template (CC BY 4.0, https://commonpaper.com/documents/statement-of-work/); governed by the Professional Services Agreement above, whose Standard Terms are unmodified and incorporated by reference.`
);

// Shared signature-block fields, spread into every document. "signature" type
// opens a draw/type pad; the rest are plain typeable fields. The confusing
// "By:" line was removed — each block is just Signature · Print Name · Title ·
// Date. Labels are written as direct prompts (they show as the field's hint).
const SIG = [
  { key: "sigA", label: "Sign — first party (draw or type)", type: "signature" },
  { key: "sigNameA", label: "Print full name — first party", type: "text" },
  { key: "sigTitleA", label: "Title, or “Individual” — first party", type: "text" },
  { key: "sigDateA", label: "Date signed — first party", type: "text" },
  { key: "sigB", label: "Sign — second party (draw or type)", type: "signature" },
  { key: "sigNameB", label: "Print full name — second party", type: "text" },
  { key: "sigTitleB", label: "Title, or “Individual” — second party", type: "text" },
  { key: "sigDateB", label: "Date signed — second party", type: "text" },
];

export const DOCUMENTS = [
  {
    id: "mutual-nda",
    name: "Mutual NDA",
    category: "Confidentiality",
    blurb: "Common Paper Mutual NDA Cover Page; Standard Terms by reference.",
    fields: [
      { key: "effectiveDate", label: "Effective Date", type: "text", default: "Date of last signature on this Cover Page" },
      { key: "partyA", label: "Party 1 (official name)", type: "text", placeholder: "Acme, Inc." },
      { key: "partyANotice", label: "Party 1 notice address (email or postal)", type: "textarea", placeholder: "legal@acme.example / 123 Main St, City, ST 00000" },
      { key: "partyB", label: "Party 2 (official name)", type: "text", placeholder: "Beta LLC" },
      { key: "partyBNotice", label: "Party 2 notice address (email or postal)", type: "textarea", placeholder: "legal@beta.example / 456 Oak Ave, City, ST 00000" },
      { key: "purpose", label: "Purpose (why information is shared)", type: "textarea", placeholder: "evaluating a potential business relationship between the parties" },
      { key: "agreementTerm", label: "Term (length of the Agreement)", type: "text", placeholder: "2 years from the Effective Date" },
      { key: "confidentialityPeriod", label: "Confidentiality period (how long obligations last)", type: "text", placeholder: "3 years after disclosure of the Confidential Information" },
      { key: "governingLaw", label: "Governing Law (state, province, and/or country)", type: "text", placeholder: "the State of Delaware, USA" },
      { key: "chosenCourts", label: "Chosen Courts (state, province, and/or county)", type: "text", placeholder: "New Castle County, Delaware" },
      ...SIG,
    ],
    body: `# MUTUAL NON-DISCLOSURE AGREEMENT — COVER PAGE

This Cover Page, together with the Common Paper Mutual Non-Disclosure Agreement Standard Terms Version 1.0 incorporated by reference in the section below, forms the agreement between the parties (the "Agreement"). Capitalized terms have the meanings given in the Standard Terms. If there is any inconsistency between this Cover Page and the Standard Terms, this Cover Page controls.

## Key Terms

Effective Date: {{effectiveDate}}

Party 1: {{partyA}}

Party 1 notice address: {{partyANotice}}

Party 2: {{partyB}}

Party 2 notice address: {{partyBNotice}}

Purpose: {{purpose}}

Term: {{agreementTerm}}

Confidentiality period: {{confidentialityPeriod}}

Governing Law: the laws of {{governingLaw}}.

Chosen Courts: the courts (whether state, federal, or otherwise) located in {{chosenCourts}}.

## Incorporation of the Standard Terms

The parties incorporate by reference the Common Paper Mutual Non-Disclosure Agreement Standard Terms Version 1.0, posted at https://commonpaper.com/standards/mutual-nda/1.0/. The Standard Terms are not reproduced or modified in this document; each party should read the Standard Terms in full at that link before signing. By signing below, each party agrees to this Cover Page and the incorporated Standard Terms. The parties have not changed the Standard Terms except for the details set out in this Cover Page.

## Signatures

PARTY 1: {{partyA}}

Signature: {{sigA}}   Date: {{sigDateA}}

Print Name: {{sigNameA}}   Title: {{sigTitleA}}

PARTY 2: {{partyB}}

Signature: {{sigB}}   Date: {{sigDateB}}

Print Name: {{sigNameB}}   Title: {{sigTitleB}}

${MNDA_FOOTER}`,
  },

  {
    id: "oneway-nda",
    name: "One-Way NDA",
    category: "Confidentiality",
    blurb: "Common Paper Mutual NDA applied one-way via a Cover Page modification.",
    fields: [
      { key: "effectiveDate", label: "Effective Date", type: "text", default: "Date of last signature on this Cover Page" },
      { key: "disclosing", label: "Disclosing Party (official name)", type: "text", placeholder: "Acme, Inc." },
      { key: "disclosingNotice", label: "Disclosing Party notice address (email or postal)", type: "textarea", placeholder: "legal@acme.example / 123 Main St, City, ST 00000" },
      { key: "receiving", label: "Receiving Party (official name)", type: "text", placeholder: "Jordan Lee" },
      { key: "receivingNotice", label: "Receiving Party notice address (email or postal)", type: "textarea", placeholder: "jordan@example.com / 456 Oak Ave, City, ST 00000" },
      { key: "purpose", label: "Purpose (why information is shared)", type: "textarea", placeholder: "evaluating a potential contracting engagement" },
      { key: "agreementTerm", label: "Term (length of the Agreement)", type: "text", placeholder: "2 years from the Effective Date" },
      { key: "confidentialityPeriod", label: "Confidentiality period (how long obligations last)", type: "text", placeholder: "3 years after disclosure of the Confidential Information" },
      { key: "governingLaw", label: "Governing Law (state, province, and/or country)", type: "text", placeholder: "the State of California, USA" },
      { key: "chosenCourts", label: "Chosen Courts (state, province, and/or county)", type: "text", placeholder: "San Francisco County, California" },
      ...SIG,
    ],
    body: `# ONE-WAY NON-DISCLOSURE AGREEMENT — COVER PAGE

This Cover Page, together with the Common Paper Mutual Non-Disclosure Agreement Standard Terms Version 1.0 incorporated by reference in the section below, forms the agreement between the parties (the "Agreement"). Capitalized terms have the meanings given in the Standard Terms. If there is any inconsistency between this Cover Page and the Standard Terms, this Cover Page controls.

## Key Terms

Effective Date: {{effectiveDate}}

Disclosing Party: {{disclosing}}

Disclosing Party notice address: {{disclosingNotice}}

Receiving Party: {{receiving}}

Receiving Party notice address: {{receivingNotice}}

Purpose: {{purpose}}

Term: {{agreementTerm}}

Confidentiality period: {{confidentialityPeriod}}

Governing Law: the laws of {{governingLaw}}.

Chosen Courts: the courts (whether state, federal, or otherwise) located in {{chosenCourts}}.

## Cover Page Modification — Unilateral Use

The parties use the Mutual Non-Disclosure Agreement on a one-way basis: only {{disclosing}} (the "Disclosing Party") will disclose Confidential Information under this Agreement, and {{receiving}} (the "Receiving Party") acts solely as a Recipient. Each reference in the Standard Terms to a party disclosing Confidential Information applies only to the Disclosing Party, and each reference to a Recipient's obligations applies only to the Receiving Party. This is a Cover Page modification only; the text of the Standard Terms is not changed.

## Incorporation of the Standard Terms

The parties incorporate by reference the Common Paper Mutual Non-Disclosure Agreement Standard Terms Version 1.0, posted at https://commonpaper.com/standards/mutual-nda/1.0/. The Standard Terms are not reproduced or modified in this document; each party should read the Standard Terms in full at that link before signing. By signing below, each party agrees to this Cover Page (including the modification above) and the incorporated Standard Terms.

## Signatures

DISCLOSING PARTY: {{disclosing}}

Signature: {{sigA}}   Date: {{sigDateA}}

Print Name: {{sigNameA}}   Title: {{sigTitleA}}

RECEIVING PARTY: {{receiving}}

Signature: {{sigB}}   Date: {{sigDateB}}

Print Name: {{sigNameB}}   Title: {{sigTitleB}}

${MNDA_ONEWAY_FOOTER}`,
  },

  {
    id: "contractor-agreement",
    name: "Independent Contractor Agreement",
    category: "Services",
    blurb: "Independent contractor scope, payment, IP, and risk allocation.",
    fields: [
      { key: "effectiveDate", label: "Effective date", type: "date", default: today },
      { key: "client", label: "Client (legal name)", type: "text", placeholder: "Acme, Inc." },
      { key: "clientAddress", label: "Client notice address", type: "textarea", placeholder: "123 Main St, City, ST 00000" },
      { key: "contractor", label: "Contractor (legal name)", type: "text", placeholder: "Jordan Lee" },
      { key: "contractorAddress", label: "Contractor notice address", type: "textarea", placeholder: "456 Oak Ave, City, ST 00000" },
      { key: "services", label: "Description of services", type: "textarea", placeholder: "design and develop a marketing website per the attached statement of work" },
      { key: "fee", label: "Fee", type: "text", placeholder: "$5,000 fixed" },
      { key: "paymentTerms", label: "Payment / invoicing terms", type: "textarea", placeholder: "50% on start, 50% on delivery; invoices net 15" },
      { key: "expenses", label: "Expenses", type: "select", options: ["No reimbursable expenses", "Pre-approved expenses reimbursed at cost"], default: "No reimbursable expenses" },
      { key: "term", label: "Term / completion", type: "text", placeholder: "until the Services are completed and accepted" },
      { key: "noticeDays", label: "Termination notice (days)", type: "text", default: "14" },
      { key: "state", label: "Governing law (US state)", type: "text", placeholder: "New York" },
      { key: "venue", label: "Exclusive venue (county, state)", type: "text", placeholder: "New York County, New York" },
      ...SIG,
    ],
    body: `# INDEPENDENT CONTRACTOR AGREEMENT

This Independent Contractor Agreement (the "Agreement") is made as of {{effectiveDate}} between {{client}}, with a notice address at {{clientAddress}} ("Client"), and {{contractor}}, with a notice address at {{contractorAddress}} ("Contractor").

## 1. Engagement and Services

Client engages Contractor to perform the following services: {{services}} (the "Services"). Contractor shall perform the Services in a professional and workmanlike manner consistent with generally accepted industry standards and shall determine the method, details, and means of performing the Services.

## 2. Independent Contractor Status

Contractor is an independent contractor and not an employee, agent, partner, or joint venturer of Client. Contractor is solely responsible for all federal, state, and local taxes, withholdings, insurance, and benefits relating to the compensation paid under this Agreement, and is not entitled to any employee benefits from Client. Contractor supplies its own tools and equipment and controls the manner and means of performing the Services. Contractor may perform services for others, provided it does not breach Section 5 or 8.

## 3. Compensation; Expenses; Invoicing

As full consideration for the Services and the rights granted, Client shall pay Contractor {{fee}}. Payment and invoicing terms: {{paymentTerms}}. Expenses: {{expenses}}. Undisputed invoices not paid when due accrue interest at the lower of 1.5% per month or the maximum rate permitted by law. Fees are exclusive of applicable taxes other than taxes on Client's net income.

## 4. Term and Termination

This Agreement remains in effect {{term}}, unless terminated earlier under this Section. Either Party may terminate for convenience on {{noticeDays}} days' written notice, and either Party may terminate immediately for the other Party's material breach not cured within ten (10) days of written notice. On termination, Client shall pay for Services properly performed and accepted through the termination date, and Contractor shall promptly deliver all work in progress and Client materials. Sections 5 through 11 survive termination.

## 5. Confidentiality

Each Party (the "Recipient") shall keep confidential the other Party's non-public business, technical, and financial information, use it only to perform this Agreement, protect it with at least reasonable care, and not disclose it without prior written consent, except as required by law (with prompt notice where permitted). These obligations continue for three (3) years after termination, and indefinitely for trade secrets.

## 6. Intellectual Property

All deliverables, work product, and materials created by Contractor specifically for Client in the course of the Services (the "Deliverables") are "works made for hire" to the maximum extent permitted by law. To the extent any Deliverable does not qualify as a work made for hire, Contractor hereby irrevocably assigns to Client all right, title, and interest in and to the Deliverables, including all intellectual property rights, effective upon Client's payment in full. Contractor waives, to the extent permitted by law, any moral rights in the Deliverables, and agrees to execute documents and take actions reasonably requested to perfect and enforce Client's rights. Contractor retains ownership of its pre-existing and general tools, know-how, and materials ("Background IP"); to the extent Background IP is incorporated into a Deliverable, Contractor grants Client a perpetual, worldwide, royalty-free, non-exclusive license to use it as part of the Deliverable.

## 7. Representations and Warranties

Contractor represents and warrants that: (a) it has full authority to enter into and perform this Agreement; (b) the Services will be performed in a professional and workmanlike manner; (c) the Deliverables will be original to Contractor or properly licensed and will not, to Contractor's knowledge, infringe or misappropriate any third party's intellectual property or other rights; and (d) it will comply with all laws applicable to its performance. EXCEPT AS EXPRESSLY STATED, NEITHER PARTY MAKES ANY OTHER WARRANTY, EXPRESS OR IMPLIED.

## 8. Non-Solicitation

During the term and for twelve (12) months after termination, neither Party shall knowingly solicit for employment any employee or contractor of the other Party who was directly involved in this engagement, except that general advertising not targeted at such persons is permitted.

## 9. Indemnification

Contractor shall defend, indemnify, and hold harmless Client from third-party claims to the extent arising from Contractor's gross negligence or willful misconduct or from a breach of the warranty in Section 7(c). The indemnified Party shall give prompt notice and reasonable cooperation, and the indemnifying Party shall control the defense and may not settle in a way that imposes liability on the other without consent.

## 10. Limitation of Liability

EXCEPT FOR A PARTY'S INDEMNIFICATION OBLIGATIONS, BREACH OF CONFIDENTIALITY, INFRINGEMENT OF THE OTHER PARTY'S INTELLECTUAL PROPERTY, OR GROSS NEGLIGENCE OR WILLFUL MISCONDUCT, NEITHER PARTY IS LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, AND EACH PARTY'S TOTAL LIABILITY ARISING OUT OF THIS AGREEMENT WILL NOT EXCEED THE TOTAL FEES PAID OR PAYABLE UNDER THIS AGREEMENT.

## 11. General

This Agreement (with any attached statement of work) is the entire agreement and supersedes all prior understandings; conflicting terms in a Client purchase order have no effect. It may be amended only in a signed writing. No waiver is effective unless in writing, and no single waiver is a continuing waiver. If any provision is unenforceable, it will be reformed to the minimum extent necessary and the remainder enforced. Contractor may not assign or subcontract without Client's prior written consent; Client may assign to a successor in connection with a merger or sale of substantially all assets. Notices must be in writing to the addresses above by recognized courier or certified mail, effective on receipt. This Agreement is governed by the laws of the State of {{state}} without regard to conflict-of-laws rules, and the Parties consent to exclusive jurisdiction and venue in the courts located in {{venue}}. This Agreement may be executed in counterparts and by electronic signature.

## 12. Signatures

{{client}}

Signature: {{sigA}}   Date: {{sigDateA}}

Print Name / Title: {{sigNameA}}

{{contractor}}

Signature: {{sigB}}   Date: {{sigDateB}}

Print Name / Title: {{sigNameB}}

${FOOTER}`,
  },

  {
    id: "statement-of-work",
    name: "Statement of Work",
    category: "Services",
    blurb: "SOW under a Professional Services Agreement (Common Paper).",
    fields: [
      { key: "effectiveDate", label: "SOW Effective Date", type: "text", default: "Date of last signature on this SOW" },
      { key: "provider", label: "Provider (official name)", type: "text", placeholder: "Studio North LLC" },
      { key: "customer", label: "Customer (official name)", type: "text", placeholder: "Acme, Inc." },
      { key: "governingPSA", label: "Governing Professional Services Agreement", type: "textarea", default: "the Professional Services Agreement between the parties dated ____________" },
      { key: "project", label: "Project name", type: "text", placeholder: "Marketing website redesign" },
      { key: "scope", label: "Scope of services", type: "textarea", placeholder: "design, build, and launch a 6-page marketing website" },
      { key: "deliverables", label: "Deliverables", type: "textarea", placeholder: "Figma designs; responsive site; CMS handoff; 1 round of revisions" },
      { key: "timeline", label: "Timeline / milestones", type: "textarea", placeholder: "Design by 2026-06-15; build by 2026-07-15; launch by 2026-07-31" },
      { key: "fees", label: "Fees", type: "text", placeholder: "$12,000 fixed fee" },
      { key: "paymentSchedule", label: "Payment schedule", type: "textarea", placeholder: "40% on signing, 30% on design approval, 30% on launch; invoices net 15" },
      { key: "acceptance", label: "Acceptance criteria", type: "textarea", default: "Customer has ten (10) business days after delivery of each deliverable to accept it or provide written notice of material non-conformity; absent timely notice the deliverable is deemed accepted." },
      { key: "assumptions", label: "Assumptions / out of scope", type: "textarea", default: "None" },
      ...SIG,
    ],
    body: `# STATEMENT OF WORK

This Statement of Work ("SOW"), effective {{effectiveDate}}, is entered into by {{provider}} ("Provider") and {{customer}} ("Customer") under, and is governed by, {{governingPSA}} (the "PSA"). Capitalized terms not defined here have the meanings given in the PSA. If there is a conflict between this SOW and the PSA, the PSA controls except for terms this SOW expressly states override it for this engagement.

## 1. Project

{{project}}

## 2. Scope of Services

{{scope}}

## 3. Deliverables

{{deliverables}}

## 4. Timeline and Milestones

{{timeline}}

## 5. Fees

{{fees}}

## 6. Payment Schedule

{{paymentSchedule}}

## 7. Acceptance

{{acceptance}}

## 8. Assumptions and Exclusions

{{assumptions}}

## 9. Signatures

PROVIDER: {{provider}}

Signature: {{sigA}}   Date: {{sigDateA}}

Print Name: {{sigNameA}}   Title: {{sigTitleA}}

CUSTOMER: {{customer}}

Signature: {{sigB}}   Date: {{sigDateB}}

Print Name: {{sigNameB}}   Title: {{sigTitleB}}

${SOW_FOOTER}`,
  },

  {
    id: "professional-services-agreement",
    name: "Professional Services Agreement",
    category: "Services",
    blurb: "Common Paper PSA Cover Page; Standard Terms v1.1 by reference.",
    fields: [
      { key: "effectiveDate", label: "Effective Date", type: "text", default: "Date of last signature on this Cover Page" },
      { key: "provider", label: "Provider (official name)", type: "text", placeholder: "Studio North LLC" },
      { key: "providerNotice", label: "Provider notice address (email or postal)", type: "textarea", placeholder: "legal@studionorth.example / 123 Main St, City, ST 00000" },
      { key: "customer", label: "Customer (official name)", type: "text", placeholder: "Acme, Inc." },
      { key: "customerNotice", label: "Customer notice address (email or postal)", type: "textarea", placeholder: "contracts@acme.example / 456 Oak Ave, City, ST 00000" },
      { key: "services", label: "Services", type: "textarea", default: "The professional services described in each Statement of Work (SOW) the parties sign under this Agreement." },
      { key: "fees", label: "Fees", type: "text", placeholder: "As set out in each SOW" },
      { key: "paymentTiming", label: "Payment timing", type: "textarea", default: "Provider will invoice as set out in each SOW (or monthly if a SOW is silent). Customer will pay each undisputed invoice within 30 days of the invoice date." },
      { key: "term", label: "Term", type: "textarea", default: "Starts on the Effective Date and continues until terminated; either party may terminate for convenience on 30 days' written notice, or immediately for an uncured material breach. Active SOWs survive until completed unless terminated under the Standard Terms." },
      { key: "governingLaw", label: "Governing Law (state, province, and/or country)", type: "text", placeholder: "the State of New York, USA" },
      { key: "chosenCourts", label: "Chosen Courts (state, province, and/or county)", type: "text", placeholder: "New York County, New York" },
      { key: "generalCap", label: "General Cap Amount", type: "text", default: "1x the fees paid or payable in the 12-month period immediately before the claim" },
      ...SIG,
    ],
    body: `# PROFESSIONAL SERVICES AGREEMENT — COVER PAGE

This Cover Page, together with the Common Paper Professional Services Agreement Standard Terms Version 1.1 incorporated by reference in the section below, forms the agreement between the parties (the "Agreement"). Capitalized terms have the meanings given in the Standard Terms. If there is any inconsistency between this Cover Page and the Standard Terms, this Cover Page controls.

## Key Terms

Effective Date: {{effectiveDate}}

Provider: {{provider}}

Provider notice address: {{providerNotice}}

Customer: {{customer}}

Customer notice address: {{customerNotice}}

Services: {{services}}

Fees: {{fees}}

Payment timing: {{paymentTiming}}

Term: {{term}}

General Cap Amount: {{generalCap}}.

Governing Law: the laws of {{governingLaw}}.

Chosen Courts: the courts (whether state, federal, or otherwise) located in {{chosenCourts}}.

## Incorporation of the Standard Terms

The parties incorporate by reference the Common Paper Professional Services Agreement Standard Terms Version 1.1, posted at https://commonpaper.com/standards/professional-services-agreement/. The Standard Terms are not reproduced or modified in this document; each party should read the Standard Terms in full at that link before signing. Work is performed under one or more Statements of Work that reference this Agreement. By signing below, each party agrees to this Cover Page and the incorporated Standard Terms.

## Signatures

PROVIDER: {{provider}}

Signature: {{sigA}}   Date: {{sigDateA}}

Print Name: {{sigNameA}}   Title: {{sigTitleA}}

CUSTOMER: {{customer}}

Signature: {{sigB}}   Date: {{sigDateB}}

Print Name: {{sigNameB}}   Title: {{sigTitleB}}

${PSA_FOOTER}`,
  },

  {
    id: "partnership-agreement",
    name: "Partnership Agreement",
    category: "Partnerships",
    blurb: "Common Paper Partnership Cover Page; Standard Terms v1.1 by reference.",
    fields: [
      { key: "effectiveDate", label: "Effective Date", type: "text", default: "Date of last signature on this Cover Page" },
      { key: "partyA", label: "Party 1 (official name)", type: "text", placeholder: "Acme, Inc." },
      { key: "partyANotice", label: "Party 1 notice address (email or postal)", type: "textarea", placeholder: "partners@acme.example / 123 Main St, City, ST 00000" },
      { key: "partyB", label: "Party 2 (official name)", type: "text", placeholder: "Beta LLC" },
      { key: "partyBNotice", label: "Party 2 notice address (email or postal)", type: "textarea", placeholder: "bd@beta.example / 456 Oak Ave, City, ST 00000" },
      { key: "partnershipScope", label: "Partnership type", type: "select", options: ["Referral", "Co-marketing", "Sponsorship", "Referral + Co-marketing", "Referral + Co-marketing + Sponsorship"], default: "Referral" },
      { key: "activities", label: "Partnership activities", type: "textarea", placeholder: "Each party refers prospective customers to the other and lists the other on its partners page." },
      { key: "compensation", label: "Fees / commission", type: "textarea", default: "Referral fee of 10% of first-year net revenue from a referred customer, paid quarterly; otherwise no fees." },
      { key: "term", label: "Term", type: "textarea", default: "Starts on the Effective Date and continues for 12 months, then renews for successive 12-month periods unless either party gives 30 days' written notice of non-renewal; either party may terminate for convenience on 30 days' notice." },
      { key: "governingLaw", label: "Governing Law (state, province, and/or country)", type: "text", placeholder: "the State of Delaware, USA" },
      { key: "chosenCourts", label: "Chosen Courts (state, province, and/or county)", type: "text", placeholder: "New Castle County, Delaware" },
      ...SIG,
    ],
    body: `# PARTNERSHIP AGREEMENT — COVER PAGE

This Cover Page, together with the Common Paper Partnership Agreement Standard Terms Version 1.1 incorporated by reference in the section below, forms the agreement between the parties (the "Agreement"). Capitalized terms have the meanings given in the Standard Terms. If there is any inconsistency between this Cover Page and the Standard Terms, this Cover Page controls.

## Key Terms

Effective Date: {{effectiveDate}}

Party 1: {{partyA}}

Party 1 notice address: {{partyANotice}}

Party 2: {{partyB}}

Party 2 notice address: {{partyBNotice}}

Partnership type: {{partnershipScope}}

Partnership activities: {{activities}}

Fees / commission: {{compensation}}

Term: {{term}}

Governing Law: the laws of {{governingLaw}}.

Chosen Courts: the courts (whether state, federal, or otherwise) located in {{chosenCourts}}.

## Incorporation of the Standard Terms

The parties incorporate by reference the Common Paper Partnership Agreement Standard Terms Version 1.1, posted at https://commonpaper.com/standards/partnership-agreement/. The Standard Terms are not reproduced or modified in this document; each party should read the Standard Terms in full at that link before signing. By signing below, each party agrees to this Cover Page and the incorporated Standard Terms.

## Signatures

PARTY 1: {{partyA}}

Signature: {{sigA}}   Date: {{sigDateA}}

Print Name: {{sigNameA}}   Title: {{sigTitleA}}

PARTY 2: {{partyB}}

Signature: {{sigB}}   Date: {{sigDateB}}

Print Name: {{sigNameB}}   Title: {{sigTitleB}}

${PARTNER_FOOTER}`,
  },

  {
    id: "ai-addendum",
    name: "AI Addendum",
    category: "AI",
    blurb: "Common Paper AI Addendum to an existing agreement; v1.0 by reference.",
    fields: [
      { key: "effectiveDate", label: "Addendum Effective Date", type: "text", default: "Date of last signature on this Addendum" },
      { key: "provider", label: "Provider (official name)", type: "text", placeholder: "Acme AI, Inc." },
      { key: "customer", label: "Customer (official name)", type: "text", placeholder: "Beta Corp." },
      { key: "primaryAgreement", label: "Primary Agreement this Addendum supplements", type: "textarea", default: "the agreement between the parties dated ____________ (the \"Primary Agreement\")" },
      { key: "aiFeature", label: "AI feature / product covered", type: "textarea", placeholder: "the AI drafting assistant and related model-powered features of the product" },
      { key: "trainingRights", label: "Training on Customer Data", type: "select", options: ["Provider may NOT use Customer Data to train or fine-tune AI models", "Provider may use only de-identified, aggregated Customer Data to train or improve AI models", "Provider may use Customer Data to train or fine-tune AI models"], default: "Provider may NOT use Customer Data to train or fine-tune AI models" },
      { key: "humanOversight", label: "Human oversight / disclaimer", type: "textarea", default: "AI output may be inaccurate, is not professional advice, and is provided for Customer's review; Customer is responsible for human review before relying on it." },
      { key: "governingLaw", label: "Governing Law", type: "text", default: "as set out in the Primary Agreement" },
      ...SIG,
    ],
    body: `# AI ADDENDUM — COVER PAGE

This AI Addendum ("Addendum"), effective {{effectiveDate}}, is entered into by {{provider}} ("Provider") and {{customer}} ("Customer"). It supplements and is incorporated into {{primaryAgreement}}, together with the Common Paper AI Addendum Standard Terms Version 1.0 incorporated by reference below. Capitalized terms not defined here have the meanings given in the AI Addendum Standard Terms or the Primary Agreement. If there is any inconsistency, this Cover Page controls over the AI Addendum Standard Terms, and this Addendum controls over the Primary Agreement solely as to the subject matter of AI.

## Key Terms

Effective Date: {{effectiveDate}}

Provider: {{provider}}

Customer: {{customer}}

Primary Agreement: {{primaryAgreement}}

AI feature covered: {{aiFeature}}

Training on Customer Data: {{trainingRights}}.

Human oversight: {{humanOversight}}

Governing Law: {{governingLaw}}.

## Incorporation of the Standard Terms

The parties incorporate by reference the Common Paper AI Addendum Standard Terms Version 1.0, posted at https://commonpaper.com/standards/ai-addendum/. The Standard Terms are not reproduced or modified in this document; each party should read them in full at that link before signing. By signing below, each party agrees to this Cover Page and the incorporated AI Addendum Standard Terms as a supplement to the Primary Agreement.

## Signatures

PROVIDER: {{provider}}

Signature: {{sigA}}   Date: {{sigDateA}}

Print Name: {{sigNameA}}   Title: {{sigTitleA}}

CUSTOMER: {{customer}}

Signature: {{sigB}}   Date: {{sigDateB}}

Print Name: {{sigNameB}}   Title: {{sigTitleB}}

${AI_FOOTER}`,
  },
];

export function getDocument(id) {
  return DOCUMENTS.find((d) => d.id === id) || null;
}
