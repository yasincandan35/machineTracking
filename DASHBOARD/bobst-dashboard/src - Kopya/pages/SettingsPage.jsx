import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useColor } from '../contexts/ColorContext';
import { Palette, Monitor, Save, RotateCcw } from 'lucide-react';
import { getTranslation } from '../utils/translations';

const SettingsPage = ({ currentLanguage = 'tr' }) => {
  const { user } = useAuth();
  const { colorSettings, saveColorSettings, resetToDefault, defaultColors } = useColor();
  const [activeTab, setActiveTab] = useState('personalization');
  const [localColorSettings, setLocalColorSettings] = useState(colorSettings);
  const [isLoading, setIsLoading] = useState(false);

  // Renk tercihlerini kaydet
  const saveColorPreferences = async () => {
    setIsLoading(true);
    const success = await saveColorSettings(localColorSettings);
    if (success) {
      alert(getTranslation('colorPreferencesSaved', currentLanguage));
    } else {
      alert(getTranslation('colorPreferencesNotSaved', currentLanguage));
    }
    setIsLoading(false);
  };

  // Varsayılan renklere dön
  const handleResetToDefault = async () => {
    setLocalColorSettings(defaultColors);
    await resetToDefault();
  };

  const handleColorChange = (key, value) => {
    setLocalColorSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">{getTranslation('settings', currentLanguage)}</h1>
      
      {/* Tab menüsü */}
      <div className="flex border-b mb-6">
        <button
          onClick={() => setActiveTab('personalization')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'personalization'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <Palette className="inline w-4 h-4 mr-2" />
          {getTranslation('personalization', currentLanguage)}
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'system'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <Monitor className="inline w-4 h-4 mr-2" />
          {getTranslation('system', currentLanguage)}
        </button>
      </div>

      {/* Kişiselleştirme sekmesi */}
      {activeTab === 'personalization' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">{getTranslation('colorSettings', currentLanguage)}</h2>
            <p className="text-gray-600 mb-4">
              {getTranslation('colorSettingsDescription', currentLanguage)}
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Arkaplan */}
              <div>
                <label className="block text-sm font-medium mb-2">{getTranslation('backgroundColor', currentLanguage)}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={localColorSettings.background}
                    onChange={(e) => handleColorChange('background', e.target.value)}
                    className="w-12 h-10 border rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={localColorSettings.background}
                    onChange={(e) => handleColorChange('background', e.target.value)}
                    className="flex-1 px-3 py-2 border rounded"
                    placeholder="#f8fafc"
                  />
                </div>
              </div>

              {/* Info Kartları */}
              <div>
                <label className="block text-sm font-medium mb-2">{getTranslation('infoCards', currentLanguage)}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={localColorSettings.infoCard}
                    onChange={(e) => handleColorChange('infoCard', e.target.value)}
                    className="w-12 h-10 border rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={localColorSettings.infoCard}
                    onChange={(e) => handleColorChange('infoCard', e.target.value)}
                    className="flex-1 px-3 py-2 border rounded"
                    placeholder="#ffffff"
                  />
                </div>
              </div>

              {/* Grafik Kartları */}
              <div>
                <label className="block text-sm font-medium mb-2">{getTranslation('graphCards', currentLanguage)}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={localColorSettings.graphCard}
                    onChange={(e) => handleColorChange('graphCard', e.target.value)}
                    className="w-12 h-10 border rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={localColorSettings.graphCard}
                    onChange={(e) => handleColorChange('graphCard', e.target.value)}
                    className="flex-1 px-3 py-2 border rounded"
                    placeholder="#ffffff"
                  />
                </div>
              </div>

              {/* Sidebar */}
              <div>
                <label className="block text-sm font-medium mb-2">{getTranslation('sidebar', currentLanguage)}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={localColorSettings.sidebar}
                    onChange={(e) => handleColorChange('sidebar', e.target.value)}
                    className="w-12 h-10 border rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={localColorSettings.sidebar}
                    onChange={(e) => handleColorChange('sidebar', e.target.value)}
                    className="flex-1 px-3 py-2 border rounded"
                    placeholder="#1f2937"
                  />
                </div>
              </div>

              {/* Metin Rengi */}
              <div>
                <label className="block text-sm font-medium mb-2">{getTranslation('textColor', currentLanguage)}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={localColorSettings.text}
                    onChange={(e) => handleColorChange('text', e.target.value)}
                    className="w-12 h-10 border rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={localColorSettings.text}
                    onChange={(e) => handleColorChange('text', e.target.value)}
                    className="flex-1 px-3 py-2 border rounded"
                    placeholder="#1f2937"
                  />
                </div>
              </div>

              {/* Vurgu Rengi */}
              <div>
                <label className="block text-sm font-medium mb-2">{getTranslation('accentColor', currentLanguage)}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={localColorSettings.accent}
                    onChange={(e) => handleColorChange('accent', e.target.value)}
                    className="w-12 h-10 border rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={localColorSettings.accent}
                    onChange={(e) => handleColorChange('accent', e.target.value)}
                    className="flex-1 px-3 py-2 border rounded"
                    placeholder="#3b82f6"
                  />
                </div>
              </div>
            </div>

            {/* Butonlar */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={saveColorPreferences}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isLoading ? getTranslation('saving', currentLanguage) : getTranslation('save', currentLanguage)}
              </button>
              <button
                onClick={handleResetToDefault}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                <RotateCcw className="w-4 h-4" />
                {getTranslation('default', currentLanguage)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sistem sekmesi */}
      {activeTab === 'system' && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">{getTranslation('systemSettings', currentLanguage)}</h2>
          <p className="text-gray-600">{getTranslation('systemSettingsDescription', currentLanguage)}</p>
        </div>
      )}
    </div>
  );
};

export default SettingsPage; 