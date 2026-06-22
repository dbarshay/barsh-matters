export type GraphDraftMaildropResolution = {
  clioMaildropEmail: string;
  clioMaildropLabel: string;
  formattedCc: string;
  source: "deprecated-clio-maildrop";
} | null;

export async function resolveMaildropForGraphDraftMatterId(_matterId: unknown): Promise<GraphDraftMaildropResolution> {
  return null;
}
