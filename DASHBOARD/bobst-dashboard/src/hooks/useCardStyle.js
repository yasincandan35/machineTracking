import { useTheme } from '../contexts/ThemeContext';
import { cardHeights, calculateCardHeight } from '../utils/cardMappings';

export const useCardStyle = (customStyle = {}, minHeight = '120px', cardKey = null) => {
  const { isLiquidGlass } = useTheme();

  // Kart anahtarı varsa otomatik yükseklik hesapla
  let finalMinHeight = minHeight;
  if (cardKey && cardHeights[cardKey]) {
    finalMinHeight = cardHeights[cardKey];
  } else if (cardKey && cardKey.includes('Info')) {
    // Info kartları için varsayılan 1 satır yüksekliği
    finalMinHeight = cardHeights.default;
  }

  const baseClassName = isLiquidGlass 
    ? `relative glass-card p-4 transition-all duration-300 ease-in-out`
    : `relative rounded-xl shadow-md shadow-bottom-cards p-4 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 hover:shadow-lg hover:scale-[1.01] transition-all duration-300 ease-in-out`;

  const style = isLiquidGlass ? { minHeight: finalMinHeight } : { ...customStyle, minHeight: finalMinHeight };

  return {
    className: baseClassName,
    style: style
  };
};
