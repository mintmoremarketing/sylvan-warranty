// Standard e-warranty certificate text, as provided in Sylvan's brief (pp. 24–30, 44–47).

const ARBITRATION =
  "The customer/end-user agrees that any claims, disputes, or differences arising out of or relating to the terms herein shall be resolved through arbitration before a sole arbitrator appointed by Sylvan Plyboard (India) Limited. The customer/end-user must accept these terms without any reservations. The arbitration shall be governed by the provisions of the Arbitration and Conciliation Act, 1996, as amended from time to time. The arbitrator’s decision shall be final, conclusive, and binding on both parties. The arbitration proceedings shall be conducted in English, and any award rendered will be in English. The venue for arbitration shall be Kolkata, and the courts in Kolkata shall have exclusive jurisdiction over any related matters, to the exclusion of all other courts."

const PLY_EXCLUSIONS = [
  "Natural calamities including hailstorms, earthquakes, fires, floods, tornadoes, or any other Acts of God;",
  "Improper or abnormal use, including exposure to excessive moisture, such as circumstances where the products are placed in close proximity to water, standing water, or where the moisture content exceeds 15%, in line with BIS norms or applicable standards, due to improper installation or other reasons;",
  "Damage resulting from improper storage, handling, machining, joinery, or other mechanical, or chemical, or any other form of treatment. Sylvan Ply products must not be used alongside other plywood / blockboard / flush door types, similar panel products, or untreated timber for furnishing;",
  "Damage resulting from water seepage, rot, or decay caused by the presence of moisture in the building/area where the products are used;",
  "Impact damage from foreign objects;",
  "Incidental, consequential, or accidental damage arising from its use, negligence, mishandling, or use under the influence of alcohol or any other prescription medication not prescribed by a medical practitioner, by the end user or their agents; this warranty does not cover any commercial or economic loss, including but not limited to any direct, incidental, or consequential loss associated therewith;",
  "Use of products for purposes other than originally intended and sold;",
  "Natural wear and tear or damage due to abnormal use, lack of maintenance, severely pest-infested environments, or poor workmanship;",
  "Damage caused by factors beyond Sylvan Ply’s control;",
  "Sylvan Ply will only consider claims for the replacement of the damaged material itself. No monetary claims for the damaged products or any portion thereof shall be entertained for any expenses incurred in relation to the removal of the defective or damaged products; the re-installation of the replacement material; any associated labour charges; or any costs pertaining to the replacement or repair of the frame, structure, or hardware supporting the products;",
  "Breach of warranty terms or failure to exercise reasonable care in assembly, inspection, or maintenance by the purchaser or any other party;",
  "Contamination or infection resulting from additional materials such as overlays, adhesives, or fillers;",
  "Sylvan Ply applies specialised chemical treatments to its products to enhance resistance; however, the warranty against borer and termite attacks on plywood is limited solely to the replacement of the portion of material actually damaged. No other claims, including monetary or incidental damages, will be entertained;",
]

const COMMON_PLY_TERMS = (exclusionClause: string, extraBefore: string[] = []) => [
  "This warranty is extended exclusively to the original purchaser of Sylvan Ply’s products and is strictly non-transferable.",
  "The products must be purchased only from authorised dealers or sub-dealers of Sylvan Ply.",
  "To be eligible for warranty coverage, customers must register their warranty certificate within 30 days of purchase by submitting the purchase invoice and required details via our official website at www.sylvanply.com.",
  `This warranty is valid only in cases of manufacturing defects, if a complaint or request for replacement is made within 30 days from the date of purchase. Sylvan Ply will replace the defective products, if any, subject to the exclusions specified in ${exclusionClause}.`,
  ...extraBefore,
  "This warranty excludes any incidental or consequential costs, including but not limited to conversion costs into finished products or expenses related to paints, lacquer, polish, hardware, laminates, veneer, fittings, varnish, or other complementary materials.",
  "Upon receipt of a complaint, Sylvan Ply will send an authorised representative to inspect the allegedly defective products at the location of use.",
  "The purchaser must provide the original proof of purchase (invoice, cash memo, etc.) issued by an authorised dealer or sub-dealer along with the duly called-in warranty certificate. The products must be verified as genuine via markings or roller impressions.",
  "The authorised representatives of Sylvan Ply will assess the nature and extent of the damage. Warranty claims are subject to verification by Sylvan Ply’s representatives to confirm that the damage is covered under the terms of the warranty.",
  "Sylvan Ply reserves the right to take samples from the damaged portion of the product and send them for physical and/or chemical examination to Sylvan Ply’s own laboratory, the National Test House, or other government-recognised laboratories.",
  "Claims will be accepted only if visual, chemical, or physical testing confirms a genuine manufacturing defect in Sylvan Ply products.",
  "Any modifications, repairs, or alterations made by the end-user to the products will void this warranty.",
  "The final determination regarding the applicability of the warranty shall be made by Sylvan Ply after thorough verification. Replacement will be carried out only if the damage falls within the scope of the warranty.",
  "This certificate may be issued based on verbal confirmation from authorised dealers/sub-dealers. The company may request supporting documents at its discretion, and failure to provide them may result in denial of the warranty.",
]

export type CertificateTerms = { intro: string; coveredProducts?: string[]; terms: string[]; exclusions?: string[] }

