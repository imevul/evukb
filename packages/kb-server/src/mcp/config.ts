/** Whether MCP registers evu.kb.ask (default false for retrieval-first agent hosts). */
export function resolveMcpEnableAsk(): boolean {
  const raw = process.env.EVUKB_MCP_ENABLE_ASK?.trim().toLowerCase();
  if (raw === undefined || raw === '') {
    return false;
  }
  return raw === '1' || raw === 'true' || raw === 'yes';
}
