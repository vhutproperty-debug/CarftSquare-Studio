import OpsShell from '@/components/ops/OpsShell';
import WhatsAppInbox from '@/components/ops/whatsapp/WhatsAppInbox';

export default function OpsWhatsAppPage() {
  return (
    <OpsShell
      title="WhatsApp Inbox"
      subtitle="Interakt conversations linked to CraftSquare demand and supply records."
      workspace
      pipelineStage="demand"
    >
      <WhatsAppInbox />
    </OpsShell>
  );
}
