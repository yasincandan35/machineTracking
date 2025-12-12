import React from 'react';
import { Package, CheckCircle, XCircle, Bot } from 'lucide-react';
import { getTranslation } from '../../../utils/translations';
import { useCardStyle } from '../../../hooks/useCardStyle';

export default function RobotPalletizingInfoCard({
  qualifiedBundle = 0,
  defectiveBundle = 0,
  goodPallets = 0,
  defectivePallets = 0,
  style,
  currentLanguage = 'tr',
}) {
  const cardStyle = useCardStyle(style, '140px', 'robotPalletizingInfo');

  return (
    <div className={cardStyle.className} style={cardStyle.style}>
      <div className="absolute left-3 top-3">
        <h2 className="text-base font-semibold">
          {getTranslation('robotPalletizing', currentLanguage)}
        </h2>
      </div>

      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center">
        <Bot className="w-24 h-24 text-orange-500 dark:text-orange-400 opacity-80" />
      </div>

      <div className="absolute left-3 top-1/2 -translate-y-1/2 right-44">
        <div className="grid grid-cols-2 gap-4">
          <InfoStat
            icon={<CheckCircle className="w-5 h-5 text-green-500" />}
            label={getTranslation('qualifiedBundle', currentLanguage)}
            value={qualifiedBundle}
            valueClass="text-green-600 dark:text-green-400"
          />
          <InfoStat
            icon={<XCircle className="w-5 h-5 text-red-500" />}
            label={getTranslation('defectiveBundle', currentLanguage)}
            value={defectiveBundle}
            valueClass="text-red-600 dark:text-red-400"
          />
          <InfoStat
            icon={<Package className="w-5 h-5 text-blue-500" />}
            label={getTranslation('goodPallets', currentLanguage)}
            value={goodPallets}
            valueClass="text-blue-600 dark:text-blue-400"
          />
          <InfoStat
            icon={<Package className="w-5 h-5 text-orange-500" />}
            label={getTranslation('defectivePallets', currentLanguage)}
            value={defectivePallets}
            valueClass="text-orange-600 dark:text-orange-400"
          />
        </div>
      </div>
    </div>
  );
}

function InfoStat({ icon, label, value, valueClass }) {
  return (
    <div className="flex items-start gap-2">
      {icon}
      <div className="min-w-0">
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{label}</p>
        <p className={`text-xl font-bold ${valueClass}`}>{value.toLocaleString()}</p>
      </div>
    </div>
  );
}
