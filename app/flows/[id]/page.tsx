import { notFound } from 'next/navigation';
import { getStore } from '@/lib/store';
import FlowBuilder from '@/components/FlowBuilder';

export const dynamic = 'force-dynamic';

export default async function FlowEditorPage({
  params,
}: {
  params: { id: string };
}) {
  const flow = await getStore().getFlow(params.id);
  if (!flow) notFound();

  return <FlowBuilder initialFlow={flow} />;
}
