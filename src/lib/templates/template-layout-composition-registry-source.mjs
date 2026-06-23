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

export const initialBillingLetterMergeCodeReadinessContract = Object.freeze({
  "phase": "Templates Phase 18A",
  "templateId": "initial-billing-letter",
  "templateName": "Initial Billing Letter",
  "documentKind": "letter",
  "layoutDependency": "letterhead-simple",
  "matterScope": "individual",
  "testMatterFileNumber": "BRL_202600003",
  "generationWired": false,
  "storageCallsAllowed": false,
  "clioCallsAllowed": false,
  "docxImportAllowedInThisPhase": false,
  "legacyTokenInventory": [
    "<<BALANCE_AMOUNT>>",
    "<<CASE_ID>>",
    "<<DOS_END>>",
    "<<DOS_START>>",
    "<<INJUREDPARTY_NAME>>",
    "<<INSURANCECOMPANY_LOCAL_CITY>>",
    "<<INSURANCECOMPANY_LOCAL_STATE>>",
    "<<INSURANCECOMPANY_LOCAL_ZIP>>",
    "<<INS_CLAIM_NUMBER>>",
    "<<NOWDT>>",
    "<<PROVIDER_SUITNAME>>"
  ],
  "requiredStandardTokens": [
    "letter.date",
    "insurer.name",
    "insurer.mailingAddress",
    "provider.name",
    "patient.name",
    "claim.number",
    "claim.amount",
    "claim.dosRange",
    "matter.fileNumber"
  ],
  "replacementMappings": [
    {
      "legacy": [
        "<<NOWDT>>"
      ],
      "standard": [
        "letter.date"
      ]
    },
    {
      "legacy": [
        "<<INSURANCECOMPANY_LOCAL_CITY>>",
        "<<INSURANCECOMPANY_LOCAL_STATE>>",
        "<<INSURANCECOMPANY_LOCAL_ZIP>>"
      ],
      "standard": [
        "insurer.name",
        "insurer.mailingAddress"
      ]
    },
    {
      "legacy": [
        "<<PROVIDER_SUITNAME>>"
      ],
      "standard": [
        "provider.name"
      ]
    },
    {
      "legacy": [
        "<<INJUREDPARTY_NAME>>"
      ],
      "standard": [
        "patient.name"
      ]
    },
    {
      "legacy": [
        "<<INS_CLAIM_NUMBER>>"
      ],
      "standard": [
        "claim.number"
      ]
    },
    {
      "legacy": [
        "<<BALANCE_AMOUNT>>"
      ],
      "standard": [
        "claim.amount"
      ]
    },
    {
      "legacy": [
        "<<DOS_START>>",
        "<<DOS_END>>"
      ],
      "standard": [
        "claim.dosRange"
      ]
    },
    {
      "legacy": [
        "<<CASE_ID>>"
      ],
      "standard": [
        "matter.fileNumber"
      ]
    }
  ]
});

export const initialBillingLetterDocxImportGateContract = Object.freeze({
  "phase": "Templates Phase 18B",
  "templateId": "initial-billing-letter",
  "templateName": "Initial Billing Letter",
  "documentKind": "letter",
  "matterScope": "individual",
  "sourceDocxPath": "templates/docx/incoming/Initial Billing Letter.docx",
  "committedDocxPath": "templates/docx/letters/initial-billing-letter.docx",
  "layoutDependency": "letterhead-simple",
  "testMatterFileNumber": "BRL_202600003",
  "generationWired": false,
  "storageCallsAllowed": false,
  "clioCallsAllowed": false,
  "normalizedVisibleTextRequired": true,
  "legacyTokensAllowedUntilTransformPhase": true,
  "legacyTokenInventory": [
    "<<BALANCE_AMOUNT>>",
    "<<CASE_ID>>",
    "<<DOS_END>>",
    "<<DOS_START>>",
    "<<INJUREDPARTY_NAME>>",
    "<<INSURANCECOMPANY_LOCAL_CITY>>",
    "<<INSURANCECOMPANY_LOCAL_STATE>>",
    "<<INSURANCECOMPANY_LOCAL_ZIP>>",
    "<<INS_CLAIM_NUMBER>>",
    "<<NOWDT>>",
    "<<PROVIDER_SUITNAME>>"
  ],
  "requiredStandardTokens": [
    "letter.date",
    "insurer.name",
    "insurer.mailingAddress",
    "provider.name",
    "patient.name",
    "claim.number",
    "claim.amount",
    "claim.dosRange",
    "matter.fileNumber"
  ],
  "requiredVisiblePhrases": [
    "Barshay, Rizzo & Lopez",
    "Provider:",
    "Patient:",
    "Claim No.:",
    "Amount:",
    "Date of Service:",
    "Our File Number:",
    "Dear Sir or Madam"
  ],
  "docxXmlPartCount": 1,
  "visibleTextCharacterCount": 2442,
  "docxSha256": "ebab9d0c1dfa15526f620d18810b06f51b92d8ab0389c5885a86a43a2ded4580"
});

