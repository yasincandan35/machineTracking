/**
 * Tek Ünite Yazdırma - A4 Dikey
 * Sol: Set Değerleri (verilerle)
 * Sağ: Gerçek Değerler (sadece başlıklar)
 */

export const printSingleUnit = (unitData, slotNumber, machineName, jobName) => {
  // DR Blade ve Açısı değerlerini ekrandan oku
  const cards = document.querySelectorAll('[draggable="true"]');
  let drBladeValue = '-';
  let drBladeAngleValue = '-';
  
  cards.forEach(card => {
    // Kartın içindeki tüm div'leri kontrol et ve "Ünite X" yazan metni bul
    const allDivs = card.querySelectorAll('div');
    let cardTitle = null;
    
    for (const div of allDivs) {
      const text = div.textContent?.trim();
      if (text && text.startsWith('Ünite ') && text.length < 20) { // Sadece başlık, uzun içerik değil
        cardTitle = text;
        break;
      }
    }
    
    console.log('Card title:', cardTitle, '| Looking for: Ünite', slotNumber);
    
    if (cardTitle && cardTitle === `Ünite ${slotNumber}`) {
      console.log('✓ Found card for Ünite', slotNumber);
      
      // DR Blade
      const bladeSelect = card.querySelector('.blade-select');
      console.log('  blade-select:', bladeSelect ? 'VAR' : 'YOK', '| value:', bladeSelect?.value);
      if (bladeSelect && bladeSelect.value) {
        drBladeValue = bladeSelect.options[bladeSelect.selectedIndex].text;
        console.log('  → DR Blade:', drBladeValue);
      }
      
      // DR Blade Açısı
      const angleInputs = card.querySelectorAll('.blade-angle-input');
      const angleSelects = card.querySelectorAll('.blade-angle-select');
      console.log('  angle-inputs:', angleInputs.length, '| angle-selects:', angleSelects.length);
      
      if (angleInputs.length === 2) {
        // Lemanic 1: V-H
        const v = angleInputs[0].value || '-';
        const h = angleInputs[1].value || '-';
        drBladeAngleValue = `V: ${v} - H: ${h}`;
        console.log('  → DR Blade Açısı (V-H):', drBladeAngleValue);
      } else if (angleSelects.length === 2) {
        // Lemanic 2/3: X-Y select
        const x = angleSelects[0].value || '-';
        const y = angleSelects[1].value || '-';
        drBladeAngleValue = x && y && x !== '' && y !== '' ? `${x} - ${y}` : '-';
        console.log('  → DR Blade Açısı (X-Y):', drBladeAngleValue);
      }
    }
  });
  
  console.log('Final values - DR Blade:', drBladeValue, '| DR Blade Açısı:', drBladeAngleValue);
  
  // UnitData'ya ekle
  unitData.drBlade = drBladeValue;
  unitData.drBladeAngle = drBladeAngleValue;
  // Print container oluştur
  const printContainer = document.createElement('div');
  printContainer.id = 'single-unit-print';
  printContainer.style.cssText = 'background: white;';
  
  // Sol: Set Değerleri
  const leftCard = createUnitCard(unitData, 'Set Değerleri', true);
  
  // Sağ: Gerçek Değerler
  const rightCard = createUnitCard(unitData, 'Gerçek Değerler', false);
  
  // Wrapper - yan yana
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display: flex; gap: 40px; justify-content: center; align-items: flex-start; padding: 40px; background: white;';
  
  // Header - iki satırlı
  const header = document.createElement('div');
  header.style.cssText = 'text-align: center; margin-bottom: 30px; background: white;';
  
  const headerLine1 = document.createElement('div');
  headerLine1.style.cssText = 'font-size: 24px; font-weight: bold; color: #333; margin-bottom: 8px;';
  headerLine1.textContent = `${machineName} - Ünite ${slotNumber}`;
  
  const headerLine2 = document.createElement('div');
  headerLine2.style.cssText = 'font-size: 20px; font-weight: 600; color: #555;';
  headerLine2.textContent = jobName || 'İŞİN ADI';
  
  header.appendChild(headerLine1);
  header.appendChild(headerLine2);
  
  const content = document.createElement('div');
  content.style.cssText = 'display: flex; flex-direction: column; align-items: center; background: white;';
  content.appendChild(header);
  
  const cardsWrapper = document.createElement('div');
  cardsWrapper.style.cssText = 'display: flex; gap: 40px; background: white;';
  cardsWrapper.appendChild(leftCard);
  cardsWrapper.appendChild(rightCard);
  
  content.appendChild(cardsWrapper);
  printContainer.appendChild(content);
  document.body.appendChild(printContainer);
  
  // Print CSS
  const style = document.createElement('style');
  style.id = 'single-unit-print-style';
  style.textContent = `
    @media print {
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      
      @page {
        size: A4 portrait;
        margin: 10mm;
      }
      
      html, body {
        background: white !important;
      }
      
      body > *:not(#single-unit-print) {
        display: none !important;
      }
      
      #single-unit-print {
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
        min-height: 100vh !important;
        background: white !important;
      }
      
      /* Checkbox'ları görünür yap */
      input[type="checkbox"] {
        display: inline-block !important;
        -webkit-appearance: checkbox !important;
        appearance: checkbox !important;
      }
    }
  `;
  document.head.appendChild(style);
  
  // Print
  setTimeout(() => {
    window.print();
    setTimeout(() => {
      printContainer.remove();
      style.remove();
    }, 100);
  }, 100);
};

