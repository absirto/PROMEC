import { generalQueue } from '../services/queue';

export async function addToQueue(type: string, payload: unknown) {
  if (!generalQueue) return;
  await generalQueue.add({ type, payload });
}
