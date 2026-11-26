import React from 'react';
import {
  BriefcaseBusiness,
  Calculator,
  Headset,
  Megaphone,
  SearchCheck,
  Workflow,
  Bot,
} from 'lucide-react';

interface AgentIconProps {
  icon: string;
  accentColor?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const AgentIcon: React.FC<AgentIconProps> = ({
  icon,
  accentColor = '#4563FF',
  size = 'md',
}) => {
  const IconComp =
    icon === 'BriefcaseBusiness'
      ? BriefcaseBusiness
      : icon === 'Megaphone'
        ? Megaphone
        : icon === 'SearchCheck'
          ? SearchCheck
          : icon === 'Calculator'
            ? Calculator
            : icon === 'Headset'
              ? Headset
              : icon === 'Workflow'
                ? Workflow
                : Bot;

  const boxClass =
    size === 'sm'
      ? 'w-8 h-8 rounded-lg'
      : size === 'lg'
        ? 'w-12 h-12 rounded-xl'
        : 'w-10 h-10 rounded-xl';

  const iconClass =
    size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5';

  return (
    <span
      className={`${boxClass} inline-flex items-center justify-center shrink-0 border border-black/5 dark:border-white/10`}
      style={{
        backgroundColor: `${accentColor}16`,
        color: accentColor,
      }}
      aria-hidden="true"
    >
      <IconComp className={iconClass} />
    </span>
  );
};
