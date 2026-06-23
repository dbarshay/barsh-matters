export const templateLayoutCompositionRegistrySource = {
  mergeFieldDefinitions: {
    "addressee.address": { label: "addressee.address" },
    "addressee.fax": { label: "addressee.fax" },
    "addressee.name": { label: "addressee.name" },
    "caption.defendant": { label: "caption.defendant" },
    "caption.indexNumber": { label: "caption.indexNumber" },
    "caption.plaintiff": { label: "caption.plaintiff" },
    "court.county": { label: "court.county" },
    "court.name": { label: "court.name" },
    "fax.pageCount": { label: "fax.pageCount" },
    "firm.address": { label: "firm.address" },
    "firm.fax": { label: "firm.fax" },
    "firm.name": { label: "firm.name" },
    "firm.phone": { label: "firm.phone" },
    "letter.reLine": { label: "letter.reLine" },
    "matter.amountClaimed": { label: "matter.amountClaimed" },
    "matter.claimNumber": { label: "matter.claimNumber" },
    "matter.dateOfLoss": { label: "matter.dateOfLoss" },
    "matter.insurerName": { label: "matter.insurerName" },
    "matter.patientName": { label: "matter.patientName" },
    "matter.providerName": { label: "matter.providerName" },
    "signer.email": { label: "signer.email" },
    "signer.extension": { label: "signer.extension" },
    "signer.fax": { label: "signer.fax" },
    "signer.name": { label: "signer.name" },
  },

  "templates": [
    {
      "templateId": "template-letterhead-demand-letter",
      "templateName": "Demand Letter With Letterhead",
      "templateKind": "letter",
      "layoutComposition": {
        "mode": "single",
        "assets": [
          {
            "role": "letterhead",
            "assetKey": "barsh-letterhead-standard",
            "required": true,
            "appliesTo": "firstPage",
            "mergeFieldPolicy": "requiresTemplateFields"
          }
        ],
        "outputOrder": [
          "letterhead"
        ]
      },
    templateFile: {
      kind: "docx",
      path: "templates/docx/template-letterhead-demand-letter.docx",
      required: true,
    },
    expectedMergeFields: [
          "firm.name",
          "firm.address",
          "firm.phone",
          "firm.fax",
          "signer.name",
          "signer.email",
          "signer.extension",
          "signer.fax",
          "addressee.name",
          "addressee.address",
          "matter.patientName",
          "matter.providerName",
          "matter.insurerName",
          "matter.claimNumber",
          "matter.dateOfLoss",
          "letter.reLine"
    ],
},
    {
      "templateId": "template-pleading-summons-complaint",
      "templateName": "Summons and Complaint With Pleading Paper",
      "templateKind": "pleading",
      "layoutComposition": {
        "mode": "single",
        "assets": [
          {
            "role": "pleadingPaper",
            "assetKey": "ny-supreme-pleading-standard",
            "required": true,
            "appliesTo": "bodyOnly",
            "mergeFieldPolicy": "requiresWorkflowFields"
          }
        ],
        "outputOrder": [
          "pleadingPaper"
        ]
      },
    templateFile: {
      kind: "docx",
      path: "templates/docx/template-pleading-summons-complaint.docx",
      required: true,
    },
    expectedMergeFields: [
          "court.name",
          "court.county",
          "caption.plaintiff",
          "caption.defendant",
          "caption.indexNumber",
          "matter.patientName",
          "matter.providerName",
          "matter.insurerName",
          "matter.claimNumber",
          "matter.amountClaimed",
          "signer.name"
    ],
},
    {
      "templateId": "template-fax-cover-and-letter",
      "templateName": "Simple Cover/Fax Page With Letter",
      "templateKind": "fax-letter",
      "layoutComposition": {
        "mode": "composed",
        "assets": [
          {
            "role": "simpleCoverFaxPage",
            "assetKey": "barsh-simple-cover-fax-standard",
            "required": true,
            "appliesTo": "coverOnly",
            "mergeFieldPolicy": "requiresWorkflowFields"
          },
          {
            "role": "letterhead",
            "assetKey": "barsh-letterhead-standard",
            "required": true,
            "appliesTo": "firstPage",
            "mergeFieldPolicy": "requiresTemplateFields"
          }
        ],
        "outputOrder": [
          "simpleCoverFaxPage",
          "letterhead"
        ]
      },
    templateFile: {
      kind: "docx",
      path: "templates/docx/template-fax-cover-and-letter.docx",
      required: true,
    },
    expectedMergeFields: [
          "firm.name",
          "firm.phone",
          "firm.fax",
          "signer.name",
          "signer.email",
          "signer.extension",
          "signer.fax",
          "addressee.name",
          "addressee.fax",
          "matter.patientName",
          "matter.providerName",
          "matter.claimNumber",
          "letter.reLine",
          "fax.pageCount"
    ],
},
    {
      "templateId": "template-pleading-with-letterhead",
      "templateName": "Pleading Packet With Letterhead",
      "templateKind": "pleading-packet",
      "layoutComposition": {
        "mode": "composed",
        "assets": [
          {
            "role": "letterhead",
            "assetKey": "barsh-letterhead-standard",
            "required": true,
            "appliesTo": "firstPage",
            "mergeFieldPolicy": "requiresTemplateFields"
          },
          {
            "role": "pleadingPaper",
            "assetKey": "ny-supreme-pleading-standard",
            "required": true,
            "appliesTo": "bodyOnly",
            "mergeFieldPolicy": "requiresWorkflowFields"
          }
        ],
        "outputOrder": [
          "letterhead",
          "pleadingPaper"
        ]
      },
    templateFile: {
      kind: "docx",
      path: "templates/docx/template-pleading-with-letterhead.docx",
      required: true,
    },
    expectedMergeFields: [
          "firm.name",
          "firm.address",
          "firm.phone",
          "firm.fax",
          "court.name",
          "court.county",
          "caption.plaintiff",
          "caption.defendant",
          "caption.indexNumber",
          "matter.patientName",
          "matter.providerName",
          "matter.insurerName",
          "matter.claimNumber",
          "matter.amountClaimed",
          "signer.name",
          "signer.email",
          "signer.extension",
          "signer.fax"
    ],
}
  ],
  "registry": {
    "layoutAssets": [
      {
        "role": "letterhead",
        "assetKey": "barsh-letterhead-standard",
        "active": true,
        "label": "Barsh Law standard letterhead",
        "appliesTo": "firstPage",
        "requiredMergeFields": [
          "signer.email",
          "signer.extension",
          "signer.fax"
        ]
      },
      {
        "role": "pleadingPaper",
        "assetKey": "ny-supreme-pleading-standard",
        "active": true,
        "label": "New York Supreme Court pleading paper",
        "appliesTo": "bodyOnly",
        "requiredMergeFields": [
          "court.name",
          "caption.plaintiff",
          "caption.defendant"
        ]
      },
      {
        "role": "simpleCoverFaxPage",
        "assetKey": "barsh-simple-cover-fax-standard",
        "active": true,
        "label": "Simple cover/fax page",
        "appliesTo": "coverOnly",
        "requiredMergeFields": [
          "fax.to",
          "fax.number"
        ]
      }
    ],
    "allowedCompositions": [
      {
        "roles": [
          "letterhead"
        ]
      },
      {
        "roles": [
          "pleadingPaper"
        ]
      },
      {
        "roles": [
          "simpleCoverFaxPage"
        ]
      },
      {
        "roles": [
          "letterhead",
          "pleadingPaper"
        ]
      },
      {
        "roles": [
          "letterhead",
          "simpleCoverFaxPage"
        ]
      },
      {
        "roles": [
          "pleadingPaper",
          "simpleCoverFaxPage"
        ]
      },
      {
        "roles": [
          "letterhead",
          "pleadingPaper",
          "simpleCoverFaxPage"
        ]
      }
    ],
    "mergeFieldDefinitions": [
      {
        "key": "signer.email"
      },
      {
        "key": "signer.extension"
      },
      {
        "key": "signer.fax"
      },
      {
        "key": "addressee.name"
      },
      {
        "key": "re.line"
      },
      {
        "key": "court.name"
      },
      {
        "key": "caption.plaintiff"
      },
      {
        "key": "caption.defendant"
      },
      {
        "key": "fax.to"
      },
      {
        "key": "fax.number"
      }
    ]
  }
};
