// SylvanCare+ Warranty Policy, as provided in Sylvan's brief ("Warranty all in one", pp. 5–9).

export type PolicyBlock = string | { list: string[] }
export type PolicySection = { title: string; clauses: { no: string; blocks: PolicyBlock[] }[] }

export const CARE_PLUS_POLICY: PolicySection[] = [
  {
    title: "1. Scope, applicability and coverage",
    clauses: [
      {
        no: "1.1",
        blocks: [
          "The SylvanCare+ Warranty (“SylvanCare+ Warranty”) shall be applicable to the following premium products manufactured by Sylvan Plyboard (India) Limited (“Sylvan” or “the Company”) for the respective standard warranty periods specified against each product (collectively referred to as the “Covered Products”):",
          { list: ["Z Plus Premium Ply — 15 years", "Premium Club Ply — 12 years", "Elite Plus Ply — 12 years"] },
        ],
      },
      {
        no: "1.2",
        blocks: [
          "The SylvanCare+ Warranty is applicable exclusively to the plywood products expressly listed in Clause 1.1 above and shall not apply to blockboards or any other product category unless expressly covered by Sylvan in writing.",
        ],
      },
      {
        no: "1.3",
        blocks: [
          "The SylvanCare+ Warranty shall apply prospectively to Covered Products manufactured on and after 1st October, 2026 and shall remain valid for the applicable warranty period specified in Clause 1.1 above, calculated from the date of invoice, subject to the terms and conditions contained herein.",
        ],
      },
      {
        no: "1.4",
        blocks: [
          "This SylvanCare+ Warranty is supplementary to Sylvan’s standard product warranty applicable to the relevant Covered Product and shall not replace or limit the terms thereunder.",
        ],
      },
      {
        no: "1.5",
        blocks: [
          "The SylvanCare+ Warranty shall be applicable only upon successful registration of the purchase in accordance with the following requirements:",
          {
            list: [
              "Valid proof of purchase of the Covered Product must be registered with Sylvan through the designated online warranty portal within ninety (90) days from the date of purchase.",
              "Registration within the aforesaid period of ninety (90) days is a mandatory condition precedent to availing the SylvanCare+ Warranty.",
              "Failure to complete such registration within the prescribed period of ninety (90) days shall automatically render the SylvanCare+ Warranty unenforceable in respect of such purchase.",
              "Subject to successful registration, claims under the SylvanCare+ Warranty may be made only during the applicable warranty period specified for the relevant Covered Product under Clause 1.1 above.",
            ],
          },
        ],
      },
    ],
  },
  {
    title: "2. SylvanCare+ one-time warranty coverage",
    clauses: [
      { no: "2.1", blocks: ["The benefit available under the SylvanCare+ Warranty may be claimed only once in respect of a particular purchase/invoice of Covered Products."] },
      {
        no: "2.2",
        blocks: [
          "Where an invoice includes multiple units of Covered Products:",
          {
            list: [
              "compensation shall be proportionate to the number of units of Covered Products actually found defective;",
              "any compensation towards damage to furniture or installations incorporating such Covered Products shall be governed by Clause 5.1 and determined upon inspection.",
            ],
          },
        ],
      },
      {
        no: "2.3",
        blocks: [
          "Any compensation or warranty benefit availed shall be digitally recorded in Sylvan’s internal database. No subsequent SylvanCare+ Warranty claim shall be entertained in respect of the specific quantity of Covered Products for which compensation has already been granted, and any further claim relating to the remaining purchase quantity shall be subject to separate verification and submission of valid proof of purchase and eligibility.",
        ],
      },
    ],
  },
  {
    title: "3. Warranty registration, complaint registration and inspection",
    clauses: [
      {
        no: "3.1",
        blocks: [
          "The purchaser shall register the Covered Products on Sylvan’s designated online warranty portal by providing the required details and uploading a valid proof of purchase/invoice. Upon successful submission and verification of the invoice and requisite particulars, the SylvanCare+ Warranty registration shall be recorded in Sylvan’s system, and a warranty registration confirmation/certificate shall be generated.",
        ],
      },
      {
        no: "3.2",
        blocks: [
          "Upon receipt of a warranty registration, Sylvan reserves the right to depute its Authorised Representative(s) to physically inspect the site of installation/use and/or seek relevant information to verify the number of units used, installation conditions, and compliance with applicable usage guidelines in relation to the Covered Products.",
        ],
      },
      { no: "3.3", blocks: ["Upon receipt of a complaint, Sylvan reserves the right to depute its Authorised Representative(s) to physically inspect the allegedly defective product at the site of installation/use."] },
      {
        no: "3.4",
        blocks: [
          "At the time of inspection, the homeowner/site owner shall mandatorily produce:",
          {
            list: [
              "the certificate related to the SylvanCare+ Warranty generated through Sylvan’s official warranty portal; and",
              "a valid proof of purchase verifying the purchase of Covered Products.",
            ],
          },
        ],
      },
      {
        no: "3.5",
        blocks: [
          "Any proof of purchase of Covered Products shall be subject to validation at any stage including but not limited to after the claim has been raised. If proof of purchase/usage of Covered Products is not ascertained to the satisfaction of Sylvan, the claim under the SylvanCare+ Warranty shall stand rejected.",
        ],
      },
    ],
  },
  {
    title: "4. Sampling, testing and verification",
    clauses: [
      {
        no: "4.1",
        blocks: [
          "Sylvan, at its sole discretion, reserves the unrestricted right to:",
          {
            list: [
              "verify the proof of purchase and confirm that the material in respect of which the warranty has been invoked was purchased within the applicable warranty period, prior to approving any warranty certificate or compensation claim;",
              "extract samples from the allegedly defective portion; and",
              "subject such samples to physical, chemical, and/or visual examination.",
            ],
          },
        ],
      },
      {
        no: "4.2",
        blocks: [
          "Testing may be conducted at the sole discretion of Sylvan at Sylvan’s own laboratory, or any nationally renowned or government-recognised laboratory, including but not limited to:",
          { list: ["National Test House", "Shriram Test House, Delhi", "JBS Testing Solutions Pvt. Ltd., Punjab", "Unique Test House LLP, Punjab"] },
        ],
      },
      {
        no: "4.3",
        blocks: [
          "Warranty liability under the SylvanCare+ Warranty shall arise only upon confirmation by Sylvan of:",
          {
            list: [
              "originality of the product as a genuine Sylvan product;",
              "existence of a manufacturing defect attributable solely to Covered Products or the occurrence of termite infestation, borer attack, wood fungus decay, or such other condition expressly covered under the scope of the SylvanCare+ Warranty; and",
              "the defect or complaint falling within the scope of coverage under the SylvanCare+ Warranty, as assessed and confirmed by Sylvan.",
            ],
          },
        ],
      },
    ],
  },
  {
    title: "5. Scope of SylvanCare+ warranty",
    clauses: [
      {
        no: "5.1",
        blocks: [
          "Upon confirmation by Sylvan, pursuant to inspection, testing, and verification under the SylvanCare+ Warranty, of either (a) a manufacturing defect attributable solely to the Covered Products; or (b) termite infestation, borer attack, wood fungus decay, or similar deterioration affecting the Covered Products and falling within the scope of Sylvan’s applicable product warranty coverage; and provided that such condition has not arisen due to homeowner/site owner fault, improper installation, excluded site conditions, misuse, neglect, or any other exclusion set out in the SylvanCare+ Warranty, Sylvan shall, subject to the terms herein:",
          {
            list: [
              "compensate the cost of defective or impacted sheets to the extent of the affected area of Covered Products;",
              "compensate certain ancillary costs directly attributable to the defect in accordance with Clause 5.2;",
              "where such manufacturing defect or covered termite, borer, or fungal deterioration in the Covered Products results in damage to the furniture or installation in which the Covered Products are incorporated, extend compensation, repair, or replacement only to the affected portion of such furniture or installation and only to the extent directly and reasonably attributable thereto, as determined upon inspection at Sylvan’s sole discretion.",
            ],
          },
          "For avoidance of doubt, the SylvanCare+ Warranty shall not extend to project-wide replacement or replacement of unaffected areas.",
        ],
      },
      {
        no: "5.2",
        blocks: [
          "Ancillary costs may include, at Sylvan’s sole discretion, any reasonable cost for defective products where such defects are directly attributable to the acts and omissions of Sylvan for:",
          {
            list: [
              "Laminates;",
              "Adhesives;",
              "Labour charge for fitting, removal;",
              "Transportation of Covered Products from dealer to site location;",
              "Termite/Borer Treatment;",
              "Veneers applied on/impacted by the Covered Products.",
            ],
          },
        ],
      },
      { no: "5.3", blocks: ["Any other items not mentioned above, including reusable items, shall be excluded."] },
      {
        no: "5.4",
        blocks: [
          "Compensation shall:",
          {
            list: [
              "be paid only on reasonable actuals/internal estimates benchmarked to industry standards — whichever is lower;",
              "be reasonable, verifiable and directly linked to the defective product;",
              "be assessed based on invoices submitted by the claimant, or Sylvan’s internal estimates prepared by its technical team.",
            ],
          },
        ],
      },
      {
        no: "5.5",
        blocks: [
          "No compensation shall be payable without photographic evidence, site inspection, and verification. The SylvanCare+ Warranty shall not entitle the claimant to:",
          {
            list: [
              "upgrades, redesigns, or aesthetic improvements;",
              "replacement of unaffected products or furniture;",
              "compensation beyond the scope of the original installation; or",
              "project-wide replacement or rectification disproportionate to the affected Covered Products.",
            ],
          },
        ],
      },
      {
        no: "5.6",
        blocks: [
          "Sylvan may reject the claim if the details received at the time of the claim do not match with the details shared at the time of warranty registration under Clause 1.5, which includes but is not limited to fields such as homeowner/site owner details, site address, and quantity of Covered Products used.",
        ],
      },
      {
        no: "5.7",
        blocks: [
          "The warranty can only be issued in the name of the homeowner/site owner, and only they can claim compensation under the same. Other stakeholders such as dealers, sub-dealers, contractors, carpenters, architects, interior designers, OEMs, etc., shall not be eligible to claim under the SylvanCare+ Warranty.",
        ],
      },
    ],
  },
  {
    title: "6. Compensation and ancillary cost safeguards",
    clauses: [
      {
        no: "6.1",
        blocks: [
          "Sylvan reserves the right, in relation to any compensation payable under the SylvanCare+ Warranty, including compensation for Covered Products and ancillary costs, to:",
          { list: ["reject inflated, unverifiable or unrelated claims;", "limit compensation strictly to costs proportionate to the defective quantity."] },
        ],
      },
      {
        no: "6.2",
        blocks: [
          "If fraud, misrepresentation, an incorrect GSTIN, forged invoices, or misinformation is detected at any stage, zero compensation shall be payable, and the claim shall stand rejected.",
        ],
      },
    ],
  },
  {
    title: "7. Verification of product and usage",
    clauses: [
      {
        no: "7.1",
        blocks: [
          "Sylvan reserves the right to verify:",
          {
            list: [
              "that the impacted product is genuinely manufactured by Sylvan; and",
              "that the damaged area corresponds exactly to the location where Covered Products were used.",
            ],
          },
        ],
      },
      { no: "7.2", blocks: ["This verification shall apply particularly where branding is not visible due to lamination, painting, or veneering."] },
    ],
  },
  {
    title: "8. Invoice and documentation requirements",
    clauses: [
      {
        no: "8.1",
        blocks: [
          "For registration and claims, invoices must:",
          {
            list: [
              "clearly specify the Covered Product name, quantity and description; and",
              "be issued by authorised dealers or any other person who has been specifically authorised by Sylvan or any person approved at the sole discretion of Sylvan.",
            ],
          },
        ],
      },
      {
        no: "8.2",
        blocks: [
          "Sylvan reserves the absolute right and sole discretion to reject claims arising from:",
          { list: ["invalid, unverifiable, altered, and/or manipulated invoices;", "invoices issued by unauthorised parties."] },
        ],
      },
    ],
  },
  {
    title: "9. Site conditions, installation and workmanship exclusions",
    clauses: [
      {
        no: "9.1",
        blocks: [
          "Claims under the SylvanCare+ Warranty shall be rejected and shall not apply where damage is attributable, directly or indirectly, to the following:",
          {
            list: [
              "moisture content exceeding BIS-prescribed limits;",
              "exposure to water, seepage, damp or flooded conditions;",
              "bending, warping, or distortion within BIS-prescribed limits;",
              "improper storage, stacking, handling, transportation after delivery, or lack of adequate ventilation;",
              "poor workmanship, improper installation, faulty application, or non-compliance with recommended installation practices, including incorrect framing or inadequate structural support; improper screw/nail selection or fixing methods; improper alignment, levelling, or joint treatment; use of incompatible adhesives, chemicals, polishes, laminates, coatings, or finishes; cutting, resizing, grooving, drilling, or modification contrary to manufacturer guidelines; failure to follow prescribed sealing or surface protection procedures;",
              "normal wear and tear;",
              "abnormal or improper use after purchase;",
              "use with untreated timber or other brands, where damage is attributable thereto;",
              "independent warranties or representations made by dealers or third parties;",
              "fire, accidental fire incidents, electrical short circuits, external heat exposure, or any other external hazard or force majeure event, except where a manufacturing defect independent of such event is conclusively established;",
              "use of the covered products for exterior or outdoor applications. The covered products are intended for interior use only and are not designed for prolonged exposure to rainwater, standing water, or direct sunlight.",
            ],
          },
        ],
      },
      {
        no: "9.2",
        blocks: ["Such issues shall be treated as site-related, installation-related, usage-related, or maintenance-related issues and shall not constitute manufacturing defects under the SylvanCare+ Warranty."],
      },
      {
        no: "9.3",
        blocks: [
          "For the avoidance of doubt, any damage, variation, or deviation in respect of parameters for which permissible limits are prescribed under the applicable Bureau of Indian Standards (BIS) specifications shall, to the extent it remains within such prescribed limits, be treated as acceptable and shall not constitute a manufacturing defect or entitle the claimant to any remedy under the SylvanCare+ Warranty.",
        ],
      },
      {
        no: "9.4",
        blocks: ["Without prejudice to Clause 1.2 above, the SylvanCare+ Warranty shall not apply to blockboards or to any product not expressly identified as a Covered Product under Clause 1.1."],
      },
    ],
  },
  {
    title: "10. Mixed-brand usage",
    clauses: [
      {
        no: "10.1",
        blocks: [
          "Sylvan shall not be liable for any damage or defect unless such damage or defect is conclusively established, upon inspection, to have originated from the Covered Products manufactured by Sylvan, and compensation shall be limited to the extent the Covered Products are impacted or responsible for the resulting damage.",
        ],
      },
      {
        no: "10.2",
        blocks: ["At a site where multiple products of a similar nature from other manufacturers or brands have been used along with the Covered Products, Sylvan reserves the right to reject the claim."],
      },
    ],
  },
  {
    title: "11. Limitation of liability",
    clauses: [
      {
        no: "11.1",
        blocks: [
          "Sylvan shall not be responsible for:",
          {
            list: [
              "indirect, incidental or consequential losses, other than ancillary costs covered under Clause 5.2;",
              "loss of profits, business interruption, or aesthetic dissatisfaction.",
            ],
          },
        ],
      },
      { no: "11.2", blocks: ["Sylvan’s liability is strictly limited to what is expressly covered under the SylvanCare+ Warranty."] },
    ],
  },
  {
    title: "12. Cooperation and good faith",
    clauses: [
      {
        no: "12.1",
        blocks: [
          "Failure to comply with any of the following requirements shall render the SylvanCare+ Warranty null and void:",
          { list: ["cooperate during inspection;", "permit sampling or testing; or", "provide accurate information."] },
        ],
      },
    ],
  },
  {
    title: "13. Final authority",
    clauses: [
      {
        no: "13.1",
        blocks: [
          "Subject to applicable law, the Company's determination regarding:",
          { list: ["identification of the alleged defect;", "quantum of compensation; and", "acceptance or rejection of the claim,"] },
          "shall be final and binding.",
        ],
      },
    ],
  },
  {
    title: "14. Governing law and jurisdiction",
    clauses: [
      { no: "14.1", blocks: ["The SylvanCare+ Warranty shall be governed by and construed in accordance with the laws of India."] },
      { no: "14.2", blocks: ["Any dispute shall be subject to the exclusive jurisdiction of courts at Kolkata, West Bengal."] },
    ],
  },
]

