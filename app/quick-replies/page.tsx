import { getStore } from '@/lib/store';
import TriggerManager from '@/components/TriggerManager';
import {
  createTriggerAction,
  updateTriggerAction,
  deleteTriggerAction,
} from '@/app/actions';

export const dynamic = 'force-dynamic';

export default async function QuickRepliesPage() {
  const store = getStore();
  let triggers: Awaited<ReturnType<typeof store.listTriggers>> = [];
  let storeError: string | null = null;
  try {
    triggers = await store.listTriggers();
  } catch (err) {
    storeError = (err as Error).message;
  }

  return (
    <div>
      <div className="page-head">
        <h1>Quick Replies</h1>
        <p>
          Simple keyword → reply automations. Evaluated top to bottom,
          first match wins. Visual flows are checked <em>before</em> these, so
          use quick replies for the simple cases.
        </p>
      </div>

      <section className="card">
        {storeError ? (
          <div className="warn">Could not load triggers: {storeError}</div>
        ) : (
          <TriggerManager
            initial={triggers}
            createAction={createTriggerAction}
            updateAction={updateTriggerAction}
            deleteAction={deleteTriggerAction}
          />
        )}
      </section>

      <div className="info small">
        <strong>Tip:</strong> “Private reply (comment → DM)” is the classic
        growth flow — someone comments <strong>LINK</strong> on your post and
        instantly gets the link in their DMs.
      </div>
    </div>
  );
}
