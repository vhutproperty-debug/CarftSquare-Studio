import type { ComplexLink, Contact, Interaction, OpsTask, UnitLink, UnitRecord } from '@/lib/ops/contacts/types';
import { FAR_DATE } from '@/lib/ops/contacts/types';

export type ContactUnitView = {
  linkId: string;
  unitId: string;
  complex: string;
  tower: string;
  flat: string;
  relation: UnitLink['relation'];
  agreementStart: string;
  agreementEnd: string;
  tel?: undefined;
};

export type ContactView = Contact & {
  phonesTel: string[];
  complexes: Array<{ id: string; complex: string }>;
  units: ContactUnitView[];
  nearestAgreementEnd: string | null;
};

export function presentContact(
  contact: Contact,
  complexLinks: ComplexLink[],
  unitLinks: UnitLink[],
  units: UnitRecord[],
): ContactView {
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  return {
    ...contact,
    phonesTel: contact.phones.map((phone) => `tel:${phone}`),
    nearestAgreementEnd: contact.nearestAgreementEnd === FAR_DATE ? null : contact.nearestAgreementEnd,
    complexes: complexLinks.map((link) => ({ id: link.id, complex: link.complex })),
    units: unitLinks.map((link) => {
      const unit = byId.get(link.unitId);
      return {
        linkId: link.id,
        unitId: link.unitId,
        complex: unit?.complex || '',
        tower: unit?.tower || '',
        flat: unit?.flat || '',
        relation: link.relation,
        agreementStart: link.agreementStart,
        agreementEnd: link.agreementEnd,
      };
    }),
  };
}

export function presentInteraction(interaction: Interaction) {
  return interaction;
}

export function presentTask(task: OpsTask) {
  return task;
}
