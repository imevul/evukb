export function parseSseEvents(
  payload: string,
  eventName?: string,
): Array<{ event: string; data: string }> {
  const events: Array<{ event: string; data: string }> = [];
  const blocks = payload.split('\n\n');

  for (const block of blocks) {
    if (!block.trim()) {
      continue;
    }

    let event = 'message';
    const dataLines: string[] = [];

    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) {
        event = line.slice('event:'.length).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trim());
      }
    }

    if (dataLines.length === 0) {
      continue;
    }

    if (eventName && event !== eventName) {
      continue;
    }

    events.push({ event, data: dataLines.join('\n') });
  }

  return events;
}