export const STANDARD_TERMS: Record<"LIFETIME" | "STD_710" | "WPC", CertificateTerms> = {
  LIFETIME: {
    intro:
      "Sylvan Plyboard (India) Limited (hereinafter referred to as “Sylvan Ply”) is committed to delivering quality and reliability. Accordingly, it provides a warranty on its plywood and blockboard (collectively referred to as “Products”) from the date of manufacture, subject to the terms and conditions as outlined herewith. We are confident that our products will offer you trouble-free performance. In the event of any issue, you may present this warranty certificate along with proof of purchase to our authorised dealer/sub-dealer for assistance.",
    coveredProducts: [
      "Z plus premium plus plywood and blockboard",
      "Z plus premium plywood and blockboard",
      "Premium club plywood and blockboard",
      "Elite plus plywood and blockboard",
      "Oceanic premium club plywood and blockboard",
      "Robusta premium plus plywood and blockboard",
    ],
    terms: [
      ...COMMON_PLY_TERMS("the exclusions below", [
        "The company may provide replacement solely for damage caused by swelling and corrugation resulting from manufacturing defects, up to 2.5, 5, 7.5, or 10 times per damaged sheet, depending on the product type, and only when used in the manufacture of furniture or other interior applications.",
      ]),
      ARBITRATION,
    ],
    exclusions: [...PLY_EXCLUSIONS, "For blockboard and flush door, the warranty is limited to protection against borer attacks only. This warranty is restricted to the replacement of the material actually damaged, and excludes all other forms of damage or claims;", "Use of inferior or substandard putty resulting in fungus or infestation by borers or termites."],
  },
  STD_710: {
    intro:
      "Sylvan Plyboard (India) Limited (hereinafter referred to as “Sylvan Ply”) is committed to delivering quality and reliability. Accordingly, it provides a warranty on its plywood, blockboard, and flush door (collectively referred to as “Products”) from the date of manufacture, subject to the terms and conditions outlined below. We are confident that our products will offer you trouble-free performance. In the event of any issue, you may present this warranty certificate along with proof of purchase to our authorised dealer/sub-dealer for assistance.",
    coveredProducts: [
      "Primo plus plywood and blockboard",
      "Robusta premium plywood and blockboard",
      "BLU BWP plywood and blockboard",
      "Robusta BWP plywood and blockboard",
      "Gateway pinewood flush door",
      "Gateway hardwood flush door",
      "Robusta mix pine flush door",
    ],
    terms: [...COMMON_PLY_TERMS("the exclusions below"), ARBITRATION],
    exclusions: [...PLY_EXCLUSIONS, "For blockboard, flush door and IS:303 BWP-grade plywood, the warranty is limited to protection against borer attacks only. This warranty is restricted to the replacement of the material actually damaged, and excludes all other forms of damage or claims;", "Use of inferior or substandard putty resulting in fungus or infestation by borers or termites."],
  },
  WPC: {
    intro:
      "Sylvan Plyboard (India) Limited (hereinafter referred to as “Sylvan Ply”) is committed to delivering quality and reliability. Accordingly, it provides a warranty on its WPC (Wood Polymer Composite) Solid Polymer Board (hereinafter referred to as “Product”), subject to the terms and conditions outlined below. In the event of any issue, you may present this warranty certificate along with proof of purchase to our authorised dealer/sub-dealer for assistance.",
    terms: [
      "The warranty is extended exclusively to the original purchaser of the Sylvan Ply’s product and is strictly non-transferable.",
      "The Product must be purchased only from authorised dealers or sub-dealers of Sylvan Ply.",
      "To be eligible for warranty coverage, customers must register their warranty certificate within 30 days of purchase by submitting the purchase invoice and required details via Sylvan Ply’s official website at www.sylvanply.com.",
      "The Company will replace the defective product, if any, subject to the exclusions below. This warranty includes damage caused by manufacturing defects; moisture and water under standard indoor conditions; and termite and borer attacks.",
      "Upon receipt of a complaint, Sylvan Ply will depute an authorised representative to inspect the allegedly defective product at the location of use.",
      "A maximum time of 30 days needs to be given to address the issue from the date of receipt of complaint.",
      "The purchaser must provide the original proof of purchase (invoice, cash memo, etc.) issued by an authorised dealer or sub-dealer along with the duly called-in warranty certificate. The Product must be verified as genuine via markings or sticker impressions.",
      "Sylvan Ply reserves the right to collect samples of the affected product for laboratory testing, either at its own facility or at any government-recognised laboratory.",
      "On satisfactory proof of the originality of the product with Sylvan Ply brand post testing, Sylvan Ply will replace equal quantity of damaged product.",
      "Non-compliance with the product care and usage instructions shall result in the forfeiture of warranty coverage: the product is designed strictly for internal use; do not use nails, acids, or harsh chemicals on the product; employ skilled professionals for any fabrication and installation; apply decorative skins on both sides; avoid storing in direct sunlight or extreme atmospheric conditions; clean only with a wet mop and mild cleaning agents.",
      "Sylvan Ply will only consider claims for the replacement of the damaged material itself. No monetary claims shall be entertained for removal, re-installation, labour, delays, indirect damage, or the frame, structure, or hardware supporting the product.",
      ARBITRATION,
    ],
    exclusions: [
      "Use of the product in exterior applications or placement in areas exposed to direct sunlight or extreme weather conditions;",
      "Improper storage, handling, or installation of the product, including failure to adhere to the care instructions;",
      "Any damage resulting from natural calamities, acts of God, or events beyond the company’s control (including but not limited to fire, floods, earthquakes, hailstorms, etc.);",
      "Use of counterfeit products or products procured through unauthorised channels;",
      "Misuse, mishandling, abuse, or improper installation of the product at any stage;",
      "Failure to present the original invoice and warranty certificate during the claim process;",
      "Consequential, incidental, or indirect damages, including but not limited to costs for removal, re-installation, labour, or replacement of frames, structures, or hardware.",
    ],
  },
}