// Kart oluşturma helper
const createUnitCard = (unitData, cardTitle, withData) => {
  const card = document.createElement('div');
  card.style.cssText = `
    background: white;
    border: 2px solid #333;
    border-radius: 8px;
    padding: 20px;
    width: 320px;
    min-height: 870px;
    display: flex;
    flex-direction: column;
  `;
  
  // Başlık
  const title = document.createElement('div');
  title.style.cssText = 'font-size: 20px; font-weight: 700; color: #333; margin-bottom: 20px; text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px;';
  title.textContent = cardTitle;
  card.appendChild(title);
  
  // Kategoriler container - sabit yükseklik
  const categoriesContainer = document.createElement('div');
  categoriesContainer.style.cssText = 'height: 580px; background: white;';
  
  // Kategoriler
  const categories = [
    { label: 'RENK', value: unitData.renk, showInReal: true },
    { label: 'SİLİNDİR', value: unitData.silindir, showInReal: true },
    { label: 'MÜREKKEP', value: unitData.murekkep, showInReal: true },
    { label: 'VİZKOZİTE', value: unitData.vizkozite, showInReal: false },
    { label: 'SOLVENT', value: unitData.solvent, showInReal: false },
    { label: 'MEDIUM', value: unitData.medium, showInReal: true },
    { label: 'TONER', value: unitData.toner, showInReal: true },
    { label: 'DR. BLADE', value: unitData.drBlade || '-', showInReal: false },
    { label: 'DR. BLADE AÇISI', value: unitData.drBladeAngle || '-', showInReal: false }
  ];
  
  categories.forEach(cat => {
    const catDiv = document.createElement('div');
    catDiv.style.cssText = 'background: white; border-radius: 4px; padding: 10px; margin-bottom: 8px; border: 1px solid #333; height: 70px; display: flex; flex-direction: column; justify-content: space-between;';
    
    // Label container
    const labelContainer = document.createElement('div');
    labelContainer.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 6px;';
    
    // Gerçek Değerler kartında checkbox mantığı
    if (!withData) {
      if (!cat.showInReal) {
        // VİZKOZİTE, SOLVENT, DR. BLADE, DR. BLADE AÇISI → Boş checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = false;  // ⬜ Boş checkbox
        checkbox.style.cssText = 'width: 16px; height: 16px; cursor: pointer; flex-shrink: 0;';
        labelContainer.appendChild(checkbox);
      } else {
        // RENK, SİLİNDİR, MÜREKKEP, MEDIUM, TONER → Checkbox yok ama spacer ekle (hizalama)
        const spacer = document.createElement('div');
        spacer.style.cssText = 'width: 16px; flex-shrink: 0;';
        labelContainer.appendChild(spacer);
      }
    }
    
    const label = document.createElement('div');
    label.style.cssText = 'font-size: 11px; font-weight: 700; color: #000; text-transform: uppercase; letter-spacing: 0.5px;';
    label.textContent = cat.label;
    labelContainer.appendChild(label);
    
    const value = document.createElement('div');
    value.style.cssText = 'font-size: 13px; color: #000; font-weight: 400; min-height: 22px; border-bottom: 2px solid #999; padding-bottom: 4px;';
    
    // Set Değerleri (sol) → tüm veriler
    // Gerçek Değerler (sağ) → sadece showInReal:true olanlar
    if (withData) {
      value.textContent = cat.value || '-';
    } else if (cat.showInReal) {
      value.textContent = cat.value || '-';
    } else {
      value.textContent = '';
    }
    
    catDiv.appendChild(labelContainer);
    catDiv.appendChild(value);
    categoriesContainer.appendChild(catDiv);
  });
  
  card.appendChild(categoriesContainer);
  
  // Gerçek Değerler kartı için alt not ekle (en alta sabit) - checkbox checked
  if (!withData) {
    const noteContainer = document.createElement('div');
    noteContainer.style.cssText = 'margin-top: auto; padding: 12px; background: white; border: 1px solid #ddd; border-radius: 6px; display: flex; align-items: center; gap: 8px;';
    
    const noteCheckbox = document.createElement('input');
    noteCheckbox.type = 'checkbox';
    noteCheckbox.checked = true;  // ✅ Dolu checkbox
    noteCheckbox.style.cssText = 'width: 16px; height: 16px; cursor: pointer; flex-shrink: 0; accent-color: #10b981;';
    
    const noteText = document.createElement('div');
    noteText.style.cssText = 'font-size: 11px; color: #333; font-weight: 600; line-height: 1.4;';
    noteText.textContent = '* Herhangi bir değişim yok ise kutuyu işaretleyiniz';
    
    noteContainer.appendChild(noteCheckbox);
    noteContainer.appendChild(noteText);
    card.appendChild(noteContainer);
  } else {
    // Sol kart için boş spacer (aynı yüksekliği korumak için)
    const spacer = document.createElement('div');
    spacer.style.cssText = 'margin-top: auto; height: 44px;'; // note container ile aynı yükseklik
    card.appendChild(spacer);
  }
  
  return card;
};