export const hiddenFieldMergeSourceMappingContract = Object.freeze({
  "phase": "Templates Phase 18D",
  "contractName": "Hidden Field Merge-Source Mapping Contract",
  "generationWired": false,
  "storageCallsAllowed": false,
  "clioCallsAllowed": false,
  "dbMutationAllowed": false,
  "hiddenFieldsMustBeMappable": true,
  "requiredCapabilities": [
    "Discover hidden/import JSON fields from relevant source tables.",
    "Expose hidden fields as selectable merge sources when a template requires them.",
    "Preserve full source path provenance for every hidden field.",
    "Allow hidden fields to be composed into higher-level merge fields.",
    "Fail readiness when a required hidden field source is missing.",
    "Keep hidden-field mapping read-only during template dry-runs."
  ],
  "canonicalHiddenFieldPathSyntax": {
    "jsonPathStyle": "Table.column.path.to.field",
    "example": "ReferenceEntity.details._hiddenImportFields.hidden_street"
  },
  "knownHiddenFieldSources": [
    {
      "sourceTable": "ReferenceEntity",
      "sourceColumn": "details",
      "jsonRoot": "_hiddenImportFields",
      "entityType": "insurer_company",
      "sourceRole": "insurer",
      "fields": [
        {
          "path": "ReferenceEntity.details._hiddenImportFields.hidden_street",
          "mergeUse": "insurer.mailingAddress.line1"
        },
        {
          "path": "ReferenceEntity.details._hiddenImportFields.hidden_city",
          "mergeUse": "insurer.mailingAddress.city"
        },
        {
          "path": "ReferenceEntity.details._hiddenImportFields.hidden_state",
          "mergeUse": "insurer.mailingAddress.state"
        },
        {
          "path": "ReferenceEntity.details._hiddenImportFields.hidden_zipcode",
          "mergeUse": "insurer.mailingAddress.zip"
        },
        {
          "path": "ReferenceEntity.details._hiddenImportFields.hidden_website",
          "mergeUse": "insurer.website"
        },
        {
          "path": "ReferenceEntity.details._hiddenImportFields.hidden_domicile",
          "mergeUse": "insurer.domicile"
        },
        {
          "path": "ReferenceEntity.details._hiddenImportFields.hidden_group_name",
          "mergeUse": "insurer.groupName"
        },
        {
          "path": "ReferenceEntity.details._hiddenImportFields.hidden_naic_number",
          "mergeUse": "insurer.naicNumber"
        }
      ]
    }
  ],
  "composedMergeSources": [
    {
      "mergeCode": "insurer.mailingAddress",
      "sourcePaths": [
        "ReferenceEntity.details._hiddenImportFields.hidden_street",
        "ReferenceEntity.details._hiddenImportFields.hidden_city",
        "ReferenceEntity.details._hiddenImportFields.hidden_state",
        "ReferenceEntity.details._hiddenImportFields.hidden_zipcode"
      ],
      "format": "street newline city comma state space zipcode",
      "phase18CTestValue": "3100 Sanders Road, Suite 201\nNorthbrook, Illinois 60062"
    }
  ],
  "phase18CContinuity": {
    "templateId": "initial-billing-letter",
    "testMatterFileNumber": "BRL_202600003",
    "insurerName": "Allstate Indemnity Company",
    "source": "ReferenceEntity.details._hiddenImportFields",
    "resolvedAddress": "3100 Sanders Road, Suite 201\nNorthbrook, Illinois 60062"
  }
});
