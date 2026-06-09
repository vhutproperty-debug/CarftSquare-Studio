'use client';

const PROPERTY_PURPOSE_CARDS = [
  {
    value: '🏠 I will live here (Own Residence)',
    emoji: '🏡',
    title: 'My Dream Home',
    description: 'Luxury, comfort and personalised interiors for my family.',
  },
  {
    value: '💼 I want to furnish it for Rental Income',
    emoji: '💰',
    title: 'Investment Property',
    description: 'Optimised furnishing strategy for rental income and ROI.',
  },
];

function formatOptionLabel(option: string) {
  return option.replace(/^[^\w]+/, '').trim() || option;
}

export default function EstimateSelectionCards({
  questionId,
  options,
  selected,
  onSelect,
  disabled,
}: {
  questionId: string;
  options: string[];
  selected?: string | null;
  onSelect: (value: string) => void;
  disabled?: boolean;
}) {
  if (questionId === 'propertyPurpose') {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {PROPERTY_PURPOSE_CARDS.map((card) => (
          <button
            key={card.value}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(card.value)}
            className={`estimate-selection-card estimate-fade-in-up group flex min-h-[160px] flex-col items-start rounded-3xl border-2 border-slate-100 bg-white p-8 text-left disabled:opacity-60 ${
              selected === card.value ? 'selected' : ''
            }`}
          >
            <span className="text-4xl">{card.emoji}</span>
            <span className="mt-5 text-lg font-black text-slate-950">{card.title}</span>
            <span className="mt-2 text-sm leading-6 text-slate-500">{card.description}</span>
          </button>
        ))}
      </div>
    );
  }

  const gridClass = options.length === 2 ? 'sm:grid-cols-2' : options.length <= 4 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div className={`grid gap-4 ${gridClass}`}>
      {options.map((option, index) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(option)}
          style={{ animationDelay: `${index * 60}ms` }}
          className={`estimate-selection-card estimate-fade-in-up flex min-h-[72px] items-center rounded-2xl border-2 border-slate-100 bg-white px-6 py-5 text-left disabled:opacity-60 ${
            selected === option ? 'selected' : ''
          }`}
        >
          <span className="text-sm font-bold leading-6 text-slate-800">{formatOptionLabel(option)}</span>
        </button>
      ))}
    </div>
  );
}
