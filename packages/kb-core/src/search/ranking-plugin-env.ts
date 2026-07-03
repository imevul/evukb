export function isRankingPluginReloadEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.EVUKB_ENABLE_RANKING_PLUGIN_RELOAD === 'true';
}
