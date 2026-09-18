import PipelineBoard from "@/pages/chief/ChiefPipeline";

/**
 * The PM's own leads.
 *
 * Same board as the chief's, inside the PM shell. The backend already scopes
 * the pipeline to `assigned_pm_user_id = me` for a PM on both the read and the
 * two write paths, so this needs no filtering of its own - it would only be a
 * second, drift-prone opinion about who may see what.
 */
export default function PMPipeline() {
  return <PipelineBoard role="pm" />;
}