export const COVERED_SUMMARY = [
  "Cost of defective or impacted sheets, for the affected area",
  "Termite infestation, borer attack and wood fungus decay",
  "Ancillary costs: laminates, adhesives, labour for fitting and removal, transport from dealer to site, termite/borer treatment, and veneers",
  "Repair or replacement of the affected portion of furniture built with the covered sheets",
]

export const NOT_COVERED_SUMMARY = [
  "Blockboards and any product not listed as a covered product",
  "Water, seepage, damp or flooded conditions, or moisture above BIS limits",
  "Poor workmanship, improper installation, or incompatible adhesives and finishes",
  "Improper storage, handling or ventilation after delivery",
  "Normal wear and tear, misuse, fire or other external hazards",
  "Exterior or outdoor use, and mixing with other brands or untreated timber",
  "Upgrades, redesigns, or replacing unaffected areas",
]

/** The landing page's "covers" grid: COVERED_SUMMARY split into its individual benefits, same wording. */
export const COVERED_ITEMS = [
  "Defective or impacted sheets",
  "Termite and borer attack",
  "Wood fungus decay",
  "Laminates",
  "Adhesives",
  "Labour for fitting and removal",
  "Transport from dealer to site",
  "Termite / borer treatment",
  "Veneers",
  "Furniture repair or replacement",
]

/** Short forms of NOT_COVERED_SUMMARY for the landing page; the policy page has the full wording. */
export const NOT_COVERED_SHORT = [
  "Blockboards and products not listed as covered",
  "Water, seepage, damp or flooding",
  "Poor workmanship or improper installation",
  "Improper storage, handling or ventilation",
  "Wear and tear, misuse or fire",
  "Outdoor use, or mixing with other brands",
  "Upgrades or replacing unaffected areas",
]