/**
 * Tüm Üniteleri Sırayla Yazdırma
 * Her ünite için printSingleUnit fonksiyonunu çağırır
 */
export const printAllUnits = (activeUnits, machineName, jobName) => {
  if (!activeUnits || activeUnits.length === 0) {
    alert('Yazdırılacak ünite bulunamadı!');
    return;
  }

  // Her ünite için DR Blade ve DR Blade Açısı değerlerini ekrandan oku
  const cards = document.querySelectorAll('[draggable="true"]');
  const unitsWithBladeData = activeUnits.map(unit => {
    const updatedUnit = { ...unit };
    
    cards.forEach(card => {
      const allDivs = card.querySelectorAll('div');
      let cardTitle = null;
      
      for (const div of allDivs) {
        const text = div.textContent?.trim();
        if (text && text.startsWith('Ünite ') && text.length < 20) {
          cardTitle = text;
          break;
        }
      }
      
      if (cardTitle && cardTitle === `Ünite ${unit.slotNumber}`) {
        // DR Blade
        const bladeSelect = card.querySelector('.blade-select');
        if (bladeSelect && bladeSelect.value) {
          updatedUnit.drBlade = bladeSelect.options[bladeSelect.selectedIndex].text;
        }
        
        // DR Blade Açısı
        const angleInputs = card.querySelectorAll('.blade-angle-input');
        const angleSelects = card.querySelectorAll('.blade-angle-select');
        
        if (angleInputs.length === 2) {
          // Lemanic 1: V-H
          const v = angleInputs[0].value || '-';
          const h = angleInputs[1].value || '-';
          updatedUnit.drBladeAngle = `V: ${v} - H: ${h}`;
        } else if (angleSelects.length === 2) {
          // Lemanic 2/3: X-Y select
          const x = angleSelects[0].value || '';
          const y = angleSelects[1].value || '';
          updatedUnit.drBladeAngle = x && y && x !== '' && y !== '' ? `${x} - ${y}` : '-';
        }
      }
    });
    
    return updatedUnit;
  });

  // Tüm üniteleri tek bir print container'da topla
  const printContainer = document.createElement('div');
  printContainer.id = 'all-units-print';
  printContainer.style.cssText = 'background: white;';

  // Her ünite için sayfa oluştur
  unitsWithBladeData.forEach((unit, index) => {
    // Sayfa wrapper - her ünite ayrı sayfa
    const pageWrapper = document.createElement('div');
    pageWrapper.className = 'print-page';
    pageWrapper.style.cssText = `
      background: white;
      page-break-after: always;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
    `;

    // Son sayfa için page-break-after olmasın
    if (index === activeUnits.length - 1) {
      pageWrapper.style.pageBreakAfter = 'avoid';
    }

    // Sol: Set Değerleri
    const leftCard = createUnitCard(unit, 'Set Değerleri', true);
    
    // Sağ: Gerçek Değerler
    const rightCard = createUnitCard(unit, 'Gerçek Değerler', false);

    // Header - iki satırlı
    const header = document.createElement('div');
    header.style.cssText = 'text-align: center; margin-bottom: 30px; background: white;';
    
    const headerLine1 = document.createElement('div');
    headerLine1.style.cssText = 'font-size: 24px; font-weight: bold; color: #333; margin-bottom: 8px;';
    headerLine1.textContent = `${machineName} - Ünite ${unit.slotNumber}`;
    
    const headerLine2 = document.createElement('div');
    headerLine2.style.cssText = 'font-size: 20px; font-weight: 600; color: #555;';
    headerLine2.textContent = jobName || 'İŞİN ADI';
    
    header.appendChild(headerLine1);
    header.appendChild(headerLine2);

    // Content wrapper
    const content = document.createElement('div');
    content.style.cssText = 'display: flex; flex-direction: column; align-items: center; background: white;';
    content.appendChild(header);

    // Cards wrapper - yan yana
    const cardsWrapper = document.createElement('div');
    cardsWrapper.style.cssText = 'display: flex; gap: 40px; background: white;';
    cardsWrapper.appendChild(leftCard);
    cardsWrapper.appendChild(rightCard);
    
    content.appendChild(cardsWrapper);
    pageWrapper.appendChild(content);
    printContainer.appendChild(pageWrapper);
  });

  document.body.appendChild(printContainer);

  // Print CSS
  const style = document.createElement('style');
  style.id = 'all-units-print-style';
  style.textContent = `
    @media print {
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      
      @page {
        size: A4 portrait;
        margin: 10mm;
      }
      
      html, body {
        background: white !important;
      }
      
      body > *:not(#all-units-print) {
        display: none !important;
      }
      
      #all-units-print {
        display: block !important;
        background: white !important;
      }

      .print-page {
        page-break-after: always !important;
        min-height: 100vh !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }

      .print-page:last-child {
        page-break-after: avoid !important;
      }
      
      /* Checkbox'ları görünür yap */
      input[type="checkbox"] {
        display: inline-block !important;
        -webkit-appearance: checkbox !important;
        appearance: checkbox !important;
      }
    }
  `;
  document.head.appendChild(style);

  // Print
  setTimeout(() => {
    window.print();
    setTimeout(() => {
      printContainer.remove();
      style.remove();
    }, 100);
  }, 100);
};
