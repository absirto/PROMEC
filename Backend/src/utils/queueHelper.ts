import { generalQueue } from '../core/queue';

export async function addToQueue(type: string, payload: unknown) {
  if (!generalQueue) return;
  await generalQueue.add({ type, payload });
}
